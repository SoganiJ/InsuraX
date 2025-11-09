'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../firebase/config'; // Switched to relative path
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { 
  PieChart as RechartsPieChart, 
  Pie,
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { FileText, BarChart3, PieChart, TrendingUp, Users, AlertTriangle } from 'lucide-react';

// Import our dashboard components using relative paths
import PriorityAlert from './admindashboard/PriorityAlert';
import DynamicKPI from './admindashboard/DynamicKPI';
import LiveTriageQueue from './admindashboard/LiveTriageQueue';
import ClaimDetailsModal from './admindashboard/ClaimDetailsModal';
import { predictFraud, transformClaimDataForML, processGeminiAnalysis } from '@/lib/fraudDetectionAPI';
import { calculateCompositeScore, calculateOCRScore, calculateCNNScore, calculateNetworkScore, type MLScore, type OCRScore, type CNNScore } from '@/lib/compositeScoring';
import { analyzeDocumentOCR, analyzeIncidentPhoto, extractBase64FromDataURL } from '@/lib/visionAPI';
import LoadingSpinner from './ui/LoadingSpinner';

const AdminDashboardContent = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // State for our live data
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [loadingClaims, setLoadingClaims] = useState(true); // Loading state for claims
  const [processingClaims, setProcessingClaims] = useState<Set<string>>(new Set());
  const [lastProcessed, setLastProcessed] = useState<Map<string, number>>(new Map());
  const [processedClaims, setProcessedClaims] = useState<Set<string>>(new Set()); // Track which claims have been processed
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number>(0);
  // Removed geminiProcessing state - now handled per claim in modal

  // Derived state: these values are automatically calculated when `claims` changes
  const highRiskCount = claims.filter(c => (c.fraudScore || 0) > 0.7).length;
  const pendingClaimsCount = claims.filter(c => c.status === 'Submitted' || c.status === 'Under Review').length;
  const approvedClaimsCount = claims.filter(c => c.status === 'Approved').length;
  const rejectedClaimsCount = claims.filter(c => c.status === 'Rejected').length;
  const onHoldClaimsCount = claims.filter(c => c.status === 'On Hold').length;
  const totalClaimsCount = claims.length;
  const averageFraudScore = claims.length > 0 ? claims.reduce((sum, c) => sum + (c.fraudScore || 0), 0) / claims.length : 0;
  const totalClaimAmount = claims.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
  const averageClaimAmount = claims.length > 0 ? totalClaimAmount / claims.length : 0;

  const shouldProcessClaim = (claimId: string): boolean => {
    const now = Date.now();
    const lastProcessedTime = lastProcessed.get(claimId) || 0;
    const cooldownPeriod = 10000; // 10 seconds cooldown
    
    if (now - lastProcessedTime < cooldownPeriod) {
      console.log('⏸️ Claim processing cooldown active for:', claimId);
      return false;
    }
    
    if (processingClaims.has(claimId)) {
      console.log('⏸️ Claim already being processed:', claimId);
      return false;
    }
    
    return true;
  };

  // 🚀 COMPREHENSIVE ANALYSIS FUNCTION - Runs all 4 components automatically
  const runComprehensiveAnalysis = async (claimId: string, claimData: any, fraudResult: any) => {
    console.log('🔄 Starting comprehensive analysis for claim:', claimId);
    
    const mlScore: MLScore = {
      fraud_score: fraudResult.fraud_score,
      risk_level: fraudResult.risk_level,
      detailed_explanation: fraudResult.detailed_explanation,
      is_fraud: fraudResult.is_fraud
    };
    
    let networkScore = null;
    let ocrScore = null;
    let cnnScore = null;
    
    // 1️⃣ NETWORK ANALYSIS - Check if already cached, otherwise run
    try {
      console.log('📊 Running network analysis...');
      const cacheDoc = await getDoc(doc(db, 'networkAnalysisCache', 'latest'));
      let networkAnalysis = null;
      
      if (cacheDoc.exists()) {
        const cacheData = cacheDoc.data();
        const cacheAge = Date.now() - cacheData.timestamp;
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes
          console.log('✅ Using cached network analysis');
          networkAnalysis = cacheData.networkAnalysis;
        }
      }
      
      if (!networkAnalysis) {
        console.log('🔄 Fetching fresh network analysis...');
        // Fetch all data for network analysis
        const [usersResponse, policiesResponse, claimsResponse] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/policies'),
          fetch('/api/admin/claims')
        ]);
        
        const users = await usersResponse.json();
        const policies = await policiesResponse.json();
        const claims = await claimsResponse.json();
        
        const response = await fetch('http://localhost:5000/api/fraud-rings/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: users.data || [],
            policies: policies.data || [],
            claims: claims.data || []
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            networkAnalysis = result.results;
            // Cache it
            await setDoc(doc(db, 'networkAnalysisCache', 'latest'), {
              networkAnalysis: result.results,
              timestamp: Date.now(),
              source: 'auto'
            });
            console.log('✅ Network analysis completed and cached');
          }
        }
      }
      
      if (networkAnalysis) {
        networkScore = calculateNetworkScore(claimData.userId, networkAnalysis);
        console.log('✅ Network score calculated:', networkScore);
      }
    } catch (error) {
      console.error('❌ Network analysis failed:', error);
    }
    
    // 2️⃣ OCR ANALYSIS - Analyze all supporting documents
    try {
      console.log('📄 Running OCR analysis on documents...');
      const documents = claimData.supporting_documents || [];
      const ocrResults: Record<string, any> = {};
      
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        try {
          const base64Data = extractBase64FromDataURL(document.base64 || `data:${document.type};base64,${document.base64}`);
          const result = await analyzeDocumentOCR(base64Data, document.type);
          ocrResults[`doc_${i}`] = result;
          console.log(`✅ OCR completed for document ${i + 1}/${documents.length}`);
        } catch (docError) {
          console.error(`❌ OCR failed for document ${i}:`, docError);
        }
      }
      
      if (Object.keys(ocrResults).length > 0) {
        // Fetch user details for OCR comparison
        let userDetails = null;
        try {
          const userDoc = await getDoc(doc(db, 'users', claimData.userId));
          if (userDoc.exists()) {
            userDetails = userDoc.data();
          }
        } catch (userError) {
          console.error('❌ Failed to fetch user details:', userError);
        }
        
        // Calculate OCR score with user and claim details
        ocrScore = calculateOCRScore(ocrResults, userDetails, claimData);
        
        // Store OCR results in Firebase
        await updateDoc(doc(db, 'claims', claimId), {
          'vision_analysis.ocrResults': ocrResults,
          'vision_analysis.last_updated': new Date().toISOString()
        });
        console.log('✅ OCR analysis completed and stored');
      }
    } catch (error) {
      console.error('❌ OCR analysis failed:', error);
    }
    
    // 3️⃣ CNN ANALYSIS - Analyze all incident photos
    try {
      console.log('🖼️ Running CNN analysis on photos...');
      const photos = claimData.incident_photos || [];
      const cnnResults: Record<string, any> = {};
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const base64Data = extractBase64FromDataURL(photo.base64 || `data:${photo.type};base64,${photo.base64}`);
          const result = await analyzeIncidentPhoto(base64Data, {
            description: claimData.description || claimData.incident_description,
            insurance_type: claimData.insurance_type,
            claim_amount: claimData.claimAmount,
            policy_type: claimData.policyName
          });
          cnnResults[`photo_${i}`] = result;
          console.log(`✅ CNN completed for photo ${i + 1}/${photos.length}`);
        } catch (photoError) {
          console.error(`❌ CNN failed for photo ${i}:`, photoError);
        }
      }
      
      if (Object.keys(cnnResults).length > 0) {
        // Calculate CNN score with incident description and claim details
        const incidentDescription = claimData.description || claimData.incident_description || '';
        cnnScore = calculateCNNScore(cnnResults, incidentDescription, claimData);
        
        // Store CNN results in Firebase
        await updateDoc(doc(db, 'claims', claimId), {
          'vision_analysis.cnnResults': cnnResults,
          'vision_analysis.last_updated': new Date().toISOString()
        });
        console.log('✅ CNN analysis completed and stored');
      }
    } catch (error) {
      console.error('❌ CNN analysis failed:', error);
    }
    
    // 4️⃣ CALCULATE COMPOSITE SCORE
    console.log('🎯 Calculating composite score with all components...');
    const compositeScore = calculateCompositeScore(mlScore, networkScore, ocrScore, cnnScore);
    
    // Store composite score in Firebase
    await updateDoc(doc(db, 'claims', claimId), {
      composite_score: compositeScore,
      composite_fraud_score: compositeScore.composite_fraud_score,
      composite_risk_level: compositeScore.composite_risk_level,
      composite_confidence: compositeScore.composite_confidence,
      composite_last_updated: new Date().toISOString()
    });
    
    console.log('✅ Comprehensive analysis completed!', {
      ml: mlScore.fraud_score,
      network: networkScore?.overall_risk || 0,
      ocr: ocrScore ? (1.0 - ocrScore.authenticity_score) : 0,
      cnn: cnnScore ? (1.0 - cnnScore.damage_authenticity) : 0,
      composite: compositeScore.composite_fraud_score,
      confidence: compositeScore.composite_confidence
    });
  };

  useEffect(() => {
    // --- Authentication Check ---
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🔍 Auth state changed:', currentUser ? 'User logged in' : 'No user');
      
      if (!currentUser) {
        console.log('❌ No user found, redirecting to signin');
        router.push('/auth/signin');
        return;
      }
      
      console.log('👤 User found, checking admin role...');
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists() && userDoc.data()?.role === 'admin') {
        console.log('✅ Admin user confirmed');
        setUser(currentUser);
        setLoadingAuth(false);
      } else {
        console.log('❌ Not an admin user, redirecting to dashboard');
        router.push('/dashboard');
      }
    });
    
    // --- Live Firestore Listener for ALL Claims (Admin View) ---
    const claimsQuery = query(collection(db, "claims"), orderBy("submittedDate", "desc"));

    const unsubscribeClaims = onSnapshot(claimsQuery, async (querySnapshot) => {
      const currentTime = Date.now();
      const timeSinceLastSnapshot = currentTime - lastSnapshotTime;
      
      console.log('📊 Firestore snapshot received, docs count:', querySnapshot.docs.length);
      console.log('⏰ Time since last snapshot:', timeSinceLastSnapshot, 'ms');
      
      const claimsData: any[] = [];
      const claimsToProcess: string[] = []; // Track which claims need ML processing
      
      // Process each claim and fetch user data
      for (const docSnapshot of querySnapshot.docs) {
        const claimData: any = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Check if this claim has been processed before
        const hasBeenProcessed = processedClaims.has(claimData.id);
        const hasIncompleteMLAnalysis = !claimData.fraudScore || !claimData.mlAnalysisDate || !claimData.riskLevel || !claimData.fraudExplanation;
        
        // Only process if:
        // 1. It hasn't been processed before AND needs ML analysis
        // 2. OR it's been more than 5 minutes since last snapshot (periodic refresh)
        // 3. OR it's a new claim (not in processedClaims set)
        const shouldProcessThisClaim = (!hasBeenProcessed && hasIncompleteMLAnalysis) || 
                                     timeSinceLastSnapshot > 300000 || // 5 minutes
                                     !hasBeenProcessed;
        
        if (shouldProcessThisClaim && hasIncompleteMLAnalysis) {
          claimsToProcess.push(claimData.id);
        }
        
        // Fetch user data for display
        if (!claimData.claimantName && claimData.userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', claimData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              claimData.claimantName = userData.displayName || 'Unknown User';
            }
          } catch (error) {
            claimData.claimantName = 'Unknown User';
          }
        }
        
        claimsData.push(claimData);
      }
      
      // Update claims state
      setClaims(claimsData);
      setLoadingClaims(false);
      setLastSnapshotTime(currentTime);
      
      // Process only the claims that need ML analysis (with debouncing)
      if (claimsToProcess.length > 0) {
        console.log('🚀 Processing', claimsToProcess.length, 'claims for ML analysis:', claimsToProcess);
        
        // Add debouncing - only process if it's been more than 2 seconds since last processing
        setTimeout(async () => {
          for (const claimId of claimsToProcess) {
            const claimData = claimsData.find(c => c.id === claimId);
            if (!claimData) continue;
            
            // Check if still needs processing and not already being processed
            const stillNeedsProcessing = !claimData.fraudScore || !claimData.mlAnalysisDate || !claimData.riskLevel || !claimData.fraudExplanation;
            if (!stillNeedsProcessing || processingClaims.has(claimId) || !shouldProcessClaim(claimId)) {
              continue;
            }
            
            // Mark as processing
            setProcessingClaims(prev => new Set(prev).add(claimId));
            setLastProcessed(prev => new Map(prev).set(claimId, Date.now()));
            
            console.log('🚀 ML PROCESSING STARTED for claim:', claimId);
            
            try {
              const mlData = transformClaimDataForML(claimData);
              
              // Add retry logic for timeout errors
              let fraudResult;
              let retries = 2;
              let lastError;
              
              while (retries > 0) {
                try {
                  fraudResult = await predictFraud(mlData);
                  break; // Success, exit retry loop
                } catch (error) {
                  lastError = error;
                  if (error instanceof Error && error.name === 'TimeoutError' && retries > 1) {
                    console.log(`⏰ Timeout for claim ${claimId}, retrying... (${retries - 1} retries left)`);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                    continue;
                  }
                  throw error; // Re-throw if not timeout or no retries left
                }
              }
              
              if (!fraudResult) {
                throw lastError || new Error('Failed to get fraud prediction after retries');
              }
              
              // Update Firestore with ML results
              await updateDoc(doc(db, 'claims', claimId), {
                fraudScore: fraudResult.fraud_score,
                riskLevel: fraudResult.risk_level,
                fraudExplanation: fraudResult.detailed_explanation,
                detailed_explanation: fraudResult.detailed_explanation,
                is_fraud: fraudResult.is_fraud,
                mlAnalysisDate: new Date().toISOString(),
                gemini_analysis: 'AI analysis disabled'
              });
              
              console.log('✅ ML analysis completed for claim:', claimId);
              
              // 🚀 AUTOMATIC COMPREHENSIVE ANALYSIS - Run all components
              try {
                await runComprehensiveAnalysis(claimId, claimData, fraudResult);
              } catch (comprehensiveError) {
                console.error('❌ Comprehensive analysis failed:', comprehensiveError);
              }
              
              // Mark as processed
              setProcessedClaims(prev => new Set(prev).add(claimId));
              
            } catch (error) {
              console.error('❌ ML prediction failed for claim:', claimId, error);
              
              // Fallback: Save basic analysis
              try {
                await updateDoc(doc(db, 'claims', claimId), {
                  fraudExplanation: 'Analysis failed - basic risk assessment only',
                  detailed_explanation: 'Analysis failed - basic risk assessment only',
                  mlAnalysisDate: new Date().toISOString(),
                  gemini_analysis: 'AI analysis failed'
                });
                setProcessedClaims(prev => new Set(prev).add(claimId));
                console.log('✅ Fallback analysis saved for claim:', claimId);
              } catch (fallbackError) {
                console.error('❌ Fallback save also failed:', fallbackError);
              }
            } finally {
              // Remove from processing set
              setProcessingClaims(prev => {
                const newSet = new Set(prev);
                newSet.delete(claimId);
                return newSet;
              });
            }
          }
        }, 2000); // 2 second debounce
      }
    }, (error) => {
      console.error("Error fetching claims:", error);
      setLoadingClaims(false);
    });

    // Cleanup function to prevent memory leaks
    return () => {
        unsubscribeAuth();
        unsubscribeClaims();
        // Reset processed claims on unmount
        setProcessedClaims(new Set());
    };
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut(auth).catch(error => console.error('Error signing out:', error));
  };

  // Recalculate network scores for claims with 0% network score or low confidence
  const recalculateNetworkScores = async () => {
    console.log('🔄 Starting network score recalculation for claims with incomplete analysis...');
    
    // Find claims with 0% network score OR confidence < 100%
    const claimsNeedingUpdate = claims.filter(claim => 
      claim.composite_score && (
        claim.composite_score.network_score === 0 || 
        claim.composite_score.composite_confidence < 100
      )
    );
    
    if (claimsNeedingUpdate.length === 0) {
      console.log('✅ No claims need network score updates');
      return;
    }
    
    console.log(`📊 Found ${claimsNeedingUpdate.length} claims needing updates (0% network or <100% confidence)`);
    
    try {
      // Fetch fresh network analysis
      const [usersResponse, policiesResponse, claimsResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/policies'),
        fetch('/api/admin/claims')
      ]);
      
      const users = await usersResponse.json();
      const policies = await policiesResponse.json();
      const claimsData = await claimsResponse.json();
      
      const response = await fetch('http://localhost:5000/api/fraud-rings/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: users.data || [],
          policies: policies.data || [],
          claims: claimsData.data || []
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch network analysis');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error('Network analysis failed');
      }
      
      const networkAnalysis = result.results;
      console.log('✅ Fresh network analysis fetched');
      
      // Update each claim with new network score
      for (const claim of claimsNeedingUpdate) {
        try {
          const networkScore = calculateNetworkScore(claim.userId, networkAnalysis);
          
          if (networkScore && networkScore.overall_risk > 0) {
            // Recalculate composite score with new network score
            const mlScore: MLScore = {
              fraud_score: claim.fraudScore || claim.fraud_score || 0,
              risk_level: claim.riskLevel || claim.risk_level || 'low',
              detailed_explanation: claim.fraudExplanation || claim.detailed_explanation || '',
              is_fraud: claim.is_fraud || false
            };
            
            // Properly reconstruct OCR score from stored data
            let ocrScore = null;
            if (claim.vision_analysis?.ocrResults && Object.keys(claim.vision_analysis.ocrResults).length > 0) {
              // Fetch user details for OCR comparison
              let userDetails = null;
              try {
                const userDoc = await getDoc(doc(db, 'users', claim.userId));
                if (userDoc.exists()) {
                  userDetails = userDoc.data();
                }
              } catch (userError) {
                console.error('❌ Failed to fetch user details:', userError);
              }
              ocrScore = calculateOCRScore(claim.vision_analysis.ocrResults, userDetails, claim);
            }
            
            // Properly reconstruct CNN score from stored data
            let cnnScore = null;
            if (claim.vision_analysis?.cnnResults && Object.keys(claim.vision_analysis.cnnResults).length > 0) {
              const incidentDescription = claim.description || claim.incident_description || '';
              cnnScore = calculateCNNScore(claim.vision_analysis.cnnResults, incidentDescription, claim);
            }
            
            const newCompositeScore = calculateCompositeScore(mlScore, networkScore, ocrScore, cnnScore);
            
            // Update Firestore
            await updateDoc(doc(db, 'claims', claim.id), {
              composite_score: newCompositeScore,
              composite_fraud_score: newCompositeScore.composite_fraud_score,
              composite_risk_level: newCompositeScore.composite_risk_level,
              composite_confidence: newCompositeScore.composite_confidence,
              composite_last_updated: new Date().toISOString()
            });
            
            console.log(`✅ Updated network score for claim ${claim.id}: ${(networkScore.overall_risk * 100).toFixed(1)}%`);
          }
        } catch (claimError) {
          console.error(`❌ Failed to update claim ${claim.id}:`, claimError);
        }
      }
      
      // Cache the network analysis
      await setDoc(doc(db, 'networkAnalysisCache', 'latest'), {
        networkAnalysis,
        timestamp: Date.now(),
        source: 'recalculation'
      });
      
      console.log('✅ Network score recalculation completed!');
    } catch (error) {
      console.error('❌ Network score recalculation failed:', error);
    }
  };

  // Removed handleGeminiProcessing - now handled per claim in modal

  if (loadingAuth || !user) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white">Fraud Command Center</h1>
                <p className="text-slate-400 mt-2">Welcome back, {user.displayName || 'Admin'}</p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={recalculateNetworkScores}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-all flex items-center gap-2"
                    title="Recalculate scores for claims with 0% network score or confidence < 100%"
                >
                    <Users className="w-4 h-4" />
                    Recalculate Scores
                </button>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg transition-all"
                    disabled={isLoggingOut}
                >
                    {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                </button>
            </div>
        </div>
        
        <div className="mb-8">
            <PriorityAlert 
                level={highRiskCount > 0 ? 'high' : 'low'}
                message={
                    highRiskCount > 0 
                    ? `${highRiskCount} high-risk claims require immediate review.`
                    : "All high-risk claims are reviewed. The queue is clear."
                }
            />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DynamicKPI title="Total Claims" value={totalClaimsCount.toString()} trend={0} trendPeriod="live view" />
            <DynamicKPI title="Pending Claims" value={pendingClaimsCount.toString()} trend={0} trendPeriod="live view" />
            <DynamicKPI title="High Risk Claims" value={highRiskCount.toString()} trend={0} trendPeriod="live view" />
            <DynamicKPI title="Avg. Fraud Score" value={averageFraudScore.toFixed(2)} trend={0} trendPeriod="live view" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <DynamicKPI title="Approved Claims" value={approvedClaimsCount.toString()} trend={0} trendPeriod="live view" />
            <DynamicKPI title="Rejected Claims" value={rejectedClaimsCount.toString()} trend={0} trendPeriod="live view" />
            <DynamicKPI title="On Hold Claims" value={onHoldClaimsCount.toString()} trend={0} trendPeriod="live view" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <DynamicKPI title="Total Claim Amount" value={`₹${(totalClaimAmount / 100000).toFixed(1)}L`} trend={0} trendPeriod="live view" />
            <DynamicKPI title="Avg. Claim Amount" value={`₹${(averageClaimAmount / 1000).toFixed(0)}K`} trend={0} trendPeriod="live view" />
        </div>

        {/* Visualizations Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Claims Status Pie Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">Claims Status Overview</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                        <Pie
                            data={[
                                { name: 'Pending', value: pendingClaimsCount, color: '#f59e0b' },
                                { name: 'Approved', value: approvedClaimsCount, color: '#10b981' },
                                { name: 'Rejected', value: rejectedClaimsCount, color: '#ef4444' },
                                { name: 'On Hold', value: onHoldClaimsCount, color: '#f97316' }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: any) => {
                                if (percent < 0.05) return '';
                                return `${name} ${(percent * 100).toFixed(0)}%`;
                            }}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {[
                                { name: 'Pending', value: pendingClaimsCount, color: '#f59e0b' },
                                { name: 'Approved', value: approvedClaimsCount, color: '#10b981' },
                                { name: 'Rejected', value: rejectedClaimsCount, color: '#ef4444' },
                                { name: 'On Hold', value: onHoldClaimsCount, color: '#f97316' }
                            ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#f9fafb'
                            }} 
                        />
                    </RechartsPieChart>
                </ResponsiveContainer>
            </div>

            {/* Risk Level Distribution */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <h3 className="text-xl font-bold text-white">Risk Level Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                        <Pie
                            data={[
                                { name: 'High Risk', value: highRiskCount, color: '#ef4444' },
                                { name: 'Medium Risk', value: claims.filter(c => (c.fraudScore || 0) > 0.3 && (c.fraudScore || 0) <= 0.7).length, color: '#f59e0b' },
                                { name: 'Low Risk', value: claims.filter(c => (c.fraudScore || 0) <= 0.3).length, color: '#10b981' }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: any) => {
                                if (percent < 0.05) return '';
                                return `${name} ${(percent * 100).toFixed(0)}%`;
                            }}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {[
                                { name: 'High Risk', value: highRiskCount, color: '#ef4444' },
                                { name: 'Medium Risk', value: claims.filter(c => (c.fraudScore || 0) > 0.3 && (c.fraudScore || 0) <= 0.7).length, color: '#f59e0b' },
                                { name: 'Low Risk', value: claims.filter(c => (c.fraudScore || 0) <= 0.3).length, color: '#10b981' }
                            ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#f9fafb'
                            }} 
                        />
                    </RechartsPieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Claims Management Card */}
            <a 
                href="/admin-dashboard/claims" 
                className="bg-slate-800 p-8 rounded-xl border border-slate-700 hover:border-blue-500 transition-all duration-200 group"
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                        <FileText className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Claims Management</h3>
                        <p className="text-slate-400 text-sm mt-1">Review and process claims</p>
                    </div>
                </div>
            </a>

            {/* Analytics Card */}
            <a 
                href="/admin-dashboard/analytics" 
                className="bg-slate-800 p-8 rounded-xl border border-slate-700 hover:border-green-500 transition-all duration-200 group"
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                        <BarChart3 className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Analytics</h3>
                        <p className="text-slate-400 text-sm mt-1">View detailed insights</p>
                    </div>
                </div>
            </a>

            {/* Network Analysis Card */}
            <a 
                href="/admin-dashboard/network-analysis" 
                className="bg-slate-800 p-8 rounded-xl border border-slate-700 hover:border-purple-500 transition-all duration-200 group"
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                        <Users className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Network Analysis</h3>
                        <p className="text-slate-400 text-sm mt-1">Detect fraud rings</p>
                    </div>
                </div>
            </a>

            {/* User Management Card */}
            <a 
                href="/admin-dashboard/users" 
                className="bg-slate-800 p-8 rounded-xl border border-slate-700 hover:border-orange-500 transition-all duration-200 group"
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 bg-orange-500/20 rounded-xl group-hover:bg-orange-500/30 transition-colors">
                        <Users className="w-8 h-8 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">User Management</h3>
                        <p className="text-slate-400 text-sm mt-1">Manage users & roles</p>
                    </div>
                </div>
            </a>
        </div>

        {/* Live Triage Queue */}
        <LiveTriageQueue 
            claims={claims} 
            loading={loadingClaims}
            onClaimSelect={setSelectedClaim} 
        />
      </div>
      
      <ClaimDetailsModal claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
    </>
  );
};

export default AdminDashboardContent;

