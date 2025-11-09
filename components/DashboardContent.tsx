// components/DashboardContent.tsx
'use client';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../firebase/config';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ShieldCheck, FileText, HelpCircle, FilePlus2, Activity, Bell, LifeBuoy } from "lucide-react";
import { useData } from "@/context/DataContext";
import { formatCurrency } from "@/lib/formatters";

interface DashboardCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, description, icon, onClick }) => (
  <div
    onClick={onClick}
    className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 
               hover:border-purple-500 hover:shadow-[0_10px_25px_rgba(139,92,246,0.5)] hover:scale-[1.02] 
               transition-all duration-300 cursor-pointer"
  >
    <div className="flex items-center gap-4 mb-4">
      {icon && <div className="text-purple-400 group-hover:text-purple-500 text-2xl">{icon}</div>}
      <h3 className="text-xl font-semibold text-white">{title}</h3>
    </div>
    <p className="text-slate-400 text-sm">{description}</p>
  </div>
);

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-purple-500" />
  </div>
);

const DashboardContent = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { policies, claims } = useData();

  // Calculate total coverage from all policies
  const totalCoverage = policies.reduce((sum, policy) => sum + (policy.sum_insured || 0), 0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
          if (userDoc.data()?.role === 'admin') {
            router.push('/admin-dashboard');
          }
        }
      } else {
        router.push('/');
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loadingAuth || !user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white">
            Welcome back, {userData?.displayName || user.displayName || 'User'} 👋
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Manage your insurance smartly & securely
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 
                     text-white py-2 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-md"
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      {/* User Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-800/70 rounded-2xl p-6 border border-slate-700 col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">User Information</h2>
            <a 
              href="/dashboard/profile" 
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              Edit Profile →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 text-slate-300">
            <p><span className="font-medium text-white">Name:</span> {userData?.displayName || user.displayName}</p>
            <p><span className="font-medium text-white">Email:</span> {user.email}</p>
            <p><span className="font-medium text-white">Role:</span> {userData?.role || 'User'}</p>
            <p><span className="font-medium text-white">Joined:</span> {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}</p>
            <p><span className="font-medium text-white">Gender:</span> {userData?.insured_sex || 'Not specified'}</p>
            <p><span className="font-medium text-white">Age:</span> {userData?.insured_age || 'Not specified'}</p>
            <p><span className="font-medium text-white">Occupation:</span> {userData?.insured_occupation || 'Not specified'}</p>
            <p><span className="font-medium text-white">Location:</span> {userData?.policy_city || 'Not specified'}, {userData?.policy_state || 'Not specified'}</p>
          </div>
        </div>
        <div className="bg-slate-800/70 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Stats</h2>
          <ul className="space-y-2 text-slate-300">
            <li>📄 Active Policies: {policies.length}</li>
            <li>🛡️ Claims Filed: {claims.length}</li>
            <li>⭐ Risk Score: {userData?.riskScore || 'Low'}</li>
            <li>💰 Total Coverage: {formatCurrency(totalCoverage)}</li>
            <li>🔄 Renewal Status: All Active</li>
          </ul>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Link href="/dashboard/policies" className="block">
          <DashboardCard
            title="My Policies"
            description="View and manage all your insurance policies in one place"
            icon={<ShieldCheck />}
            onClick={() => router.push('/dashboard/policies')}
          />
        </Link>

        <Link href="/dashboard/claim" className="block">
          <DashboardCard
            title="File a Claim"
            description="Start a new insurance claim with our guided process"
            icon={<FilePlus2 />}
            onClick={() => router.push('/dashboard/claim')}
          />
        </Link>

        <Link href="/dashboard/claims" className="block">
          <DashboardCard
            title="Claims Management"
            description="Track, manage, and communicate about your claims"
            icon={<FileText />}
            onClick={() => router.push('/dashboard/claims')}
          />
        </Link>

        <Link href="/dashboard/risk-assessment" className="block">
          <DashboardCard
            title="Risk Assessment"
            description="Get personalized risk analysis for your assets"
            icon={<Activity />}
          />
        </Link>

        <Link href="/dashboard/support" className="block">
          <DashboardCard
            title="Support Center"
            description="Get help from our support team 24/7"
            icon={<LifeBuoy />}
          />
        </Link>

        <DashboardCard
          title="Notifications"
          description="Check your latest updates & alerts"
          icon={<Bell />}
        />
      </div>
    </div>
  );
};

export default DashboardContent;
