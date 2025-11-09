from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import json
import numpy as np
import pandas as pd
import os
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global variables to store loaded models
models = {}

# Base path for model files (we'll create this from FRAUD.ipynb)
BASE_PATH = Path(__file__).parent / "deployment_package"

# Insurance types supported (from FRAUD.ipynb)
INSURANCE_TYPES = [
    'automobile', 'health', 'life', 'property', 
    'crop', 'personal_accident', 'travel'
]

def load_model(insurance_type):
    """Load model, preprocessor, and explainers for a specific insurance type"""
    if insurance_type in models:
        return models[insurance_type]
    
    type_path = BASE_PATH / insurance_type
    
    if not type_path.exists():
        print(f"Model path does not exist: {type_path}")
        return None
    
    try:
        # Load model
        with open(type_path / "model.pkl", "rb") as f:
            model = joblib.load(f)
        
        # Load preprocessor
        with open(type_path / "preprocessor.pkl", "rb") as f:
            preprocessor = joblib.load(f)
        
        # Load features
        with open(type_path / "features.json", "r") as f:
            features = json.load(f)
        
        models[insurance_type] = {
            'model': model,
            'preprocessor': preprocessor,
            'features': features
        }
        
        print(f" Loaded model for: {insurance_type}")
        return models[insurance_type]
        
    except Exception as e:
        print(f" Error loading model for {insurance_type}: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': list(models.keys()),
        'supported_types': INSURANCE_TYPES,
        'deployment_package_exists': BASE_PATH.exists()
    })

@app.route('/predict', methods=['POST'])
def predict_fraud():
    """Main prediction endpoint"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No JSON payload provided'}), 400
        
        insurance_type = data.get('insurance_type')
        claim_data = data.get('claim_data')
        
        if not insurance_type or not claim_data:
            return jsonify({
                'error': 'Missing insurance_type or claim_data'
            }), 400
        
        if insurance_type not in INSURANCE_TYPES:
            return jsonify({
                'error': f'Unsupported insurance type: {insurance_type}'
            }), 400
        
        # Load model if not already loaded
        model_info = load_model(insurance_type)
        if not model_info:
            return jsonify({
                'error': f'Failed to load model for {insurance_type}'
            }), 500
        
        # Preprocess input
        input_df = pd.DataFrame([claim_data])
        features = model_info['features']
        
        # Ensure all required features are present
        for feature in features:
            if feature not in input_df.columns:
                if feature in ['insured_age', 'policy_annual_premium', 'claim_amount', 
                              'sum_insured', 'claim_amount_to_sum_insured_ratio', 
                              'previous_claims_count', 'policy_duration_days', 
                              'incident_to_claim_days']:
                    input_df[feature] = 0
                else:
                    input_df[feature] = 'Unknown'
        
        # Select only required features
        input_df = input_df[features]
        
        # Apply preprocessing
        processed_data = model_info['preprocessor'].transform(input_df)
        
        # Make prediction
        model = model_info['model']
        prediction_proba = model.predict_proba(processed_data)[0]
        fraud_probability = float(prediction_proba[1])
        prediction = 1 if fraud_probability >= 0.5 else 0
        
        # Prepare response
        response = {
            'prediction': {
                'fraud': bool(prediction),
                'probability': fraud_probability,
                'confidence': float(max(prediction_proba))
            },
            'insurance_type': insurance_type,
            'model_info': {
                'features_used': len(features),
                'model_type': type(model).__name__
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            'error': f'Prediction failed: {str(e)}'
        }), 500

@app.route('/models/status', methods=['GET'])
def models_status():
    """Get status of all models"""
    status = {}
    for insurance_type in INSURANCE_TYPES:
        model_info = load_model(insurance_type)
        status[insurance_type] = {
            'loaded': model_info is not None,
            'features_count': len(model_info['features']) if model_info else 0,
            'model_type': type(model_info['model']).__name__ if model_info else None
        }
    return jsonify(status)

if __name__ == '__main__':
    print('Starting Fraud Detection API...')
    print(f'Models will be loaded from: {BASE_PATH}')
    print(f'Deployment package exists: {BASE_PATH.exists()}')
    
    if not BASE_PATH.exists():
        print('  WARNING: deployment_package folder not found!')
        print('Please run FRAUD.ipynb to generate the deployment package first.')
    
    # Pre-load all models
    loaded_count = 0
    for insurance_type in INSURANCE_TYPES:
        if load_model(insurance_type):
            loaded_count += 1
    
    print(f'API ready! Loaded {loaded_count}/{len(INSURANCE_TYPES)} models')
    app.run(debug=True, host='0.0.0.0', port=5000)
