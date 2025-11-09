"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { generateAllPolicies } from '@/lib/policyGenerator';

// Types
export interface Policy {
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

export interface Claim {
  id?: string;
  claimId: string;
  policyId: string;
  policyName: string;
  claimType: string;
  claimAmount: number;
  status: string;
  submittedDate: string;
  incidentDate: string;
  description: string;
  adjuster?: {
    name: string;
    email: string;
    phone: string;
  };
  timeline: Array<{
    date: string;
    status: string;
    description: string;
  }>;
  documents: Array<{
    name: string;
    type: string;
    uploaded: string;
  }>;
  messages: Array<{
    sender: string;
    message: string;
    timestamp: string;
  }>;
  userId: string;
  // ML Model fields
  insurance_type: string;
  policy_term: string;
  insured_sex: string;
  insured_age: number;
  insured_occupation: string;
  policy_state: string;
  policy_city: string;
  policy_annual_premium: number;
  sum_insured: number;
  previous_claims_count: number;
  policy_renewal_status: string;
  premium_payment_delays: string;
  coverage_changes_before_claim: string;
  incident_time: string;
  claim_filing_date: string;
  claim_amount_to_sum_insured_ratio: number;
  policy_age_at_incident_days: number;
  claim_filing_delay_days: number;
  // Conditional fields
  auto_make?: string;
  auto_model?: string;
  auto_year?: number;
  accident_location?: string;
  third_party_involved?: string;
  claim_duration_days?: number;
  hospital_name?: string;
  treatment_details?: string;
  nominee_relationship?: string;
  property_type?: string;
  crop_type?: string;
  weather_condition?: string;
  custom_claim_type?: string;
  incident_photos?: Array<{
    name: string;
    size: number;
    type: string;
    uploaded: string;
  }>;
  supporting_documents?: Array<{
    name: string;
    size: number;
    type: string;
    uploaded: string;
  }>;
}

interface DataContextType {
  // User data
  user: any;
  userData: any;
  refreshUserData: () => Promise<void>;
  
  // Policies
  policies: Policy[];
  loadingPolicies: boolean;
  addPolicy: (policy: Omit<Policy, 'id' | 'userId'>) => Promise<void>;
  updatePolicy: (policyId: string, updates: Partial<Policy>) => Promise<void>;
  generateAutoPolicies: () => Promise<void>;
  
  // Claims
  claims: Claim[];
  loadingClaims: boolean;
  addClaim: (claim: Omit<Claim, 'id' | 'userId'>) => Promise<void>;
  updateClaim: (claimId: string, updates: Partial<Claim>) => Promise<void>;
  
  // Loading states
  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);

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

  // Initialize user and load data
  useEffect(() => {
    console.log("DataContext: useEffect initialized");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("DataContext: Auth state changed", currentUser?.uid);
      console.log("DataContext: Current timestamp:", new Date().toISOString());
      
      if (currentUser) {
        setUser(currentUser);
        
        // Get user data from Firestore
        console.log("DataContext: Fetching user data from Firestore...");
        console.log("DataContext: User ID:", currentUser.uid);
        
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          console.log("DataContext: Firestore query completed");
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("DataContext: User data loaded:", userData);
            console.log("DataContext: User data keys:", Object.keys(userData));
            console.log("DataContext: Specific fields - phone:", userData.phone, "insured_sex:", userData.insured_sex, "address:", userData.address);
            setUserData(userData);
          } else {
            console.log("DataContext: No user document found in Firestore");
            setUserData(null);
          }
        } catch (error) {
          console.error("DataContext: Error fetching user data:", error);
          setUserData(null);
        }
        
        // Load user's policies and claims
        await loadUserData(currentUser.uid);
      } else {
        console.log("DataContext: No user authenticated");
        setUser(null);
        setUserData(null);
        setPolicies([]);
        setClaims([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-generate policies when userData is complete and no policies exist
  useEffect(() => {
    const checkAndGeneratePolicies = async () => {
      if (user && userData && isProfileComplete(userData) && policies.length === 0 && !loadingPolicies) {
        console.log("DataContext: Profile complete and no policies found, auto-generating policies...");
        await generateAutoPolicies();
      }
    };

    checkAndGeneratePolicies();
  }, [user, userData, policies.length, loadingPolicies]);

  // Generate auto-policies based on user profile
  const generateAutoPolicies = async () => {
    if (!user || !userData) {
      console.log("DataContext: Cannot generate policies - no user or userData");
      return;
    }

    if (!isProfileComplete(userData)) {
      console.log("DataContext: Cannot generate policies - profile incomplete");
      return;
    }

    if (policies.length > 0) {
      console.log("DataContext: Policies already exist, skipping auto-generation");
      return;
    }

    try {
      console.log("DataContext: Generating auto-policies for user:", user.uid);
      setLoadingPolicies(true);
      
      // Generate policies using the policy generator
      const generatedPolicies = generateAllPolicies(userData, user.uid);
      
      // Add each policy to Firestore
      for (const policy of generatedPolicies) {
        const docRef = await addDoc(collection(db, 'policies'), policy);
        const addedPolicy = { id: docRef.id, ...policy };
        setPolicies(prev => [...prev, addedPolicy]);
      }
      
      console.log("DataContext: Successfully generated", generatedPolicies.length, "policies");
    } catch (error) {
      console.error("DataContext: Error generating auto-policies:", error);
    } finally {
      setLoadingPolicies(false);
    }
  };

  const loadUserData = async (userId: string) => {
    setLoadingPolicies(true);
    setLoadingClaims(true);
    
    try {
      // Load policies
      const policiesQuery = query(
        collection(db, 'policies'),
        where('userId', '==', userId)
      );
      const policiesSnapshot = await getDocs(policiesQuery);
      const userPolicies = policiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Policy[];
      setPolicies(userPolicies);

      // Load claims
      const claimsQuery = query(
        collection(db, 'claims'),
        where('userId', '==', userId)
      );
      const claimsSnapshot = await getDocs(claimsQuery);
      const userClaims = claimsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Claim[];
      setClaims(userClaims);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingPolicies(false);
      setLoadingClaims(false);
    }
  };

  const refreshUserData = async () => {
    if (!user) {
      console.log("DataContext: refreshUserData called but no user");
      return;
    }
    
    try {
      console.log("DataContext: Refreshing user data...");
      // Refresh user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("DataContext: Refreshed user data:", userData);
        setUserData(userData);
      } else {
        console.log("DataContext: No user document found during refresh");
        setUserData(null);
      }
      
      // Reload policies and claims
      await loadUserData(user.uid);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const addPolicy = async (policyData: Omit<Policy, 'id' | 'userId'>) => {
    if (!user) return;
    
    try {
      const newPolicy = {
        ...policyData,
        userId: user.uid
      };
      
      const docRef = await addDoc(collection(db, 'policies'), newPolicy);
      const addedPolicy = { id: docRef.id, ...newPolicy };
      setPolicies(prev => [...prev, addedPolicy]);
    } catch (error) {
      console.error('Error adding policy:', error);
      throw error;
    }
  };

  const updatePolicy = async (policyId: string, updates: Partial<Policy>) => {
    try {
      await updateDoc(doc(db, 'policies', policyId), updates);
      setPolicies(prev => 
        prev.map(policy => 
          policy.id === policyId ? { ...policy, ...updates } : policy
        )
      );
    } catch (error) {
      console.error('Error updating policy:', error);
      throw error;
    }
  };

  const addClaim = async (claimData: Omit<Claim, 'id' | 'userId'>) => {
    if (!user) return;
    
    try {
      const newClaim = {
        ...claimData,
        userId: user.uid
      };
      
      const docRef = await addDoc(collection(db, 'claims'), newClaim);
      const addedClaim = { id: docRef.id, ...newClaim };
      setClaims(prev => [...prev, addedClaim]);
    } catch (error) {
      console.error('Error adding claim:', error);
      throw error;
    }
  };

  const updateClaim = async (claimId: string, updates: Partial<Claim>) => {
    try {
      await updateDoc(doc(db, 'claims', claimId), updates);
      setClaims(prev => 
        prev.map(claim => 
          claim.id === claimId ? { ...claim, ...updates } : claim
        )
      );
    } catch (error) {
      console.error('Error updating claim:', error);
      throw error;
    }
  };

  const value: DataContextType = React.useMemo(() => ({
    user,
    userData,
    refreshUserData,
    policies,
    loadingPolicies,
    addPolicy,
    updatePolicy,
    generateAutoPolicies,
    claims,
    loadingClaims,
    addClaim,
    updateClaim,
    loading
  }), [user, userData, policies, claims, loading, loadingPolicies, loadingClaims]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

