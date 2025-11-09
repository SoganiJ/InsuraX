'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';
import { Download, FileText, User, Calendar, MapPin, Car, Heart, Home, Wheat, Brain, AlertTriangle, TrendingUp, TrendingDown, Bot, Eye, Search, ImageIcon, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { processGeminiAnalysis } from '@/lib/fraudDetectionAPI';
import { analyzeDocumentOCR, analyzeIncidentPhoto, extractBase64FromDataURL, getRiskLevelColor, getRiskLevelText, type OCRResult, type CNNResult } from '@/lib/visionAPI';

const MLExplanationDisplay: React.FC<{ 
  explanation: string; 
  fraudScore: number; 
  riskLevel: string; 
  isMLAnalyzed: boolean;
  geminiAnalysis?: string;
}> = ({ 
  explanation, fraudScore, riskLevel, isMLAnalyzed, geminiAnalysis 
}) => {
  if (!isMLAnalyzed) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-400 mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">ML Analysis Pending</span>
        </div>
        <p className="text-sm text-slate-300">This claim has not been analyzed by the ML fraud detection system yet.</p>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <TrendingUp className="w-4 h-4" />;
      case 'low': return <TrendingDown className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Risk Summary */}
      <div className={`p-4 rounded-lg border ${getRiskColor(riskLevel)}`}>
        <div className="flex items-center gap-2 mb-2">
          {getRiskIcon(riskLevel)}
          <span className="font-semibold capitalize">{riskLevel} Risk</span>
          <span className="text-sm opacity-75">({(fraudScore * 100).toFixed(1)}% fraud probability)</span>
        </div>
        <p className="text-sm opacity-90">
          {fraudScore > 0.7 ? 'High probability of fraud detected' : 
           fraudScore > 0.3 ? 'Moderate risk of fraud' : 
           'Low risk - appears legitimate'}
        </p>
      </div>

      {/* Gemini AI Analysis */}
      {geminiAnalysis && geminiAnalysis !== 'AI analysis temporarily unavailable' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-3">
            <Bot className="w-4 h-4" />
            <span className="font-semibold">AI Expert Analysis</span>
          </div>
          <div className="prose prose-sm max-w-none text-slate-300">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {geminiAnalysis}
            </div>
          </div>
        </div>
      )}

      {/* Technical ML Analysis */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-300 mb-3">
          <Brain className="w-4 h-4" />
          <span className="font-semibold">Technical ML Analysis</span>
        </div>
        <div className="text-sm text-slate-400 space-y-2">
          <div className="whitespace-pre-wrap">
            {explanation}
          </div>
        </div>
      </div>
    </div>
  );
};


// Download Base64 image as file
const downloadImage = (base64Data: string, fileName: string, mimeType: string) => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const ClaimDetailsModal: React.FC<{ claim: any; onClose: () => void }> = ({ claim, onClose }) => {
  const [claimantName, setClaimantName] = useState(claim?.claimantName || 'Loading...');
  const [userEmail, setUserEmail] = useState(claim?.email || 'Loading...');
  const [userPhone, setUserPhone] = useState(claim?.phone || 'Loading...');
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [geminiProcessing, setGeminiProcessing] = useState(false);
  const [geminiAnalysisResult, setGeminiAnalysisResult] = useState(claim?.gemini_analysis || '');
  
  // Load images from localStorage if not in claim data
  const [claimImages, setClaimImages] = useState<{
    incident_photos: any[];
    supporting_documents: any[];
  }>({ incident_photos: [], supporting_documents: [] });
  
  useEffect(() => {
    // Try to load images from localStorage first, then from claim data
    try {
      const storedImages = localStorage.getItem(`claim_images_${claim?.claimId}`);
      if (storedImages) {
        const parsedImages = JSON.parse(storedImages);
        setClaimImages(parsedImages);
        console.log('📸 Loaded images from localStorage for OCR/CNN');
      } else if (claim?.incident_photos || claim?.supporting_documents) {
        setClaimImages({
          incident_photos: claim.incident_photos || [],
          supporting_documents: claim.supporting_documents || []
        });
      }
    } catch (error) {
      console.error('Error loading claim images:', error);
    }
  }, [claim?.claimId]);
  
  // Vision analysis states
  const [visionAnalysisResults, setVisionAnalysisResults] = useState<{
    ocrResults: Record<string, OCRResult>;
    cnnResults: Record<string, CNNResult>;
    isAnalyzing: Record<string, boolean>;
  }>({
    ocrResults: {},
    cnnResults: {},
    isAnalyzing: {}
  });

  useEffect(() => {
    // Fetch user data if claimantName is not available
    if (claim && claim.userId) {
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', claim.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setClaimantName(userData.displayName || 'Unknown User');
            setUserEmail(userData.email || 'N/A');
            setUserPhone(userData.phone || 'N/A');
          } else {
            setClaimantName('Unknown User');
            setUserEmail('N/A');
            setUserPhone('N/A');
          }
        } catch (error) {
          console.error('Error fetching user data for claim:', error);
          setClaimantName('Unknown User');
          setUserEmail('N/A');
          setUserPhone('N/A');
        }
      };
      fetchUserData();
    } else if (claim?.claimantName) {
      setClaimantName(claim.claimantName);
      setUserEmail(claim.email || 'N/A');
      setUserPhone(claim.phone || 'N/A');
    }
  }, [claim]);

  const handleGeminiAnalysis = async () => {
    if (!claim || geminiProcessing) return;
    
    setGeminiProcessing(true);
    try {
      console.log(`🤖 Starting Gemini analysis for claim: ${claim.id}`);
      
      const geminiResult = await processGeminiAnalysis(claim);
      
      // Update local state immediately
      setGeminiAnalysisResult(geminiResult);
      
      // Update Firestore
      await updateDoc(doc(db, 'claims', claim.id), {
        gemini_analysis: geminiResult,
        gemini_analysis_date: new Date().toISOString()
      });
      
      console.log(`✅ Gemini analysis completed for claim: ${claim.id}`);
      
    } catch (error) {
      console.error(`❌ Gemini analysis failed for claim ${claim.id}:`, error);
      alert('Failed to generate AI analysis. Please try again.');
    } finally {
      setGeminiProcessing(false);
    }
  };

  // Vision analysis functions
  const handleOCRAnalysis = async (document: any, index: number) => {
    const docKey = `doc_${index}`;
    
    setVisionAnalysisResults(prev => ({
      ...prev,
      isAnalyzing: { ...prev.isAnalyzing, [docKey]: true }
    }));
    
    try {
      const base64Data = extractBase64FromDataURL(document.base64 || `data:${document.type};base64,${document.base64}`);
      const result = await analyzeDocumentOCR(base64Data, document.type);
      
      setVisionAnalysisResults(prev => ({
        ...prev,
        ocrResults: { ...prev.ocrResults, [docKey]: result },
        isAnalyzing: { ...prev.isAnalyzing, [docKey]: false }
      }));
    } catch (error) {
      console.error('OCR analysis failed:', error);
      setVisionAnalysisResults(prev => ({
        ...prev,
        isAnalyzing: { ...prev.isAnalyzing, [docKey]: false }
      }));
    }
  };

  const handleCNNAnalysis = async (photo: any, index: number) => {
    const photoKey = `photo_${index}`;
    
    setVisionAnalysisResults(prev => ({
      ...prev,
      isAnalyzing: { ...prev.isAnalyzing, [photoKey]: true }
    }));
    
    try {
      const base64Data = extractBase64FromDataURL(photo.base64 || `data:${photo.type};base64,${photo.base64}`);
      const result = await analyzeIncidentPhoto(base64Data, {
        description: claim.description || claim.incident_description,
        insurance_type: claim.insurance_type,
        claim_amount: claim.claimAmount,
        policy_type: claim.policyName
      });
      
      setVisionAnalysisResults(prev => ({
        ...prev,
        cnnResults: { ...prev.cnnResults, [photoKey]: result },
        isAnalyzing: { ...prev.isAnalyzing, [photoKey]: false }
      }));
    } catch (error) {
      console.error('CNN analysis failed:', error);
      setVisionAnalysisResults(prev => ({
        ...prev,
        isAnalyzing: { ...prev.isAnalyzing, [photoKey]: false }
      }));
    }
  };

  const handleAdminAction = async (action: 'Approved' | 'On Hold' | 'Rejected') => {
    if (!claim || isUpdating) return;
    
    setIsUpdating(true);
    try {
      const claimRef = doc(db, 'claims', claim.id);
      const updateData = {
        status: action,
        lastUpdated: serverTimestamp(),
        adminAction: {
          action: action,
          timestamp: serverTimestamp(),
          adminId: 'admin', // You can get this from auth context
          adminName: 'Admin User', // You can get this from auth context
          comment: adminComment.trim() || null // Include admin comment if provided
        }
      };

      // Add to timeline
      const timelineEntry = {
        date: new Date().toISOString().split('T')[0],
        status: action,
        description: action === 'Approved' ? 'Claim approved by admin' : 
                    action === 'Rejected' ? 'Claim rejected by admin' : 
                    'Claim put on hold by admin',
        adminAction: true,
        adminComment: adminComment.trim() || null
      };

      // Get current timeline or create new one
      const currentTimeline = claim.timeline || [];
      const updatedTimeline = [...currentTimeline, timelineEntry];

      await updateDoc(claimRef, {
        ...updateData,
        timeline: updatedTimeline
      });

      console.log(`Claim ${action.toLowerCase()} successfully`);
      // Close modal after successful update
      onClose();
    } catch (error) {
      console.error(`Error ${action.toLowerCase()} claim:`, error);
      alert(`Failed to ${action.toLowerCase()} claim. Please try again.`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!claim) return null;

  const getInsuranceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'automobile': return <Car className="w-5 h-5" />;
      case 'health': return <Heart className="w-5 h-5" />;
      case 'life': return <User className="w-5 h-5" />;
      case 'property': return <Home className="w-5 h-5" />;
      case 'crop': return <Wheat className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-xl border border-slate-700 p-6 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              {getInsuranceIcon(claim.insurance_type)}
              <h3 className="text-2xl font-bold text-white">Claim Review: {claim.claimId || claim.id}</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>

          {/* Main Claim Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Claimant Information
              </h4>
              <div className="space-y-2 text-sm text-slate-300">
                <p><strong>Name:</strong> {claimantName}</p>
                <p><strong>Email:</strong> {userEmail}</p>
                <p><strong>Phone:</strong> {userPhone}</p>
                <p><strong>Age:</strong> {claim.insured_age || 'N/A'}</p>
                <p><strong>Gender:</strong> {claim.insured_sex || 'N/A'}</p>
                <p><strong>Occupation:</strong> {claim.insured_occupation || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Policy Information
              </h4>
              <div className="space-y-2 text-sm text-slate-300">
                <p><strong>Policy ID:</strong> {claim.policyId || 'N/A'}</p>
                <p><strong>Type:</strong> {claim.insurance_type || 'N/A'}</p>
                <p><strong>Term:</strong> {claim.policy_term || 'N/A'}</p>
                <p><strong>Premium:</strong> {formatCurrency(claim.policy_annual_premium || 0)}</p>
                <p><strong>Coverage:</strong> {formatCurrency(claim.sum_insured || 0)}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Claim Details
              </h4>
              <div className="space-y-2 text-sm text-slate-300">
                <p><strong>Amount:</strong> {formatCurrency(claim.claimAmount || 0)}</p>
                <p><strong>Type:</strong> {claim.claimType || claim.custom_claim_type || 'N/A'}</p>
                <p><strong>Incident Date:</strong> {claim.incidentDate || 'N/A'}</p>
                <p><strong>Filed Date:</strong> {claim.submittedDate || 'N/A'}</p>
                <p><strong>Status:</strong> {claim.status || 'Pending Review'}</p>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
              <div>
                <p><strong>State:</strong> {claim.policy_state || 'N/A'}</p>
                <p><strong>City:</strong> {claim.policy_city || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Accident Location:</strong> {claim.accident_location || 'N/A'}</p>
                <p><strong>Third Party Involved:</strong> {claim.third_party_involved || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Insurance-Specific Details */}
          {(claim.insurance_type === 'automobile' || claim.auto_make) && (
            <div className="bg-slate-800 p-4 rounded-lg mb-6">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Car className="w-4 h-4" />
                Auto Insurance Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
                <p><strong>Make:</strong> {claim.auto_make || 'N/A'}</p>
                <p><strong>Model:</strong> {claim.auto_model || 'N/A'}</p>
                <p><strong>Year:</strong> {claim.auto_year || 'N/A'}</p>
              </div>
            </div>
          )}

          {(claim.insurance_type === 'health' || claim.hospital_name) && (
            <div className="bg-slate-800 p-4 rounded-lg mb-6">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Health Insurance Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                <p><strong>Hospital:</strong> {claim.hospital_name || 'N/A'}</p>
                <p><strong>Duration:</strong> {claim.claim_duration_days || 'N/A'} days</p>
                <p><strong>Treatment:</strong> {claim.treatment_details || 'N/A'}</p>
              </div>
            </div>
          )}

          {/* Risk Analysis */}
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h4 className="text-white font-semibold mb-3">Risk Analysis Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
              <p><strong>Claim to Coverage Ratio:</strong> {((claim.claimAmount / claim.sum_insured) * 100).toFixed(1)}%</p>
              <p><strong>Policy Age at Incident:</strong> {claim.policy_age_at_incident_days || 'N/A'} days</p>
              <p><strong>Filing Delay:</strong> {claim.claim_filing_delay_days || 'N/A'} days</p>
              <p><strong>Previous Claims:</strong> {claim.previous_claims_count || 0}</p>
              <p><strong>Payment Delays:</strong> {claim.premium_payment_delays || 'N/A'}</p>
              <p><strong>Coverage Changes:</strong> {claim.coverage_changes_before_claim || 'N/A'}</p>
            </div>
          </div>
          
          {/* ML Fraud Analysis */}
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Fraud Detection Analysis
            </h4>
        
            <MLExplanationDisplay 
              explanation={claim.fraudExplanation || claim.detailed_explanation || 'No ML analysis available'}
              fraudScore={claim.fraudScore || 0}
              riskLevel={claim.riskLevel || (claim.fraudScore > 0.7 ? 'high' : claim.fraudScore > 0.3 ? 'medium' : 'low')}
              isMLAnalyzed={!!(claim.fraudScore && claim.fraudScore > 0)}
              geminiAnalysis={geminiAnalysisResult}
            />
            
            {/* Gemini Analysis Button */}
            {claim.fraudScore && (
              <div className="mt-4">
                <button
                  onClick={handleGeminiAnalysis}
                  disabled={geminiProcessing}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 w-full justify-center"
                >
                  {geminiProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Generating AI Analysis...
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      {geminiAnalysisResult && 
                       geminiAnalysisResult !== 'AI analysis disabled' && 
                       geminiAnalysisResult !== 'Pending AI analysis' && 
                       geminiAnalysisResult !== 'AI analysis temporarily unavailable' ? 
                        'Regenerate AI Analysis' : 'Generate AI Analysis'
                      }
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Uploaded Documents */}
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h4 className="text-white font-semibold mb-3">Uploaded Documents</h4>
            
            {claimImages.incident_photos?.length > 0 && (
              <div className="mb-4">
                <h5 className="text-gray-300 font-medium mb-2">Incident Photos ({claimImages.incident_photos.length})</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {claimImages.incident_photos.map((photo: any, index: number) => {
                    const photoKey = `photo_${index}`;
                    const cnnResult = visionAnalysisResults.cnnResults[photoKey];
                    const isAnalyzing = visionAnalysisResults.isAnalyzing[photoKey];
                    
                    return (
                      <div key={index} className="bg-gray-700 p-3 rounded-lg">
                        <img 
                          src={`data:${photo.type};base64,${photo.base64}`}
                          alt={photo.name}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium truncate">{photo.name}</p>
                            <p className="text-gray-400 text-xs">{(photo.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            onClick={() => downloadImage(photo.base64, photo.name, photo.type)}
                            className="ml-2 h-8 w-8 p-0 border border-gray-600 hover:bg-gray-600 rounded flex items-center justify-center"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* CNN Analysis Button */}
                        <div className="space-y-2">
                          <button
                            onClick={() => handleCNNAnalysis(photo, index)}
                            disabled={isAnalyzing}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-2"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-3 h-3" />
                                Verify Image (CNN)
                              </>
                            )}
                          </button>
                          
                          {/* CNN Results */}
                          {cnnResult && (
                            <div className={`p-2 rounded text-xs ${getRiskLevelColor(1 - cnnResult.confidence)}`}>
                              {cnnResult.success ? (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <ImageIcon className="w-3 h-3" />
                                    <span className="font-medium">{getRiskLevelText(1 - cnnResult.confidence)} ({(cnnResult.confidence * 100).toFixed(0)}% match)</span>
                                  </div>
                                  <div className="text-gray-300 mb-2">
                                    <strong>Verification:</strong> {cnnResult.verification_result}
                                  </div>
                                  {cnnResult.image_caption && (
                                    <div className="text-gray-300 mb-2">
                                      <strong>Image shows:</strong> {cnnResult.image_caption}
                                    </div>
                                  )}
                                  {cnnResult.analysis?.key_objects_detected?.length > 0 && (
                                    <div className="text-gray-300 mb-2">
                                      <strong>Objects:</strong> {cnnResult.analysis.key_objects_detected.join(', ')}
                                    </div>
                                  )}
                                  {cnnResult.recommendations && cnnResult.recommendations.length > 0 && (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-gray-400">Recommendations</summary>
                                      <div className="mt-1 text-gray-300 space-y-1">
                                        {cnnResult.recommendations.map((rec, i) => (
                                          <div key={i} className="text-xs">{rec}</div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-400">
                                  CNN Analysis Failed: {cnnResult.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {claimImages.supporting_documents?.length > 0 && (
              <div>
                <h5 className="text-gray-300 font-medium mb-2">Supporting Documents ({claimImages.supporting_documents.length})</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {claimImages.supporting_documents.map((doc: any, index: number) => {
                    const docKey = `doc_${index}`;
                    const ocrResult = visionAnalysisResults.ocrResults[docKey];
                    const isAnalyzing = visionAnalysisResults.isAnalyzing[docKey];
                    
                    return (
                      <div key={index} className="bg-gray-700 p-3 rounded-lg">
                        <img 
                          src={`data:${doc.type};base64,${doc.base64}`}
                          alt={doc.name}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-gray-400 text-xs">{(doc.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            onClick={() => downloadImage(doc.base64, doc.name, doc.type)}
                            className="ml-2 h-8 w-8 p-0 border border-gray-600 hover:bg-gray-600 rounded flex items-center justify-center"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* OCR Analysis Button */}
                        <div className="space-y-2">
                          <button
                            onClick={() => handleOCRAnalysis(doc, index)}
                            disabled={isAnalyzing}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-2"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Search className="w-3 h-3" />
                                Extract Text (OCR)
                              </>
                            )}
                          </button>
                          
                          {/* OCR Results */}
                          {ocrResult && (
                            <div className={`p-2 rounded text-xs ${ocrResult.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                              {ocrResult.success ? (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Eye className="w-3 h-3 text-green-400" />
                                    <span className="text-green-400 font-medium">OCR Complete ({(ocrResult.confidence * 100).toFixed(0)}%)</span>
                                  </div>
                                  {Object.keys(ocrResult.extracted_info).length > 0 && (
                                    <div className="text-gray-300 space-y-1">
                                      {Object.entries(ocrResult.extracted_info).map(([key, value]) => (
                                        <div key={key}>
                                          <span className="text-gray-400 capitalize">{key.replace('_', ' ')}:</span> {value}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {ocrResult.raw_text && (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-gray-400">Raw Text</summary>
                                      <div className="mt-1 text-gray-300 max-h-20 overflow-y-auto text-xs">
                                        {ocrResult.raw_text}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-400">
                                  OCR Failed: {ocrResult.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Admin Comment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Admin Comment (Optional)
            </label>
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Add a comment for the user (e.g., reason for approval/rejection, additional information needed, etc.)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isUpdating}
            />
            <p className="text-xs text-gray-400 mt-1">
              This comment will be visible to the user in their claim management dashboard.
            </p>
          </div>

          {/* Admin Actions */}
          <div className="flex gap-4">
            <button 
              onClick={() => handleAdminAction('Approved')}
              disabled={isUpdating || claim.status === 'Approved'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex-1 transition-colors"
            >
              {isUpdating ? 'Processing...' : 'Approve Claim'}
            </button>
            <button 
              onClick={() => handleAdminAction('On Hold')}
              disabled={isUpdating || claim.status === 'On Hold'}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex-1 transition-colors"
            >
              {isUpdating ? 'Processing...' : 'Keep on Hold'}
            </button>
            <button 
              onClick={() => handleAdminAction('Rejected')}
              disabled={isUpdating || claim.status === 'Rejected'}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex-1 transition-colors"
            >
              {isUpdating ? 'Processing...' : 'Reject Claim'}
            </button>
           </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClaimDetailsModal;
