'use client';

import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface FilterState {
  searchTerm: string;
  status: string;
  riskLevel: string;
  insuranceType: string;
  minAmount: string;
  maxAmount: string;
}

const ClaimsFilter = ({ onFilterChange }: { onFilterChange: (filters: FilterState) => void }) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    status: '',
    riskLevel: '',
    insuranceType: '',
    minAmount: '',
    maxAmount: ''
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Apply filters whenever any filter changes
  useEffect(() => {
    onFilterChange(filters);
  }, [filters]); // 🔑 Removed onFilterChange from dependencies to prevent infinite loops

  const handleInputChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: '',
      riskLevel: '',
      insuranceType: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-6">
      <div className="flex flex-col gap-4">
        {/* Main Search Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search Input */}
          <div className="relative w-full md:flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by claim ID, claimant name, or policy ID..."
              value={filters.searchTerm}
              onChange={(e) => handleInputChange('searchTerm', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <SlidersHorizontal size={16} />
              Advanced Filters
            </button>
            {hasActiveFilters && (
              <button 
                onClick={resetFilters}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <X size={16} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            {/* Risk Level Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Risk Level</label>
              <select
                value={filters.riskLevel}
                onChange={(e) => handleInputChange('riskLevel', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            {/* Insurance Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Insurance Type</label>
              <select
                value={filters.insuranceType}
                onChange={(e) => handleInputChange('insuranceType', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="automobile">Automobile</option>
                <option value="health">Health</option>
                <option value="life">Life</option>
                <option value="property">Property</option>
                <option value="crop">Crop</option>
              </select>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Amount Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => handleInputChange('minAmount', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => handleInputChange('maxAmount', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimsFilter;
