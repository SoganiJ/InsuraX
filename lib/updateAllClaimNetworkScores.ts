import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { calculateNetworkScore, calculateCompositeScore } from './compositeScoring';

/**
 * Update network scores for all claims when network analysis changes
 */
export async function updateAllClaimNetworkScores() {
  console.log('🔄 Updating network scores for all claims...');

  // Get latest network analysis
  const cacheDoc = await getDoc(doc(db, 'networkAnalysisCache', 'latest'));
  if (!cacheDoc.exists()) {
    console.log('❌ No network analysis cache found');
    return;
  }

  const networkAnalysis = cacheDoc.data().networkAnalysis;

  // Get all claims
  const claimsSnapshot = await getDocs(collection(db, 'claims'));
  let updatedCount = 0;

  for (const claimDoc of claimsSnapshot.docs) {
    const claim = claimDoc.data();

    // Recalculate network score
    const newNetworkScore = calculateNetworkScore(claim.userId, networkAnalysis);

    // Get existing ML/OCR/CNN scores
    const mlScore = claim.fraudScore ? {
      fraud_score: claim.fraudScore,
      risk_level: claim.riskLevel || 'low',
      detailed_explanation: claim.fraudExplanation || '',
      is_fraud: claim.is_fraud || false
    } : null;

    const ocrScore = claim.composite_score?.ocr_score || null;
    const cnnScore = claim.composite_score?.cnn_score || null;

    // Recalculate composite score with new network score
    const newCompositeScore = calculateCompositeScore(
      mlScore,
      newNetworkScore,
      ocrScore ? {
        overall_confidence: ocrScore,
        documents_analyzed: 1,
        suspicious_documents: 0,
        authenticity_score: 1 - ocrScore
      } : null,
      cnnScore ? {
        overall_confidence: cnnScore,
        images_analyzed: 1,
        suspicious_images: 0,
        damage_authenticity: 1 - cnnScore
      } : null
    );

    // Update claim with new scores
    await updateDoc(doc(db, 'claims', claimDoc.id), {
      'composite_score.network_score': newNetworkScore.overall_risk,
      'composite_fraud_score': newCompositeScore.composite_fraud_score,
      'composite_risk_level': newCompositeScore.composite_risk_level,
      'composite_confidence': newCompositeScore.composite_confidence,
      'composite_last_updated': new Date().toISOString(),
      'composite_score': newCompositeScore
    });

    updatedCount++;
  }

  console.log(`✅ Updated network scores for ${updatedCount} claims`);
}
