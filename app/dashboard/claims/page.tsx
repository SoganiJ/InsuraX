"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  ArrowLeft,
  Download
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useData } from "@/context/DataContext";

export default function ClaimsManagementPage() {
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isClearing, setIsClearing] = useState(false);
  const { claims, loadingClaims, user } = useData();
  
  // Load images from localStorage when claim is selected
  const [claimImages, setClaimImages] = useState<{
    incident_photos: any[];
    supporting_documents: any[];
  }>({ incident_photos: [], supporting_documents: [] });

  useEffect(() => {
    if (selectedClaim?.claimId) {
      // Try to load images from localStorage
      try {
        const storedImages = localStorage.getItem(`claim_images_${selectedClaim.claimId}`);
        if (storedImages) {
          const parsedImages = JSON.parse(storedImages);
          setClaimImages(parsedImages);
          console.log('📸 Loaded claim images from localStorage:', selectedClaim.claimId);
        } else {
          // Fallback to claim data if available
          setClaimImages({
            incident_photos: selectedClaim.incident_photos || [],
            supporting_documents: selectedClaim.supporting_documents || []
          });
        }
      } catch (error) {
        console.error('Error loading claim images:', error);
        setClaimImages({ incident_photos: [], supporting_documents: [] });
      }
    } else {
      setClaimImages({ incident_photos: [], supporting_documents: [] });
    }
  }, [selectedClaim?.claimId]);

  // Download Base64 image as file
  const downloadImage = (base64Data: string, fileName: string, mimeType: string) => {
    // Create a blob from the base64 data
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const clearAllClaims = async () => {
    if (!user) return;
    
    setIsClearing(true);
    try {
      // Import Firebase functions
      const { collection, query, where, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/firebase/config');
      
      // Get all claims for this user
      const q = query(collection(db, 'claims'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      // Delete all claims
      const deletePromises = querySnapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'claims', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      
      // Refresh the page to show updated state
      window.location.reload();
      
    } catch (error) {
      console.error('Error clearing claims:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted': return 'bg-blue-500';
      case 'under review': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'processing': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted': return <Clock className="w-4 h-4" />;
      case 'under review': return <AlertCircle className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loadingClaims) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Claims Management</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-400">Loading claims...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Claims Management</h1>
              <p className="text-slate-400">Track, manage, and communicate about your insurance claims</p>
            </div>
            {claims.length > 0 && (
              <Button
                onClick={clearAllClaims}
                disabled={isClearing}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              >
                {isClearing ? 'Clearing...' : 'Clear All Claims'}
              </Button>
            )}
          </div>
        </motion.div>

        {claims.length === 0 ? (
          /* No Claims State */
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Claims Yet</h3>
              <p className="text-gray-400 mb-6">You haven't filed any insurance claims yet.</p>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/dashboard/claim'}
              >
                File Your First Claim
              </Button>
            </CardContent>
          </Card>
        ) : !selectedClaim ? (
          /* Claims List */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {claims.map((claim) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => setSelectedClaim(claim)}
              >
                <Card className="bg-gray-800 border-gray-700 hover:border-blue-500 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white text-lg">{claim.policyName}</CardTitle>
                        <p className="text-gray-400 text-sm">#{claim.claimId}</p>
                      </div>
                      <Badge className={`${getStatusColor(claim.status)} text-white`}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(claim.status)}
                          {claim.status}
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <DollarSign className="w-4 h-4" />
                      <span>Claim Amount: {formatCurrency(claim.claimAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Calendar className="w-4 h-4" />
                      <span>Filed: {claim.submittedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <FileText className="w-4 h-4" />
                      <span>Type: {claim.claimType}</span>
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2">{claim.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Claim Details */
          <div className="space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => setSelectedClaim(null)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Claims
            </Button>

            {/* Claim Header */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-white">{selectedClaim.policyName}</CardTitle>
                    <p className="text-gray-400">Claim ID: {selectedClaim.claimId}</p>
                  </div>
                  <Badge className={`${getStatusColor(selectedClaim.status)} text-white text-lg px-3 py-1`}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedClaim.status)}
                      {selectedClaim.status}
                    </div>
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Claim Details */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Claim Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Claim Type</p>
                      <p className="text-white">{selectedClaim.claimType}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Claim Amount</p>
                      <p className="text-white">{formatCurrency(selectedClaim.claimAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Incident Date</p>
                      <p className="text-white">{selectedClaim.incidentDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Incident Time</p>
                      <p className="text-white">{selectedClaim.incident_time || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Submitted Date</p>
                      <p className="text-white">{selectedClaim.submittedDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Policy ID</p>
                      <p className="text-white">{selectedClaim.policyId}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Description</p>
                    <p className="text-white">{selectedClaim.description}</p>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Policy Information */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Policy Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Policy Name</p>
                    <p className="text-white">{selectedClaim.policyName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Insurance Type</p>
                    <p className="text-white capitalize">{selectedClaim.insurance_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Policy Term</p>
                    <p className="text-white">{selectedClaim.policy_term}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Annual Premium</p>
                    <p className="text-white">{formatCurrency(selectedClaim.policy_annual_premium)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Sum Insured</p>
                    <p className="text-white">{formatCurrency(selectedClaim.sum_insured)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Renewal Status</p>
                    <p className="text-white">{selectedClaim.policy_renewal_status}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Previous Claims</p>
                    <p className="text-white">{selectedClaim.previous_claims_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Payment Delays</p>
                    <p className="text-white">{selectedClaim.premium_payment_delays}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Coverage Changes</p>
                    <p className="text-white">{selectedClaim.coverage_changes_before_claim}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Age</p>
                    <p className="text-white">{selectedClaim.insured_age} years</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Gender</p>
                    <p className="text-white">{selectedClaim.insured_sex === 'M' ? 'Male' : 'Female'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Occupation</p>
                    <p className="text-white">{selectedClaim.insured_occupation}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Location</p>
                    <p className="text-white">{selectedClaim.policy_city}, {selectedClaim.policy_state}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance-Specific Details */}
            {selectedClaim.insurance_type === 'automobile' && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Vehicle Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Vehicle Make</p>
                      <p className="text-white">{selectedClaim.auto_make || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Vehicle Model</p>
                      <p className="text-white">{selectedClaim.auto_model || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Vehicle Year</p>
                      <p className="text-white">{selectedClaim.auto_year || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Third Party Involved</p>
                      <p className="text-white">{selectedClaim.third_party_involved || 'Not specified'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-400 text-sm">Accident Location</p>
                      <p className="text-white">{selectedClaim.accident_location || 'Not specified'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedClaim.insurance_type === 'health' && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Health Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Hospital Name</p>
                      <p className="text-white">{selectedClaim.hospital_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Treatment Duration</p>
                      <p className="text-white">{selectedClaim.claim_duration_days || 0} days</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-400 text-sm">Treatment Details</p>
                      <p className="text-white">{selectedClaim.treatment_details || 'Not specified'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedClaim.insurance_type === 'life' && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Life Insurance Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="text-gray-400 text-sm">Nominee Relationship</p>
                    <p className="text-white">{selectedClaim.nominee_relationship || 'Not specified'}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedClaim.insurance_type === 'property' && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Property Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="text-gray-400 text-sm">Property Type</p>
                    <p className="text-white">{selectedClaim.property_type || 'Not specified'}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedClaim.insurance_type === 'crop' && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Crop Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Crop Type</p>
                      <p className="text-white">{selectedClaim.crop_type || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Weather Condition</p>
                      <p className="text-white">{selectedClaim.weather_condition || 'Not specified'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ML Analysis Features */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Risk Analysis Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Claim to Coverage Ratio</p>
                    <p className="text-white">{selectedClaim.claim_amount_to_sum_insured_ratio ? (selectedClaim.claim_amount_to_sum_insured_ratio * 100).toFixed(2) + '%' : 'Not calculated'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Policy Age at Incident</p>
                    <p className="text-white">{selectedClaim.policy_age_at_incident_days || 0} days</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Filing Delay</p>
                    <p className="text-white">{selectedClaim.claim_filing_delay_days || 0} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            {(claimImages.incident_photos?.length > 0 || claimImages.supporting_documents?.length > 0) && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Uploaded Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {claimImages.incident_photos?.length > 0 && (
                      <div>
                        <h4 className="text-gray-300 font-medium mb-2">Incident Photos ({claimImages.incident_photos.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {claimImages.incident_photos.map((photo: any, index: number) => (
                            <div key={index} className="bg-gray-700 p-3 rounded-lg">
                              <img 
                                src={`data:${photo.type};base64,${photo.base64}`}
                                alt={photo.name}
                                className="w-full h-32 object-cover rounded mb-2"
                              />
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium truncate">{photo.name}</p>
                                  <p className="text-gray-400 text-xs">{(photo.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadImage(photo.base64, photo.name, photo.type)}
                                  className="ml-2 h-8 w-8 p-0 border-gray-600 hover:bg-gray-600"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {claimImages.supporting_documents?.length > 0 && (
                      <div>
                        <h4 className="text-gray-300 font-medium mb-2">Supporting Documents ({claimImages.supporting_documents.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {claimImages.supporting_documents.map((doc: any, index: number) => (
                            <div key={index} className="bg-gray-700 p-3 rounded-lg">
                              <img 
                                src={`data:${doc.type};base64,${doc.base64}`}
                                alt={doc.name}
                                className="w-full h-32 object-cover rounded mb-2"
                              />
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                                  <p className="text-gray-400 text-xs">{(doc.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadImage(doc.base64, doc.name, doc.type)}
                                  className="ml-2 h-8 w-8 p-0 border-gray-600 hover:bg-gray-600"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {selectedClaim.timeline && selectedClaim.timeline.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Claim Timeline</CardTitle>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-400 text-sm">System Update</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-400 text-sm">Admin Action</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedClaim.timeline.map((event: any, index: number) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            event.adminAction ? 'bg-orange-500' : 'bg-blue-500'
                          }`}></div>
                          {index < selectedClaim.timeline.length - 1 && (
                            <div className="w-px h-8 bg-gray-600 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white font-medium">{event.status}</p>
                              <p className="text-gray-400 text-sm">{event.description}</p>
                              {event.adminComment && (
                                <div className="mt-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                                  <p className="text-blue-300 text-sm font-medium mb-1">Admin Comment:</p>
                                  <p className="text-blue-200 text-sm">{event.adminComment}</p>
                                </div>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm">{event.date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}
      </div>
    </div>
  );
}