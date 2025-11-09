'use client';

import React from 'react';
import NetworkAnalysis from '@/components/admindashboard/NetworkAnalysis';

export default function NetworkAnalysisPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <NetworkAnalysis />
      </div>
    </div>
  );
}




