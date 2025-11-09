'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';
import { ExternalLink, AlertTriangle, CheckCircle, Eye, Users, Phone, MapPin, FileText } from 'lucide-react';
import { db } from '@/firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const RiskBadge = ({ score, riskLevel }: { score: number; riskLevel?: string }) => {
  const level = riskLevel || (score > 0.7 ? 'high' : score > 0.3 ? 'medium' : 'low');
  
  const getIcon = () => {
    switch (level) {
      case 'high': return <AlertTriangle className="w-3 h-3" />;
      case 'medium': return <Eye className="w-3 h-3" />;
      case 'low': return <CheckCircle className="w-3 h-3" />;
      default: return null;
    }
  };
  
  const getStyles = () => {
    switch (level) {
      case 'high': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getStyles()}`}>
      {getIcon()}
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'on hold': return 'bg-yellow-500/20 text-yellow-400';
      case 'submitted': return 'bg-blue-500/20 text-blue-400';
      case 'pending': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
      {status || 'Pending Review'}
    </span>
  );
};

const NetworkAnalysisBadge = ({ networks }: { networks: any[] }) => {
  if (!networks || networks.length === 0) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-500/20 text-gray-400">
        No Networks
      </span>
    );
  }

  const getNetworkIcon = (type: string) => {
    switch (type) {
      case 'phone_network': return <Phone className="w-3 h-3" />;
      case 'location_network': return <MapPin className="w-3 h-3" />;
      case 'policy_network': return <FileText className="w-3 h-3" />;
      case 'claim_network': return <AlertTriangle className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  const getNetworkColor = (riskScore: number) => {
    if (riskScore > 0.7) return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (riskScore > 0.4) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  };

  const getRiskLevel = (riskScore: number) => {
    if (riskScore > 0.7) return 'High';
    if (riskScore > 0.4) return 'Medium';
    return 'Low';
  };

  return (
    <div className="flex flex-col gap-1">
      {networks.map((network, index) => (
        <span 
          key={index}
          className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getNetworkColor(network.risk_score)}`}
        >
          {getNetworkIcon(network.type)}
          {network.type.replace('_', ' ')}
          <span className="text-xs opacity-75">({getRiskLevel(network.risk_score)})</span>
        </span>
      ))}
    </div>
  );
};

const RapidFilerBadge = ({ rapidFiler }: { rapidFiler: any }) => {
  if (!rapidFiler) {
    return <span className="text-slate-400 text-xs">Normal</span>;
  }

  const getRiskColor = () => {
    if (rapidFiler.claim_count >= 5) return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (rapidFiler.claim_count >= 3) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  };

  const getRiskLevel = () => {
    if (rapidFiler.claim_count >= 5) return 'High';
    if (rapidFiler.claim_count >= 3) return 'Medium';
    return 'Low';
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getRiskColor()}`}>
      <Users className="w-3 h-3" />
      {rapidFiler.claim_count} claims
      <span className="text-xs opacity-75">({getRiskLevel()})</span>
    </span>
  );
};

const ClaimsTable = ({ claims, loading, onClaimSelect }: any) => {
  const [networkAnalysisData, setNetworkAnalysisData] = useState<any>(null);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const hasFetchedNetworks = useRef(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [sortedClaims, setSortedClaims] = useState<any[]>([]);


  // Fetch network analysis data for all users (only once)
  useEffect(() => {
    const fetchNetworkAnalysis = async () => {
      if (!claims || claims.length === 0 || hasFetchedNetworks.current || loadingNetworks) return;
      
      hasFetchedNetworks.current = true;
      setLoadingNetworks(true);
      
      try {
        // First check if we have cached data in Firestore
        const cacheDoc = await getDoc(doc(db, 'networkAnalysisCache', 'latest'));
        const cacheData = cacheDoc.data();
        
        if (cacheData && cacheData.timestamp) {
          const cacheAge = Date.now() - cacheData.timestamp;
          const maxCacheAge = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < maxCacheAge && cacheData.networkAnalysis) {
            console.log('📦 Using cached network analysis from Firestore');
            setNetworkAnalysisData(cacheData.networkAnalysis);
            setLoadingNetworks(false);
            return;
          }
        }
        
        console.log('🔄 Cache expired or not found, fetching fresh data...');
        
        // Add a small delay to prevent simultaneous API calls
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fetch all data needed for network analysis
        const [usersResponse, policiesResponse, claimsResponse] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/policies'),
          fetch('/api/admin/claims')
        ]);

        const users = await usersResponse.json();
        const policies = await policiesResponse.json();
        const claimsData = await claimsResponse.json();

        const requestData = {
          users: users.data || [],
          policies: policies.data || [],
          claims: claimsData.data || []
        };
        
        // Retry mechanism for Neo4j connection issues
        let retries = 3;
        let delay = 1000;
        
        while (retries > 0) {
          try {
            const response = await fetch('http://localhost:5000/api/fraud-rings/detect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('🔍 Full API response:', result);
              console.log('🔍 Response success:', result.success);
              console.log('🔍 Response results:', result.results);
              
            if (result.success) {
              console.log('🔍 Network analysis API success:', result.results);
              console.log('🔍 Suspicious networks:', result.results?.suspicious_networks);
              console.log('🔍 Rapid filers:', result.results?.rapid_filers);
              setNetworkAnalysisData(result.results);
              
              // Store in Firestore cache
              await setDoc(doc(db, 'networkAnalysisCache', 'latest'), {
                networkAnalysis: result.results,
                timestamp: Date.now(),
                source: 'api'
              });
              
              console.log('💾 Network analysis cached in Firestore');
              return; // Success, exit retry loop
              } else if (result.error && result.error.includes('Existing exports of data')) {
                console.log(`🔄 ClaimsTable retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                retries--;
                continue;
              }
            } else {
              const errorText = await response.text();
              if (response.status === 500 && errorText.includes('Existing exports of data')) {
                console.log(`🔄 ClaimsTable retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                retries--;
                continue;
              }
            }
            break; // Exit retry loop for other errors
          } catch (fetchError) {
            if (retries > 1) {
              console.log(`🔄 ClaimsTable retrying in ${delay}ms... (${retries} retries left)`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              retries--;
              continue;
            }
            throw fetchError;
          }
        }
      } catch (error) {
        console.error('Failed to fetch network analysis:', error);
      } finally {
        setLoadingNetworks(false);
      }
    };

    fetchNetworkAnalysis();
  }, [claims, loadingNetworks]);

  // Helper function to get rapid filer info for a specific user
  const getUserRapidFilerInfo = (userId: string) => {
    if (!networkAnalysisData?.fraud_indicators?.rapid_claim_filers) {
      return null;
    }
    
    // Find rapid filer info for this user
    const rapidFiler = networkAnalysisData.fraud_indicators.rapid_claim_filers.find((filer: any) => 
      filer.userId === userId || filer.email === userId
    );
    
    return rapidFiler;
  };

  // Store individual user network analysis in Firestore
  const storeUserNetworkAnalysis = async (userId: string, networks: any[]) => {
    try {
      await setDoc(doc(db, 'userNetworkAnalysis', userId), {
        networks,
        timestamp: Date.now(),
        userId
      });
      console.log(`💾 Stored network analysis for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error storing network analysis for user ${userId}:`, error);
    }
  };

  // Get user network analysis from Firestore
  const getUserNetworksFromFirestore = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'userNetworkAnalysis', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const cacheAge = Date.now() - data.timestamp;
        const maxCacheAge = 10 * 60 * 1000; // 10 minutes for user-specific data
        
        if (cacheAge < maxCacheAge) {
          console.log(`📦 Using cached network analysis for user ${userId}`);
          return data.networks || [];
        }
      }
    } catch (error) {
      console.error(`❌ Error getting cached network analysis for user ${userId}:`, error);
    }
    return [];
  };

  // Helper function to get networks for a specific user
  const getUserNetworks = (userId: string) => {
    if (!networkAnalysisData?.suspicious_networks) {
      return [];
    }
    
    return networkAnalysisData.suspicious_networks.filter((network: any) => {
      const users = network.users || [];
      const userNames = network.user_names || [];
      const userEmails = network.user_emails || [];
      
      return users.some((user: string) => user === userId) || 
             userNames.some((user: string) => user === userId) ||
             userEmails.some((email: string) => email === userId);
    });
  };

  // Store network analysis when data is fetched
  useEffect(() => {
    if (networkAnalysisData && claims.length > 0) {
      // Store network analysis for each user
      claims.forEach((claim: any) => {
        const userNetworks = getUserNetworks(claim.userId);
        if (userNetworks.length > 0) {
          storeUserNetworkAnalysis(claim.userId, userNetworks);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkAnalysisData, claims]);

  // Sorting functionality
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting whenever claims or sortConfig changes
  useEffect(() => {
    let sorted = [...claims];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortConfig?.key) {
        case 'date':
          aValue = new Date(a.submittedDate || 0).getTime();
          bValue = new Date(b.submittedDate || 0).getTime();
          // If dates are the same, sort by claim ID as secondary sort
          if (aValue === bValue) {
            return (a.claimId || a.id || '').localeCompare(b.claimId || b.id || '');
          }
          break;
        case 'fraudScore':
          aValue = a.composite_fraud_score || a.fraudScore || 0;
          bValue = b.composite_fraud_score || b.fraudScore || 0;
          // If scores are the same, sort by date as secondary sort
          if (aValue === bValue) {
            const dateA = new Date(a.submittedDate || 0).getTime();
            const dateB = new Date(b.submittedDate || 0).getTime();
            return dateB - dateA;
          }
          break;
        case 'riskLevel':
          const riskOrder = { low: 1, medium: 2, high: 3 };
          aValue = riskOrder[(a.composite_risk_level || a.riskLevel || 'low').toLowerCase() as keyof typeof riskOrder] || 0;
          bValue = riskOrder[(b.composite_risk_level || b.riskLevel || 'low').toLowerCase() as keyof typeof riskOrder] || 0;
          // If risk levels are the same, sort by fraud score as secondary sort
          if (aValue === bValue) {
            const scoreA = a.composite_fraud_score || a.fraudScore || 0;
            const scoreB = b.composite_fraud_score || b.fraudScore || 0;
            return scoreB - scoreA;
          }
          break;
        case 'amount':
          aValue = a.claimAmount || 0;
          bValue = b.claimAmount || 0;
          // If amounts are the same, sort by date as secondary sort
          if (aValue === bValue) {
            const dateA = new Date(a.submittedDate || 0).getTime();
            const dateB = new Date(b.submittedDate || 0).getTime();
            return dateB - dateA;
          }
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortConfig?.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig?.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setSortedClaims(sorted);
  }, [claims, sortConfig]);

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="text-slate-500 ml-1">⇅</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-400 ml-1">↑</span> : 
      <span className="text-blue-400 ml-1">↓</span>;
  };

  if (loading) {
    return <div className="text-center text-slate-400 py-8">Loading claims data...</div>;
  }

  return (
    <div className="overflow-x-auto bg-slate-900 rounded-xl border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Claim ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Claimant</th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center">
                Date
                {getSortIcon('date')}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => handleSort('fraudScore')}
            >
              <div className="flex items-center">
                Fraud Score
                {getSortIcon('fraudScore')}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Component Scores</th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => handleSort('riskLevel')}
            >
              <div className="flex items-center">
                Risk Level
                {getSortIcon('riskLevel')}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Network Analysis</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Rapid Filers</th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => handleSort('amount')}
            >
              <div className="flex items-center">
                Amount
                {getSortIcon('amount')}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedClaims.map((claim: any, index: number) => {
            const userNetworks = getUserNetworks(claim.userId);
            const rapidFilerInfo = getUserRapidFilerInfo(claim.userId);
            
            return (
              <motion.tr 
                key={claim.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{claim.claimId || claim.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{claim.claimantName || claim.policyHolderName || 'Loading...'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                  {claim.submittedDate ? new Date(claim.submittedDate).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-white font-bold">
                        {claim.composite_fraud_score 
                          ? (claim.composite_fraud_score * 100).toFixed(1) + '%' 
                          : claim.fraudScore 
                          ? (claim.fraudScore * 100).toFixed(1) + '%' 
                          : 'Pending'}
                      </span>
                      {claim.is_fraud && (
                        <span className="text-red-400 text-xs font-bold">FRAUD</span>
                      )}
                    </div>
                    {claim.composite_confidence && (
                      <span className="text-xs text-slate-400">
                        {claim.composite_confidence}% confidence
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1 text-xs">
                    {claim.composite_score ? (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">ML:</span>
                          <span className="text-slate-300 font-mono">{(claim.composite_score.ml_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Network:</span>
                          <span className="text-slate-300 font-mono">{(claim.composite_score.network_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">OCR:</span>
                          <span className="text-slate-300 font-mono">{(claim.composite_score.ocr_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">CNN:</span>
                          <span className="text-slate-300 font-mono">{(claim.composite_score.cnn_score * 100).toFixed(1)}%</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">Analyzing...</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RiskBadge 
                    score={claim.composite_fraud_score || claim.fraudScore || 0} 
                    riskLevel={claim.composite_risk_level || claim.riskLevel} 
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {loadingNetworks ? (
                    <span className="text-xs text-slate-400">Loading...</span>
                  ) : (
                    <NetworkAnalysisBadge networks={userNetworks} />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {loadingNetworks ? (
                    <span className="text-xs text-slate-400">Loading...</span>
                  ) : (
                    <RapidFilerBadge rapidFiler={rapidFilerInfo} />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(claim.claimAmount || 0)}</td>
                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={claim.status} /></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => onClaimSelect(claim)}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Details <ExternalLink size={14} />
                  </button>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ClaimsTable;
