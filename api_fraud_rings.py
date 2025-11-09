"""
API endpoint for fraud ring detection
Integrates with the main Flask API server
"""

from flask import Blueprint, jsonify, request
import json
from fraud_ring_detection import FraudRingDetector
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint
fraud_rings_bp = Blueprint('fraud_rings', __name__)

# Global detector instance
detector = None

def init_detector(neo4j_uri: str, username: str, password: str, database: str = "neo4j"):
    """Initialize the fraud ring detector"""
    global detector
    detector = FraudRingDetector(neo4j_uri, username, password, database)
    detector.create_schema()
    logger.info(f"Fraud ring detector initialized with database: {database}")

@fraud_rings_bp.route('/api/fraud-rings/detect', methods=['POST'])
def detect_fraud_rings():
    """Detect fraud rings from provided data"""
    try:
        if not detector:
            return jsonify({
                'success': False,
                'error': 'Fraud ring detector not initialized. Please check Neo4j connection and credentials.',
                'suggestion': 'Set NEO4J_PASSWORD environment variable and ensure Neo4j is running'
            }), 503
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        users_data = data.get('users', [])
        policies_data = data.get('policies', [])
        claims_data = data.get('claims', [])
        
        if not users_data or not policies_data or not claims_data:
            return jsonify({
                'success': False,
                'error': 'Missing required data: users, policies, or claims'
            }), 400
        
        # Load data into Neo4j
        detector.load_data_from_firestore(users_data, policies_data, claims_data)
        
        # Detect fraud rings
        results = detector.detect_fraud_rings()
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error detecting fraud rings: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@fraud_rings_bp.route('/api/fraud-rings/visualization', methods=['GET'])
def get_network_visualization():
    """Get network visualization data"""
    try:
        if not detector:
            return jsonify({
                'success': False,
                'error': 'Fraud ring detector not initialized'
            }), 500
        
        visualization_data = detector.get_network_visualization_data()
        
        return jsonify({
            'success': True,
            'data': visualization_data
        })
        
    except Exception as e:
        logger.error(f"Error getting visualization data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@fraud_rings_bp.route('/api/fraud-rings/health', methods=['GET'])
def health_check():
    """Health check for fraud ring detection service"""
    try:
        if not detector:
            return jsonify({
                'success': False,
                'status': 'Not initialized'
            }), 500
        
        # Test Neo4j connection
        result = detector.session.run("RETURN 1 as test")
        test_value = result.single()['test']
        
        return jsonify({
            'success': True,
            'status': 'Healthy',
            'neo4j_connected': test_value == 1
        })
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'success': False,
            'status': 'Unhealthy',
            'error': str(e)
        }), 500
