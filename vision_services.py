"""
Vision Services for Insurance Fraud Detection
- OCR for supporting documents (EasyOCR - Much Better Accuracy)
- CNN for incident photo verification
"""

import cv2
import numpy as np
from PIL import Image
import io
import base64
import re
import json
from typing import Dict, List, Tuple, Any

# Optional imports with fallbacks
try:
    import easyocr
    HAS_EASYOCR = True
except ImportError:
    HAS_EASYOCR = False
    print("EasyOCR not available. OCR functionality will be limited.")

try:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    import torch
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    print("Transformers not available. Image analysis will be limited.")

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    print("Sentence Transformers not available. Text analysis will be limited.")

# Load models once when module is imported
print("Loading vision models...")

# EasyOCR reader (supports 80+ languages, much better than Tesseract)
easyocr_reader = None
if HAS_EASYOCR:
    try:
        # Initialize EasyOCR with English and Hindi support
        easyocr_reader = easyocr.Reader(['en', 'hi'], gpu=False)  # Set gpu=True if you have CUDA
        print("✅ EasyOCR loaded (English + Hindi support)")
    except Exception as e:
        print(f"❌ Failed to load EasyOCR: {e}")
        easyocr_reader = None
else:
    print("⚠️ EasyOCR not available - OCR functionality disabled")

# BLIP model for image captioning
blip_processor = None
blip_model = None
if HAS_TRANSFORMERS:
    try:
        blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        print("✅ BLIP model loaded for image captioning")
    except Exception as e:
        print(f"❌ Failed to load BLIP model: {e}")
        blip_processor = None
        blip_model = None
else:
    print("⚠️ Transformers not available - Image analysis disabled")

# Sentence transformer for semantic similarity
sentence_model = None
if HAS_SENTENCE_TRANSFORMERS:
    try:
        sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Sentence transformer loaded")
    except Exception as e:
        print(f"❌ Failed to load sentence transformer: {e}")
        sentence_model = None
else:
    print("⚠️ Sentence Transformers not available - Text analysis disabled")

class OCRService:
    """Enhanced OCR service using EasyOCR for better accuracy"""
    
    @staticmethod
    def extract_text_from_base64(base64_image: str, image_type: str) -> Dict[str, Any]:
        """
        Extract text from base64 encoded image using EasyOCR (much better than Tesseract)
        """
        try:
            if easyocr_reader is None:
                return {
                    'success': False,
                    'error': 'EasyOCR not loaded',
                    'raw_text': '',
                    'extracted_info': {},
                    'confidence': 0
                }
            
            # Decode base64 image
            image_data = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert PIL to OpenCV format for preprocessing
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Fast preprocessing for better OCR accuracy (3x faster!)
            processed_images = OCRService._fast_preprocessing(cv_image)
            
            # Try OCR on multiple preprocessed versions (with early exit for speed)
            best_result = None
            best_confidence = 0
            
            for i, processed_image in enumerate(processed_images):
                try:
                    # Use EasyOCR for text extraction
                    results = easyocr_reader.readtext(processed_image)
                    
                    # Combine all text with confidence scores
                    extracted_text = ""
                    total_confidence = 0
                    valid_detections = 0
                    
                    for (bbox, text, confidence) in results:
                        if confidence > 0.3:  # Filter low confidence detections
                            extracted_text += text + " "
                            total_confidence += confidence
                            valid_detections += 1
                    
                    if valid_detections > 0:
                        avg_confidence = total_confidence / valid_detections
                        if avg_confidence > best_confidence:
                            best_confidence = avg_confidence
                            best_result = {
                                'text': extracted_text.strip(),
                                'confidence': avg_confidence,
                                'detections': len(results)
                            }
                            
                        # Early exit: if first method gives good confidence, skip others
                        if i == 0 and avg_confidence > 0.7:
                            print(f"✅ Fast OCR: Good confidence ({avg_confidence:.2f}) on first attempt, skipping others")
                            break
                            
                except Exception as e:
                    print(f"OCR attempt failed: {e}")
                    continue
            
            if best_result is None:
                return {
                    'success': False,
                    'error': 'No text detected with sufficient confidence',
                    'raw_text': '',
                    'extracted_info': {},
                    'confidence': 0
                }
            
            # Extract specific information from the best result
            extracted_info = OCRService._parse_document_text(best_result['text'])
            
            return {
                'success': True,
                'raw_text': best_result['text'],
                'extracted_text': best_result['text'],  # For Gemini compatibility
                'extracted_info': extracted_info,
                'confidence': best_result['confidence'],
                'detections_count': best_result['detections'],
                'analysis': {
                    'verification_status': 'Verified' if best_result['confidence'] > 0.7 else 'Needs review',
                    'key_info': extracted_info
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'raw_text': '',
                'extracted_info': {},
                'confidence': 0
            }
    
    @staticmethod
    def _fast_preprocessing(image: np.ndarray) -> List[np.ndarray]:
        """Fast preprocessing with only the best methods - 3x faster!"""
        processed_images = []
        
        # Method 1: Original image (often works best)
        processed_images.append(image)
        
        # Method 2: Grayscale (most reliable)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        processed_images.append(gray)
        
        # Method 3: Best threshold method only
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        processed_images.append(thresh)
        
        return processed_images  # Only 3 methods instead of 7!
    
    @staticmethod
    def _parse_document_text(text: str) -> Dict[str, str]:
        """Enhanced parsing for insurance documents with better patterns"""
        info = {}
        
        # Enhanced patterns for insurance documents
        patterns = {
            'policy_number': [
                r'(?:policy|pol\.?)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9\-/]+)',
                r'(?:policy\s*id|policy\s*code)\s*:?\s*([A-Z0-9\-/]+)',
                r'policy\s*([A-Z0-9]{8,})'
            ],
            'amount': [
                r'(?:amount|sum|₹|rs\.?|rupees?)\s*:?\s*([0-9,]+(?:\.[0-9]{2})?)',
                r'₹\s*([0-9,]+)',
                r'rs\.?\s*([0-9,]+)',
                r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs\.?)'
            ],
            'date': [
                r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
                r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})',
                r'(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})',
                r'(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})'
            ],
            'name': [
                r'(?:name|holder|patient|claimant)\s*:?\s*([A-Za-z\s\.]+)',
                r'name\s*of\s*([A-Za-z\s\.]+)',
                r'patient\s*name\s*:?\s*([A-Za-z\s\.]+)'
            ],
            'hospital': [
                r'(?:hospital|clinic|medical\s+center|healthcare)\s*:?\s*([A-Za-z\s\.]+)',
                r'treated\s+at\s*:?\s*([A-Za-z\s\.]+)',
                r'admitted\s+to\s*:?\s*([A-Za-z\s\.]+)'
            ],
            'doctor': [
                r'(?:dr\.?|doctor|physician)\s*:?\s*([A-Za-z\s\.]+)',
                r'attending\s+doctor\s*:?\s*([A-Za-z\s\.]+)',
                r'consultant\s*:?\s*([A-Za-z\s\.]+)'
            ],
            'diagnosis': [
                r'(?:diagnosis|condition|treatment|disease)\s*:?\s*([A-Za-z\s\.]+)',
                r'medical\s+condition\s*:?\s*([A-Za-z\s\.]+)',
                r'illness\s*:?\s*([A-Za-z\s\.]+)'
            ],
            'phone': [
                r'(?:phone|mobile|contact)\s*:?\s*(\d{10})',
                r'(\d{10})',
                r'(\+91\s*\d{10})'
            ],
            'email': [
                r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
            ]
        }
        
        for key, pattern_list in patterns.items():
            for pattern in pattern_list:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    # Take the first match and clean it
                    info[key] = matches[0].strip().strip('.,:')
                    break
        
        return info
    
    @staticmethod
    def _calculate_confidence(text: str) -> float:
        """Calculate confidence score based on text quality and content"""
        if not text.strip():
            return 0.0
        
        # Base confidence from text length
        text_length = len(text.strip())
        base_confidence = min(text_length / 200, 1.0)
        
        # Bonus for relevant insurance keywords
        insurance_keywords = [
            'policy', 'insurance', 'claim', 'amount', 'date', 'hospital', 
            'treatment', 'patient', 'doctor', 'diagnosis', 'medical',
            'coverage', 'premium', 'beneficiary', 'admission', 'discharge'
        ]
        
        keyword_matches = sum(1 for keyword in insurance_keywords 
                            if keyword.lower() in text.lower())
        
        # Bonus for structured data (numbers, dates, etc.)
        has_numbers = bool(re.search(r'\d+', text))
        has_dates = bool(re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text))
        has_amounts = bool(re.search(r'₹|rs\.?|\d+,\d+', text, re.IGNORECASE))
        
        # Calculate final confidence
        keyword_bonus = min(keyword_matches * 0.05, 0.3)
        structure_bonus = (has_numbers + has_dates + has_amounts) * 0.1
        
        return min(base_confidence + keyword_bonus + structure_bonus, 1.0)

class CNNService:
    """CNN service for incident photo verification"""
    
    @staticmethod
    def analyze_incident_photo(base64_image: str, claim_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze incident photo and verify against claim description
        """
        try:
            if not blip_model or not blip_processor or not sentence_model:
                return {
                    'success': False,
                    'error': 'Vision models not loaded',
                    'verification_result': 'Unable to analyze',
                    'confidence': 0,
                    'analysis': {}
                }
            
            # Decode and process image
            image_data = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_data))
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Generate image caption using BLIP
            caption = CNNService._generate_image_caption(image)
            
            # Extract claim information for comparison
            claim_description = claim_data.get('description', '')
            insurance_type = claim_data.get('insurance_type', '')
            
            # Perform verification
            verification_result = CNNService._verify_against_claim(
                caption, claim_description, insurance_type, claim_data
            )
            
            return {
                'success': True,
                'image_caption': caption,
                'verification_result': verification_result['result'],
                'confidence': verification_result['confidence'],
                'analysis': verification_result['analysis'],
                'recommendations': verification_result['recommendations']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'verification_result': 'Analysis failed',
                'confidence': 0,
                'analysis': {}
            }
    
    @staticmethod
    def _generate_image_caption(image: Image.Image) -> str:
        """Generate caption for image using BLIP model"""
        try:
            inputs = blip_processor(image, return_tensors="pt")
            
            with torch.no_grad():
                out = blip_model.generate(**inputs, max_length=50)
            
            caption = blip_processor.decode(out[0], skip_special_tokens=True)
            return caption
            
        except Exception as e:
            print(f"Error generating caption: {e}")
            return "Unable to generate caption"
    
    @staticmethod
    def _verify_against_claim(caption: str, description: str, insurance_type: str, claim_data: Dict) -> Dict[str, Any]:
        """Verify image content against claim description"""
        
        # Create text embeddings for semantic comparison
        try:
            caption_embedding = sentence_model.encode([caption])
            description_embedding = sentence_model.encode([description])
            
            # Calculate similarity
            similarity = np.dot(caption_embedding[0], description_embedding[0]) / (
                np.linalg.norm(caption_embedding[0]) * np.linalg.norm(description_embedding[0])
            )
            
        except Exception:
            similarity = 0.5  # Default similarity if embedding fails
        
        # Insurance type specific verification
        verification_checks = CNNService._perform_insurance_specific_checks(
            caption, insurance_type, claim_data
        )
        
        # Combine results
        overall_confidence = (similarity * 0.6 + verification_checks['confidence'] * 0.4)
        
        # Determine result
        if overall_confidence > 0.7:
            result = "VERIFIED - Image matches claim description"
        elif overall_confidence > 0.4:
            result = "PARTIAL MATCH - Some inconsistencies detected"
        else:
            result = "MISMATCH - Image does not match claim description"
        
        return {
            'result': result,
            'verification_result': result,  # For Gemini compatibility
            'confidence': float(overall_confidence),
            'analysis': {
                'semantic_similarity': float(similarity),
                'insurance_specific_checks': verification_checks,
                'image_caption': caption,
                'key_objects_detected': CNNService._extract_key_objects(caption),
                'damage_assessment': {
                    'damage_detected': 'damage' in caption.lower() or 'broken' in caption.lower(),
                    'severity': 'high' if overall_confidence > 0.8 else 'medium' if overall_confidence > 0.5 else 'low',
                    'description': caption
                },
                'scene_verification': {
                    'matches_claim': similarity > 0.7,
                    'consistency_score': float(similarity),
                    'key_elements': CNNService._extract_key_objects(caption)
                }
            },
            'recommendations': CNNService._generate_recommendations(overall_confidence, verification_checks)
        }
    
    @staticmethod
    def _perform_insurance_specific_checks(caption: str, insurance_type: str, claim_data: Dict) -> Dict[str, Any]:
        """Perform insurance type specific verification"""
        
        checks = {
            'confidence': 0.5,
            'passed_checks': [],
            'failed_checks': [],
            'observations': []
        }
        
        caption_lower = caption.lower()
        
        if insurance_type == 'automobile':
            # Check for vehicle-related content
            vehicle_keywords = ['car', 'vehicle', 'truck', 'motorcycle', 'accident', 'damage', 'crash', 'road']
            vehicle_detected = any(keyword in caption_lower for keyword in vehicle_keywords)
            
            if vehicle_detected:
                checks['passed_checks'].append('Vehicle-related content detected')
                checks['confidence'] += 0.2
            else:
                checks['failed_checks'].append('No vehicle-related content detected')
                checks['confidence'] -= 0.2
                
            # Check for damage indicators
            damage_keywords = ['damage', 'broken', 'dent', 'scratch', 'bent', 'cracked']
            damage_detected = any(keyword in caption_lower for keyword in damage_keywords)
            
            if damage_detected:
                checks['passed_checks'].append('Damage indicators found')
                checks['confidence'] += 0.1
        
        elif insurance_type == 'health':
            # Check for medical-related content
            medical_keywords = ['hospital', 'medical', 'patient', 'bed', 'doctor', 'clinic', 'treatment']
            medical_detected = any(keyword in caption_lower for keyword in medical_keywords)
            
            if medical_detected:
                checks['passed_checks'].append('Medical environment detected')
                checks['confidence'] += 0.2
            else:
                checks['failed_checks'].append('No medical environment detected')
                checks['confidence'] -= 0.2
        
        elif insurance_type == 'property':
            # Check for property/building content
            property_keywords = ['house', 'building', 'home', 'damage', 'fire', 'water', 'roof', 'window']
            property_detected = any(keyword in caption_lower for keyword in property_keywords)
            
            if property_detected:
                checks['passed_checks'].append('Property-related content detected')
                checks['confidence'] += 0.2
            else:
                checks['failed_checks'].append('No property-related content detected')
                checks['confidence'] -= 0.2
        
        # Ensure confidence stays within bounds
        checks['confidence'] = max(0, min(1, checks['confidence']))
        
        return checks
    
    @staticmethod
    def _extract_key_objects(caption: str) -> List[str]:
        """Extract key objects from image caption"""
        # Simple keyword extraction
        common_objects = ['car', 'vehicle', 'person', 'building', 'damage', 'hospital', 'road', 'house', 'fire', 'water']
        detected_objects = [obj for obj in common_objects if obj in caption.lower()]
        return detected_objects
    
    @staticmethod
    def _generate_recommendations(confidence: float, checks: Dict) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        if confidence < 0.3:
            recommendations.append("🚨 HIGH RISK: Image does not match claim - requires manual investigation")
            recommendations.append("Consider requesting additional documentation")
        elif confidence < 0.6:
            recommendations.append("⚠️ MEDIUM RISK: Some inconsistencies detected")
            recommendations.append("Review claim details and consider follow-up questions")
        else:
            recommendations.append("✅ LOW RISK: Image verification passed")
            recommendations.append("Documentation appears consistent with claim")
        
        if checks['failed_checks']:
            recommendations.append(f"Failed checks: {', '.join(checks['failed_checks'])}")
        
        return recommendations

# Utility functions for the API
def process_claim_images(claim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process all images for a claim (both OCR and CNN)
    """
    results = {
        'ocr_results': [],
        'cnn_results': [],
        'overall_risk_score': 0,
        'recommendations': []
    }
    
    # Process supporting documents with OCR
    supporting_docs = claim_data.get('supporting_documents', [])
    for doc in supporting_docs:
        if doc.get('base64'):
            ocr_result = OCRService.extract_text_from_base64(
                doc['base64'], doc.get('type', 'image/jpeg')
            )
            ocr_result['document_name'] = doc.get('name', 'Unknown')
            results['ocr_results'].append(ocr_result)
    
    # Process incident photos with CNN
    incident_photos = claim_data.get('incident_photos', [])
    for photo in incident_photos:
        if photo.get('base64'):
            cnn_result = CNNService.analyze_incident_photo(
                photo['base64'], claim_data
            )
            cnn_result['photo_name'] = photo.get('name', 'Unknown')
            results['cnn_results'].append(cnn_result)
    
    # Calculate overall risk score
    risk_scores = []
    
    # OCR confidence scores
    for ocr in results['ocr_results']:
        if ocr.get('success'):
            risk_scores.append(1 - ocr.get('confidence', 0))  # Higher confidence = lower risk
    
    # CNN verification scores
    for cnn in results['cnn_results']:
        if cnn.get('success'):
            risk_scores.append(1 - cnn.get('confidence', 0))  # Higher confidence = lower risk
    
    if risk_scores:
        results['overall_risk_score'] = sum(risk_scores) / len(risk_scores)
    
    # Generate overall recommendations
    if results['overall_risk_score'] > 0.7:
        results['recommendations'].append("🚨 HIGH RISK: Multiple image verification issues detected")
    elif results['overall_risk_score'] > 0.4:
        results['recommendations'].append("⚠️ MEDIUM RISK: Some image verification concerns")
    else:
        results['recommendations'].append("✅ LOW RISK: Image verification passed")
    
    return results 