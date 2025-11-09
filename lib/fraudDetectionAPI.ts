/**
 * Enhanced Fraud Detection API Integration with Gemini AI
 * This file provides functions to integrate with the Python ML API and Gemini AI
 */

interface FraudPredictionRequest {
  // Required fields
  insurance_type: string;
  insured_age: number;
  insured_sex: string;
  insured_occupation: string;
  policy_state: string;
  policy_annual_premium: number;
  claim_amount: number;
  sum_insured: number;
  previous_claims_count: number;
  policy_renewal_status: string;
  premium_payment_delays: string;
  coverage_changes_before_claim: string;
  policy_duration_days: number;
  incident_to_claim_days: number;
  claim_amount_to_sum_insured_ratio: number;
  
  // Insurance-specific fields (optional based on type)
  auto_make?: string;
  auto_model?: string;
  auto_year?: number;
  accident_location?: string;
  third_party_involved?: string;
  hospital_name?: string;
  treatment_details?: string;
  claim_duration_days?: number;
  nominee_relationship?: string;
  property_type?: string;
  crop_type?: string;
  weather_condition?: string;
  
  // Metadata
  submittedDate?: string;
  claimId?: string;
  id?: string; // Add id property for compatibility
}

interface FraudPredictionResponse {
  success: boolean;
  insurance_type: string;
  is_fraud: boolean;
  fraud_score: number; // 0.0 to 1.0
  confidence_percentage: number; // 0 to 100
  risk_level: 'low' | 'medium' | 'high';
  detailed_explanation: string;
  gemini_analysis?: string; // Enhanced AI explanation
  model_features_used: number;
  timestamp: string;
  error?: string;
  message?: string;
}

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:5000';

/**
 * Get enhanced fraud analysis from Gemini AI
 */
async function getGeminiAnalysis(
  fraudScore: number,
  riskLevel: string,
  confidence: number,
  claimData: any,
  mlAnalysis: any,
  networkAnalysis?: any,
  visionAnalysis?: any
): Promise<string> {
  try {
    console.log('🔍 Calling Gemini API for fraud analysis (SAFELY RE-ENABLED)...');
    
    const response = await fetch('/api/fraud-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fraudScore,
        riskLevel,
        confidence,
        claimData,
        mlAnalysis: mlAnalysis || {},
        shapValues: mlAnalysis?.shap_values || {},
        limeValues: mlAnalysis?.lime_values || {},
        networkAnalysis: networkAnalysis || {},
        visionAnalysis: {
          ocrResults: visionAnalysis?.ocrResults ? Object.entries(visionAnalysis.ocrResults).map(([key, result]) => ({
            ...result,
            document_name: `Document ${key.replace('doc_', '')}`
          })) : [],
          cnnResults: visionAnalysis?.cnnResults ? Object.entries(visionAnalysis.cnnResults).map(([key, result]) => ({
            ...result,
            photo_name: `Photo ${key.replace('photo_', '')}`
          })) : [],
          overall_risk_score: visionAnalysis?.overall_risk_score || 0,
          recommendations: visionAnalysis?.recommendations || []
        }
      }),
    });

    console.log('📡 Gemini API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Gemini analysis received:', result.analysis ? 'Yes' : 'No');
    
    return result.analysis || 'Analysis unavailable';
  } catch (error) {
    console.error('❌ Gemini analysis failed:', error);
    return `AI analysis temporarily unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Process Gemini analysis for a claim that already has ML results
 */
export async function processGeminiAnalysis(claimData: any, networkAnalysis?: any, visionAnalysis?: any): Promise<string> {
  try {
    console.log('🤖 Processing Gemini analysis for claim:', claimData.id);
    console.log('🔍 Current gemini_analysis value:', claimData.gemini_analysis);
    
    // Check if already has VALID Gemini analysis (skip if disabled/pending/error states)
    // But allow regeneration if we have new network or vision analysis data
    const hasNewAnalysisData = networkAnalysis || visionAnalysis;
    const shouldSkipRegeneration = claimData.gemini_analysis && 
        claimData.gemini_analysis !== 'Pending AI analysis' && 
        claimData.gemini_analysis !== 'AI analysis temporarily disabled to preserve quota' &&
        claimData.gemini_analysis !== 'AI analysis disabled' &&
        claimData.gemini_analysis !== 'AI analysis temporarily unavailable' &&
        claimData.gemini_analysis !== 'AI analysis completely disabled to prevent quota exhaustion' &&
        !claimData.gemini_analysis.includes('temporarily unavailable') &&
        !claimData.gemini_analysis.includes('disabled') &&
        !hasNewAnalysisData; // Don't skip if we have new analysis data
    
    if (shouldSkipRegeneration) {
      console.log('✅ Claim already has valid Gemini analysis, skipping regeneration');
      return claimData.gemini_analysis;
    }
    
    if (hasNewAnalysisData) {
      console.log('🔄 Regenerating Gemini analysis with new network/vision data');
    }
    
    // Get Gemini analysis
    console.log('🚀 Proceeding to call Gemini API...');
    console.log('📊 Data being sent to Gemini:', {
      fraudScore: claimData.fraudScore || 0,
      riskLevel: claimData.riskLevel || 'low',
      confidence: (claimData.fraudScore || 0) * 100,
      hasNetworkAnalysis: !!networkAnalysis,
      hasVisionAnalysis: !!visionAnalysis,
      networkTypes: networkAnalysis?.suspicious_networks?.map((n: any) => n.type) || [],
      networkCount: networkAnalysis?.suspicious_networks?.length || 0,
      currentUserId: claimData.userId,
      visionResults: (visionAnalysis?.ocrResults ? Object.keys(visionAnalysis.ocrResults).length : 0) + (visionAnalysis?.cnnResults ? Object.keys(visionAnalysis.cnnResults).length : 0),
      visionAnalysisStructure: {
        ocrResults: visionAnalysis?.ocrResults ? Object.keys(visionAnalysis.ocrResults) : [],
        cnnResults: visionAnalysis?.cnnResults ? Object.keys(visionAnalysis.cnnResults) : []
      }
    });
    
    const geminiAnalysis = await getGeminiAnalysis(
      claimData.fraudScore || 0,
      claimData.riskLevel || 'low',
      (claimData.fraudScore || 0) * 100,
      claimData,
      {
        fraud_score: claimData.fraudScore || 0,
        risk_level: claimData.riskLevel || 'low',
        detailed_explanation: claimData.fraudExplanation || claimData.detailed_explanation || '',
        is_fraud: claimData.is_fraud || false
      },
      networkAnalysis,
      visionAnalysis
    );
    
    // ✅ DISABLED: Don't save to Firestore here to prevent listener loops
    // Firestore updates will be handled by the main AdminDashboardContent
    console.log('✅ Gemini analysis completed (not saving to Firestore to prevent loops):', claimData.id);
    
    return geminiAnalysis;
  } catch (error) {
    console.error('❌ Gemini analysis processing failed:', error);
    return 'AI analysis temporarily unavailable';
  }
}

/**
 * Apply business logic rules to catch obvious fraud cases
 */
function applyBusinessRules(claimData: FraudPredictionRequest, mlResult: FraudPredictionResponse): FraudPredictionResponse {
  console.log('🔍 Applying business logic rules...');
  console.log('🔍 BUSINESS RULES DEBUG:', {
    claimAmount: claimData.claim_amount,
    sumInsured: claimData.sum_insured,
    ratio: claimData.claim_amount_to_sum_insured_ratio,
    ratioPercentage: (claimData.claim_amount_to_sum_insured_ratio * 100).toFixed(1) + '%',
    rule1Triggered: claimData.claim_amount_to_sum_insured_ratio > 1.0,
    incidentToClaimDays: claimData.incident_to_claim_days,
    rule2Triggered: claimData.incident_to_claim_days === 0 && claimData.claim_amount > 100000,
    previousClaims: claimData.previous_claims_count,
    policyDuration: claimData.policy_duration_days,
    rule3Triggered: claimData.previous_claims_count > 2 && claimData.policy_duration_days < 180
  });
  
  const businessRules = [];
  let overrideFraud = false;
  let overrideReason = '';
  let maxFraudScore = 0;
  let totalViolationScore = 0;
  let violationCount = 0;
  
  // Rule 1: Claim exceeds coverage by more than 150%
  if (claimData.claim_amount_to_sum_insured_ratio > 1.0) {
    overrideFraud = true;
    
    // Dynamic scoring based on ratio intensity
    let ratioScore = 0;
    const ratio = claimData.claim_amount_to_sum_insured_ratio;
    
    if (ratio > 3.0) {
      ratioScore = 0.98; // 98% - Extreme violation (300%+)
    } else if (ratio > 2.0) {
      ratioScore = 0.95; // 95% - Very high violation (250-300%)
    } else if (ratio > 1.5) {
      ratioScore = 0.90; // 90% - High violation (200-250%)
    } else if (ratio > 1.0) {
      ratioScore = 0.85; // 85% - Medium-high violation (150-200%)
    } else {
      ratioScore = 0.56; // 75% - Medium violation (100-150%)
    }
    
    maxFraudScore = Math.max(maxFraudScore, ratioScore);
    totalViolationScore += ratioScore;
    violationCount++;
    
    const severity = ratio > 2.5 ? 'EXTREME' : ratio > 2.0 ? 'VERY HIGH' : ratio > 1.5 ? 'HIGH' : 'MEDIUM';
    overrideReason = `🚨 BUSINESS RULE VIOLATION (${severity}): Claim amount (₹${claimData.claim_amount.toLocaleString()}) exceeds policy coverage (₹${claimData.sum_insured.toLocaleString()}) by ${(ratio * 100).toFixed(1)}%. This is impossible under normal circumstances.`;
    businessRules.push(`Claim exceeds coverage by ${(ratio * 100).toFixed(1)}% (${severity})`);
    console.log(`🚨 BUSINESS RULE 1 TRIGGERED: High claim-to-coverage ratio - Score: ${(ratioScore * 100).toFixed(1)}%`);
  }
  
  // Rule 2: Claim filed on same day as incident for high amounts
  if (claimData.incident_to_claim_days === 0 && claimData.claim_amount > 100000) {
    overrideFraud = true;
    
    // Dynamic scoring based on claim amount
    let sameDayScore = 0;
    const claimAmount = claimData.claim_amount;
    
    if (claimAmount > 5000000) { // >50L
      sameDayScore = 0.95; // 95% - Extreme
    } else if (claimAmount > 2000000) { // >20L
      sameDayScore = 0.90; // 90% - Very high
    } else if (claimAmount > 1000000) { // >10L
      sameDayScore = 0.85; // 85% - High
    } else {
      sameDayScore = 0.80; // 80% - Medium
    }
    
    maxFraudScore = Math.max(maxFraudScore, sameDayScore);
    totalViolationScore += sameDayScore;
    violationCount++;
    
    const severity = claimAmount > 5000000 ? 'EXTREME' : claimAmount > 2000000 ? 'VERY HIGH' : claimAmount > 1000000 ? 'HIGH' : 'MEDIUM';
    overrideReason += `\n🚨 BUSINESS RULE VIOLATION (${severity}): High-value claim (₹${claimAmount.toLocaleString()}) filed on same day as incident. This is highly suspicious.`;
    businessRules.push(`Same-day filing for ₹${(claimAmount / 100000).toFixed(1)}L claim (${severity})`);
    console.log(`🚨 BUSINESS RULE 2 TRIGGERED: Same-day high-value claim - Score: ${(sameDayScore * 100).toFixed(1)}%`);
  }
  
  // Rule 3: Multiple claims in short policy duration
  if (claimData.previous_claims_count > 2 && claimData.policy_duration_days < 180) {
    overrideFraud = true;
    
    // Dynamic scoring based on claims frequency and duration
    let multipleClaimsScore = 0;
    const claimsCount = claimData.previous_claims_count;
    const durationDays = claimData.policy_duration_days;
    const claimsPerMonth = (claimsCount / durationDays) * 30;
    
    if (claimsPerMonth > 2) { // >2 claims per month
      multipleClaimsScore = 0.90; // 90% - Very high
    } else if (claimsPerMonth > 1) { // >1 claim per month
      multipleClaimsScore = 0.85; // 85% - High
    } else if (claimsPerMonth > 0.5) { // >0.5 claims per month
      multipleClaimsScore = 0.80; // 80% - Medium-high
    } else {
      multipleClaimsScore = 0.75; // 75% - Medium
    }
    
    maxFraudScore = Math.max(maxFraudScore, multipleClaimsScore);
    totalViolationScore += multipleClaimsScore;
    violationCount++;
    
    const severity = claimsPerMonth > 2 ? 'VERY HIGH' : claimsPerMonth > 1 ? 'HIGH' : 'MEDIUM';
    overrideReason += `\n🚨 BUSINESS RULE VIOLATION (${severity}): ${claimsCount} previous claims in only ${durationDays} days of policy duration (${claimsPerMonth.toFixed(1)} claims/month).`;
    businessRules.push(`Multiple claims: ${claimsCount} in ${durationDays} days (${severity})`);
    console.log(`🚨 BUSINESS RULE 3 TRIGGERED: Multiple claims in short duration - Score: ${(multipleClaimsScore * 100).toFixed(1)}%`);
  }
  
  // Rule 4: Suspicious round number amounts (new rule)
  if (claimData.claim_amount % 100000 === 0 && claimData.claim_amount > 500000) {
    overrideFraud = true;
    
    let roundNumberScore = 0;
    const claimAmount = claimData.claim_amount;
    
    if (claimAmount % 1000000 === 0) { // Exact lakhs
      roundNumberScore = 0.70; // 70% - Medium
    } else if (claimAmount % 500000 === 0) { // Half lakhs
      roundNumberScore = 0.65; // 65% - Medium-low
    } else {
      roundNumberScore = 0.60; // 60% - Low-medium
    }
    
    maxFraudScore = Math.max(maxFraudScore, roundNumberScore);
    totalViolationScore += roundNumberScore;
    violationCount++;
    
    overrideReason += `\n⚠️ BUSINESS RULE VIOLATION (SUSPICIOUS): Round number claim amount (₹${claimAmount.toLocaleString()}) is suspicious.`;
    businessRules.push(`Suspicious round number: ₹${(claimAmount / 100000).toFixed(0)}L`);
    console.log(`⚠️ BUSINESS RULE 4 TRIGGERED: Suspicious round number - Score: ${(roundNumberScore * 100).toFixed(1)}%`);
  }
  
  // If business rules triggered, override ML result with dynamic scoring
  if (overrideFraud) {
    // Calculate final fraud score
    let finalFraudScore;
    let finalConfidence;
    let finalRiskLevel: 'low' | 'medium' | 'high';
    
    if (violationCount === 1) {
      // Single violation - use the score directly
      finalFraudScore = maxFraudScore;
      finalConfidence = Math.round(maxFraudScore * 100);
    } else {
      // Multiple violations - use weighted average with penalty for multiple violations
      const averageScore = totalViolationScore / violationCount;
      const multipleViolationPenalty = Math.min(0.1, violationCount * 0.02); // Max 10% penalty
      finalFraudScore = Math.min(0.99, averageScore + multipleViolationPenalty);
      finalConfidence = Math.round(finalFraudScore * 100);
    }
    
    // Determine risk level based on final score
    if (finalFraudScore >= 0.90) {
      finalRiskLevel = 'high'; // Changed from 'extreme'
    } else if (finalFraudScore >= 0.80) {
      finalRiskLevel = 'high';
    } else if (finalFraudScore >= 0.70) {
      finalRiskLevel = 'medium'; // Changed from 'medium-high'
    } else {
      finalRiskLevel = 'medium';
    }
    
    console.log('🚨 Business rules override: FRAUD DETECTED', {
      violations: violationCount,
      maxScore: (maxFraudScore * 100).toFixed(1) + '%',
      finalScore: (finalFraudScore * 100).toFixed(1) + '%',
      riskLevel: finalRiskLevel
    });
    
    return {
      ...mlResult,
      is_fraud: true,
      fraud_score: finalFraudScore,
      confidence_percentage: finalConfidence,
      risk_level: finalRiskLevel,
      detailed_explanation: `🚨 BUSINESS RULE OVERRIDE: FRAUD DETECTED (${finalRiskLevel.toUpperCase()} RISK)\n\n${overrideReason}\n\nViolated Rules: ${businessRules.join(', ')}\n\nFinal Fraud Score: ${(finalFraudScore * 100).toFixed(1)}% (${violationCount} violation${violationCount > 1 ? 's' : ''})\n\n--- Original ML Analysis ---\n${mlResult.detailed_explanation}`
    };
  }
  
  // If no business rules triggered, return original ML result
  console.log('✅ Business rules passed, using ML result');
  return mlResult;
}

/**
 * Call the ML API to get fraud prediction for a claim
 */
export async function predictFraud(claimData: FraudPredictionRequest): Promise<FraudPredictionResponse> {
  try {
    console.log('Calling fraud detection API with data:', claimData);
    console.log('🔍 RATIO DEBUG - Sending to ML API:', {
      claim_amount: claimData.claim_amount,
      sum_insured: claimData.sum_insured,
      ratio: claimData.claim_amount_to_sum_insured_ratio,
      ratioPercentage: (claimData.claim_amount_to_sum_insured_ratio * 100).toFixed(1) + '%'
    });
    
    const response = await fetch(`${API_BASE_URL}/api/predict-fraud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claimData),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: FraudPredictionResponse = await response.json();
    console.log('Fraud detection result:', result);

    // 🎯 APPLY BUSINESS RULES
    const enhancedResult = applyBusinessRules(claimData, result);
    console.log('Enhanced fraud detection result:', enhancedResult);

    // Note: Gemini analysis will be processed separately after ML completion
    enhancedResult.gemini_analysis = 'Pending AI analysis';
    
    return enhancedResult;
  } catch (error) {
    console.error('❌ Error calling fraud detection API:', error);
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      claimData: {
        insurance_type: claimData.insurance_type,
        claim_amount: claimData.claim_amount,
        sum_insured: claimData.sum_insured
      }
    });
    
    return {
      success: false,
      insurance_type: claimData.insurance_type,
      is_fraud: false,
      fraud_score: 0.0,
      confidence_percentage: 0,
      risk_level: 'low',
      detailed_explanation: 'Failed to analyze claim for fraud',
      gemini_analysis: 'AI analysis unavailable due to technical error',
      model_features_used: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'ML API is currently unavailable'
    };
  }
}

/**
 * Batch predict fraud for multiple claims
 */
export async function batchPredictFraud(claims: FraudPredictionRequest[]): Promise<any[]> {
  const results: any[] = [];
  
  for (const claim of claims) {
    try {
      const result = await predictFraud(claim);
      results.push({
        claimId: claim.claimId || claim.id || 'unknown',
        success: result.success,
        fraud_score: result.fraud_score,
        risk_level: result.risk_level,
        detailed_explanation: result.detailed_explanation,
        gemini_analysis: result.gemini_analysis,
        is_fraud: result.is_fraud,
        confidence_percentage: result.confidence_percentage,
        timestamp: result.timestamp
      });
    } catch (error) {
      console.error(`Batch prediction failed for claim ${claim.claimId || claim.id || 'unknown'}:`, error);
      results.push({
        claimId: claim.claimId || claim.id || 'unknown',
        success: false,
        fraud_score: 0.5,
        risk_level: 'medium',
        detailed_explanation: 'Analysis failed',
        gemini_analysis: 'AI analysis unavailable',
        is_fraud: false,
        confidence_percentage: 0,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return results;
}

/**
 * Check if the ML API is healthy
 */
export async function checkAPIHealth(): Promise<{ status: string; models_loaded: string[]; total_models: number } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('API health check failed:', error);
    return null;
  }
}

/**
 * Get information about available models
 */
export async function getModelsInfo(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get models info:', error);
    return null;
  }
}

/**
 * Transform claim data from your dashboard format to ML API format
 */
export function transformClaimDataForML(claimData: any): FraudPredictionRequest {
  // Calculate derived fields if not present
  // Fix: Use correct field names - claimAmount (camelCase) not claim_amount (snake_case)
  const claimAmount = claimData.claimAmount || claimData.claim_amount || 0;
  const sumInsured = claimData.sum_insured || 0;
  const claimAmountToSumInsuredRatio = sumInsured > 0 
    ? claimAmount / sumInsured 
    : 0;

  const policyDurationDays = claimData.policy_age_at_incident_days || 365;
  const incidentToClaimDays = claimData.claim_filing_delay_days || 1;

  return {
    insurance_type: claimData.insurance_type?.toLowerCase() || 'automobile',
    insured_age: claimData.insured_age || 30,
    insured_sex: claimData.insured_sex || 'M',
    insured_occupation: claimData.insured_occupation || 'Unknown',
    policy_state: claimData.policy_state || 'Unknown',
    policy_annual_premium: claimData.policy_annual_premium || 0,
    claim_amount: claimAmount, // Use the correctly mapped claimAmount
    sum_insured: sumInsured,
    previous_claims_count: claimData.previous_claims_count || 0,
    policy_renewal_status: claimData.policy_renewal_status || 'Active',
    premium_payment_delays: claimData.premium_payment_delays || 'No Delays',
    coverage_changes_before_claim: claimData.coverage_changes_before_claim || 'No Change',
    policy_duration_days: policyDurationDays,
    incident_to_claim_days: incidentToClaimDays,
    claim_amount_to_sum_insured_ratio: claimAmountToSumInsuredRatio,
    
    // Insurance-specific fields
    auto_make: claimData.auto_make || "",
    auto_model: claimData.auto_model || "",
    auto_year: claimData.auto_year || 0,
    accident_location: claimData.accident_location || "",
    third_party_involved: claimData.third_party_involved || "",
    hospital_name: claimData.hospital_name || "",
    treatment_details: claimData.treatment_details || "",
    claim_duration_days: claimData.claim_duration_days || 0,
    nominee_relationship: claimData.nominee_relationship || "",
    property_type: claimData.property_type || "",
    crop_type: claimData.crop_type || "",
    weather_condition: claimData.weather_condition || "",
    
    // Metadata
    submittedDate: claimData.submittedDate,
    claimId: claimData.claimId || claimData.id,
    id: claimData.id // Add id for compatibility
  };
}

/**
 * Get risk level color for UI display
 */
export function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'high':
      return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'medium':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    case 'low':
      return 'text-green-500 bg-green-500/10 border-green-500/20';
    default:
      return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  }
}

/**
 * Format confidence percentage for display
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * Get fraud status icon
 */
export function getFraudStatusIcon(isFraud: boolean, riskLevel: string): string {
  if (isFraud) {
    return '🚨'; // High risk fraud detected
  }
  
  switch (riskLevel) {
    case 'high':
      return '⚠️'; // High risk but not definitive fraud
    case 'medium':
      return '🔍'; // Medium risk - needs review
    case 'low':
      return '✅'; // Low risk - likely legitimate
    default:
      return '❓'; // Unknown
  }
}

/**
 * Extract key insights from detailed explanation
 */
export function extractKeyInsights(detailedExplanation: string): string[] {
  const insights: string[] = [];
  
  // Extract SHAP contributions
  if (detailedExplanation.includes('Feature Contributions (SHAP)')) {
    const shapSection = detailedExplanation.split('Feature Contributions (SHAP)')[1];
    if (shapSection) {
      const lines = shapSection.split('\n').slice(1, 4); // Get top 3 features
      lines.forEach(line => {
        if (line.trim() && line.includes('.')) {
          insights.push(line.trim());
        }
      });
    }
  }
  
  // Extract feature importance
  if (detailedExplanation.includes('Most Important Features')) {
    const featuresSection = detailedExplanation.split('Most Important Features')[1];
    if (featuresSection) {
      const lines = featuresSection.split('\n').slice(1, 4); // Get top 3 features
      lines.forEach(line => {
        if (line.trim() && line.includes('.')) {
          insights.push(line.trim());
        }
      });
    }
  }
  
  return insights.slice(0, 3); // Return max 3 insights
}

/**
 * Usage example for your admin dashboard:
 * 
 * import { predictFraud, transformClaimDataForML, getRiskLevelColor } from './fraudDetectionAPI';
 * 
 * // In your claims component:
 * const handleFraudCheck = async (claim) => {
 *   const mlData = transformClaimDataForML(claim);
 *   console.log('📊 ML Data being sent:', mlData);
 *   console.log('🔍 RATIO DEBUG - Raw claim data:', {
 *     claimAmount: claim.claimAmount,
 *     claim_amount: claim.claim_amount,
 *     sum_insured: claim.sum_insured,
 *     rawRatio: claim.sum_insured > 0 ? (claim.claimAmount || claim.claim_amount || 0) / claim.sum_insured : 0
 *   });
 *   console.log('🔍 RATIO DEBUG - Transformed ML data:', {
 *     claim_amount: mlData.claim_amount,
 *     sum_insured: mlData.sum_insured,
 *     ratio: mlData.claim_amount_to_sum_insured_ratio,
 *     ratioPercentage: (mlData.claim_amount_to_sum_insured_ratio * 100).toFixed(1) + '%',
 *     willTriggerBusinessRule: mlData.claim_amount_to_sum_insured_ratio > 1.5
 *   });
 *   const result = await predictFraud(mlData);
 *   
 *   // Update claim with fraud score
 *   updateClaimFraudScore(claim.id, {
 *     fraudScore: result.fraud_score,
 *     riskLevel: result.risk_level,
 *     explanation: result.detailed_explanation
 *   });
 * };
 */
