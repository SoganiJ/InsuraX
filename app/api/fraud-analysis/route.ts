import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 🚨 REMOVED: Duplicate getGeminiAnalysis function that was causing infinite recursion
// The actual Gemini processing is handled by the POST function below

// Test function to verify Gemini integration
export async function testGeminiIntegration() {
  try {
    console.log('🧪 Testing Gemini integration...');
    
    const testData = {
      fraudScore: 0.116,
      riskLevel: 'low',
      confidence: 11.6,
      claimData: {
        claimantName: 'Test User',
        claimAmount: 3000,
        insurance_type: 'health',
        policyId: 'TEST123',
        status: 'Submitted'
      },
      mlAnalysis: {},
      shapValues: {},
      limeValues: {}
    };

    const response = await fetch('/api/fraud-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Gemini test successful:', result.analysis ? 'Analysis received' : 'No analysis');
      return true;
    } else {
      console.error('❌ Gemini test failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Gemini test error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Gemini fraud analysis API called (SAFELY RE-ENABLED)');
    
    const { 
      fraudScore, 
      riskLevel, 
      confidence, 
      claimData, 
      mlAnalysis, 
      shapValues, 
      limeValues,
      networkAnalysis,
      visionAnalysis
    } = await request.json();

    console.log('📊 Analysis data:', {
      fraudScore,
      riskLevel,
      confidence,
      claimantName: claimData?.claimantName,
      claimAmount: claimData?.claimAmount,
      hasNetworkAnalysis: !!networkAnalysis,
      hasVisionAnalysis: !!visionAnalysis,
      networkNetworksCount: networkAnalysis?.suspicious_networks?.length || 0,
      networkTypes: networkAnalysis?.suspicious_networks?.map((n: any) => n.type) || [],
      visionAnalysisDetails: {
        ocrResultsCount: visionAnalysis?.ocrResults?.length || 0,
        cnnResultsCount: visionAnalysis?.cnnResults?.length || 0,
        ocrResults: visionAnalysis?.ocrResults?.map((r: any) => ({ success: r.success, confidence: r.confidence })) || [],
        cnnResults: visionAnalysis?.cnnResults?.map((r: any) => ({ success: r.success, confidence: r.confidence })) || []
      }
    });

    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" 
    });

    // Create a comprehensive prompt for fraud analysis explanation
    const systemPrompt = `You are an expert insurance fraud analyst AI assistant. Your job is to provide a comprehensive fraud analysis using ALL available data and analysis results.

**CLAIMANT INFORMATION:**
- Name: ${claimData?.claimantName || 'Unknown'}
- Email: ${claimData?.email || 'N/A'}
- Phone: ${claimData?.phone || 'N/A'}
- Age: ${claimData?.insured_age || 'N/A'}
- Gender: ${claimData?.insured_sex || 'N/A'}
- Occupation: ${claimData?.insured_occupation || 'N/A'}

**POLICY INFORMATION:**
- Policy ID: ${claimData?.policyId || 'Unknown'}
- Type: ${claimData?.insurance_type || 'Unknown'}
- Term: ${claimData?.policy_term || 'N/A'}
- Premium: ₹${claimData?.policy_annual_premium || 0}
- Coverage: ₹${claimData?.sum_insured || 0}
- Renewal Status: ${claimData?.policy_renewal_status || 'N/A'}
- Payment Delays: ${claimData?.premium_payment_delays || 'N/A'}
- Coverage Changes: ${claimData?.coverage_changes_before_claim || 'N/A'}

**CLAIM DETAILS:**
- Amount: ₹${claimData?.claimAmount || 0}
- Type: ${claimData?.claimType || 'N/A'}
- Incident Date: ${claimData?.incidentDate || 'N/A'}
- Filed Date: ${claimData?.submittedDate || 'N/A'}
- Status: ${claimData?.status || 'Unknown'}
- Description: ${claimData?.description || 'N/A'}

**LOCATION INFORMATION:**
- Policy State: ${claimData?.policy_state || 'N/A'}
- Policy City: ${claimData?.policy_city || 'N/A'}
- Incident Location: ${claimData?.accident_location || claimData?.hospital_name || 'N/A'}

**INSURANCE-SPECIFIC DETAILS:**
${claimData?.insurance_type === 'automobile' ? `
**AUTO INSURANCE:**
- Make: ${claimData?.auto_make || 'N/A'}
- Model: ${claimData?.auto_model || 'N/A'}
- Year: ${claimData?.auto_year || 'N/A'}
- Third Party Involved: ${claimData?.third_party_involved || 'N/A'}
` : ''}
${claimData?.insurance_type === 'health' ? `
**HEALTH INSURANCE:**
- Hospital: ${claimData?.hospital_name || 'N/A'}
- Treatment: ${claimData?.treatment_details || 'N/A'}
- Duration: ${claimData?.claim_duration_days || 0} days
` : ''}
${claimData?.insurance_type === 'life' ? `
**LIFE INSURANCE:**
- Nominee Relationship: ${claimData?.nominee_relationship || 'N/A'}
` : ''}
${claimData?.insurance_type === 'property' ? `
**PROPERTY INSURANCE:**
- Property Type: ${claimData?.property_type || 'N/A'}
` : ''}
${claimData?.insurance_type === 'crop' ? `
**CROP INSURANCE:**
- Crop Type: ${claimData?.crop_type || 'N/A'}
- Weather: ${claimData?.weather_condition || 'N/A'}
` : ''}

**RISK ANALYSIS FEATURES:**
- Claim to Coverage Ratio: ${((claimData?.claimAmount || 0) / (claimData?.sum_insured || 1) * 100).toFixed(1)}%
- Policy Age at Incident: ${claimData?.policy_age_at_incident_days || 0} days
- Filing Delay: ${claimData?.claim_filing_delay_days || 0} days
- Previous Claims: ${claimData?.previous_claims_count || 0}
- Policy Duration: ${claimData?.policy_age_at_incident_days || 0} days

**ML ANALYSIS RESULTS:**
- Fraud Score: ${fraudScore} (0-1 scale)
- Risk Level: ${riskLevel}
- Confidence: ${confidence}%
- Is Fraud: ${fraudScore > 0.7 ? 'YES' : 'NO'}

**DETAILED ML ANALYSIS:**
${mlAnalysis?.detailed_explanation || 'No detailed explanation available'}

**BUSINESS RULE ANALYSIS:**
${claimData?.fraudExplanation || claimData?.detailed_explanation || 'No business rule analysis available'}

**TECHNICAL ML FEATURES:**
- Most Important Features: ${JSON.stringify(mlAnalysis?.feature_importance || {}, null, 2)}
- Feature Contributions (SHAP): ${JSON.stringify(shapValues, null, 2)}
- Local Interpretability (LIME): ${JSON.stringify(limeValues, null, 2)}
- Model Confidence: ${mlAnalysis?.confidence || 'N/A'}
- Final Score Breakdown: ${JSON.stringify(mlAnalysis?.score_breakdown || {}, null, 2)}

**DOCUMENT ANALYSIS:**
- Incident Photos: ${claimData?.incident_photos_count || 0} files
- Supporting Documents: ${claimData?.supporting_documents_count || 0} files

**NETWORK ANALYSIS RESULTS:**
${networkAnalysis ? `
- Suspicious Networks: ${networkAnalysis.suspicious_networks?.length || 0} detected
- Network Types: ${networkAnalysis.suspicious_networks?.map((n: any) => n.type).join(', ') || 'None'}
- Risk Score: ${networkAnalysis.overall_risk_score || 'N/A'}
- Recommendations: ${networkAnalysis.recommendations || 'None'}
- Note: Email domain networks are excluded as most users share common domains (Gmail, Yahoo, etc.)
` : 'No network analysis available'}

**VISION ANALYSIS RESULTS:**
${visionAnalysis ? `
- OCR Results: ${JSON.stringify(visionAnalysis.ocrResults || {}, null, 2)}
- CNN Results: ${JSON.stringify(visionAnalysis.cnnResults || {}, null, 2)}
- Image Analysis: ${visionAnalysis.isAnalyzing ? 'In progress' : 'Completed'}
` : 'No vision analysis available'}

**YOUR TASK:**
Create a comprehensive fraud analysis report that includes:

1. **EXECUTIVE SUMMARY** (3-4 sentences)
   - Overall fraud risk assessment based on ALL data
   - Key red flags or green flags identified
   - Primary recommendation

2. **COMPREHENSIVE RISK ASSESSMENT**
   - Explain the fraud score considering all factors
   - Analyze the confidence level and its reliability
   - Justify the risk level based on multiple data points

3. **DETAILED FINDINGS** (Top 5-7 most important factors)
   - Demographics analysis (age, gender, occupation)
   - Policy pattern analysis (premium, coverage, history)
   - Claim pattern analysis (amount, timing, location)
   - Behavioral analysis (filing delays, previous claims)
   - Technical analysis (ML model insights, feature importance)

4. **RED FLAGS** (Specific concerning patterns)
   - High-risk indicators from all data sources
   - Unusual patterns or anomalies
   - Business rule violations

5. **GREEN FLAGS** (Positive indicators)
   - Legitimate claim patterns
   - Supporting evidence
   - Low-risk characteristics

6. **NETWORK ANALYSIS INSIGHTS** ${networkAnalysis?.suspicious_networks?.length > 0 ? '(Available)' : '(No suspicious networks detected)'}
   ${networkAnalysis?.suspicious_networks?.length > 0 ? `
   - Suspicious connections detected: ${networkAnalysis.suspicious_networks.map((n: any) => `${n.type} (${n.risk_score > 0.7 ? 'High' : n.risk_score > 0.4 ? 'Medium' : 'Low'} risk)`).join(', ')}
   - Network details: ${networkAnalysis.suspicious_networks.map((n: any) => `${n.type}: ${n.shared_attribute} shared by ${n.user_names?.join(', ') || n.users?.join(', ') || 'Unknown users'}`).join('; ')}
   - User behavior in context of similar cases
   ` : `
   - No suspicious networks detected for this user
   - User appears to be isolated from known fraud patterns
   `}

7. **DOCUMENT VERIFICATION INSIGHTS** ${visionAnalysis && (visionAnalysis.ocrResults?.length > 0 || visionAnalysis.cnnResults?.length > 0) ? '(Available)' : '(No analysis performed)'}
   ${visionAnalysis && (visionAnalysis.ocrResults?.length > 0 || visionAnalysis.cnnResults?.length > 0) ? `
   **OCR ANALYSIS RESULTS:**
   ${visionAnalysis.ocrResults?.length > 0 ? visionAnalysis.ocrResults.map((ocr: any, index: number) => `
   - Document ${index + 1} (${ocr.document_name}):
     * Extracted Text: "${ocr.extracted_text || 'No text found'}"
     * Confidence: ${(ocr.confidence * 100).toFixed(1)}%
     * Verification Status: ${ocr.analysis?.verification_status || 'Not verified'}
     * Key Information: ${JSON.stringify(ocr.analysis?.key_info || {}, null, 2)}
     * Cross-reference with user profile: ${ocr.analysis?.key_info ? 'Compare extracted details with claimant information, policy details, and claim description for consistency' : 'No key information extracted'}
   `).join('\n') : 'No OCR analysis performed'}
   
   **CNN IMAGE ANALYSIS RESULTS:**
   ${visionAnalysis.cnnResults?.length > 0 ? visionAnalysis.cnnResults.map((cnn: any, index: number) => `
   - Image ${index + 1} (${cnn.photo_name}):
     * Verification Result: ${cnn.verification_result || 'Not analyzed'}
     * Confidence: ${(cnn.confidence * 100).toFixed(1)}%
     * Damage Assessment: ${JSON.stringify(cnn.analysis?.damage_assessment || {}, null, 2)}
     * Scene Verification: ${JSON.stringify(cnn.analysis?.scene_verification || {}, null, 2)}
     * Claim Description Match: ${cnn.verification_result ? 'Compare image analysis results with claim description for consistency. Look for mismatches between what the image shows and what is claimed.' : 'No verification performed'}
   `).join('\n') : 'No CNN analysis performed'}
   
   **CROSS-REFERENCE ANALYSIS:**
   ${visionAnalysis.ocrResults?.length > 0 || visionAnalysis.cnnResults?.length > 0 ? `
   - Document-Profile Consistency: ${visionAnalysis.ocrResults?.length > 0 ? `
     **CRITICAL ANALYSIS REQUIRED:**
     * Compare OCR extracted text with claimant name: "${claimData?.claimantName || 'Unknown'}"
     * Compare with claim description: "${claimData?.description || claimData?.incident_description || 'No description'}"
     * Compare with insurance type: "${claimData?.insurance_type || 'Unknown'}"
     * Compare with claim amount: ${claimData?.claimAmount || 'Unknown'}
     * **FRAUD INDICATOR**: If OCR text contains presentation slides, network graphs, academic content, or any non-insurance related content, this is a MAJOR RED FLAG for fraudulent document submission
     * **CONTENT RELEVANCE**: Insurance claims should contain medical reports, police reports, repair estimates, receipts, invoices, or other insurance-related documents - NOT academic presentations or random text
   ` : 'No OCR data to cross-reference'}
   - Image-Claim Consistency: ${visionAnalysis.cnnResults?.length > 0 ? `
     **CRITICAL ANALYSIS REQUIRED:**
     * Compare CNN image analysis with claim description: "${claimData?.description || claimData?.incident_description || 'No description'}"
     * Verify if image shows the claimed incident type (accident, medical, property damage, etc.)
     * Check if image content matches the insurance type: "${claimData?.insurance_type || 'Unknown'}"
     * Look for inconsistencies between what the image shows and what is claimed
   ` : 'No CNN data to cross-reference'}
   - Overall Document Authenticity: ${visionAnalysis.ocrResults?.length > 0 || visionAnalysis.cnnResults?.length > 0 ? `
     **FINAL ASSESSMENT:**
     * Rate document authenticity based on content relevance to insurance claims
     * Flag any documents that appear to be academic presentations, random text, or non-insurance content
     * Consider this a HIGH-RISK FRAUD INDICATOR if documents are irrelevant to the claim
   ` : 'No analysis available'}
   ` : 'No analysis data available for cross-reference'}
   ` : `
   - No document analysis performed
   - Consider running OCR and CNN analysis for document verification
   `}

8. **FINAL RECOMMENDATION**
   - Approve, Reject, or Investigate Further
   - Specific next steps and verification needed
   - Priority level for investigation

**GUIDELINES:**
- Use ALL available data in your analysis
- Cross-reference different data sources for consistency
- Explain the "why" behind each finding
- Be specific about what to investigate further
- Use professional, actionable language
- Consider both technical and business perspectives
- Highlight any data inconsistencies or missing information
- **CRITICAL**: Only mention network analysis if suspicious networks are actually detected
- **CRITICAL**: Only mention document verification if OCR/CNN analysis has been performed
- **CRITICAL**: Do not make assumptions about network connections or document analysis if the data shows "No suspicious networks detected" or "No analysis performed"
- **FRAUD DETECTION PRIORITY**: Pay special attention to document content relevance - if OCR extracts presentation slides, academic content, or non-insurance related text, this is a MAJOR fraud indicator
- **CONTENT VALIDATION**: Insurance claims should only contain relevant documents like medical reports, police reports, repair estimates, receipts, invoices, or other insurance-related documents
- **EXAMPLE**: If OCR extracts "Node A has 5 friends, network graphs, presentation slides" - this is IRRELEVANT to insurance claims and indicates potential fraud

Format the response as a comprehensive, structured report that an insurance professional can use for decision-making.`;

    console.log('🔄 Generating Gemini content...');
    
    // Generate content
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini analysis generated successfully');

    return NextResponse.json({ 
      analysis: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Gemini Fraud Analysis Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate fraud analysis. Please try again later.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  
  /*
  try {
    console.log('🤖 Gemini fraud analysis API called');
    
    const { 
      fraudScore, 
      riskLevel, 
      confidence, 
      claimData, 
      mlAnalysis, 
      shapValues, 
      limeValues 
    } = await request.json();

    console.log('📊 Analysis data:', {
      fraudScore,
      riskLevel,
      confidence,
      claimantName: claimData?.claimantName,
      claimAmount: claimData?.claimAmount
    });

    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" 
    });

    // Create a comprehensive prompt for fraud analysis explanation
    const systemPrompt = `You are an expert insurance fraud analyst AI assistant. Your job is to explain fraud detection analysis in simple, understandable terms for insurance professionals.

**CLAIM DATA:**
- Claimant: ${claimData?.claimantName || 'Unknown'}
- Claim Amount: ₹${claimData?.claimAmount || 0}
- Insurance Type: ${claimData?.insurance_type || 'Unknown'}
- Policy ID: ${claimData?.policyId || 'Unknown'}
- Status: ${claimData?.status || 'Unknown'}

**ML ANALYSIS RESULTS:**
- Fraud Score: ${fraudScore} (0-1 scale)
- Risk Level: ${riskLevel}
- Confidence: ${confidence}%
- Is Fraud: ${fraudScore > 0.7 ? 'YES' : 'NO'}

**TECHNICAL ANALYSIS:**
${JSON.stringify(mlAnalysis, null, 2)}

**SHAP VALUES (Feature Contributions):**
${JSON.stringify(shapValues, null, 2)}

**LIME VALUES (Local Interpretations):**
${JSON.stringify(limeValues, null, 2)}

**YOUR TASK:**
Create a clear, professional fraud analysis report that includes:

1. **EXECUTIVE SUMMARY** (2-3 sentences)
   - Overall fraud risk assessment
   - Key recommendation

2. **RISK ASSESSMENT** 
   - Explain the fraud score in simple terms
   - What the confidence level means
   - Risk level justification

3. **KEY FINDINGS** (Top 3-5 most important factors)
   - Explain each factor in plain English
   - Why it matters for fraud detection
   - Whether it supports or contradicts fraud

4. **RED FLAGS** (if any)
   - Specific concerning patterns
   - Unusual behaviors or values

5. **GREEN FLAGS** (if any)
   - Positive indicators
   - Legitimate claim patterns

6. **RECOMMENDATION**
   - Approve, Reject, or Investigate Further
   - Specific next steps
   - Additional verification needed

**GUIDELINES:**
- Use simple, professional language
- Avoid technical jargon
- Focus on actionable insights
- Be specific about what to look for
- Explain the "why" behind each finding
- Use bullet points for clarity
- Keep it concise but comprehensive

Format the response as a structured report that an insurance professional can easily understand and act upon.`;

    console.log(' Generating Gemini content...');
    
    // Generate content
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini analysis generated successfully');

    return NextResponse.json({ 
      analysis: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Gemini Fraud Analysis Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate fraud analysis. Please try again later.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  */
}
