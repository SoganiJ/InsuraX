'use client';

// Removed unused imports: predictFraud, transformClaimDataForML
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';
import ClaimsFilter from '../../../components/admindashboard/ClaimsFilter';
import ClaimsTable from '../../../components/admindashboard/ClaimsTable';
import ClaimDetailsModal from '../../../components/admindashboard/ClaimDetailsModal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export default function ClaimsTriagePage() {
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Authentication Check
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/auth/signin');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists() && userDoc.data()?.role === 'admin') {
        // Admin user confirmed
      } else {
        router.push('/dashboard');
      }
      setLoading(false);
    });
    
    // Live Firestore Listener for ALL Claims (Admin View)
    const claimsQuery = query(collection(db, "claims"), orderBy("submittedDate", "desc"), );

    const unsubscribeClaims = onSnapshot(claimsQuery, async (querySnapshot) => {
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
        
        // Fetch user data if claimantName is not available
        if (!claimData.claimantName && claimData.userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', claimData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              claimData.claimantName = userData.displayName || 'Unknown User';
            }
          } catch (error) {
            console.error('Error fetching user data for claim:', error);
            claimData.claimantName = 'Unknown User';
          }
        }
        
        claimsData.push(claimData);
      }
      
      setAllClaims(claimsData);
      setFilteredClaims(claimsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching claims: ", error);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeClaims();
    };
  }, [router]);
  
  const handleFilterChange = useCallback((filters: any) => {
    console.log("Applying filters:", filters);
    
    let filtered = [...allClaims];
    
    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(claim => 
        (claim.claimId && claim.claimId.toLowerCase().includes(searchLower)) ||
        (claim.claimantName && claim.claimantName.toLowerCase().includes(searchLower)) ||
        (claim.policyId && claim.policyId.toLowerCase().includes(searchLower))
      );
    }
    
    // Status filter
    if (filters.status) {
      filtered = filtered.filter(claim => claim.status === filters.status);
    }
    
    // Risk level filter
    if (filters.riskLevel) {
      filtered = filtered.filter(claim => {
        const score = claim.fraudScore || 0;
        if (filters.riskLevel === 'low') return score <= 0.3;
        if (filters.riskLevel === 'medium') return score > 0.3 && score <= 0.7;
        if (filters.riskLevel === 'high') return score > 0.7;
        return true;
      });
    }
    
    // Insurance type filter
    if (filters.insuranceType) {
      filtered = filtered.filter(claim => claim.insurance_type === filters.insuranceType);
    }
    
    // Amount range filter
    if (filters.minAmount) {
      const minAmount = parseFloat(filters.minAmount);
      filtered = filtered.filter(claim => claim.claimAmount >= minAmount);
    }
    
    if (filters.maxAmount) {
      const maxAmount = parseFloat(filters.maxAmount);
      filtered = filtered.filter(claim => claim.claimAmount <= maxAmount);
    }
    
    setFilteredClaims(filtered);
  }, [allClaims]); // 🔑 Dependencies: only recreate when allClaims changes

  return (
    <>
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin-dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
              <ArrowLeft size={18} />
              Back to Command Center
            </Link>
            <h1 className="text-3xl font-bold text-white">Claims Triage</h1>
          </div>
        </div>

        {/* Filters */}
        <ClaimsFilter onFilterChange={handleFilterChange} />

        {/* Results Count */}
        <div className="mb-4 text-slate-400">
          Showing {filteredClaims.length} of {allClaims.length} claims
        </div>

        {/* Table */}
        {loading ? (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
            </div>
        ) : (
            <ClaimsTable claims={filteredClaims} loading={loading} onClaimSelect={setSelectedClaim} />
        )}
      </div>
      
      <ClaimDetailsModal claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
    </>
  );
}

