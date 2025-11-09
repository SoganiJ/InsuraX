'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/formatters';
import { Eye } from 'lucide-react';

const RiskIndicator = ({ score }: { score: number }) => {
  const getRiskColor = () => {
    if (score > 0.8) return 'bg-red-500';
    if (score > 0.5) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  return <div className={`w-2.5 h-2.5 rounded-full ${getRiskColor()}`} />;
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
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status || 'Unknown'}
    </span>
  );
};

const LiveTriageQueue = ({ claims, onClaimSelect }: any) => {
  // Handle loading internally - if no claims, show loading
  if (!claims || claims.length === 0) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Live Triage Queue</h3>
        </div>
        <div className="text-center text-slate-400 py-8">Loading live claims...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">Live Triage Queue</h3>
        <span className="text-slate-400 text-sm">{claims.length} claims</span>
      </div>
      
      <div className="space-y-3">
        {claims.slice(0, 5).map((claim: any, index: number) => (
          <motion.div
            key={claim.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-700 p-4 rounded-lg border border-slate-600 hover:border-blue-500 transition-all cursor-pointer group"
            onClick={() => onClaimSelect(claim)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RiskIndicator score={claim.fraudScore || 0} />
                <div>
                  <p className="font-medium text-white">{claim.claimantName || claim.policyHolderName || 'Loading...'}</p>
                  <p className="text-sm text-slate-400">Claim #{claim.claimId || claim.id}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <StatusBadge status={claim.status} />
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatCurrency(claim.claimAmount || 0)}</p>
                  <p className="text-xs text-slate-400">
                    {(claim.fraudScore || 0) > 0.7 ? 'High Risk' : 
                     (claim.fraudScore || 0) > 0.3 ? 'Medium Risk' : 'Low Risk'}
                  </p>
                </div>
                <Eye className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {claims.length > 5 && (
        <div className="text-center mt-4">
          <span className="text-slate-400 text-sm">+{claims.length - 5} more claims</span>
        </div>
      )}
    </div>
  );
};

export default LiveTriageQueue;

