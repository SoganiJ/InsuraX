'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Users, FileText, AlertTriangle, CheckCircle, Clock, XCircle, PieChart, BarChart3 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { formatCurrency } from '@/lib/formatters';
// Removed unused imports: predictFraud, transformClaimDataForML
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
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

interface AnalyticsData {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  onHoldClaims: number;
  totalFraudClaims: number;
  totalNonFraudClaims: number;
  averageFraudScore: number;
  claimsByType: Record<string, number>;
  averageClaimAmount: number;
  totalClaimAmount: number;
  averageReviewTime: number;
  highRiskClaims: number;
  mediumRiskClaims: number;
  lowRiskClaims: number;
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    onHoldClaims: 0,
    totalFraudClaims: 0,
    totalNonFraudClaims: 0,
    averageFraudScore: 0,
    claimsByType: {},
    averageClaimAmount: 0,
    totalClaimAmount: 0,
    averageReviewTime: 0,
    highRiskClaims: 0,
    mediumRiskClaims: 0,
    lowRiskClaims: 0
  });
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all claims for analytics
    const q = query(collection(db, 'claims'), orderBy('submittedDate', 'desc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const claimsData: any[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const claimData: any = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // ✅ REMOVED ML PROCESSING - Only AdminDashboardContent should process ML
        // Set default values if ML data is missing (will be processed by main dashboard)
        if (!claimData.fraudScore) {
          claimData.fraudScore = 0.5;
          claimData.riskLevel = 'medium';
          claimData.fraudExplanation = 'Analysis pending';
          claimData.is_fraud = false;
          claimData.gemini_analysis = 'Pending AI analysis';
        }
        
        // Fetch user data
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
      
      setClaims(claimsData);
      const analytics = calculateAnalytics(claimsData);
      setAnalyticsData(analytics);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching claims for analytics:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateAnalytics = (claims: any[]): AnalyticsData => {
    const totalClaims = claims.length;
    
    // Status breakdown
    const pendingClaims = claims.filter(c => c.status === 'Submitted' || c.status === 'Under Review').length;
    const approvedClaims = claims.filter(c => c.status === 'Approved').length;
    const rejectedClaims = claims.filter(c => c.status === 'Rejected').length;
    const onHoldClaims = claims.filter(c => c.status === 'On Hold').length;
    
    // Fraud analysis
    const totalFraudClaims = claims.filter(c => (c.fraudScore || 0) > 0.7).length;
    const totalNonFraudClaims = claims.filter(c => (c.fraudScore || 0) <= 0.7).length;
    const averageFraudScore = claims.length > 0 ? claims.reduce((sum, c) => sum + (c.fraudScore || 0), 0) / claims.length : 0;
    
    // Risk level breakdown
    const highRiskClaims = claims.filter(c => (c.fraudScore || 0) > 0.7).length;
    const mediumRiskClaims = claims.filter(c => (c.fraudScore || 0) > 0.3 && (c.fraudScore || 0) <= 0.7).length;
    const lowRiskClaims = claims.filter(c => (c.fraudScore || 0) <= 0.3).length;
    
    // Claims by type
    const claimsByType: Record<string, number> = {};
    claims.forEach(claim => {
      const type = claim.insurance_type || 'Unknown';
      claimsByType[type] = (claimsByType[type] || 0) + 1;
    });
    
    // Amount analysis
    const totalClaimAmount = claims.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
    const averageClaimAmount = claims.length > 0 ? totalClaimAmount / claims.length : 0;
    
    // Review time calculation (simplified - using submission date as proxy)
    const averageReviewTime = 48; // This would be calculated from actual review times in a real system
    
    return {
      totalClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      onHoldClaims,
      totalFraudClaims,
      totalNonFraudClaims,
      averageFraudScore,
      claimsByType,
      averageClaimAmount,
      totalClaimAmount,
      averageReviewTime,
      highRiskClaims,
      mediumRiskClaims,
      lowRiskClaims
    };
  };

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue" }: any) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="ml-1">{trendValue}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-500/20`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
      </div>
    </div>
  );

  // Chart data preparation
  const statusData = [
    { name: 'Pending', value: analyticsData.pendingClaims, color: '#f59e0b' },
    { name: 'Approved', value: analyticsData.approvedClaims, color: '#10b981' },
    { name: 'Rejected', value: analyticsData.rejectedClaims, color: '#ef4444' },
    { name: 'On Hold', value: analyticsData.onHoldClaims, color: '#f97316' }
  ];

  const riskData = [
    { name: 'High Risk', value: analyticsData.highRiskClaims, color: '#ef4444' },
    { name: 'Medium Risk', value: analyticsData.mediumRiskClaims, color: '#f59e0b' },
    { name: 'Low Risk', value: analyticsData.lowRiskClaims, color: '#10b981' }
  ];

  const claimsByTypeData = Object.entries(analyticsData.claimsByType).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    color: type === 'automobile' ? '#3b82f6' : 
           type === 'health' ? '#10b981' : 
           type === 'life' ? '#8b5cf6' : 
           type === 'property' ? '#f59e0b' : '#ef4444'
  }));

  const fraudVsLegitimateData = [
    { name: 'Fraud Claims', value: analyticsData.totalFraudClaims, color: '#ef4444' },
    { name: 'Legitimate Claims', value: analyticsData.totalNonFraudClaims, color: '#10b981' }
  ];

  // Generate monthly trend data from actual claims
  const generateMonthlyTrendData = (claims: any[]) => {
    const monthlyData: Record<string, { claims: number; fraud: number }> = {};
    
    // Initialize last 6 months
    const months = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      months.push(monthKey);
      monthlyData[monthKey] = { claims: 0, fraud: 0 };
    }
    
    // Count claims by month
    claims.forEach(claim => {
      if (claim.submittedDate) {
        const claimDate = new Date(claim.submittedDate);
        const monthKey = claimDate.toLocaleDateString('en-US', { month: 'short' });
        
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].claims++;
          if ((claim.fraudScore || 0) > 0.7) {
            monthlyData[monthKey].fraud++;
          }
        }
      }
    });
    
    return months.map(month => ({
      month,
      claims: monthlyData[month].claims,
      fraud: monthlyData[month].fraud
    }));
  };

  const monthlyTrendData = generateMonthlyTrendData(claims || []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin-dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
            <ArrowLeft size={18} />
            Back to Command Center
          </Link>
          <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-slate-400 mt-2">Comprehensive insights into claims and fraud detection</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Claims"
          value={analyticsData.totalClaims}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Pending Claims"
          value={analyticsData.pendingClaims}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Approved Claims"
          value={analyticsData.approvedClaims}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Rejected Claims"
          value={analyticsData.rejectedClaims}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Claims Status Pie Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Claims Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => {
                  if (percent < 0.05) return ''; // Don't show labels for very small slices
                  return `${name} ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Level Pie Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-xl font-bold text-white">Risk Level Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => {
                  if (percent < 0.05) return '';
                  return `${name} ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Claims by Type Bar Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <h3 className="text-xl font-bold text-white">Claims by Insurance Type</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={claimsByTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }} 
              />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fraud vs Legitimate Claims */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Fraud vs Legitimate Claims</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={fraudVsLegitimateData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => {
                  if (percent < 0.05) return '';
                  return `${name} ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {fraudVsLegitimateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Monthly Claims Trend</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthlyTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb'
              }} 
            />
            <Area type="monotone" dataKey="claims" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="fraud" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-slate-300 text-sm">Total Claims</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-slate-300 text-sm">Fraud Claims</span>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Financial Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Total Claim Amount</span>
              <span className="text-white font-bold">{formatCurrency(analyticsData.totalClaimAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Average Claim Amount</span>
              <span className="text-white font-bold">{formatCurrency(analyticsData.averageClaimAmount)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Processing Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Average Review Time</span>
              <span className="text-white font-bold">{analyticsData.averageReviewTime} Hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">On Hold Claims</span>
              <span className="text-yellow-400 font-bold">{analyticsData.onHoldClaims}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Fraud Detection</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Fraud Claims Detected</span>
              <span className="text-red-400 font-bold">{analyticsData.totalFraudClaims}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Legitimate Claims</span>
              <span className="text-green-400 font-bold">{analyticsData.totalNonFraudClaims}</span>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Fraud Detection Rate</span>
                <span className="text-white font-bold">
                  {analyticsData.totalClaims > 0 ? ((analyticsData.totalFraudClaims / analyticsData.totalClaims) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
