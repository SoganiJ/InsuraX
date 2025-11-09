import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { calculateNetworkScore, calculateCompositeScore } from '@/lib/compositeScoring';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting retroactive network score update...');
    
    const { networkAnalysis } = await request.json();
    
    if (!networkAnalysis) {
      return NextResponse.json({ 
        error: 'Network analysis data is required' 
      }, { status: 400 });
    }

    // Store the latest network analysis in cache
    console.log('💾 Storing network analysis in cache...');
    await setDoc(doc(db, 'networkAnalysisCache', 'latest'), {
      networkAnalysis: networkAnalysis,
      timestamp: Date.now(),
      source: 'network_analysis_component'
    });

    // Get all claims
    console.log('📊 Fetching all claims from Firestore...');
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    const totalClaims = claimsSnapshot.size;
    let updatedCount = 0;
    let errorCount = 0;

    console.log(`📊 Processing ${totalClaims} claims...`);

    for (const claimDoc of claimsSnapshot.docs) {
      try {
        const claim = claimDoc.data();
        const claimId = claimDoc.id;

        if (!claim.userId) {
          console.warn(`⚠️ Skipping claim ${claimId} - no userId`);
          continue;
        }

        // Recalculate network score for this user
        const newNetworkScore = calculateNetworkScore(claim.userId, networkAnalysis);

        // Get existing scores from the claim
        const mlScore = claim.fraudScore ? {
          fraud_score: claim.fraudScore,
          risk_level: claim.riskLevel || 'low',
          detailed_explanation: claim.fraudExplanation || '',
          is_fraud: claim.is_fraud || false
        } : null;

        // Get OCR and CNN scores if they exist
        const existingComposite = claim.composite_score || {};
        const ocrScore = existingComposite.ocr_score;
        const cnnScore = existingComposite.cnn_score;

        // Reconstruct OCR and CNN score objects if scores exist
        const ocrScoreObj = ocrScore !== undefined && ocrScore !== null ? {
          overall_confidence: ocrScore,
          documents_analyzed: claim.supporting_documents?.length || 0,
          suspicious_documents: 0,
          authenticity_score: 1 - ocrScore
        } : null;

        const cnnScoreObj = cnnScore !== undefined && cnnScore !== null ? {
          overall_confidence: cnnScore,
          images_analyzed: claim.incident_photos?.length || 0,
          suspicious_images: 0,
          damage_authenticity: 1 - cnnScore
        } : null;

        // Recalculate composite score with new network score
        const newCompositeScore = calculateCompositeScore(
          mlScore,
          newNetworkScore,
          ocrScoreObj,
          cnnScoreObj
        );

        // Update the claim document
        await updateDoc(doc(db, 'claims', claimId), {
          'composite_score': newCompositeScore,
          'composite_fraud_score': newCompositeScore.composite_fraud_score,
          'composite_risk_level': newCompositeScore.composite_risk_level,
          'composite_confidence': newCompositeScore.composite_confidence,
          'network_score_updated_at': new Date().toISOString(),
          'network_analysis_version': Date.now()
        });

        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`✅ Updated ${updatedCount}/${totalClaims} claims...`);
        }
      } catch (err) {
        errorCount++;
        console.error(`❌ Error updating claim ${claimDoc.id}:`, err);
      }
    }

    const result = {
      success: true,
      totalClaims,
      updatedCount,
      errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Retroactive score update completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in retroactive score update:', error);
    return NextResponse.json({ 
      error: 'Failed to update claim scores',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
