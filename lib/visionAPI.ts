/**
 * Vision API helper functions for OCR and CNN analysis
 */

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:5000';

export interface OCRResult {
  success: boolean;
  raw_text: string;
  extracted_text: string; // For Gemini compatibility
  extracted_info: {
    policy_number?: string;
    amount?: string;
    date?: string;
    name?: string;
    hospital?: string;
    doctor?: string;
    diagnosis?: string;
  };
  confidence: number;
  analysis?: {
    verification_status: string;
    key_info: any;
  };
  error?: string;
}

export interface CNNResult {
  success: boolean;
  image_caption: string;
  verification_result: string;
  confidence: number;
  analysis: {
    semantic_similarity: number;
    insurance_specific_checks: {
      confidence: number;
      passed_checks: string[];
      failed_checks: string[];
      observations: string[];
    };
    key_objects_detected: string[];
    damage_assessment?: any; // For Gemini compatibility
    scene_verification?: any; // For Gemini compatibility
  };
  recommendations: string[];
  error?: string;
}

export interface ClaimImageAnalysis {
  ocr_results: (OCRResult & { document_name: string })[];
  cnn_results: (CNNResult & { photo_name: string })[];
  overall_risk_score: number;
  recommendations: string[];
}

/**
 * Perform OCR analysis on a supporting document
 */
export async function analyzeDocumentOCR(
  base64Image: string, 
  imageType: string
): Promise<OCRResult> {
  try {
    console.log('🔍 Starting OCR analysis...');
    
    const response = await fetch(`${ML_API_URL}/api/ocr-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64_image: base64Image,
        image_type: imageType
      }),
    });

    if (!response.ok) {
      throw new Error(`OCR API responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ OCR analysis completed');
    
    return result;
  } catch (error) {
    console.error('❌ OCR analysis failed:', error);
    return {
      success: false,
      raw_text: '',
      extracted_text: '',
      extracted_info: {},
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Perform CNN analysis on an incident photo
 */
export async function analyzeIncidentPhoto(
  base64Image: string, 
  claimData: any
): Promise<CNNResult> {
  try {
    console.log('🤖 Starting CNN analysis...');
    
    const response = await fetch(`${ML_API_URL}/api/cnn-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64_image: base64Image,
        claim_data: claimData
      }),
    });

    if (!response.ok) {
      throw new Error(`CNN API responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ CNN analysis completed');
    
    return result;
  } catch (error) {
    console.error('❌ CNN analysis failed:', error);
    return {
      success: false,
      image_caption: '',
      verification_result: 'Analysis failed',
      confidence: 0,
      analysis: {
        semantic_similarity: 0,
        insurance_specific_checks: {
          confidence: 0,
          passed_checks: [],
          failed_checks: [],
          observations: []
        },
        key_objects_detected: []
      },
      recommendations: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process all images in a claim (comprehensive analysis)
 */
export async function processClaimImages(claimData: any): Promise<ClaimImageAnalysis> {
  try {
    console.log('📸 Starting comprehensive image analysis...');
    
    const response = await fetch(`${ML_API_URL}/api/process-claim-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claimData),
    });

    if (!response.ok) {
      throw new Error(`Image processing API responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Comprehensive image analysis completed');
    
    return result;
  } catch (error) {
    console.error('❌ Comprehensive image analysis failed:', error);
    return {
      ocr_results: [],
      cnn_results: [],
      overall_risk_score: 0.5,
      recommendations: ['Image analysis failed due to technical error']
    };
  }
}

/**
 * Check if ML API server is running and supports vision services
 */
export async function checkVisionServicesHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_API_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Helper function to extract base64 data from data URL
 */
export function extractBase64FromDataURL(dataURL: string): string {
  const base64Index = dataURL.indexOf('base64,');
  if (base64Index !== -1) {
    return dataURL.substring(base64Index + 7); // Remove "base64," prefix
  }
  return dataURL;
}

/**
 * Helper function to get risk level color for UI display
 */
export function getRiskLevelColor(riskScore: number): string {
  if (riskScore > 0.7) return 'text-red-400 bg-red-500/20';
  if (riskScore > 0.4) return 'text-yellow-400 bg-yellow-500/20';
  return 'text-green-400 bg-green-500/20';
}

/**
 * Helper function to get risk level text
 */
export function getRiskLevelText(riskScore: number): string {
  if (riskScore > 0.7) return 'HIGH RISK';
  if (riskScore > 0.4) return 'MEDIUM RISK';
  return 'LOW RISK';
} 