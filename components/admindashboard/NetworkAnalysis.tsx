'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Network, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Phone, 
  Mail, 
  FileText,
  Loader2,
  RefreshCw,
  Eye,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FraudNetwork {
  type: string;
  users: string[];
  user_names?: string[];
  user_emails?: string[];
  shared_attribute: string;
  risk_score: number;
  details: any;
}

interface FraudIndicators {
  high_fraud_score_users: any[];
  rapid_claim_filers: any[];
  suspicious_amounts: any[];
  time_patterns: any[];
  document_patterns: any[];
}

interface RiskScores {
  [userId: string]: {
    overall_risk: number;
    claim_count: number;
    avg_fraud_score: number;
    total_amount: number;
    max_claim_amount: number;
    displayName?: string;
    email?: string;
  };
}

interface NetworkAnalysisData {
  suspicious_networks: FraudNetwork[];
  fraud_indicators: FraudIndicators;
  risk_scores: RiskScores;
  recommendations: string[];
}

const NetworkAnalysis: React.FC = () => {
  const [analysisData, setAnalysisData] = useState<NetworkAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'networks' | 'indicators' | 'risks'>('networks');

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Starting fraud ring analysis...');
      
      // Fetch all data from Firestore
      console.log('📊 Fetching data from Firestore...');
      const [usersResponse, policiesResponse, claimsResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/policies'),
        fetch('/api/admin/claims')
      ]);

      console.log('📊 Data fetch responses:', {
        users: usersResponse.status,
        policies: policiesResponse.status,
        claims: claimsResponse.status
      });

      const users = await usersResponse.json();
      const policies = await policiesResponse.json();
      const claims = await claimsResponse.json();

      console.log('📊 Data fetched:', {
        usersCount: users.data?.length || 0,
        policiesCount: policies.data?.length || 0,
        claimsCount: claims.data?.length || 0
      });

      console.log('🚀 Sending data to fraud ring detection API...');
      const response = await fetch('http://localhost:5000/api/fraud-rings/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: users.data || [],
          policies: policies.data || [],
          claims: claims.data || []
        })
      });

      console.log('📊 Fraud ring API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Fraud ring API error:', errorText);
        throw new Error(`Failed to run fraud ring analysis: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📊 Fraud ring API result:', result);
      
      if (result.success) {
        console.log('📊 Analysis data structure:', result.results);
        console.log('📊 Suspicious networks:', result.results.suspicious_networks);
        console.log('📊 Fraud indicators:', result.results.fraud_indicators);
        console.log('📊 Risk scores:', result.results.risk_scores);
        
        // Debug KPI counts
        const highRiskUsers = Object.values(result.results.risk_scores || {}).filter((r: any) => r.overall_risk > 0.3).length;
        const rapidFilers = result.results.fraud_indicators?.rapid_claim_filers?.length || 0;
        const recommendations = result.results.recommendations?.length || 0;
        
        console.log('📊 KPI Counts:', {
          suspiciousNetworks: result.results.suspicious_networks?.length || 0,
          highRiskUsers,
          rapidFilers,
          recommendations
        });
        
        setAnalysisData(result.results);
        console.log('✅ Analysis completed successfully');
        
        // 🆕 AUTOMATICALLY UPDATE ALL CLAIM SCORES WITH NEW NETWORK DATA
        console.log('🔄 Triggering automatic retroactive score updates...');
        try {
          const updateResponse = await fetch('/api/admin/update-network-scores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              networkAnalysis: result.results
            })
          });
          
          if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            console.log('✅ Retroactive score update completed:', updateResult);
          } else {
            console.error('⚠️ Retroactive score update failed (non-critical)');
          }
        } catch (updateErr) {
          console.error('⚠️ Retroactive score update error (non-critical):', updateErr);
        }
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('❌ Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk > 0.8) return 'bg-red-500';
    if (risk > 0.6) return 'bg-orange-500';
    if (risk > 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskLabel = (risk: number) => {
    if (risk > 0.8) return 'Critical';
    if (risk > 0.6) return 'High';
    if (risk > 0.4) return 'Medium';
    return 'Low';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Network Analysis</h2>
          <p className="text-gray-400">Detect fraud rings and suspicious networks</p>
        </div>
        <Button 
          onClick={runAnalysis} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Network className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-400">Suspicious Networks</p>
                    <p className="text-2xl font-bold text-white">
                      {analysisData.suspicious_networks?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm text-gray-400">High-Risk Users</p>
                    <p className="text-2xl font-bold text-white">
                      {Object.values(analysisData.risk_scores || {}).filter(r => r.overall_risk > 0.3).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-400">Rapid Filers</p>
                    <p className="text-2xl font-bold text-white">
                      {analysisData.fraud_indicators?.rapid_claim_filers?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-400">Recommendations</p>
                    <p className="text-2xl font-bold text-white">
                      {analysisData.recommendations?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {analysisData.recommendations.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisData.recommendations.map((rec, index) => (
                    <Alert key={index} className="border-yellow-500 bg-yellow-50">
                      <AlertDescription className="text-yellow-700">
                        {rec}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
            {[
              { id: 'networks', label: 'Suspicious Networks', icon: Network },
              { id: 'indicators', label: 'Fraud Indicators', icon: AlertTriangle },
              { id: 'risks', label: 'Risk Scores', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  selectedTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {selectedTab === 'networks' && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Suspicious Networks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysisData.suspicious_networks.map((network, index) => (
                        <div key={index} className="border border-slate-600 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {network.type === 'phone_network' && <Phone className="w-4 h-4 text-blue-500" />}
                              {network.type === 'email_network' && <Mail className="w-4 h-4 text-green-500" />}
                              {network.type === 'policy_network' && <FileText className="w-4 h-4 text-orange-500" />}
                              {network.type === 'claim_network' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              <span className="font-medium text-white capitalize">
                                {network.type.replace('_', ' ')}
                              </span>
                            </div>
                            <Badge className={`${getRiskColor(network.risk_score)} text-white`}>
                              {getRiskLabel(network.risk_score)}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-sm mb-2">
                            Shared: {network.shared_attribute}
                          </p>
                          <p className="text-gray-300 text-sm">
                            Users: {network.user_names ? network.user_names.join(', ') : network.users.join(', ')}
                          </p>
                          {network.user_emails && (
                            <p className="text-gray-500 text-xs mt-1">
                              Emails: {network.user_emails.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedTab === 'indicators' && (
                <div className="space-y-6">
                  {/* High Fraud Score Users */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">High Fraud Score Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysisData.fraud_indicators.high_fraud_score_users.map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                            <div>
                              <p className="text-white font-medium">{user.email}</p>
                              <p className="text-gray-400 text-sm">{user.phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-medium">
                                {formatCurrency(user.total_amount)}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {user.claim_count} claims, {user.avg_fraud_score.toFixed(2)} avg score
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rapid Claim Filers */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Rapid Claim Filers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysisData.fraud_indicators.rapid_claim_filers.map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                            <div>
                              <p className="text-white font-medium">{user.email}</p>
                              <p className="text-gray-400 text-sm">{user.phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-medium">
                                {user.claim_count} claims in 30 days
                              </p>
                              <p className="text-gray-400 text-sm">
                                {formatCurrency(user.total_amount)} total
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === 'risks' && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">User Risk Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analysisData.risk_scores)
                        .sort(([,a], [,b]) => b.overall_risk - a.overall_risk)
                        .map(([userId, risk]) => (
                          <div key={userId} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                            <div>
                              <p className="text-white font-medium">{risk.displayName || 'Unknown User'}</p>
                              <p className="text-gray-400 text-sm">
                                {risk.claim_count} claims, {formatCurrency(risk.total_amount)} total
                              </p>
                              <p className="text-gray-500 text-xs">
                                {risk.email} • ID: {userId}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge className={`${getRiskColor(risk.overall_risk)} text-white`}>
                                {getRiskLabel(risk.overall_risk)}
                              </Badge>
                              <p className="text-gray-400 text-sm mt-1">
                                Score: {risk.overall_risk.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {!analysisData && !loading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Analysis Data</h3>
            <p className="text-gray-400 mb-4">
              Click "Run Analysis" to detect fraud rings and suspicious networks
            </p>
            <Button onClick={runAnalysis} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NetworkAnalysis;
