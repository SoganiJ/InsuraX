/**
 * Composite Fraud Scoring System
 * Combines ML Model, Network Analysis, OCR, and CNN scores into a unified fraud score
 */

export interface MLScore {
  fraud_score: number;           // 0-1
  risk_level: 'low' | 'medium' | 'high';
  detailed_explanation: string;
  is_fraud: boolean;
}

export interface NetworkScore {
  overall_risk: number;          // 0-1
  suspicious_networks_count: number;
  is_rapid_filer: boolean;
  is_in_fraud_ring: boolean;
}

export interface OCRScore {
  overall_confidence: number;    // 0-1
  documents_analyzed: number;
  suspicious_documents: number;
  authenticity_score: number;    // 0-1
}

export interface CNNScore {
  overall_confidence: number;    // 0-1
  images_analyzed: number;
  suspicious_images: number;
  damage_authenticity: number;   // 0-1
}

export interface CompositeScore {
  // Final composite score
  composite_fraud_score: number;           // 0-1 (weighted average of all components)
  composite_risk_level: 'low' | 'medium' | 'high';
  composite_confidence: number;            // 0-100
  
  // Individual component scores
  ml_score: number;                        // 0-1
  network_score: number;                   // 0-1
  ocr_score: number;                       // 0-1
  cnn_score: number;                       // 0-1
  
  // Component weights used
  weights: {
    ml: number;
    network: number;
    ocr: number;
    cnn: number;
  };
  
  // Metadata
  components_analyzed: string[];           // Which components were available
  analysis_timestamp: string;
  detailed_breakdown: string;
}

/**
 * Default weights for each component
 * Total should equal 1.0
 */
const DEFAULT_WEIGHTS = {
  ml: 0.35,        // 40% - ML model (textual data analysis)
  network: 0.35,   // 25% - Network analysis (fraud rings)
  ocr: 0.20,       // 20% - OCR (document verification)
  cnn: 0.15        // 15% - CNN (image verification)
};

/**
 * Calculate OCR score from vision analysis results
 * Compares extracted document data with user and claim details
 */
export function calculateOCRScore(
  ocrResults: Record<string, any>, 
  userDetails?: any, 
  claimDetails?: any
): OCRScore {
  const results = Object.values(ocrResults);
  
  if (results.length === 0) {
    return {
      overall_confidence: 0,
      documents_analyzed: 0,
      suspicious_documents: 0,
      authenticity_score: 1.0 // Neutral score if no analysis
    };
  }
  
  let totalConfidence = 0;
  let suspiciousCount = 0;
  let totalMatchScore = 0;
  
  results.forEach((result: any) => {
    const baseConfidence = result.confidence || 0;
    totalConfidence += baseConfidence;
    
    const extractedText = (result.extracted_text || '').toLowerCase();
    let matchScore = 1.0; // Start with perfect match
    let isSuspicious = false;
    
    // 1. Check for obviously fake/test documents
    if (extractedText.includes('presentation') ||
        extractedText.includes('slide') ||
        extractedText.includes('network graph') ||
        extractedText.includes('node a') ||
        extractedText.includes('academic') ||
        extractedText.includes('sample document') ||
        extractedText.includes('lorem ipsum') ||
        extractedText.length < 20) {
      isSuspicious = true;
      matchScore -= 0.5; // Heavy penalty
    }
    
    // 2. Compare with user details if available
    if (userDetails) {
      const userName = (userDetails.displayName || userDetails.name || '').toLowerCase();
      const userEmail = (userDetails.email || '').toLowerCase();
      const userPhone = (userDetails.phone || userDetails.phoneNumber || '').toString();
      
      // Check if user name appears in document
      if (userName && userName.length > 3) {
        const nameWords = userName.split(' ').filter((w: string) => w.length > 2);
        const nameMatches = nameWords.filter((word: string) => extractedText.includes(word));
        
        if (nameMatches.length === 0 && extractedText.length > 50) {
          // Document doesn't contain user's name - suspicious
          matchScore -= 0.3;
          isSuspicious = true;
        } else if (nameMatches.length > 0) {
          // Name found - good sign
          matchScore += 0.1;
        }
      }
      
      // Check if email appears
      if (userEmail && extractedText.includes(userEmail)) {
        matchScore += 0.1;
      }
      
      // Check if phone appears
      if (userPhone && userPhone.length > 5 && extractedText.includes(userPhone)) {
        matchScore += 0.1;
      }
    }
    
    // 3. Compare with claim details if available
    if (claimDetails) {
      const claimAmount = claimDetails.claimAmount || claimDetails.claim_amount || 0;
      const policyId = (claimDetails.policyId || claimDetails.policy_id || '').toLowerCase();
      const incidentDate = (claimDetails.incidentDate || claimDetails.incident_date || '').toLowerCase();
      
      // Check if claim amount appears (with some tolerance)
      if (claimAmount > 0) {
        const amountStr = claimAmount.toString();
        const amountVariations = [
          amountStr,
          claimAmount.toLocaleString('en-IN'),
          (claimAmount / 1000).toFixed(0) + 'k',
          (claimAmount / 100000).toFixed(1) + 'l'
        ];
        
        const amountFound = amountVariations.some(variant => 
          extractedText.includes(variant.toLowerCase())
        );
        
        if (amountFound) {
          matchScore += 0.15;
        }
      }
      
      // Check if policy ID appears
      if (policyId && policyId.length > 3 && extractedText.includes(policyId)) {
        matchScore += 0.15;
      }
      
      // Check if incident date appears
      if (incidentDate && extractedText.includes(incidentDate)) {
        matchScore += 0.1;
      }
    }
    
    // Normalize match score to 0-1 range
    matchScore = Math.max(0, Math.min(1.0, matchScore));
    totalMatchScore += matchScore;
    
    if (isSuspicious || matchScore < 0.5) {
      suspiciousCount++;
    }
  });
  
  const avgConfidence = totalConfidence / results.length;
  const avgMatchScore = totalMatchScore / results.length;
  
  // Authenticity score combines OCR confidence with data matching
  // 60% weight on match score, 40% on OCR confidence
  const authenticityScore = (avgMatchScore * 0.6) + (avgConfidence * 0.4);
  
  return {
    overall_confidence: avgConfidence,
    documents_analyzed: results.length,
    suspicious_documents: suspiciousCount,
    authenticity_score: Math.max(0, Math.min(1.0, authenticityScore))
  };
}

/**
 * Calculate CNN score from vision analysis results
 * Compares image analysis with incident description and claim details
 */
export function calculateCNNScore(
  cnnResults: Record<string, any>,
  incidentDescription?: string,
  claimDetails?: any
): CNNScore {
  const results = Object.values(cnnResults);
  
  if (results.length === 0) {
    return {
      overall_confidence: 0,
      images_analyzed: 0,
      suspicious_images: 0,
      damage_authenticity: 1.0 // Neutral score if no analysis
    };
  }
  
  let totalConfidence = 0;
  let suspiciousCount = 0;
  let totalConsistencyScore = 0;
  
  const description = (incidentDescription || '').toLowerCase();
  const claimAmount = claimDetails?.claimAmount || claimDetails?.claim_amount || 0;
  const insuranceType = (claimDetails?.insurance_type || '').toLowerCase();
  
  results.forEach((result: any) => {
    const baseConfidence = result.confidence || 0;
    totalConfidence += baseConfidence;
    
    const verificationResult = (result.verification_result || '').toLowerCase();
    const sceneAnalysis = (result.scene_analysis || '').toLowerCase();
    const detectedObjects = result.detected_objects || [];
    
    let consistencyScore = 1.0; // Start with perfect consistency
    let isSuspicious = false;
    
    // 1. Check for obvious red flags
    if (verificationResult.includes('mismatch') ||
        verificationResult.includes('inconsistent') ||
        verificationResult.includes('suspicious') ||
        verificationResult.includes('fabricated') ||
        baseConfidence < 0.5) {
      isSuspicious = true;
      consistencyScore -= 0.4;
    }
    
    // 2. Compare with incident description
    if (description && description.length > 10) {
      // Extract key terms from description
      const descriptionTerms = [
        'accident', 'collision', 'damage', 'broken', 'crashed',
        'fire', 'theft', 'stolen', 'vandalism',
        'injury', 'hospital', 'medical',
        'flood', 'water', 'storm', 'natural disaster'
      ];
      
      const relevantTerms = descriptionTerms.filter(term => description.includes(term));
      
      // Check if scene analysis mentions similar terms
      const sceneMatchCount = relevantTerms.filter(term => 
        sceneAnalysis.includes(term) || 
        verificationResult.includes(term)
      ).length;
      
      if (relevantTerms.length > 0) {
        const matchRatio = sceneMatchCount / relevantTerms.length;
        if (matchRatio < 0.3) {
          // Scene doesn't match description - suspicious
          consistencyScore -= 0.3;
          isSuspicious = true;
        } else if (matchRatio > 0.7) {
          // Good match
          consistencyScore += 0.2;
        }
      }
      
      // Check for insurance type specific objects
      if (insuranceType === 'automobile' || insuranceType === 'auto') {
        const hasVehicle = detectedObjects.some((obj: string) => 
          ['car', 'vehicle', 'auto', 'truck', 'motorcycle'].includes(obj.toLowerCase())
        );
        if (!hasVehicle && description.includes('car')) {
          consistencyScore -= 0.2;
          isSuspicious = true;
        } else if (hasVehicle) {
          consistencyScore += 0.1;
        }
      }
      
      if (insuranceType === 'property' || insuranceType === 'home') {
        const hasProperty = detectedObjects.some((obj: string) => 
          ['house', 'building', 'property', 'home', 'roof', 'wall'].includes(obj.toLowerCase())
        );
        if (!hasProperty && description.includes('house')) {
          consistencyScore -= 0.2;
          isSuspicious = true;
        } else if (hasProperty) {
          consistencyScore += 0.1;
        }
      }
    }
    
    // 3. Compare damage severity with claim amount
    if (claimAmount > 0 && sceneAnalysis) {
      const severityKeywords = {
        minor: ['minor', 'small', 'light', 'scratch', 'dent'],
        moderate: ['moderate', 'medium', 'significant'],
        severe: ['severe', 'major', 'total', 'destroyed', 'extensive']
      };
      
      let detectedSeverity = 'unknown';
      if (severityKeywords.minor.some(kw => sceneAnalysis.includes(kw))) {
        detectedSeverity = 'minor';
      } else if (severityKeywords.severe.some(kw => sceneAnalysis.includes(kw))) {
        detectedSeverity = 'severe';
      } else if (severityKeywords.moderate.some(kw => sceneAnalysis.includes(kw))) {
        detectedSeverity = 'moderate';
      }
      
      // Check if claim amount matches damage severity
      if (detectedSeverity === 'minor' && claimAmount > 500000) {
        // Minor damage but huge claim - suspicious
        consistencyScore -= 0.4;
        isSuspicious = true;
      } else if (detectedSeverity === 'severe' && claimAmount < 50000) {
        // Severe damage but tiny claim - unusual but not necessarily fraud
        consistencyScore -= 0.1;
      } else if (detectedSeverity === 'minor' && claimAmount < 100000) {
        // Minor damage, reasonable claim
        consistencyScore += 0.1;
      } else if (detectedSeverity === 'severe' && claimAmount > 200000) {
        // Severe damage, high claim - consistent
        consistencyScore += 0.1;
      }
    }
    
    // 4. Check for stock photos or staged scenes
    if (verificationResult.includes('stock photo') ||
        verificationResult.includes('staged') ||
        verificationResult.includes('generic') ||
        sceneAnalysis.includes('watermark')) {
      consistencyScore -= 0.5;
      isSuspicious = true;
    }
    
    // Normalize consistency score
    consistencyScore = Math.max(0, Math.min(1.0, consistencyScore));
    totalConsistencyScore += consistencyScore;
    
    if (isSuspicious || consistencyScore < 0.5) {
      suspiciousCount++;
    }
  });
  
  const avgConfidence = totalConfidence / results.length;
  const avgConsistencyScore = totalConsistencyScore / results.length;
  
  // Damage authenticity combines CNN confidence with consistency analysis
  // 50% weight on consistency, 50% on CNN confidence
  const damageAuthenticity = (avgConsistencyScore * 0.5) + (avgConfidence * 0.5);
  
  return {
    overall_confidence: avgConfidence,
    images_analyzed: results.length,
    suspicious_images: suspiciousCount,
    damage_authenticity: Math.max(0, Math.min(1.0, damageAuthenticity))
  };
}

/**
 * Calculate network score for a specific user
 * Combines: base risk score + network membership + rapid filing
 */
export function calculateNetworkScore(
  userId: string,
  networkAnalysis: any
): NetworkScore {
  if (!networkAnalysis) {
    return {
      overall_risk: 0,
      suspicious_networks_count: 0,
      is_rapid_filer: false,
      is_in_fraud_ring: false
    };
  }
  
  // Get user's base risk score from Neo4j
  const userRiskScore = networkAnalysis.risk_scores?.[userId];
  const baseRisk = userRiskScore?.overall_risk || 0;
  
  // Check if user is in any suspicious networks
  const userNetworks = networkAnalysis.suspicious_networks?.filter((network: any) => {
    const users = network.users || [];
    const userNames = network.user_names || [];
    const userEmails = network.user_emails || [];
    return users.includes(userId) || userNames.includes(userId) || userEmails.includes(userId);
  }) || [];
  
  // Check if rapid filer and get claim count
  const rapidFilerInfo = networkAnalysis.fraud_indicators?.rapid_claim_filers?.find(
    (filer: any) => filer.userId === userId || filer.email === userId
  );
  const isRapidFiler = !!rapidFilerInfo;
  const claimCount = rapidFilerInfo?.claim_count || 0;
  
  // Calculate composite network risk score
  let networkRisk = baseRisk;
  
  // Add risk from suspicious network membership
  if (userNetworks.length > 0) {
    // Get the highest risk network the user is in
    const maxNetworkRisk = Math.max(...userNetworks.map((n: any) => n.risk_score || 0));
    // Weight: 40% base risk + 40% network risk
    networkRisk = (baseRisk * 0.4) + (maxNetworkRisk * 0.4);
    
    // Add extra risk for multiple networks
    if (userNetworks.length > 1) {
      networkRisk = Math.min(1.0, networkRisk + (userNetworks.length - 1) * 0.05);
    }
  }
  
  // Add risk from rapid filing
  if (isRapidFiler) {
    let rapidFilingRisk = 0;
    if (claimCount >= 5) {
      rapidFilingRisk = 0.3; // High risk
    } else if (claimCount >= 3) {
      rapidFilingRisk = 0.2; // Medium risk
    } else {
      rapidFilingRisk = 0.1; // Low risk
    }
    
    // Weight: previous risk + 20% rapid filing risk
    networkRisk = Math.min(1.0, networkRisk + (rapidFilingRisk * 0.2));
  }
  
  // Ensure risk is between 0 and 1
  networkRisk = Math.max(0, Math.min(1.0, networkRisk));
  
  return {
    overall_risk: networkRisk,
    suspicious_networks_count: userNetworks.length,
    is_rapid_filer: isRapidFiler,
    is_in_fraud_ring: userNetworks.length > 0
  };
}

/**
 * Calculate composite fraud score from all components
 */
export function calculateCompositeScore(
  mlScore: MLScore | null,
  networkScore: NetworkScore | null,
  ocrScore: OCRScore | null,
  cnnScore: CNNScore | null,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): CompositeScore {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  const componentsAnalyzed: string[] = [];
  
  // Extract individual scores
  const ml = mlScore?.fraud_score || 0;
  const network = networkScore?.overall_risk || 0;
  
  // For OCR: Higher fraud score if documents are suspicious
  // authenticity_score of 1.0 = authentic (low fraud), 0.0 = suspicious (high fraud)
  const ocr = ocrScore ? (1.0 - ocrScore.authenticity_score) : 0;
  
  // For CNN: Higher fraud score if images are suspicious
  // damage_authenticity of 1.0 = authentic (low fraud), 0.0 = suspicious (high fraud)
  const cnn = cnnScore ? (1.0 - cnnScore.damage_authenticity) : 0;
  
  // Track which components were analyzed
  if (mlScore) componentsAnalyzed.push('ML Model');
  if (networkScore && networkScore.overall_risk > 0) componentsAnalyzed.push('Network Analysis');
  if (ocrScore && ocrScore.documents_analyzed > 0) componentsAnalyzed.push('OCR Analysis');
  if (cnnScore && cnnScore.images_analyzed > 0) componentsAnalyzed.push('CNN Analysis');
  
  // Adjust weights based on available components
  let totalWeight = 0;
  const adjustedWeights = { ...weights };
  
  if (!mlScore) adjustedWeights.ml = 0;
  if (!networkScore || networkScore.overall_risk === 0) adjustedWeights.network = 0;
  if (!ocrScore || ocrScore.documents_analyzed === 0) adjustedWeights.ocr = 0;
  if (!cnnScore || cnnScore.images_analyzed === 0) adjustedWeights.cnn = 0;
  
  totalWeight = adjustedWeights.ml + adjustedWeights.network + adjustedWeights.ocr + adjustedWeights.cnn;
  
  // Normalize weights if some components are missing
  if (totalWeight > 0 && totalWeight < 1.0) {
    adjustedWeights.ml = adjustedWeights.ml / totalWeight;
    adjustedWeights.network = adjustedWeights.network / totalWeight;
    adjustedWeights.ocr = adjustedWeights.ocr / totalWeight;
    adjustedWeights.cnn = adjustedWeights.cnn / totalWeight;
  }
  
  // Calculate weighted composite score
  const compositeFraudScore = 
    (ml * adjustedWeights.ml) +
    (network * adjustedWeights.network) +
    (ocr * adjustedWeights.ocr) +
    (cnn * adjustedWeights.cnn);
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (compositeFraudScore >= 0.7) {
    riskLevel = 'high';
  } else if (compositeFraudScore >= 0.4) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  // Calculate confidence based on number of components analyzed
  const confidence = Math.min(100, (componentsAnalyzed.length / 4) * 100);
  
  // Create detailed breakdown
  const breakdown = `
📊 COMPOSITE FRAUD SCORE BREAKDOWN:

🎯 Final Score: ${(compositeFraudScore * 100).toFixed(1)}% (${riskLevel.toUpperCase()} RISK)
📈 Confidence: ${confidence.toFixed(0)}% (${componentsAnalyzed.length}/4 components analyzed)

📋 COMPONENT SCORES:
${mlScore ? `✅ ML Model: ${(ml * 100).toFixed(1)}% (Weight: ${(adjustedWeights.ml * 100).toFixed(0)}%)` : '❌ ML Model: Not analyzed'}
${networkScore && networkScore.overall_risk > 0 ? `✅ Network Analysis: ${(network * 100).toFixed(1)}% (Weight: ${(adjustedWeights.network * 100).toFixed(0)}%)` : '❌ Network Analysis: Not analyzed'}
${ocrScore && ocrScore.documents_analyzed > 0 ? `✅ OCR Analysis: ${(ocr * 100).toFixed(1)}% (Weight: ${(adjustedWeights.ocr * 100).toFixed(0)}%)` : '❌ OCR Analysis: Not analyzed'}
${cnnScore && cnnScore.images_analyzed > 0 ? `✅ CNN Analysis: ${(cnn * 100).toFixed(1)}% (Weight: ${(adjustedWeights.cnn * 100).toFixed(0)}%)` : '❌ CNN Analysis: Not analyzed'}

🔍 DETAILED INSIGHTS:
${mlScore ? `- ML Analysis: ${mlScore.is_fraud ? '🚨 FRAUD DETECTED' : '✅ Appears Legitimate'}` : ''}
${networkScore && networkScore.suspicious_networks_count > 0 ? `- Network: 🚨 User is part of ${networkScore.suspicious_networks_count} suspicious network(s)` : ''}
${networkScore && networkScore.is_rapid_filer ? `- Network: ⚠️ Rapid claim filer detected` : ''}
${ocrScore && ocrScore.suspicious_documents > 0 ? `- OCR: ⚠️ ${ocrScore.suspicious_documents}/${ocrScore.documents_analyzed} documents flagged as suspicious` : ''}
${cnnScore && cnnScore.suspicious_images > 0 ? `- CNN: ⚠️ ${cnnScore.suspicious_images}/${cnnScore.images_analyzed} images flagged as suspicious` : ''}

📌 Components Analyzed: ${componentsAnalyzed.join(', ') || 'None'}
`.trim();
  
  return {
    composite_fraud_score: compositeFraudScore,
    composite_risk_level: riskLevel,
    composite_confidence: confidence,
    ml_score: ml,
    network_score: network,
    ocr_score: ocr,
    cnn_score: cnn,
    weights: adjustedWeights,
    components_analyzed: componentsAnalyzed,
    analysis_timestamp: new Date().toISOString(),
    detailed_breakdown: breakdown
  };
}

/**
 * Helper function to format composite score for display
 */
export function formatCompositeScore(score: CompositeScore): string {
  return `${(score.composite_fraud_score * 100).toFixed(1)}% (${score.composite_risk_level.toUpperCase()})`;
}

/**
 * Get risk color for composite score
 */
export function getCompositeRiskColor(riskLevel: string): string {
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
