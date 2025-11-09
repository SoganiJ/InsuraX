// Dynamic Policy Generation Utility
// Creates realistic, varied policies for each user

interface UserProfile {
  displayName?: string;
  insured_sex?: string;
  insured_age?: number;
  insured_occupation?: string;
  policy_state?: string;
  policy_city?: string;
}

interface Policy {
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

// Base premiums by insurance type (in INR)
const basePremiums = {
  automobile: { min: 15000, max: 35000 },
  health: { min: 20000, max: 50000 },
  life: { min: 10000, max: 30000 },
  property: { min: 8000, max: 25000 },
  crop: { min: 5000, max: 15000 }
};

// Coverage multipliers (how many times the premium)
const coverageMultipliers = {
  automobile: { min: 30, max: 50 },
  health: { min: 20, max: 40 },
  life: { min: 50, max: 100 },
  property: { min: 20, max:50 },
  crop: { min: 10, max: 30 }
};

// Policy name templates
const policyNames = {
  automobile: [
    "Comprehensive Auto Insurance",
    "Premium Car Protection",
    "Complete Vehicle Coverage",
    "Advanced Auto Shield",
    "Ultimate Car Insurance"
  ],
  health: [
    "Family Health Protection",
    "Comprehensive Health Plan",
    "Premium Medical Coverage",
    "Complete Health Shield",
    "Advanced Health Insurance"
  ],
  life: [
    "Term Life Insurance",
    "Premium Life Protection",
    "Complete Life Coverage",
    "Advanced Life Plan",
    "Ultimate Life Insurance"
  ],
  property: [
    "Home Protection Insurance",
    "Premium Property Coverage",
    "Complete Home Shield",
    "Advanced Property Plan",
    "Ultimate Home Insurance"
  ],
  crop: [
    "Crop Protection Plan",
    "Premium Agriculture Coverage",
    "Complete Farm Shield",
    "Advanced Crop Insurance",
    "Ultimate Farm Protection"
  ]
};

// Calculate premium based on user demographics and risk factors
const calculatePremium = (insuranceType: keyof typeof basePremiums, userData: UserProfile): number => {
  let basePremium = basePremiums[insuranceType].min + 
    Math.random() * (basePremiums[insuranceType].max - basePremiums[insuranceType].min);
  
  // Age factor
  const age = userData.insured_age || 25;
  if (age < 25) basePremium *= 1.3; // Young drivers/people pay more
  if (age > 60) basePremium *= 1.2; // Senior citizens pay more
  if (age >= 25 && age <= 35) basePremium *= 0.9; // Prime age gets discount
  
  // Location factor
  const city = userData.policy_city || '';
  const state = userData.policy_state || '';
  
  // High-risk cities
  if (['Mumbai', 'Delhi', 'Bangalore', 'Chennai'].includes(city)) {
    basePremium *= 1.2;
  }
  // Medium-risk cities
  else if (['Pune', 'Hyderabad', 'Kolkata', 'Ahmedabad'].includes(city)) {
    basePremium *= 1.1;
  }
  // Low-risk cities get discount
  else if (['Goa', 'Kochi', 'Chandigarh'].includes(city)) {
    basePremium *= 0.9;
  }
  
  // Occupation factor
  const occupation = userData.insured_occupation || '';
  if (occupation === 'Student') basePremium *= 0.8;
  if (['Doctor', 'Engineer', 'Teacher', 'Government Employee'].includes(occupation)) {
    basePremium *= 0.9;
  }
  if (['Driver', 'Construction Worker', 'Pilot'].includes(occupation)) {
    basePremium *= 1.2;
  }
  
  // Gender factor (for automobile insurance)
  if (insuranceType === 'automobile' && userData.insured_sex === 'F') {
    basePremium *= 0.9; // Female drivers typically pay less
  }
  
  return Math.round(basePremium);
};

// Calculate sum insured based on premium and insurance type
const calculateSumInsured = (premium: number, insuranceType: keyof typeof coverageMultipliers): number => {
  const multiplier = coverageMultipliers[insuranceType].min + 
    Math.random() * (coverageMultipliers[insuranceType].max - coverageMultipliers[insuranceType].min);
  
  return Math.round(premium * multiplier);
};

// Generate unique policy ID
const generatePolicyId = (insuranceType: string, userId: string): string => {
  const prefixes = {
    automobile: 'AUTO',
    health: 'HEALTH',
    life: 'LIFE',
    property: 'PROP',
    crop: 'CROP'
  };
  
  const prefix = prefixes[insuranceType as keyof typeof prefixes] || 'POL';
  const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  const userSuffix = userId.slice(-3).toUpperCase();
  
  return `${prefix}${randomNum}${userSuffix}`;
};

// Generate realistic policy dates
const generatePolicyDates = (): { start: string; end: string; nextDue: string } => {
  const startDate = new Date();
  // Random start date within the last 6 months
  startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 180));
  
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1); // 1 year term
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    nextDue: endDate.toISOString().split('T')[0]
  };
};

// Generate varied history data
const generateHistory = (userData: UserProfile) => {
  const hasPreviousClaims = Math.random() < 0.3; // 30% chance
  const hasPaymentDelays = Math.random() < 0.2;  // 20% chance
  const hasCoverageChanges = Math.random() < 0.15; // 15% chance
  
  const paymentDelayOptions = ['None', '1-2 delays', '3-5 delays', 'Multiple delays'];
  const coverageChangeOptions = ['No Change', 'Increased coverage', 'Decreased coverage', 'Modified terms'];
  
  return {
    previousClaims: hasPreviousClaims ? Math.floor(Math.random() * 3) + 1 : 0,
    paymentDelays: hasPaymentDelays ? 
      paymentDelayOptions[Math.floor(Math.random() * (paymentDelayOptions.length - 1)) + 1] : 
      'None',
    coverageChanges: hasCoverageChanges ? 
      coverageChangeOptions[Math.floor(Math.random() * (coverageChangeOptions.length - 1)) + 1] : 
      'No Change'
  };
};

// Generate policy term based on insurance type
const generatePolicyTerm = (insuranceType: string): string => {
  if (insuranceType === 'life') {
    const terms = ['10 years', '15 years', '20 years', '25 years', '30 years'];
    return terms[Math.floor(Math.random() * terms.length)];
  }
  return '1 year';
};

// Generate consistent policy status
const generatePolicyStatus = (): { status: string; renewalStatus: string } => {
  const statusOptions = [
    { status: 'Active', renewalStatus: 'Active' },
    { status: 'Active', renewalStatus: 'Renewed' },
    { status: 'Pending Renewal', renewalStatus: 'Pending Renewal' }
  ];
  
  // 80% chance for Active policies, 20% chance for Pending Renewal
  const random = Math.random();
  if (random < 0.8) {
    // Active policy - randomly choose between Active or Renewed
    return statusOptions[Math.floor(Math.random() * 2)];
  } else {
    // Pending Renewal policy
    return statusOptions[2];
  }
};

// Main function to create a dynamic policy
export const createDynamicPolicy = (
  insuranceType: keyof typeof basePremiums, 
  userData: UserProfile, 
  userId: string
): Omit<Policy, 'id'> => {
  const premium = calculatePremium(insuranceType, userData);
  const sumInsured = calculateSumInsured(premium, insuranceType);
  const policyId = generatePolicyId(insuranceType, userId);
  const dates = generatePolicyDates();
  const history = generateHistory(userData);
  const policyTerm = generatePolicyTerm(insuranceType);
  const policyStatus = generatePolicyStatus();
  
  // Select random policy name
  const nameOptions = policyNames[insuranceType];
  const policyName = nameOptions[Math.floor(Math.random() * nameOptions.length)];
  
  return {
    policyId,
    policyName,
    insurance_type: insuranceType,
    policy_term: policyTerm,
    policy_start_date: dates.start,
    policy_end_date: dates.end,
    policy_annual_premium: premium,
    sum_insured: sumInsured,
    policy_renewal_status: policyStatus.renewalStatus,
    premium_payment_delays: history.paymentDelays,
    coverage_changes_before_claim: history.coverageChanges,
    insured_sex: userData.insured_sex || 'M',
    insured_age: userData.insured_age || 25,
    insured_occupation: userData.insured_occupation || 'Professional',
    policy_state: userData.policy_state || 'Maharashtra',
    policy_city: userData.policy_city || 'Mumbai',
    previous_claims_count: history.previousClaims,
    status: policyStatus.status,
    holderName: userData.displayName || 'User',
    nextDueDate: dates.nextDue,
    userId: userId
  };
};

// Generate all 4 standard policies for a user
export const generateAllPolicies = (userData: UserProfile, userId: string): Omit<Policy, 'id'>[] => {
  const insuranceTypes: (keyof typeof basePremiums)[] = ['automobile', 'health', 'life', 'property'];
  
  return insuranceTypes.map(type => createDynamicPolicy(type, userData, userId));
};
