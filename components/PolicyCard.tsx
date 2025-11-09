'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';

export interface Policy {
  policyId: string;
  policyName: string;
  insurance_type: string;
  policy_term: string;
  policy_start_date: string;
  policy_end_date: string;
  policy_annual_premium: number;
  sum_insured: number;
  policy_renewal_status: string;
  premium_payment_delays: string;
  coverage_changes_before_claim: string;
  insured_sex: string;
  insured_age: number;
  insured_occupation: string;
  policy_state: string;
  policy_city: string;
  previous_claims_count: number;
  status: string;
  holderName: string;
  insurer: string;
  nextDueDate: string;
}

interface PolicyCardProps {
  policy: Policy;
  onViewDetails?: () => void;
}

const PolicyCard: React.FC<PolicyCardProps> = ({ policy, onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    Active: 'bg-green-500',
    Renewed: 'bg-green-500',
    'Pending Renewal': 'bg-yellow-500',
    Expired: 'bg-red-500',
    Cancelled: 'bg-red-500',
    Suspended: 'bg-orange-500',
  };

  // Calculate progress between startDate and endDate
  const start = new Date(policy.policy_start_date).getTime();
  const end = new Date(policy.policy_end_date).getTime();
  const now = Date.now();
  const progress =
    start && end && now > start
      ? Math.min(((now - start) / (end - start)) * 100, 100)
      : 0;

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-lg p-6 rounded-2xl border border-slate-700 hover:border-purple-500 hover:shadow-purple-500/30 hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          {policy.policyName}
        </h2>
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full text-white ${
            statusColors[policy.status] || 'bg-gray-500'
          }`}
        >
          {policy.status}
        </span>
      </div>

      {/* Insurer + Holder */}
      <p className="text-slate-400 text-sm mt-1">
        <strong className="text-slate-200">Insurer:</strong> {policy.insurer}
      </p>
      <p className="text-slate-400 text-sm">
        <strong className="text-slate-200">Holder:</strong> {policy.holderName}
      </p>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Start: {policy.policy_start_date}</span>
          <span>End: {policy.policy_end_date}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Basic details */}
      <div className="mt-4 text-sm text-slate-300 space-y-1">
        <p>
          <strong>Type:</strong> {policy.insurance_type}
        </p>
        <p>
          <strong>Term:</strong> {policy.policy_term}
        </p>
        <p>
          <strong>Premium:</strong> {formatCurrency(policy.policy_annual_premium || 0)}/year
        </p>
        <p>
          <strong>Coverage:</strong> {formatCurrency(policy.sum_insured || 0)}
        </p>
        <p>
          <strong>Next Due:</strong> {policy.nextDueDate}
        </p>
        <p>
          <strong>Previous Claims:</strong> {policy.previous_claims_count}
        </p>
      </div>

      {/* Expandable Section */}
      {expanded && (
        <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-300 text-sm space-y-2">
          <p>
            <strong>Policy ID:</strong> {policy.policyId}
          </p>
          <p>
            <strong>Duration:</strong> {policy.policy_start_date} → {policy.policy_end_date}
          </p>
          <p>
            <strong>Renewal Status:</strong> {policy.policy_renewal_status}
          </p>
          <p>
            <strong>Payment Delays:</strong> {policy.premium_payment_delays}
          </p>
          <p>
            <strong>Coverage Changes:</strong> {policy.coverage_changes_before_claim}
          </p>
          <p>
            <strong>Age:</strong> {policy.insured_age} years
          </p>
          <p>
            <strong>Occupation:</strong> {policy.insured_occupation}
          </p>
          <p>
            <strong>Location:</strong> {policy.policy_city}, {policy.policy_state}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition py-2 rounded-lg font-medium text-white shadow-md"
        >
          {expanded ? 'Hide Details' : 'View Details'}
        </button>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 transition py-2 rounded-lg font-medium text-white shadow-md"
          >
            Full Details
          </button>
        )}
      </div>
    </div>
  );
};

export default PolicyCard;
