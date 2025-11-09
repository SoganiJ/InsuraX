"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { User, Save, Edit3, MapPin, Briefcase, Calendar, Mail } from "lucide-react";
import { auth, db } from "@/firebase/config";
import { onAuthStateChanged, User as FirebaseUser, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";

export default function ProfilePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { user: contextUser, userData: contextUserData, refreshUserData, loading: contextLoading } = useData();
  
  // States and cities data
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic info
    displayName: "",
    email: "",
    
    // ML model fields
    insured_sex: "",
    insured_age: "",
    insured_occupation: "",
    policy_state: "",
    policy_city: "",
    
    // Additional profile info
    phone: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
  });

  // Fallback data for Indian states and cities
  const fallbackStatesAndCities = {
    "Andhra Pradesh": ["Hyderabad", "Visakhapatnam", "Vijayawada", "Guntur", "Nellore"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tezpur", "Dibrugarh"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon"],
    "Delhi": ["New Delhi", "Central Delhi", "North Delhi", "South Delhi", "East Delhi"],
    "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
    "Haryana": ["Chandigarh", "Faridabad", "Gurgaon", "Panipat", "Ambala"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Manali", "Solan", "Mandi"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar"],
    "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
    "Manipur": ["Imphal", "Thoubal", "Bishnupur", "Churachandpur", "Ukhrul"],
    "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongstoin", "Williamnagar"],
    "Mizoram": ["Aizawl", "Lunglei", "Saiha", "Champhai", "Kolasib"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur"],
    "Punjab": ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Patiala"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
    "Sikkim": ["Gangtok", "Namchi", "Mangan", "Gyalshing", "Singtam"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar"],
    "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Ambassa", "Kailashahar"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Rishikesh", "Nainital", "Mussoorie"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri"]
  };

  // Fetch Indian states and cities data (optimized to use local data directly)
  const fetchStatesAndCities = async () => {
    setLoadingLocations(true);
    // Use local data directly instead of making external API call
    const fallbackStates = Object.keys(fallbackStatesAndCities).sort();
    setStates(fallbackStates);
    
    // If user has a selected state, load its cities from fallback
    if (formData.policy_state && fallbackStatesAndCities[formData.policy_state as keyof typeof fallbackStatesAndCities]) {
      setCities(fallbackStatesAndCities[formData.policy_state as keyof typeof fallbackStatesAndCities].sort());
    }
    setLoadingLocations(false);
  };

  // Load cities for a specific state (optimized to use local data)
  const loadCitiesForState = (stateName: string) => {
    // Use local data directly
    if (fallbackStatesAndCities[stateName as keyof typeof fallbackStatesAndCities]) {
      setCities(fallbackStatesAndCities[stateName as keyof typeof fallbackStatesAndCities].sort());
    } else {
      setCities([]);
    }
  };

  // Handle state change
  const handleStateChange = (selectedState: string) => {
    setFormData(prev => ({ ...prev, policy_state: selectedState, policy_city: "" }));
    loadCitiesForState(selectedState);
  };

  // Fetch states and cities on component mount
  useEffect(() => {
    fetchStatesAndCities();
  }, []);

  // Use DataContext data instead of loading separately
  useEffect(() => {
    console.log("Profile page useEffect triggered");
    console.log("contextLoading:", contextLoading);
    console.log("contextUser:", contextUser);
    console.log("contextUserData:", contextUserData);
    
    // Don't proceed if DataContext is still loading
    if (contextLoading) {
      console.log("DataContext still loading, waiting...");
      return;
    }
    
    if (contextUser && contextUserData) {
      setUser(contextUser);
      setUserData(contextUserData);
      
      // Populate form with existing data
      const formDataToSet = {
        displayName: contextUser.displayName || "",
        email: contextUser.email || "",
        insured_sex: contextUserData.insured_sex || "",
        insured_age: contextUserData.insured_age?.toString() || "",
        insured_occupation: contextUserData.insured_occupation || "",
        policy_state: contextUserData.policy_state || "",
        policy_city: contextUserData.policy_city || "",
        phone: contextUserData.phone || "",
        address: contextUserData.address || "",
        emergency_contact: contextUserData.emergency_contact || "",
        emergency_phone: contextUserData.emergency_phone || "",
      };
      
      console.log("Setting form data:", formDataToSet);
      setFormData(formDataToSet);
      
      // Load cities for the selected state if it exists
      if (contextUserData.policy_state) {
        loadCitiesForState(contextUserData.policy_state);
      }
      
      setLoading(false);
    } else if (contextUser && !contextUserData) {
      // User exists but no userData yet
      setUser(contextUser);
      const formDataToSet = {
        displayName: contextUser.displayName || "",
        email: contextUser.email || "",
        insured_sex: "",
        insured_age: "",
        insured_occupation: "",
        policy_state: "",
        policy_city: "",
        phone: "",
        address: "",
        emergency_contact: "",
        emergency_phone: "",
      };
      console.log("Setting form data (no userData):", formDataToSet);
      setFormData(formDataToSet);
      setLoading(false);
    } else if (!contextUser) {
      // No user authenticated
      console.log("No user authenticated");
      setLoading(false);
    }
  }, [contextUser, contextUserData, contextLoading]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) {
      console.error("No user found");
      toast.error("No user found");
      return;
    }
    
    if (!formData.displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    console.log("Saving profile with data:", formData);
    console.log("Current user:", user.uid);
    console.log("Current userData:", userData);
    console.log("User email:", user.email);
    console.log("User displayName:", user.displayName);
    
    setSaving(true);
    try {
      // Update Firebase Auth profile
      console.log("Updating Firebase Auth profile...");
      await updateProfile(user, {
        displayName: formData.displayName,
      });
      console.log("Firebase Auth profile updated successfully");

      // Update Firestore user document
      console.log("Updating Firestore document...");
      const userDocRef = doc(db, 'users', user.uid);
      const updateData = {
        ...userData,
        displayName: formData.displayName,
        insured_sex: formData.insured_sex,
        insured_age: formData.insured_age ? parseInt(formData.insured_age) : null,
        insured_occupation: formData.insured_occupation,
        policy_state: formData.policy_state,
        policy_city: formData.policy_city,
        phone: formData.phone,
        address: formData.address,
        emergency_contact: formData.emergency_contact,
        emergency_phone: formData.emergency_phone,
        updatedAt: new Date(),
      };
      
      console.log("Update data:", updateData);
      await setDoc(userDocRef, updateData, { merge: true });
      console.log("Firestore document updated successfully");
      
      // Verify the data was saved by reading it back
      console.log("Verifying saved data...");
      const verifyDoc = await getDoc(userDocRef);
      if (verifyDoc.exists()) {
        console.log("Verified saved data:", verifyDoc.data());
      } else {
        console.log("ERROR: Document not found after saving!");
      }

      // Update local state
      console.log("Updating local state...");
      setUserData((prev: any) => ({
        ...prev,
        displayName: formData.displayName,
        insured_sex: formData.insured_sex,
        insured_age: formData.insured_age ? parseInt(formData.insured_age) : null,
        insured_occupation: formData.insured_occupation,
        policy_state: formData.policy_state,
        policy_city: formData.policy_city,
        phone: formData.phone,
        address: formData.address,
        emergency_contact: formData.emergency_contact,
        emergency_phone: formData.emergency_phone,
      }));

      // Refresh DataContext to update dashboard and other components
      console.log("Refreshing DataContext...");
      await refreshUserData();

      setIsEditing(false);
      toast.success("Profile updated successfully!");
      console.log("Profile saved successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      console.error("Error details:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      toast.error(`Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original data from context
    setFormData({
      displayName: contextUser?.displayName || "",
      email: contextUser?.email || "",
      insured_sex: contextUserData?.insured_sex || "",
      insured_age: contextUserData?.insured_age?.toString() || "",
      insured_occupation: contextUserData?.insured_occupation || "",
      policy_state: contextUserData?.policy_state || "",
      policy_city: contextUserData?.policy_city || "",
      phone: contextUserData?.phone || "",
      address: contextUserData?.address || "",
      emergency_contact: contextUserData?.emergency_contact || "",
      emergency_phone: contextUserData?.emergency_phone || "",
    });
    setIsEditing(false);
  };

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!contextUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Please log in to view your profile.</div>
      </div>
    );
  }

  const fieldClasses = "bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
              <p className="text-slate-400">Manage your personal information and preferences</p>
            </div>
            <div className="flex gap-3">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      console.log("Save button clicked");
                      handleSave();
                    }}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {user?.displayName || "User"}
                    </h3>
                    <p className="text-slate-400 text-sm">{user?.email}</p>
                    <span className="inline-block bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full mt-1">
                      {userData?.role || 'User'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4" />
                    <span>Joined: {user?.metadata?.creationTime ? new Date(user?.metadata.creationTime).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-4 h-4" />
                    <span>Email verified: {user?.emailVerified ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Profile Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="displayName" className="text-slate-300">Full Name</Label>
                      <Input
                        id="displayName"
                        value={formData.displayName}
                        onChange={(e) => handleInputChange("displayName", e.target.value)}
                        disabled={!isEditing}
                        className={fieldClasses}
                        placeholder="Enter your full name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email" className="text-slate-300">Email</Label>
                      <Input
                        id="email"
                        value={formData.email}
                        disabled
                        className="bg-slate-700 border-slate-600 text-slate-400"
                        placeholder="Email cannot be changed"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        disabled={!isEditing}
                        className={fieldClasses}
                        placeholder="Enter your phone number"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="insured_sex" className="text-slate-300">Gender</Label>
                      <Select
                        value={formData.insured_sex}
                        onValueChange={(value) => handleInputChange("insured_sex", value)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className={fieldClasses}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="insured_age" className="text-slate-300">Age</Label>
                      <Input
                        id="insured_age"
                        type="number"
                        value={formData.insured_age}
                        onChange={(e) => handleInputChange("insured_age", e.target.value)}
                        disabled={!isEditing}
                        className={fieldClasses}
                        placeholder="Enter your age"
                        min="18"
                        max="100"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="insured_occupation" className="text-slate-300">Occupation</Label>
                      <Select
                        value={formData.insured_occupation}
                        onValueChange={(value) => handleInputChange("insured_occupation", value)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className={fieldClasses}>
                          <SelectValue placeholder="Select occupation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Engineer">Engineer</SelectItem>
                          <SelectItem value="Doctor">Doctor</SelectItem>
                          <SelectItem value="Teacher">Teacher</SelectItem>
                          <SelectItem value="Business Owner">Business Owner</SelectItem>
                          <SelectItem value="Salesperson">Salesperson</SelectItem>
                          <SelectItem value="Student">Student</SelectItem>
                          <SelectItem value="Government Employee">Government Employee</SelectItem>
                          <SelectItem value="Freelancer">Freelancer</SelectItem>
                          <SelectItem value="Retired">Retired</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Location Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Location Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="policy_state" className="text-slate-300">State</Label>
                      <Select
                        value={formData.policy_state}
                        onValueChange={(value) => handleStateChange(value)}
                        disabled={!isEditing || loadingLocations}
                      >
                        <SelectTrigger className={fieldClasses}>
                          <SelectValue placeholder={loadingLocations ? "Loading states..." : "Select state"} />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="policy_city" className="text-slate-300">City</Label>
                      <Select
                        value={formData.policy_city}
                        onValueChange={(value) => handleInputChange("policy_city", value)}
                        disabled={!isEditing || !formData.policy_state || cities.length === 0}
                      >
                        <SelectTrigger className={fieldClasses}>
                          <SelectValue placeholder={
                            !formData.policy_state 
                              ? "Select state first" 
                              : cities.length === 0 
                                ? "No cities available" 
                                : "Select city"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="address" className="text-slate-300">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      disabled={!isEditing}
                      className={fieldClasses}
                      placeholder="Enter your full address"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
                    Emergency Contact
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact" className="text-slate-300">Emergency Contact Name</Label>
                      <Input
                        id="emergency_contact"
                        value={formData.emergency_contact}
                        onChange={(e) => handleInputChange("emergency_contact", e.target.value)}
                        disabled={!isEditing}
                        className={fieldClasses}
                        placeholder="Enter emergency contact name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="emergency_phone" className="text-slate-300">Emergency Contact Phone</Label>
                      <Input
                        id="emergency_phone"
                        value={formData.emergency_phone}
                        onChange={(e) => handleInputChange("emergency_phone", e.target.value)}
                        disabled={!isEditing}
                        className={fieldClasses}
                        placeholder="Enter emergency contact phone"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
