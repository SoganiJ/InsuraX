'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/formatters';
import { db } from '@/firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

interface Policy {
  id?: string;
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
  nextDueDate: string;
  userId: string;
}

export default function MyPoliciesPage() {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [showAddPolicyForm, setShowAddPolicyForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState<Partial<Policy>>({
    policyId: '',
    policyName: '',
    insurance_type: '',
    policy_term: '',
    policy_start_date: '',
    policy_end_date: '',
    policy_annual_premium: 0,
    sum_insured: 0,
    policy_renewal_status: 'Active',
    premium_payment_delays: 'None',
    coverage_changes_before_claim: 'None',
    insured_sex: 'M',
    insured_age: 0,
    insured_occupation: '',
    policy_state: '',
    policy_city: '',
    previous_claims_count: 0,
    status: 'Active',
    holderName: '',
    nextDueDate: '',
  });
  const { user, userData, policies, loadingPolicies, addPolicy, generateAutoPolicies } = useData();

  // Check if user profile is complete for auto-policy generation
  const isProfileComplete = (userData: any): boolean => {
    if (!userData) return false;
    
    const requiredFields = [
      'displayName',
      'insured_sex', 
      'insured_age',
      'insured_occupation',
      'policy_state',
      'policy_city'
    ];
    
    return requiredFields.every(field => 
      userData[field] && userData[field] !== '' && userData[field] !== 0
    );
  };

  // Handle auto-policy generation
  const handleGeneratePolicies = async () => {
    if (!isProfileComplete(userData)) {
      alert('Please complete your profile first (Name, Age, Gender, Occupation, State, City) to generate policies automatically.');
      return;
    }
    
    try {
      await generateAutoPolicies();
      alert('Policies generated successfully! Check your policies below.');
    } catch (error) {
      console.error('Error generating policies:', error);
      alert('Error generating policies. Please try again.');
    }
  };

  // Pre-fill form with user data when form is shown or userData changes
  useEffect(() => {
    if (showAddPolicyForm && userData) {
      setNewPolicy(prev => ({
        ...prev,
        holderName: userData.displayName || user?.displayName || "User",
        insured_sex: userData.insured_sex || "M",
        insured_age: userData.insured_age || 0,
        insured_occupation: userData.insured_occupation || "",
        policy_state: userData.policy_state || "",
        policy_city: userData.policy_city || "",
      }));
    }
  }, [showAddPolicyForm, userData, user]);

  // Initialize with empty policies (user will add manually)
  const initializePolicies = async () => {
    if (!user) return;
    
    // We don't auto-generate policies anymore
    // Just ensure we have the user's policies loaded
    console.log('User policies loaded:', policies.length);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPolicy(prev => ({
      ...prev,
      [name]: name.includes('premium') || name.includes('insured') || name.includes('age') || name.includes('count') 
        ? Number(value) 
        : value
    }));
  };

  // Submit new policy
  const handleSubmitPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const policyToAdd: Omit<Policy, 'id'> = {
        ...newPolicy as Omit<Policy, 'id'>,
        userId: user.uid,
        holderName: userData?.displayName || user?.displayName || "User",
      };

      await addPolicy(policyToAdd);
      setShowAddPolicyForm(false);
      setNewPolicy({
        policyId: '',
        policyName: '',
        insurance_type: '',
        policy_term: '',
        policy_start_date: '',
        policy_end_date: '',
        policy_annual_premium: 0,
        sum_insured: 0,
        policy_renewal_status: 'Active',
        premium_payment_delays: 'None',
        coverage_changes_before_claim: 'None',
        insured_sex: 'M',
        insured_age: 0,
        insured_occupation: '',
        policy_state: '',
        policy_city: '',
        previous_claims_count: 0,
        status: 'Active',
        holderName: '',
        nextDueDate: '',
      });
    } catch (error) {
      console.error('Error adding policy:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (user) {
      initializePolicies();
    }
  }, [user?.uid]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Renewal Due': return 'bg-yellow-500';
      case 'Expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loadingPolicies) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">My Policies</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-400">Loading policies...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">My Policies</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {policies.length} policies
          </span>
          {policies.length === 0 && isProfileComplete(userData) && (
            <button
              onClick={handleGeneratePolicies}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Generate Policies
            </button>
          )}
          <button
            onClick={() => setShowAddPolicyForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Add New Policy
          </button>
        </div>
      </div>

      {/* Add Policy Form */}
      {showAddPolicyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg text-white w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Add New Policy</h2>
            <form onSubmit={handleSubmitPolicy} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Policy ID</label>
                  <input
                    type="text"
                    name="policyId"
                    value={newPolicy.policyId}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Policy Name</label>
                  <input
                    type="text"
                    name="policyName"
                    value={newPolicy.policyName}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Insurance Type</label>
                  <select
                    name="insurance_type"
                    value={newPolicy.insurance_type}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="Life Insurance">Life Insurance</option>
                    <option value="Health Insurance">Health Insurance</option>
                    <option value="Auto Insurance">Auto Insurance</option>
                    <option value="Home Insurance">Home Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Policy Term</label>
                  <input
                    type="text"
                    name="policy_term"
                    value={newPolicy.policy_term}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                    placeholder="e.g., 5 years"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    name="policy_start_date"
                    value={newPolicy.policy_start_date}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    name="policy_end_date"
                    value={newPolicy.policy_end_date}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Premium (₹)</label>
                  <input
                    type="number"
                    name="policy_annual_premium"
                    value={newPolicy.policy_annual_premium}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sum Insured (₹)</label>
                  <input
                    type="number"
                    name="sum_insured"
                    value={newPolicy.sum_insured}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    name="status"
                    value={newPolicy.status}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Renewal Due">Renewal Due</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Next Due Date</label>
                  <input
                    type="date"
                    name="nextDueDate"
                    value={newPolicy.nextDueDate}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                {/* Pre-filled user information */}
                <div>
                  <label className="block text-sm font-medium mb-1">Policyholder Name</label>
                  <input
                    type="text"
                    name="holderName"
                    value={newPolicy.holderName || userData?.displayName || user?.displayName || "User"}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Gender</label>
                  <select
                    name="insured_sex"
                    value={newPolicy.insured_sex || userData?.insured_sex || "M"}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age</label>
                  <input
                    type="number"
                    name="insured_age"
                    value={newPolicy.insured_age || userData?.insured_age || 0}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Occupation</label>
                  <input
                    type="text"
                    name="insured_occupation"
                    value={newPolicy.insured_occupation || userData?.insured_occupation || ""}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    name="policy_state"
                    value={newPolicy.policy_state || userData?.policy_state || ""}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input
                    type="text"
                    name="policy_city"
                    value={newPolicy.policy_city || userData?.policy_city || ""}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddPolicyForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Add Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy List or Details */}
      {!selectedPolicy ? (
        <>
          {policies.length === 0 ? (
            <div className="bg-gray-800 p-8 rounded-2xl shadow-lg text-center text-white">
              <h3 className="text-xl font-semibold mb-4">No Policies Yet</h3>
              <p className="text-gray-400 mb-6">
                {isProfileComplete(userData) 
                  ? "Generate policies automatically based on your profile or add them manually"
                  : "Complete your profile first, then generate policies automatically or add them manually"
                }
              </p>
              <div className="flex gap-4 justify-center">
                {isProfileComplete(userData) && (
                  <button
                    onClick={handleGeneratePolicies}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg transition-colors"
                  >
                    Generate Policies
                  </button>
                )}
                <button
                  onClick={() => setShowAddPolicyForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Add Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((policy) => (
                <div key={policy.policyId} className="bg-gray-800 p-6 rounded-2xl shadow-lg text-white">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">
                        {policy.policyName}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(policy.status)}`}
                      >
                        {policy.status}
                      </span>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="space-y-2 mb-4">
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Holder:</strong> {policy.holderName}
                    </p>
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Type:</strong> {policy.insurance_type}
                    </p>
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Term:</strong> {policy.policy_term}
                    </p>
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Premium:</strong> {formatCurrency(policy.policy_annual_premium)}/year
                    </p>
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Coverage:</strong> {formatCurrency(policy.sum_insured)}
                    </p>
                    <p className="text-slate-400 text-sm">
                      <strong className="text-slate-200">Next Due:</strong> {policy.nextDueDate}
                    </p>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    View Full Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Policy Details View */
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {selectedPolicy.policyName} (#{selectedPolicy.policyId})
            </h2>
            <button
              onClick={() => setSelectedPolicy(null)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Policies
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-400">Basic Information</h3>
              <p><strong>Policyholder:</strong> {selectedPolicy.holderName}</p>
              <p><strong>Insurance Type:</strong> {selectedPolicy.insurance_type}</p>
              <p><strong>Policy Term:</strong> {selectedPolicy.policy_term}</p>
              <p><strong>Start Date:</strong> {selectedPolicy.policy_start_date}</p>
              <p><strong>End Date:</strong> {selectedPolicy.policy_end_date}</p>
              <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedPolicy.status)} text-white`}>{selectedPolicy.status}</span></p>
            </div>

            {/* Financial Details */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-green-400">Financial Details</h3>
              <p><strong>Annual Premium:</strong> {formatCurrency(selectedPolicy.policy_annual_premium)}</p>
              <p><strong>Sum Insured:</strong> {formatCurrency(selectedPolicy.sum_insured)}</p>
              <p><strong>Next Due Date:</strong> {selectedPolicy.nextDueDate}</p>
              <p><strong>Previous Claims:</strong> {selectedPolicy.previous_claims_count}</p>
              <p><strong>Payment Delays:</strong> {selectedPolicy.premium_payment_delays}</p>
              <p><strong>Coverage Changes:</strong> {selectedPolicy.coverage_changes_before_claim}</p>
            </div>

            {/* Personal Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-purple-400">Personal Information</h3>
              <p><strong>Age:</strong> {selectedPolicy.insured_age} years</p>
              <p><strong>Gender:</strong> {selectedPolicy.insured_sex === 'M' ? 'Male' : 'Female'}</p>
              <p><strong>Occupation:</strong> {selectedPolicy.insured_occupation}</p>
              <p><strong>Location:</strong> {selectedPolicy.policy_city}, {selectedPolicy.policy_state}</p>
            </div>

            {/* Policy Management */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-yellow-400">Policy Management</h3>
              <p><strong>Policy ID:</strong> {selectedPolicy.policyId}</p>
              <p><strong>Renewal Status:</strong> {selectedPolicy.policy_renewal_status}</p>
              <p><strong>Duration:</strong> {selectedPolicy.policy_start_date} → {selectedPolicy.policy_end_date}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}