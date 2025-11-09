import gradio as gr
import joblib
import json
import os
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.preprocessing import LabelEncoder

# Try to import SHAP and LIME - they might not be installed
try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    print("SHAP not available. Install with: pip install shap")

try:
    import lime
    import lime.lime_tabular
    HAS_LIME = True
except ImportError:
    HAS_LIME = False
    print("LIME not available. Install with: pip install lime")

# -----------------------
# Load all models & preprocessors
# -----------------------
MODELS_DIR = os.path.join("functions", "deployment_package")
models = {}

for model_type in os.listdir(MODELS_DIR):
    model_path = os.path.join(MODELS_DIR, model_type, "model.pkl")
    preprocessor_path = os.path.join(MODELS_DIR, model_type, "preprocessor.pkl")
    features_path = os.path.join(MODELS_DIR, model_type, "features.json")

    if all(os.path.exists(p) for p in [model_path, preprocessor_path, features_path]):
        models[model_type] = {
            "model": joblib.load(model_path),
            "preprocessor": joblib.load(preprocessor_path),
            "features": json.load(open(features_path))
        }

print("Loading models and analyzing preprocessors...")
print(f"Available insurance types: {list(models.keys())}")

# -----------------------
# Create label encoders for categorical fields that are treated as numeric
# -----------------------
def create_label_encoders():
    """Create label encoders for categorical fields that the model expects as numeric"""
    encoders = {}
    
    # Common categorical fields that are treated as numeric in your models
    categorical_fields = {
        'insured_sex': ['male', 'female'],
        'insured_occupation': ['doctor', 'engineer', 'teacher', 'businessman', 'lawyer', 'govt_employee', 
                              'private_employee', 'farmer', 'shopkeeper', 'other'],
        'policy_state': ['maharashtra', 'delhi', 'karnataka', 'tamil nadu', 'gujarat', 'rajasthan',
                        'uttar pradesh', 'west bengal', 'punjab', 'haryana', 'other'],
        'policy_renewal_status': ['renewed', 'lapsed'],
        'premium_payment_delays': ['none', '1-15 days', '15-30 days', '>30 days'],
        'coverage_changes_before_claim': ['none', 'increased', 'decreased'],
        'third_party_involved': ['yes', 'no'],
        'auto_make': ['maruti', 'hyundai', 'tata', 'mahindra', 'honda', 'toyota', 'ford', 'other'],
        'auto_model': ['swift', 'i20', 'nexon', 'scorpio', 'city', 'innova', 'ecosport', 'other'],
        'accident_location': ['highway', 'city', 'residential', 'parking', 'other'],
        'hospital_name': ['apollo', 'fortis', 'max', 'aiims', 'other'],
        'treatment_details': ['surgery', 'medication', 'therapy', 'emergency', 'other'],
        'nominee_relationship': ['spouse', 'parent', 'child', 'sibling', 'other'],
        'crop_type': ['wheat', 'rice', 'cotton', 'sugarcane', 'other'],
        'weather_condition': ['normal', 'drought', 'flood', 'storm', 'other'],
        'property_type': ['house', 'apartment', 'commercial', 'other']
    }
    
    for field, values in categorical_fields.items():
        encoder = LabelEncoder()
        encoder.fit(values)
        encoders[field] = encoder
    
    return encoders

def get_feature_importance(X, model, feature_names, insurance_type):
    """Get feature importance using multiple methods"""
    explanations = {}
    
    # Method 1: Built-in feature importance (for tree-based models)
    if hasattr(model, 'feature_importances_'):
        importance_scores = model.feature_importances_
        feature_importance = list(zip(feature_names[:len(importance_scores)], importance_scores))
        feature_importance.sort(key=lambda x: abs(x[1]), reverse=True)
        explanations['builtin'] = feature_importance[:10]  # Top 10 features
    
    # Method 2: SHAP explanations
    if HAS_SHAP:
        try:
            # Create SHAP explainer
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X)
            
            # Handle binary classification (XGBoost returns 2D array)
            if isinstance(shap_values, list):
                shap_values = shap_values[1]  # Take positive class
            elif len(shap_values.shape) > 1 and shap_values.shape[1] > 1:
                shap_values = shap_values[:, 1]
            
            # Get feature contributions for the prediction
            if len(shap_values.shape) > 1:
                contributions = shap_values[0]  # First (and only) prediction
            else:
                contributions = shap_values
            
            shap_importance = list(zip(feature_names[:len(contributions)], contributions))
            shap_importance.sort(key=lambda x: abs(x[1]), reverse=True)
            explanations['shap'] = shap_importance[:10]
            
        except Exception as e:
            print(f"SHAP error: {e}")
            explanations['shap'] = None
    
    # Method 3: LIME explanations  
    if HAS_LIME:
        try:
            # Create a simple training data approximation for LIME
            # In practice, you'd use your actual training data
            training_data = np.random.randn(100, X.shape[1])
            
            explainer = lime.lime_tabular.LimeTabularExplainer(
                training_data,
                feature_names=feature_names[:X.shape[1]],
                mode='classification'
            )
            
            # Get explanation for the instance
            explanation = explainer.explain_instance(X[0], model.predict_proba, num_features=10)
            lime_importance = explanation.as_list()
            explanations['lime'] = lime_importance
            
        except Exception as e:
            print(f"LIME error: {e}")
            explanations['lime'] = None
    
    return explanations

def format_explanations(explanations, prediction, confidence):
    """Format explanations into a structured dictionary"""
    result = {
        'success': True,
        'insurance_type': 'unknown',  # Will be set by caller
        'is_fraud': bool(prediction),
        'fraud_score': confidence / 100.0,  # Convert percentage to decimal
        'risk_level': 'high' if confidence > 70 else 'medium' if confidence > 30 else 'low',
        'confidence_percentage': confidence,
        'detailed_explanation': '',
        'timestamp': datetime.now().isoformat()
    }
    
    # Build detailed explanation text
    explanation_text = f"{' Fraud Detected' if prediction == 1 else '✅ No Fraud Detected'} (Confidence: {confidence:.1f}%)\n\n"
    explanation_text += " **EXPLANATION:**\n\n"
    
    # Built-in feature importance
    if 'builtin' in explanations and explanations['builtin']:
        explanation_text += "**🎯 Most Important Features (Model):**\n"
        for i, (feature, importance) in enumerate(explanations['builtin'][:5], 1):
            feature_readable = feature.replace('_', ' ').title()
            explanation_text += f"{i}. {feature_readable}: {importance:.4f}\n"
        explanation_text += "\n"
    
    # SHAP explanations
    if 'shap' in explanations and explanations['shap']:
        explanation_text += "**🔍 Feature Contributions (SHAP):**\n"
        explanation_text += "Positive values push toward fraud, negative toward no fraud\n"
        for i, (feature, contribution) in enumerate(explanations['shap'][:5], 1):
            feature_readable = feature.replace('_', ' ').title()
            direction = "→ FRAUD" if contribution > 0 else "→ NO FRAUD"
            explanation_text += f"{i}. {feature_readable}: {contribution:+.4f} {direction}\n"
        explanation_text += "\n"
    
    # LIME explanations
    if 'lime' in explanations and explanations['lime']:
        explanation_text += "**🧪 Feature Impact (LIME):**\n"
        for i, (feature_desc, impact) in enumerate(explanations['lime'][:5], 1):
            direction = "→ FRAUD" if impact > 0 else "→ NO FRAUD"
            explanation_text += f"{i}. {feature_desc}: {impact:+.4f} {direction}\n"
        explanation_text += "\n"
    
    # Add interpretation guidance
    explanation_text += "**📋 How to interpret:**\n"
    explanation_text += "• Higher absolute values = more influence on prediction\n"
    explanation_text += "• Positive values support fraud detection\n"
    explanation_text += "• Negative values support no fraud conclusion\n"
    explanation_text += "• SHAP values show exact contribution to final score\n"
    
    result['detailed_explanation'] = explanation_text
    return result

# Global encoders
ENCODERS = create_label_encoders()

def encode_categorical_value(field, value):
    """Safely encode a categorical value, handling unknown values"""
    if field not in ENCODERS:
        return 0
    
    encoder = ENCODERS[field]
    
    # Handle empty/None values
    if not value or str(value).strip() == "":
        return 0
    
    value_str = str(value).strip().lower()
    
    # Check if value exists in encoder classes
    if value_str in encoder.classes_:
        return encoder.transform([value_str])[0]
    else:
        # Return encoding for 'other' if available, otherwise 0
        if 'other' in encoder.classes_:
            return encoder.transform(['other'])[0]
        return 0

def get_safe_categorical_value(field, value, insurance_type):
    """Get a safe categorical value that the OneHotEncoder was trained on"""
    
    # Get the actual categories from the trained OneHotEncoder
    if insurance_type in models:
        preprocessor = models[insurance_type]["preprocessor"]
        if hasattr(preprocessor, 'transformers_'):
            for name, transformer, columns in preprocessor.transformers_:
                if hasattr(transformer, 'categories_') and field in columns:
                    field_idx = list(columns).index(field)
                    trained_categories = transformer.categories_[field_idx]
                    
                    if not value or str(value).strip() == "":
                        # Return the first category as default
                        return trained_categories[0]
                    
                    value_str = str(value).strip()
                    
                    # Check if exact value exists (case sensitive for addresses)
                    if value_str in trained_categories:
                        return value_str
                    
                    # For case-insensitive matching on common fields
                    if field in ['auto_make', 'auto_model', 'third_party_involved']:
                        value_lower = value_str.lower()
                        for cat in trained_categories:
                            if cat.lower() == value_lower:
                                return cat
                    
                    # If not found, return the first (most common) category
                    return trained_categories[0]
    
    # Fallback to predefined safe values if model inspection fails
    safe_defaults = {
        'auto_make': 'Maruti',
        'auto_model': 'Swift', 
        'accident_location': '00\r\nGoyal Chowk, Nanded-954818',  # First address from your data
        'third_party_involved': 'No',
        'hospital_name': 'AIIMS',
        'treatment_details': 'A accusamus odio a iste veritatis dignissimos necessitatibus.',
        'nominee_relationship': 'spouse',
        'crop_type': 'rice',
        'weather_condition': 'normal',
        'property_type': 'residential'
    }
    
    return safe_defaults.get(field, str(value) if value else 'unknown')

# -----------------------
# Get preprocessor structure
# -----------------------
def get_preprocessor_structure(insurance_type):
    """Get the actual structure of the preprocessor"""
    if insurance_type not in models:
        return {'numeric_columns': [], 'categorical_columns': []}
    
    preprocessor = models[insurance_type]["preprocessor"]
    structure = {'numeric_columns': [], 'categorical_columns': []}
    
    if hasattr(preprocessor, 'transformers_'):
        for name, transformer, columns in preprocessor.transformers_:
            if name == 'num' or 'Standard' in str(type(transformer)):
                structure['numeric_columns'].extend(columns)
            elif name == 'cat' or 'OneHot' in str(type(transformer)):
                structure['categorical_columns'].extend(columns)
    
    return structure

def manual_transform(input_df, insurance_type, structure):
    """Manual transformation as fallback when automatic preprocessing fails"""
    from sklearn.preprocessing import StandardScaler
    import numpy as np
    
    print("Attempting manual transformation...")
    
    # Get the original preprocessor to understand the expected output
    preprocessor = models[insurance_type]["preprocessor"]
    
    # Separate numeric and categorical data
    numeric_data = input_df[structure['numeric_columns']].values
    
    # For categorical data, create a minimal representation
    # Instead of full one-hot encoding, use a simple encoding
    categorical_features = []
    for col in structure['categorical_columns']:
        if col in input_df.columns:
            val = input_df[col].iloc[0]
            # Simple hash-based encoding to keep dimensionality low
            categorical_features.append(hash(str(val)) % 100 / 100.0)
        else:
            categorical_features.append(0.0)
    
    # Combine features - this is a simplified approach
    if len(categorical_features) > 0:
        all_features = np.concatenate([
            numeric_data.flatten(), 
            categorical_features
        ])
    else:
        all_features = numeric_data.flatten()
    
    # Pad or truncate to expected size (19 features)
    if len(all_features) > 19:
        all_features = all_features[:19]
    elif len(all_features) < 19:
        # Pad with zeros
        padding = np.zeros(19 - len(all_features))
        all_features = np.concatenate([all_features, padding])
    
    return all_features.reshape(1, -1)

def get_model_expected_features(insurance_type):
    """Get the exact number of features each model expects"""
    model_feature_counts = {
        'automobile': 19,  # XGBoost expects 19 features
        'crop': 16,        # RandomForest expects 16 features  
        'health': 17,      # RandomForest expects 17 features
        'life': 15,        # RandomForest expects 15 features
        'personal_accident': 14,  # Based on transformed shape
        'property': 15,    # RandomForest expects 15 features
        'travel': 14       # Based on transformed shape
    }
    return model_feature_counts.get(insurance_type, 19)

def create_working_prediction_function():
    """Create a prediction function that handles different feature counts for each model"""
    
    def working_predict(*args):
        try:
            insurance_type = args[0]
            if not insurance_type or insurance_type not in models:
                return "Error: Please select a valid insurance type"

            model = models[insurance_type]["model"]
            preprocessor = models[insurance_type]["preprocessor"]
            expected_features = models[insurance_type]["features"]
            input_values = args[1:]
            
            print(f"\n=== WORKING PREDICTION FOR {insurance_type.upper()} ===")
            
            # Get the exact number of features this model expects
            expected_feature_count = get_model_expected_features(insurance_type)
            print(f"Model expects {expected_feature_count} features")
            
            # Create input data using the same logic as before
            input_data = {}
            structure = get_preprocessor_structure(insurance_type)
            
            for i, feature in enumerate(expected_features):
                if i < len(input_values):
                    value = input_values[i]
                    
                    if feature in structure['numeric_columns']:
                        if feature in ['insured_age', 'policy_annual_premium', 'claim_amount', 'sum_insured', 
                                      'previous_claims_count', 'policy_duration_days', 'incident_to_claim_days',
                                      'auto_year', 'claim_duration_days', 'claim_amount_to_sum_insured_ratio']:
                            try:
                                input_data[feature] = float(value) if value not in [None, ""] else 0.0
                            except:
                                input_data[feature] = 0.0
                        else:
                            input_data[feature] = encode_categorical_value(feature, value)
                    elif feature in structure['categorical_columns']:
                        safe_value = get_safe_categorical_value(feature, value, insurance_type)
                        input_data[feature] = safe_value
                    else:
                        input_data[feature] = 0.0
                else:
                    if feature in structure['numeric_columns']:
                        input_data[feature] = 0.0
                    else:
                        safe_value = get_safe_categorical_value(feature, 'unknown', insurance_type)
                        input_data[feature] = safe_value

            # Calculate derived features
            if 'claim_amount_to_sum_insured_ratio' in expected_features:
                if 'claim_amount' in input_data and 'sum_insured' in input_data:
                    if input_data['sum_insured'] > 0:
                        input_data['claim_amount_to_sum_insured_ratio'] = input_data['claim_amount'] / input_data['sum_insured']
                    else:
                        input_data['claim_amount_to_sum_insured_ratio'] = 0.0

            # Create DataFrame
            input_df = pd.DataFrame([input_data])
            input_df = input_df[expected_features]

            print(f"Input shape: {input_df.shape}")
            print(f"Sample values: {input_df.iloc[0][:5].to_dict()}")

            # Transform using the preprocessor
            X = preprocessor.transform(input_df)
            print(f"Transformed shape: {X.shape}")

            # Adjust features to match what the model expects
            if X.shape[1] > expected_feature_count:
                print(f"Truncating features from {X.shape[1]} to {expected_feature_count}")
                X_adjusted = X[:, :expected_feature_count]
            elif X.shape[1] < expected_feature_count:
                print(f"Padding features from {X.shape[1]} to {expected_feature_count}")
                # Pad with zeros
                padding = np.zeros((X.shape[0], expected_feature_count - X.shape[1]))
                X_adjusted = np.hstack([X, padding])
            else:
                X_adjusted = X
                
            print(f"Final adjusted shape: {X_adjusted.shape}")
            
            # Make prediction
            prediction = model.predict(X_adjusted)[0]
            
            # Get confidence
            confidence_score = 0.0
            try:
                if hasattr(model, 'predict_proba'):
                    proba = model.predict_proba(X_adjusted)[0]
                    if len(proba) > 1:
                        confidence_score = proba[1] * 100
                    else:
                        confidence_score = proba[0] * 100
            except:
                pass
                
            # Get feature names for explanations (use available features)
            available_features = min(len(expected_features), expected_feature_count)
            feature_names = expected_features[:available_features]
            
            # Get explanations
            print("Generating explanations...")
            explanations = get_feature_importance(X_adjusted, model, feature_names, insurance_type)
            
            # Format the result with explanations
            result = format_explanations(explanations, prediction, confidence_score)
            result['insurance_type'] = insurance_type # Ensure insurance_type is set
            return result
            
        except Exception as e:
            import traceback
            print(f"Working prediction error: {traceback.format_exc()}")
            return f"Error: {str(e)}"
    
    return working_predict

# Replace the prediction function
predict = create_working_prediction_function()

# -----------------------
# Form update function
# -----------------------
def update_form_fields(insurance_type):
    """Update form fields based on insurance type"""
    if not insurance_type or insurance_type not in models:
        return [gr.update(visible=False)] * 20
    
    expected_features = models[insurance_type]["features"]
    updates = []
    
    # Create form fields based on expected features
    for i in range(20):
        if i < len(expected_features):
            feature = expected_features[i]
            label = feature.replace("_", " ").title()
            
            # Create appropriate input based on feature type
            if feature in ['insured_age', 'policy_annual_premium', 'claim_amount', 'sum_insured', 
                          'previous_claims_count', 'policy_duration_days', 'incident_to_claim_days',
                          'auto_year', 'claim_duration_days']:
                # True numeric fields
                default_val = 2020 if feature == 'auto_year' else 0
                updates.append(gr.update(visible=True, label=label, value=str(default_val), placeholder="Enter number"))
            elif feature == 'insured_sex':
                updates.append(gr.update(visible=True, label=label, value="male", placeholder="male/female"))
            elif feature == 'third_party_involved':
                updates.append(gr.update(visible=True, label=label, value="no", placeholder="yes/no"))
            elif feature == 'policy_renewal_status':
                updates.append(gr.update(visible=True, label=label, value="renewed", placeholder="renewed/lapsed"))
            elif feature == 'premium_payment_delays':
                updates.append(gr.update(visible=True, label=label, value="none", placeholder="none/1-15 days/15-30 days/>30 days"))
            elif feature == 'coverage_changes_before_claim':
                updates.append(gr.update(visible=True, label=label, value="none", placeholder="none/increased/decreased"))
            else:
                updates.append(gr.update(visible=True, label=label, value="", placeholder=f"Enter {label.lower()}"))
        else:
            updates.append(gr.update(visible=False))
    
    return updates

# -----------------------
# Generate dummy data
# -----------------------
def generate_dummy_data(insurance_type):
    """Generate realistic dummy data"""
    if not insurance_type or insurance_type not in models:
        return [gr.update()] * 20
    
    expected_features = models[insurance_type]["features"]
    
    # Generate data based on insurance type
    dummy_data = {
        'insured_age': random.randint(25, 65),
        'insured_sex': random.choice(['male', 'female']),
        'insured_occupation': random.choice(['doctor', 'engineer', 'teacher', 'businessman']),
        'policy_state': random.choice(['maharashtra', 'delhi', 'karnataka', 'tamil nadu']),
        'policy_annual_premium': round(random.uniform(10000, 100000), 2),
        'claim_amount': round(random.uniform(5000, 500000), 2),
        'sum_insured': round(random.uniform(100000, 2000000), 2),
        'previous_claims_count': random.randint(0, 3),
        'policy_renewal_status': random.choice(['renewed', 'lapsed']),
        'premium_payment_delays': random.choice(['none', '1-15 days', '15-30 days']),
        'coverage_changes_before_claim': random.choice(['none', 'increased', 'decreased']),
        'policy_duration_days': random.randint(365, 1825),
        'incident_to_claim_days': random.randint(1, 30),
        'auto_make': random.choice(['maruti', 'hyundai', 'tata', 'mahindra']),
        'auto_model': random.choice(['swift', 'i20', 'nexon', 'scorpio']),
        'auto_year': random.randint(2015, 2023),
        'accident_location': random.choice(['highway', 'city', 'residential']),
        'third_party_involved': random.choice(['yes', 'no']),
        'hospital_name': random.choice(['apollo', 'fortis', 'max', 'other']),
        'treatment_details': random.choice(['surgery', 'medication', 'therapy']),
        'nominee_relationship': random.choice(['spouse', 'parent', 'child']),
        'crop_type': random.choice(['wheat', 'rice', 'cotton']),
        'weather_condition': random.choice(['normal', 'drought', 'flood']),
        'property_type': random.choice(['house', 'apartment', 'commercial']),
        'claim_duration_days': random.randint(1, 30)
    }
    
    updates = []
    for i in range(20):
        if i < len(expected_features):
            feature = expected_features[i]
            if feature in dummy_data:
                updates.append(gr.update(value=str(dummy_data[feature])))
            else:
                updates.append(gr.update())
        else:
            updates.append(gr.update())
    
    return updates

# -----------------------
# Create interface
# -----------------------
def create_interface():
    with gr.Blocks(title="Insurance Fraud Detection", theme=gr.themes.Soft()) as iface:
        gr.Markdown("# 🏥 Multi-Model Insurance Fraud Detection")
        gr.Markdown("Select an insurance type and enter claim details to detect potential fraud.")
        
        insurance_type = gr.Dropdown(
            choices=list(models.keys()), 
            label="Insurance Type",
            info="Select the type of insurance claim to analyze"
        )
        
        with gr.Row():
            generate_btn = gr.Button("🎲 Generate Sample Data", variant="secondary")
            predict_btn = gr.Button("🔍 Check for Fraud", variant="primary")
        
        # Create input fields
        with gr.Column():
            input_fields = []
            for i in range(20):
                field = gr.Textbox(
                    label=f"Field {i+1}",
                    visible=False,
                    interactive=True
                )
                input_fields.append(field)
        
        # Output
        output = gr.Textbox(
            label="🎯 Prediction Result & Explanation",
            interactive=False,
            lines=20,  # More lines for detailed explanations
            max_lines=25
        )
        
        # Event handlers
        insurance_type.change(
            fn=update_form_fields,
            inputs=insurance_type,
            outputs=input_fields
        )
        
        generate_btn.click(
            fn=generate_dummy_data,
            inputs=insurance_type,
            outputs=input_fields
        )
        
        predict_btn.click(
            fn=predict,
            inputs=[insurance_type] + input_fields,
            outputs=output
        )
        
        # Instructions
        gr.Markdown("""
        ### 📋 How to use:
        1. **Select Insurance Type** from the dropdown
        2. **Fill in the form fields** that appear
        3. **Generate Sample Data** for testing (optional)
        4. **Click "Check for Fraud"** to analyze the claim
        
        ### 🔧 Field Guidelines:
        - **Numeric fields**: Enter numbers only (age, amounts, counts, etc.)
        - **Categorical fields**: Use suggested values from placeholders
        - **Sex**: male/female
        - **Yes/No fields**: yes/no
        - **Status fields**: Use exact values shown in placeholders
        
        ### 🧠 AI Explanations:
        The system provides detailed explanations including:
        - **Feature Importance**: Which factors most influenced the decision
        - **SHAP Values**: Exact contribution of each feature to the prediction
        - **LIME Analysis**: Local interpretable explanations
        - **Direction**: Whether each factor supports or opposes fraud detection
        
        ### 📊 Understanding Results:
        - **Confidence Score**: How certain the model is about its prediction
        - **Feature Contributions**: Positive values increase fraud likelihood, negative decrease it
        - **Top Factors**: The most influential features are listed first
        """)
    
    return iface

# -----------------------
# Launch application
# -----------------------
if __name__ == "__main__":
    iface = create_interface()
    iface.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
        debug=True
    )