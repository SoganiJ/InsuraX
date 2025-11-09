"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Upload, Calendar, Clock, DollarSign, MapPin, Car, Hospital,
  Home, Wheat, ArrowLeft, ArrowRight, FileText, X, AlertCircle, Loader2, Paperclip
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useData } from "@/context/DataContext";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Define types for our form data
interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
  previewUrl: string;
  uploaded: string;
}

interface FormData {
  incident_date: string;
  incident_time: string;
  claim_type: string;
  custom_claim_type: string;
  claim_amount: number;
  incident_description: string;
  auto_make: string;
  auto_model: string;
  auto_year: number;
  accident_location: string;
  third_party_involved: string;
  hospital_name: string;
  treatment_details: string;
  claim_duration_days: number;
  nominee_relationship: string;
  property_type: string;
  crop_type: string;
  weather_condition: string;
  incident_photos: FileInfo[];
  supporting_documents: FileInfo[];
}

export default function FileClaimPage() {
  const [step, setStep] = useState(1);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { policies, addClaim, userData } = useData();

  // Memoize active policies to prevent re-filtering on every render
  const activePolicies = policies.filter(policy =>
    policy.status === 'Active' || policy.policy_renewal_status === 'Renewed'
  );

  const hasActivePolicies = activePolicies.length > 0;
  
  const initialFormData: FormData = {
    incident_date: "",
    incident_time: "",
    claim_type: "",
    custom_claim_type: "",
    claim_amount: 0,
    incident_description: "",
    auto_make: "",
    auto_model: "",
    auto_year: 0,
    accident_location: "",
    third_party_involved: "",
    hospital_name: "",
    treatment_details: "",
    claim_duration_days: 0,
    nominee_relationship: "",
    property_type: "",
    crop_type: "",
    weather_condition: "",
    incident_photos: [],
    supporting_documents: [],
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Reset form when component mounts or user changes
  useEffect(() => {
    if (userData) {
      setFormData(initialFormData);
      setSelectedPolicy(null);
      setStep(1);
    }
  }, [userData]);

  const validateStep = (): boolean => {
    setError(""); // Clear previous errors
    
    switch (step) {
      case 1:
        if (!selectedPolicy) {
          setError("Please select a policy to proceed.");
          return false;
        }
        return true;
      
      case 2:
        if (!formData.incident_date || !formData.incident_time) {
          setError("Incident date and time are required.");
          return false;
        }
        
        const incidentDate = new Date(formData.incident_date);
        if (incidentDate > new Date()) {
          setError("Incident date cannot be in the future.");
          return false;
        }
        
        if (!formData.claim_type) {
          setError("Please select a claim type.");
          return false;
        }
        
        if (formData.claim_type === "other" && !formData.custom_claim_type.trim()) {
          setError("Please specify the 'Other' claim type.");
          return false;
        }
        
        if (formData.claim_amount <= 0) {
          setError("Claim amount must be greater than zero.");
          return false;
        }
        
        if (formData.incident_description.trim().length < 20) {
          setError("Please provide a detailed incident description (at least 20 characters).");
          return false;
        }
        
        return true;
      
      case 3:
        // Validate based on insurance type
        if (selectedPolicy.insurance_type?.toLowerCase().includes('auto')) {
          if (!formData.auto_make || !formData.auto_model || !formData.auto_year || 
              !formData.accident_location || !formData.third_party_involved) {
            setError("Please fill all required auto insurance details.");
            return false;
          }
        } else if (selectedPolicy.insurance_type?.toLowerCase().includes('health')) {
          if (!formData.hospital_name || !formData.treatment_details || formData.claim_duration_days <= 0) {
            setError("Please fill all required health insurance details.");
            return false;
          }
        }
        return true;
      
      case 4:
        if (formData.incident_photos.length === 0) {
          setError("At least one incident photo is required.");
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep((prev) => prev + 1);
    }
  };

  const prevStep = () => setStep((prev) => prev - 1);

  const handleChange = (name: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const fileToInfo = (file: File): Promise<FileInfo> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          base64: base64Data,
          previewUrl: base64,
          uploaded: new Date().toISOString()
        });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photos' | 'documents') => {
    setError("");
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (type === 'photos') {
        return file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024; // 5MB max for images
      }
      return (file.type.startsWith('image/') || file.type === 'application/pdf') && file.size <= 10 * 1024 * 1024; // 10MB max for docs
    });

    if (validFiles.length === 0) {
      setError(type === 'photos' 
        ? "Please upload valid image files (max 5MB each)" 
        : "Please upload valid image or PDF files (max 10MB each)");
      return;
    }

    try {
      const fileInfos = await Promise.all(validFiles.map(fileToInfo));
      setFormData((prev) => ({
        ...prev,
        [type === 'photos' ? 'incident_photos' : 'supporting_documents']: [
          ...prev[type === 'photos' ? 'incident_photos' : 'supporting_documents'], 
          ...fileInfos
        ]
      }));
    } catch (error) {
      setError("Failed to process files. Please try again.");
      console.error("File processing error:", error);
    }
  };

  const removeFile = (id: string, type: 'photos' | 'documents') => {
    const fileKey = type === 'photos' ? 'incident_photos' : 'supporting_documents';
    setFormData(prev => ({
      ...prev,
      [fileKey]: prev[fileKey].filter(file => file.id !== id)
    }));
  };

  const calculatePolicyAge = (startDate: string, incidentDate: string): number => {
    try {
      const start = new Date(startDate);
      const incident = new Date(incidentDate);
      return Math.floor((incident.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error("Error calculating policy age:", error);
      return 0;
    }
  };

  const calculateFilingDelay = (incidentDate: string): number => {
    try {
      const incident = new Date(incidentDate);
      const now = new Date();
      return Math.floor((now.getTime() - incident.getTime()) / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error("Error calculating filing delay:", error);
      return 0;
    }
  };

  const calculatePreviousClaimsCount = async (policyId: string, userId: string): Promise<number> => {
    try {
      const claimsRef = collection(db, 'claims');
      const q = query(
        claimsRef, 
        where('policyId', '==', policyId),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size; // This counts all claims for this policy
    } catch (error) {
      console.error('Error counting previous claims:', error);
      return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      // Calculate derived fields
      const policyAgeDays = calculatePolicyAge(
        selectedPolicy.policy_start_date, 
        formData.incident_date
      );
      
      const filingDelayDays = calculateFilingDelay(formData.incident_date);
      
      const claimAmountToSumInsuredRatio = selectedPolicy.sum_insured > 0 
        ? formData.claim_amount / selectedPolicy.sum_insured 
        : 0;

      const claimData = {
        claimId: `CLM${Date.now()}`,
        userId: userData?.uid,
        email: userData?.email,
        policyId: selectedPolicy.policyId,
        policyName: selectedPolicy.policyName,
        claimantName: userData?.displayName || 'Unknown',
        claimType: formData.claim_type === "other" ? formData.custom_claim_type : formData.claim_type,
        claimAmount: formData.claim_amount,
        status: "Submitted",
        submittedDate: new Date().toISOString().split('T')[0],
        incidentDate: formData.incident_date,
        description: formData.incident_description,
        adjuster: { name: "TBD", email: "adjuster@insurax.com", phone: "+91 98765 43210" },
        timeline: [{ 
          date: new Date().toISOString().split('T')[0], 
          status: "Claim Submitted", 
          description: "Initial claim filed" 
        }],
        documents: [
          ...formData.incident_photos.map(f => ({ 
            name: f.name, 
            type: f.type, 
            size: f.size,
            uploaded: f.uploaded 
          })),
          ...formData.supporting_documents.map(f => ({ 
            name: f.name, 
            type: f.type, 
            size: f.size,
            uploaded: f.uploaded 
          }))
        ],
        messages: [{ 
          sender: "system", 
          message: "Your claim has been submitted successfully. We'll review it and get back to you within 2 business days.", 
          timestamp: new Date().toISOString() 
        }],
        // ML Model fields
        insurance_type: selectedPolicy.insurance_type,
        policy_term: selectedPolicy.policy_term,
        insured_sex: selectedPolicy.insured_sex,
        insured_age: selectedPolicy.insured_age,
        insured_occupation: selectedPolicy.insured_occupation,
        policy_state: selectedPolicy.policy_state,
        policy_city: selectedPolicy.policy_city,
        policy_annual_premium: selectedPolicy.policy_annual_premium,
        sum_insured: selectedPolicy.sum_insured,
        previous_claims_count: await calculatePreviousClaimsCount(selectedPolicy.policyId, userData?.uid),
        policy_renewal_status: selectedPolicy.policy_renewal_status,
        premium_payment_delays: selectedPolicy.premium_payment_delays || 'None',
        coverage_changes_before_claim: selectedPolicy.coverage_changes_before_claim || 'None',
        incident_time: formData.incident_time,
        claim_filing_date: new Date().toISOString().split('T')[0],
        claim_amount_to_sum_insured_ratio: claimAmountToSumInsuredRatio,
        policy_age_at_incident_days: policyAgeDays,
        claim_filing_delay_days: filingDelayDays,
        // Store basic file info only (no base64 in arrays)
        incident_photos_count: (formData.incident_photos || []).length,
        supporting_documents_count: (formData.supporting_documents || []).length,
        // Additional form data
        auto_make: formData.auto_make,
        auto_model: formData.auto_model,
        auto_year: formData.auto_year,
        accident_location: formData.accident_location,
        third_party_involved: formData.third_party_involved,
        hospital_name: formData.hospital_name,
        treatment_details: formData.treatment_details,
        claim_duration_days: formData.claim_duration_days,
        nominee_relationship: formData.nominee_relationship,
        property_type: formData.property_type,
        crop_type: formData.crop_type,
        weather_condition: formData.weather_condition,
        // Include images as base64
        incident_photos: formData.incident_photos.map(img => ({
          name: img.name,
          size: img.size,
          type: img.type,
          base64: img.base64,
          uploaded: img.uploaded
        })),
        supporting_documents: formData.supporting_documents.map(doc => ({
          name: doc.name,
          size: doc.size,
          type: doc.type,
          base64: doc.base64,
          uploaded: doc.uploaded
        }))
      };
      
      // Create the claim with all data including images
      await addClaim(claimData);
      
      setStep(6);
    } catch (error) {
      console.error("Error submitting claim:", error);
      setError('Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const resetForm = () => {
    setStep(1);
    setSelectedPolicy(null);
    setIsSubmitting(false);
    setFormData(initialFormData);
    setError("");
  };

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const fieldClasses = "w-full p-3 rounded-lg border bg-slate-800 text-slate-200 border-slate-600 placeholder-slate-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300";

  const renderCurrentStep = () => {
    switch(step) {
      case 1: // Policy Selection
        return (
            <motion.div key="step1" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4 }} className="space-y-4">
                <h2 className="text-lg font-semibold text-center mb-6">Select Your Policy</h2>
                {!hasActivePolicies ? (
                     <div className="text-center space-y-4 py-8">
                         <div className="text-yellow-500 text-6xl">⚠️</div>
                         <h3 className="text-xl font-semibold text-yellow-400">No Active Policies Found</h3>
                         <p className="text-slate-400 max-w-md mx-auto">You don't have any active policies to file a claim against. Please renew your policies first or contact support.</p>
                         <Button onClick={() => window.location.href = '/dashboard/policies'} className="bg-blue-600 hover:bg-blue-700"><ArrowRight className="mr-2 h-4 w-4"/>Go to My Policies</Button>
                     </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <p className="text-green-400 text-sm flex items-center"><CheckCircle2 className="w-4 h-4 mr-2"/>Showing {activePolicies.length} active policy(ies) eligible for claims</p>
                        </div>
                        <div className="grid gap-4">
                            {activePolicies.map((policy) => (
                                <div key={policy.policyId} onClick={() => setSelectedPolicy(policy)} className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedPolicy?.policyId === policy.policyId ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500' : 'border-slate-600 bg-slate-800 hover:border-slate-500'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-white">{policy.policyName}</h3>
                                            <p className="text-slate-400 text-sm">ID: {policy.policyId}</p>
                                            <p className="text-slate-400 text-sm">Type: {policy.insurance_type}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-300 text-sm">Coverage: {formatCurrency(policy.sum_insured)}</p>
                                            <p className="text-green-400 text-sm font-medium">Status: {policy.status === 'Active' ? 'Active' : policy.policy_renewal_status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        );

      case 2: // Basic Incident Details
        return (
            <motion.div key="step2" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4 }} className="space-y-4">
                <h2 className="text-lg font-semibold text-center mb-6">Incident Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center text-sm font-medium text-slate-300 mb-2"><Calendar className="w-4 h-4 mr-2" />Incident Date</label>
                        <Input type="date" value={formData.incident_date} onChange={(e) => handleChange("incident_date", e.target.value)} required max={new Date().toISOString().split("T")[0]} className={fieldClasses} />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-slate-300 mb-2"><Clock className="w-4 h-4 mr-2" />Incident Time</label>
                        <Input type="time" value={formData.incident_time} onChange={(e) => handleChange("incident_time", e.target.value)} required className={fieldClasses} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Claim Type</label>
                    <Select value={formData.claim_type} onValueChange={(val) => handleChange("claim_type", val)}>
                        <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select claim type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="theft">Theft</SelectItem><SelectItem value="death">Death</SelectItem><SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="yield_loss">Yield Loss</SelectItem><SelectItem value="damage">Damage</SelectItem><SelectItem value="injury">Injury</SelectItem>
                          <SelectItem value="accident">Accident</SelectItem><SelectItem value="fire">Fire</SelectItem><SelectItem value="other">Other (Please specify)</SelectItem>
                        </SelectContent>
                    </Select>
                    {formData.claim_type === "other" && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Please specify the claim type</label>
                            <Input placeholder="Enter custom claim type" value={formData.custom_claim_type} onChange={(e) => handleChange("custom_claim_type", e.target.value)} required={formData.claim_type === "other"} className={fieldClasses} />
                        </motion.div>
                    )}
                </div>
                <div>
                    <label className="flex items-center text-sm font-medium text-slate-300 mb-2"><DollarSign className="w-4 h-4 mr-2" />Claim Amount (₹)</label>
                    <Input type="number" placeholder="Enter claim amount" value={formData.claim_amount || ''} onChange={(e) => handleChange("claim_amount", parseInt(e.target.value) || 0)} required className={fieldClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Incident Description</label>
                    <Textarea placeholder="Describe the incident in detail..." rows={4} value={formData.incident_description} onChange={(e) => handleChange("incident_description", e.target.value)} required className={fieldClasses} />
                </div>
            </motion.div>
        );
      
      case 3: // Conditional Fields
        return (
            <motion.div key="step3" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4 }} className="space-y-4">
                <h2 className="text-lg font-semibold text-center mb-6 flex items-center justify-center">
                    {selectedPolicy.insurance_type?.toLowerCase().includes('auto') && <><Car className="w-5 h-5 mr-2" />Auto Insurance Details</>}
                    {selectedPolicy.insurance_type?.toLowerCase().includes('health') && <><Hospital className="w-5 h-5 mr-2" />Health Insurance Details</>}
                    {selectedPolicy.insurance_type?.toLowerCase().includes('home') && <><Home className="w-5 h-5 mr-2" />Home Insurance Details</>}
                    {selectedPolicy.insurance_type?.toLowerCase().includes('agri') && <><Wheat className="w-5 h-5 mr-2" />Agriculture Insurance Details</>}
                    {selectedPolicy.insurance_type?.toLowerCase().includes('life') && <><FileText className="w-5 h-5 mr-2" />Life Insurance Details</>}
                    {selectedPolicy.insurance_type?.toLowerCase().includes('property') && <><MapPin className="w-5 h-5 mr-2" />Property Insurance Details</>}
                    {!['auto', 'health', 'home', 'agri', 'life', 'property'].some(type => selectedPolicy.insurance_type?.toLowerCase().includes(type)) && <>Additional Details</>}
                </h2>
                
                {/* AUTO INSURANCE FIELDS */}
                {selectedPolicy.insurance_type?.toLowerCase().includes('auto') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Vehicle Make</label>
                            <Select value={formData.auto_make} onValueChange={(val) => handleChange("auto_make", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select vehicle make" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Maruti">Maruti</SelectItem>
                                  <SelectItem value="Hyundai">Hyundai</SelectItem>
                                  <SelectItem value="Honda">Honda</SelectItem>
                                  <SelectItem value="Toyota">Toyota</SelectItem>
                                  <SelectItem value="Tata">Tata</SelectItem>
                                  <SelectItem value="Mahindra">Mahindra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Vehicle Model</label>
                            <Input placeholder="e.g., Swift Dzire" value={formData.auto_model} onChange={(e) => handleChange("auto_model", e.target.value)} required className={fieldClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Vehicle Year</label>
                            <Input type="number" placeholder="e.g., 2022" min="1990" max={new Date().getFullYear()} value={formData.auto_year || ''} onChange={(e) => handleChange("auto_year", parseInt(e.target.value) || 0)} required className={fieldClasses} />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Third Party Involved</label>
                            <Select value={formData.third_party_involved} onValueChange={(val) => handleChange("third_party_involved", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select option" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="md:col-span-2">
                            <label className="flex items-center text-sm font-medium text-slate-300 mb-2"><MapPin className="w-4 h-4 mr-2" />Accident Location</label>
                            <Textarea placeholder="Enter detailed accident location..." rows={2} value={formData.accident_location} onChange={(e) => handleChange("accident_location", e.target.value)} required className={fieldClasses} />
                        </div>
                    </div>
                )}
                
                {/* HEALTH INSURANCE FIELDS */}
                {selectedPolicy.insurance_type?.toLowerCase().includes('health') && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Hospital Name</label>
                            <Input placeholder="Enter hospital name" value={formData.hospital_name} onChange={(e) => handleChange("hospital_name", e.target.value)} required className={fieldClasses} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Treatment Duration (Days)</label>
                            <Input type="number" placeholder="Enter number of days" min="1" value={formData.claim_duration_days || ''} onChange={(e) => handleChange("claim_duration_days", parseInt(e.target.value) || 0)} required className={fieldClasses} />
                        </div>
                         <div className="md:col-span-2">
                           <label className="block text-sm font-medium text-slate-300 mb-2">Treatment Details</label>
                            <Textarea placeholder="Describe the treatment received..." rows={3} value={formData.treatment_details} onChange={(e) => handleChange("treatment_details", e.target.value)} required className={fieldClasses}/>
                        </div>
                    </div>
                )}
                
                {/* LIFE INSURANCE FIELDS */}
                {selectedPolicy.insurance_type?.toLowerCase().includes('life') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Nominee Relationship</label>
                            <Select value={formData.nominee_relationship} onValueChange={(val) => handleChange("nominee_relationship", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select relationship" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Spouse">Spouse</SelectItem>
                                    <SelectItem value="Child">Child</SelectItem>
                                    <SelectItem value="Parent">Parent</SelectItem>
                                    <SelectItem value="Sibling">Sibling</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Claim Reason</label>
                            <Select value={formData.claim_type} onValueChange={(val) => handleChange("claim_type", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select reason" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Death">Death</SelectItem>
                                    <SelectItem value="Maturity">Maturity</SelectItem>
                                    <SelectItem value="Surrender">Surrender</SelectItem>
                                    <SelectItem value="Accidental Death">Accidental Death</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Additional Details</label>
                            <Textarea placeholder="Provide any additional information about the claim..." rows={3} value={formData.incident_description} onChange={(e) => handleChange("incident_description", e.target.value)} className={fieldClasses} />
                        </div>
                    </div>
                )}

                {/* PROPERTY INSURANCE FIELDS */}
                {selectedPolicy.insurance_type?.toLowerCase().includes('property') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Property Type</label>
                            <Select value={formData.property_type} onValueChange={(val) => handleChange("property_type", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select property type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Residential">Residential</SelectItem>
                                    <SelectItem value="Commercial">Commercial</SelectItem>
                                    <SelectItem value="Industrial">Industrial</SelectItem>
                                    <SelectItem value="Agricultural">Agricultural</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Damage Type</label>
                            <Select value={formData.claim_type} onValueChange={(val) => handleChange("claim_type", val)}>
                                <SelectTrigger className={fieldClasses}><SelectValue placeholder="Select damage type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Fire">Fire</SelectItem>
                                    <SelectItem value="Theft">Theft</SelectItem>
                                    <SelectItem value="Natural Disaster">Natural Disaster</SelectItem>
                                    <SelectItem value="Water Damage">Water Damage</SelectItem>
                                    <SelectItem value="Vandalism">Vandalism</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Property Address</label>
                            <Textarea placeholder="Enter the full address of the insured property..." rows={2} value={formData.accident_location} onChange={(e) => handleChange("accident_location", e.target.value)} required className={fieldClasses} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Damage Description</label>
                            <Textarea placeholder="Describe the damage in detail..." rows={3} value={formData.incident_description} onChange={(e) => handleChange("incident_description", e.target.value)} required className={fieldClasses} />
                        </div>
                    </div>
                )}
            </motion.div>
        );
      
      case 4: // Document Upload
        return (
            <motion.div key="step4" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4 }} className="space-y-6">
                <h2 className="text-lg font-semibold text-center mb-6">Supporting Documents</h2>
                
                {/* Incident Photos */}
                <div>
                    <label className="flex items-center text-sm font-medium text-slate-300 mb-2">
                        <Upload className="w-4 h-4 mr-2" />
                        Incident Photos (Required)
                    </label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-blue-500 hover:bg-slate-800/50 transition-all duration-300">
                        <input id="file-upload-photos" type="file" accept="image/*" multiple onChange={(e) => handleFileChange(e, 'photos')} className="hidden" />
                        <Button type="button" onClick={() => document.getElementById('file-upload-photos')?.click()}>
                            <Paperclip className="w-4 h-4 mr-2"/> Select Photos
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">Upload image files (max 5MB each)</p>
                    </div>
                    <div className="mt-4 space-y-2">
                        {formData.incident_photos.map(file => (
                            <motion.div key={file.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                                <img src={file.previewUrl} alt={file.name} className="w-10 h-10 rounded object-cover mr-3" />
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                                </div>
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeFile(file.id, 'photos')} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></Button>
                            </motion.div>
                        ))}
                    </div>
                </div>
                
                {/* Supporting Documents */}
                <div>
                    <label className="flex items-center text-sm font-medium text-slate-300 mb-2">
                        <Upload className="w-4 h-4 mr-2" />
                        Other Supporting Documents
                    </label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-blue-500 hover:bg-slate-800/50 transition-all duration-300">
                        <input id="file-upload-documents" type="file" accept="image/*,.pdf" multiple onChange={(e) => handleFileChange(e, 'documents')} className="hidden" />
                        <Button type="button" onClick={() => document.getElementById('file-upload-documents')?.click()}>
                            <Paperclip className="w-4 h-4 mr-2"/> Select Documents
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">Upload images or PDF files (max 10MB each)</p>
                    </div>
                    <div className="mt-4 space-y-2">
                        {formData.supporting_documents.map(file => (
                            <motion.div key={file.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                                {file.type.startsWith('image/') ? (
                                    <img src={file.previewUrl} alt={file.name} className="w-10 h-10 rounded object-cover mr-3" />
                                ) : (
                                    <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center mr-3"><FileText className="w-5 h-5 text-slate-400"/></div>
                                )}
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                                </div>
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeFile(file.id, 'documents')} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></Button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>
        );

      case 5: // Confirmation
        return (
            <motion.div key="step5" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.4 }} className="space-y-4">
                <h2 className="text-lg font-semibold text-center mb-6">Review Your Claim Details</h2>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-700">
                    <h3 className="font-semibold text-white">Policy Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
                        <p><strong>Policy:</strong> {selectedPolicy.policyName}</p>
                        <p><strong>Type:</strong> {selectedPolicy.insurance_type}</p>
                        <p><strong>Coverage:</strong> {formatCurrency(selectedPolicy.sum_insured)}</p>
                        <p><strong>Premium:</strong> {formatCurrency(selectedPolicy.policy_annual_premium)}</p>
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-700">
                    <h3 className="font-semibold text-white">Incident Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
                        <p><strong>Date:</strong> {formData.incident_date}</p>
                        <p><strong>Time:</strong> {formData.incident_time}</p>
                        <p><strong>Type:</strong> {formData.claim_type === "other" ? formData.custom_claim_type : formData.claim_type}</p>
                        <p><strong>Amount:</strong> {formatCurrency(formData.claim_amount)}</p>
                    </div>
                </div>
                {(formData.incident_photos.length > 0 || formData.supporting_documents.length > 0) && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <h3 className="font-semibold text-white mb-2">Uploaded Files</h3>
                        <p className="text-slate-300 text-sm">{formData.incident_photos.length} incident photo(s) and {formData.supporting_documents.length} supporting document(s).</p>
                    </div>
                )}
            </motion.div>
        );

      case 6: // Success
        return (
            <motion.div key="step6" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center space-y-4 py-8">
                <CheckCircle2 className="text-green-500 w-16 h-16 mx-auto" />
                <h2 className="text-xl font-bold">Claim Submitted!</h2>
                <p className="text-slate-400">Your claim has been filed successfully. We will review it and get back to you shortly.</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">File Another Claim</Button>
                  <Button onClick={() => window.location.href = '/dashboard/claims'} variant="outline" className="border-slate-600">View My Claims</Button>
                </div>
            </motion.div>
        );
      
      default: return null;
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-4 sm:p-6">
      <Card className="w-full max-w-2xl bg-slate-900/80 border border-slate-700 shadow-2xl rounded-2xl">
        <CardContent className="p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-2xl font-bold mb-4 text-center">File a New Insurance Claim</h1>

            {step <= totalSteps && step > 0 && (
              <div className="mb-6">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-slate-400 mt-2">Step {step} of {totalSteps}</p>
              </div>
            )}
            
            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span>{error}</span>
                </motion.div>
            )}

            <AnimatePresence mode="wait">
              {renderCurrentStep()}
            </AnimatePresence>

            {/* Navigation Buttons */}
            {step < 6 && hasActivePolicies && (
              <div className="mt-8 flex justify-between items-center">
                <Button
                  onClick={prevStep}
                  disabled={step === 1}
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>

                {step < totalSteps ? (
                  <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700">
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <>Submit Claim <CheckCircle2 className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}