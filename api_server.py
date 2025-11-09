"""
Flask API server to integrate ML fraud detection with Next.js dashboard
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add the current directory to Python path to import from app.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the ML prediction function from app.py
from app import models, create_working_prediction_function

# Import vision services
from vision_services import OCRService, CNNService, process_claim_images

# Import fraud ring detection
from api_fraud_rings import fraud_rings_bp, init_detector
import os
from dotenv import load_dotenv

# Load environment variables from .env.local first, then .env
load_dotenv('.env.local')
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js integration

# Create the prediction function
predict_fraud = create_working_prediction_function()

# Register fraud ring detection Blueprint
app.register_blueprint(fraud_rings_bp)

# Initialize the fraud ring detector (with error handling)
try:
    neo4j_uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
    # Convert neo4j:// to bolt:// if needed
    if neo4j_uri.startswith('neo4j://'):
        neo4j_uri = neo4j_uri.replace('neo4j://', 'bolt://')
    
    neo4j_password = os.getenv('NEO4J_PASSWORD', '')
    neo4j_username = os.getenv('NEO4J_USERNAME', 'neo4j')
    
    print(f"🔍 Neo4j Config: URI={neo4j_uri}, Username={neo4j_username}, Password={'***' if neo4j_password else 'EMPTY'}")
    
    if not neo4j_password:
        print("⚠️  NEO4J_PASSWORD not set - fraud ring detection will be disabled")
        print("   Set NEO4J_PASSWORD in your .env.local file to enable fraud ring detection")
    else:
        init_detector(
            neo4j_uri=neo4j_uri,
            username=neo4j_username,
            password=neo4j_password,
            database=os.getenv('NEO4J_DATABASE', 'neo4j')
        )
        print("✅ Fraud ring detection initialized successfully")
except Exception as e:
    print(f"⚠️  Fraud ring detection initialization failed: {e}")
    print("   ML prediction and vision services will still work")
    print("   Fix Neo4j connection to enable fraud ring detection")

@app.route('/api/predict-fraud', methods=['POST'])
def predict_fraud_api():
    """
    API endpoint to predict fraud for insurance claims
    Expected JSON payload matches the claim data structure from your dashboard
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract insurance type
        insurance_type = data.get('insurance_type', '').lower()
        
        if not insurance_type or insurance_type not in models:
            return jsonify({
                'error': f'Invalid or unsupported insurance type: {insurance_type}',
                'supported_types': list(models.keys())
            }), 400
        
        # Map dashboard fields to ML model input format
        # The order should match the features expected by the model
        model_features = models[insurance_type]["features"]
        
        # Create input array in the correct order
        input_values = []
        
        for feature in model_features:
            value = data.get(feature, 0)
            
            # Handle None/undefined values first
            if value is None or value == 'None' or value == '':
                value = 0  # Default to 0 for missing values
            
            # Handle categorical values
            if isinstance(value, str):
                # Convert string values to numeric if needed
                if feature in ['insured_sex']:
                    value = 1 if value.lower() in ['m', 'male'] else 0
                elif feature in ['policy_renewal_status']:
                    value = 1 if value.lower() in ['renewed', 'active'] else 0
                elif feature in ['premium_payment_delays']:
                    delay_map = {'no_delays': 0, '1-2_delays': 1, '3-5_delays': 2, '6+_delays': 3}
                    value = delay_map.get(value.lower(), 1)
                elif feature in ['coverage_changes_before_claim']:
                    value = 1 if value.lower() in ['yes', 'true'] else 0
                else:
                    # For other categorical features, use hash or default encoding
                    value = hash(str(value)) % 100  # Simple encoding
            
            # Ensure value is numeric before converting to float
            try:
                input_values.append(float(value))
            except (ValueError, TypeError):
                print(f"Warning: Could not convert {feature}={value} to float, using 0")
                input_values.append(0.0)
        
        # Make prediction
        result = predict_fraud(insurance_type, *input_values)
        
        # Convert numpy types to Python types for JSON serialization
        def convert_numpy_types(obj):
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_numpy_types(item) for item in obj]
            elif isinstance(obj, bool):
                return bool(obj)  # Ensure it's a Python bool
            else:
                return obj
        
        # Convert the result to JSON-serializable format
        json_result = convert_numpy_types(result)
        
        return jsonify(json_result)
        
    except Exception as e:
        return jsonify({
            'error': f'Prediction failed: {str(e)}',
            'fraud_score': 0.5,
            'risk_level': 'unknown',
            'is_fraud': False,
            'detailed_explanation': f'Error during prediction: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': len(models),
        'available_insurance_types': list(models.keys())
    })

@app.route('/api/ocr-analysis', methods=['POST'])
def ocr_analysis():
    """
    OCR API endpoint for extracting text from supporting documents
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        base64_image = data.get('base64_image')
        image_type = data.get('image_type', 'image/jpeg')
        
        if not base64_image:
            return jsonify({'error': 'base64_image is required'}), 400
        
        # Process OCR
        result = OCRService.extract_text_from_base64(base64_image, image_type)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'OCR analysis failed: {str(e)}',
            'raw_text': '',
            'extracted_info': {},
            'confidence': 0
        }), 500

@app.route('/api/cnn-analysis', methods=['POST'])
def cnn_analysis():
    """
    CNN API endpoint for incident photo verification
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        base64_image = data.get('base64_image')
        claim_data = data.get('claim_data', {})
        
        if not base64_image:
            return jsonify({'error': 'base64_image is required'}), 400
        
        # Process CNN analysis
        result = CNNService.analyze_incident_photo(base64_image, claim_data)
        
        # Convert numpy types to Python types for JSON serialization
        def convert_numpy_types(obj):
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_numpy_types(item) for item in obj]
            elif isinstance(obj, bool):
                return bool(obj)  # Ensure it's a Python bool
            else:
                return obj
        
        # Convert the result to JSON-serializable format
        json_result = convert_numpy_types(result)
        
        return jsonify(json_result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'CNN analysis failed: {str(e)}',
            'verification_result': 'Analysis failed',
            'confidence': 0,
            'analysis': {}
        }), 500

@app.route('/api/process-claim-images', methods=['POST'])
def process_claim_images_api():
    """
    Comprehensive image processing API for both OCR and CNN analysis
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Process all images in the claim
        result = process_claim_images(data)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': f'Image processing failed: {str(e)}',
            'ocr_results': [],
            'cnn_results': [],
            'overall_risk_score': 0.5,
            'recommendations': ['Analysis failed due to technical error']
        }), 500

if __name__ == '__main__':
    print("Starting Insurance Fraud Detection API with Vision Services...")
    print(f"Models loaded: {len(models)}")
    print(f"Available insurance types: {list(models.keys())}")
    app.run(debug=True, host='0.0.0.0', port=5000)
