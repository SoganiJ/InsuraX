'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, where, getDocs } from 'firebase/firestore';
import { Users, Search, Filter, MoreVertical, Edit, Trash2, Shield, UserCheck, UserX, Mail, Phone, Calendar, X, FileText, CreditCard, MapPin, Clock } from 'lucide-react';

interface UserData {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: any;
  lastLogin: any;
  provider: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  insured_sex?: string;
  insured_age?: string;
  insured_occupation?: string;
  policy_state?: string;
  policy_city?: string;
}

interface Policy {
  id: string;
  policyId: string;
  policyType: string;
  status: string;
  sum_insured: number;
  policy_annual_premium: number;
  policy_start_date: string;
  policy_end_date: string;
  policy_renewal_status: string;
}

interface Claim {
  id: string;
  claimId: string;
  userId?: string;
  email?: string;
  claimantName?: string;
  insurance_type?: string;
  claim_amount?: number;
  claimAmount?: number; // camelCase version
  status: string;
  submittedDate: any;
  fraudScore?: number;
  incident_date?: string;
  incidentDate?: string; // camelCase version
  claim_type?: string;
  claimType?: string; // camelCase version
}

export default function UserManagementPage() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userPolicies, setUserPolicies] = useState<Policy[]>([]);
  const [userClaims, setUserClaims] = useState<Claim[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if user is admin
        const userDoc = await doc(db, 'users', currentUser.uid);
        const userData = await getDoc(userDoc);
        
        if (userData.exists() && userData.data()?.role === 'admin') {
          setUser(currentUser);
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserData[];
        setUsers(usersData);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.uid?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.lastLogin) ||
                         (statusFilter === 'inactive' && !user.lastLogin);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleUserClick = async (userData: UserData) => {
    setSelectedUser(userData);
    setLoadingUserDetails(true);
    
    try {
      // Fetch user policies
      const policiesQuery = query(
        collection(db, 'policies'),
        where('userId', '==', userData.uid)
      );
      const policiesSnapshot = await getDocs(policiesQuery);
      const policies = policiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Policy[];
      setUserPolicies(policies);

      // Fetch user claims - try multiple matching strategies
      let claims: Claim[] = [];
      
      // Strategy 1: Try to get claims by userId
      try {
        const claimsQuery = query(
          collection(db, 'claims'),
          where('userId', '==', userData.uid)
        );
        const claimsSnapshot = await getDocs(claimsQuery);
        claims = claimsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Claim[];
      } catch (error) {
        console.log('No claims found by userId:', error);
      }
      
      // Strategy 2: If no claims found by userId, try by email
      if (claims.length === 0) {
        try {
          const claimsByEmailQuery = query(
            collection(db, 'claims'),
            where('email', '==', userData.email)
          );
          const claimsByEmailSnapshot = await getDocs(claimsByEmailQuery);
          claims = claimsByEmailSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Claim[];
        } catch (error) {
          console.log('No claims found by email:', error);
        }
      }
      
      // Strategy 3: If still no claims, try by claimantName (for very old claims)
      if (claims.length === 0) {
        try {
          const claimsByNameQuery = query(
            collection(db, 'claims'),
            where('claimantName', '==', userData.displayName)
          );
          const claimsByNameSnapshot = await getDocs(claimsByNameQuery);
          claims = claimsByNameSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Claim[];
        } catch (error) {
          console.log('No claims found by claimantName:', error);
        }
      }
      
      // Strategy 4: Last resort - get all claims and filter client-side
      if (claims.length === 0) {
        try {
          const allClaimsQuery = query(collection(db, 'claims'));
          const allClaimsSnapshot = await getDocs(allClaimsQuery);
          const allClaims = allClaimsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Claim[];
          
          // Filter by multiple criteria
          claims = allClaims.filter(claim => 
            claim.userId === userData.uid ||
            claim.email === userData.email ||
            claim.claimantName === userData.displayName
          );
        } catch (error) {
          console.log('Error fetching all claims:', error);
        }
      }
      
      // Sort claims by submission date (newest first)
      claims.sort((a, b) => {
        const getDate = (date: any) => {
          if (!date) return 0;
          if (typeof date === 'string') {
            return new Date(date).getTime();
          }
          if (date.toDate && typeof date.toDate === 'function') {
            return date.toDate().getTime();
          }
          return new Date(date).getTime();
        };
        
        const dateA = getDate(a.submittedDate);
        const dateB = getDate(b.submittedDate);
        return dateB - dateA;
      });
      
      console.log(`Found ${claims.length} claims for user ${userData.displayName} (${userData.email})`);
      console.log('Claims found:', claims);
      if (claims.length > 0) {
        console.log('Sample claim fields:', Object.keys(claims[0]));
        console.log('Sample claim data:', claims[0]);
      }
      
      setUserClaims(claims);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'user': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusBadgeColor = (user: UserData) => {
    if (!user.lastLogin) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    
    const lastLogin = user.lastLogin.toDate();
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin <= 7) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (daysSinceLogin <= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getStatusText = (user: UserData) => {
    if (!user.lastLogin) return 'Never logged in';
    
    const lastLogin = user.lastLogin.toDate();
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin === 0) return 'Active today';
    if (daysSinceLogin === 1) return 'Active yesterday';
    if (daysSinceLogin <= 7) return `Active ${daysSinceLogin} days ago`;
    if (daysSinceLogin <= 30) return `Active ${Math.floor(daysSinceLogin / 7)} weeks ago`;
    return `Inactive ${Math.floor(daysSinceLogin / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">User Management</h1>
          </div>
          <p className="text-slate-400">Manage users, roles, and permissions across the platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Users</p>
                <p className="text-white text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Admins</p>
                <p className="text-white text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active Users</p>
                <p className="text-white text-2xl font-bold">
                  {users.filter(u => u.lastLogin && 
                    Math.floor((Date.now() - u.lastLogin.toDate().getTime()) / (1000 * 60 * 60 * 24)) <= 7
                  ).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <UserX className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Inactive Users</p>
                <p className="text-white text-2xl font-bold">
                  {users.filter(u => !u.lastLogin || 
                    Math.floor((Date.now() - u.lastLogin.toDate().getTime()) / (1000 * 60 * 60 * 24)) > 30
                  ).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Advanced
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Provider</label>
                  <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                    <option value="all">All Providers</option>
                    <option value="google.com">Google</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Joined Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Last Login</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">User</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Role</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Joined</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Last Login</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userData) => (
                  <tr key={userData.id} className="border-t border-slate-700 hover:bg-slate-750">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <button
                            onClick={() => handleUserClick(userData)}
                            className="text-white font-semibold hover:text-blue-400 transition-colors text-left"
                          >
                            {userData.displayName || 'Unknown'}
                          </button>
                          <p className="text-slate-400 text-sm">{userData.email}</p>
                          <p className="text-slate-500 text-xs font-mono">{userData.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userData.role || 'user'}
                        onChange={(e) => handleRoleChange(userData.id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(userData.role || 'user')} bg-transparent focus:outline-none`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(userData)}`}>
                        {getStatusText(userData)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {userData.createdAt ? userData.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {userData.lastLogin ? userData.lastLogin.toDate().toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteUser(userData.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:bg-slate-500/20 rounded-lg transition-colors"
                          title="More Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No users found</p>
              <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mt-4 text-slate-400 text-sm">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedUser.displayName || 'Unknown User'}</h2>
                  <p className="text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingUserDetails ? (
                <div className="text-center py-8">
                  <div className="text-slate-400">Loading user details...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* User Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" />
                        Personal Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Name:</span>
                          <span className="text-white">{selectedUser.displayName || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email:</span>
                          <span className="text-white">{selectedUser.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Phone:</span>
                          <span className="text-white">{selectedUser.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Address:</span>
                          <span className="text-white">{selectedUser.address || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Age:</span>
                          <span className="text-white">{selectedUser.insured_age || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Occupation:</span>
                          <span className="text-white">{selectedUser.insured_occupation || 'Not provided'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-700 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-400" />
                        Account Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Role:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(selectedUser.role || 'user')}`}>
                            {selectedUser.role || 'user'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Provider:</span>
                          <span className="text-white">{selectedUser.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Joined:</span>
                          <span className="text-white">
                            {selectedUser.createdAt ? selectedUser.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Last Login:</span>
                          <span className="text-white">
                            {selectedUser.lastLogin ? selectedUser.lastLogin.toDate().toLocaleDateString() : 'Never'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(selectedUser)}`}>
                            {getStatusText(selectedUser)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Policies Section */}
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                      Policies ({userPolicies.length})
                    </h3>
                    {userPolicies.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userPolicies.map((policy) => (
                          <div key={policy.id} className="bg-slate-600 p-3 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-white font-semibold">{policy.policyType}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                policy.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {policy.status}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Policy ID:</span>
                                <span className="text-white font-mono">{policy.policyId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Coverage:</span>
                                <span className="text-white">₹{policy.sum_insured?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Premium:</span>
                                <span className="text-white">₹{policy.policy_annual_premium?.toLocaleString()}/year</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400">No policies found for this user.</p>
                    )}
                  </div>

                  {/* Claims Section */}
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-400" />
                      Claims ({userClaims.length})
                    </h3>
                    {userClaims.length > 0 ? (
                      <div className="space-y-3">
                        {userClaims.map((claim) => (
                          <div key={claim.id} className="bg-slate-600 p-3 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-white font-semibold">{claim.insurance_type || 'Unknown'} - {claim.claim_type || claim.claimType || 'Unknown'}</h4>
                              <div className="flex gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                                  claim.status === 'Rejected' ? 'bg-red-500/20 text-red-400' :
                                  claim.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {claim.status}
                                </span>
                                {claim.fraudScore && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    claim.fraudScore > 0.7 ? 'bg-red-500/20 text-red-400' :
                                    claim.fraudScore > 0.3 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                    Risk: {(claim.fraudScore * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="text-slate-400">Claim ID:</span>
                                <p className="text-white font-mono">{claim.claimId}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">Amount:</span>
                                <p className="text-white">₹{(claim.claim_amount || claim.claimAmount)?.toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">Incident Date:</span>
                                <p className="text-white">{claim.incident_date || claim.incidentDate}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">Submitted:</span>
                                <p className="text-white">
                                  {claim.submittedDate ? 
                                    (typeof claim.submittedDate === 'string' ? 
                                      new Date(claim.submittedDate).toLocaleDateString() : 
                                      claim.submittedDate.toDate().toLocaleDateString()
                                    ) : 'Unknown'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400">No claims found for this user.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
