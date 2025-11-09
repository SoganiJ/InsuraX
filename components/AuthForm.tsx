'use client';

import { auth, db, googleProvider } from '@/firebase/config';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Ensure getDoc is imported
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, User, Lock, ArrowRight, Shield, ChevronDown } from 'lucide-react';

const MagicButton = ({
  title,
  icon,
  position,
  onClick,
  otherClasses,
  disabled = false,
}: {
  title: string;
  icon: React.ReactNode;
  position: string;
  onClick: () => void;
  otherClasses: string;
  disabled?: boolean;
}) => {
  return (
    <button
      className={`relative inline-flex h-12 w-full overflow-hidden rounded-xl p-[1px] focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
      <span
        className={`inline-flex h-full w-full cursor-pointer items-center justify-center rounded-xl
              bg-slate-950 px-7 text-sm font-medium text-white backdrop-blur-3xl gap-2 ${otherClasses}`}
      >
        {position === "left" && icon}
        {title}
        {position === "right" && icon}
      </span>
    </button>
  );
};

const GoogleButton = ({ onClick, loading }: { onClick: () => void; loading: boolean }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group relative w-full h-12 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 hover:from-slate-700 hover:via-slate-800 hover:to-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      <div className="relative flex items-center justify-center gap-3 text-white font-medium">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? 'Please wait...' : 'Continue with Google'}
      </div>
    </button>
  );
};

type UserRole = 'user' | 'admin';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('user');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const router = useRouter();

  // Function to save or update user data in Firestore, preserving existing roles for Google auth
  const saveUserToFirestore = async (user: any, isGoogleAuth = false) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userRole: UserRole = role; // Default role for email/password signup

      if (userDocSnap.exists()) {
        // User already exists in Firestore
        const existingData = userDocSnap.data();
        // Preserve the existing role from Firestore for this user
        userRole = existingData.role || 'user'; 

        // Update only necessary fields for an existing user (e.g., last login, display name)
        await setDoc(userDocRef, {
          displayName: user.displayName || existingData.displayName || '', // Update display name if Google provides a new one
          lastLogin: new Date()
        }, { merge: true }); // Use merge: true to only update specified fields

        // Return the existing user data, potentially with updated lastLogin and displayName
        return { ...existingData, lastLogin: new Date(), uid: user.uid, email: user.email, role: userRole }; 
      } else {
        // This is a brand new user
        if (isGoogleAuth) {
          userRole = 'user'; // New Google signups default to 'user'
        } else {
          userRole = role; // Email signup uses the role selected in the form
        }

        const newUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || name || '', // Use Google displayName if available, otherwise form name
          createdAt: new Date(),
          provider: user.providerData[0]?.providerId || 'email',
          role: userRole,
          lastLogin: new Date()
        };

        await setDoc(userDocRef, newUserData, { merge: true });
        return newUserData;
      }
    } catch (err) {
      console.error('Error saving user:', err);
      throw err;
    }
  };


  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Call saveUserToFirestore, indicating it's a Google authentication
      const userData = await saveUserToFirestore(result.user, true); 
      // Redirect based on the role determined by saveUserToFirestore
      router.push(userData.role === 'admin' ? '/admin-dashboard' : '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let userCredential;
      if (isLogin) { // Login with email/password
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Fetch the user's role from Firestore for redirection
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userRoleFromDB = userDoc.data().role;
          router.push(userRoleFromDB === 'admin' ? '/admin-dashboard' : '/dashboard');
        } else {
          // Fallback if user data doesn't exist (should ideally not happen post-login)
          console.warn("User data not found in Firestore after email/password login. Redirecting to user dashboard.");
          router.push('/dashboard');
        }
      } else { // Sign up with email/password
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save new user data to Firestore with the selected role
        const userData = await saveUserToFirestore(userCredential.user); 
        router.push(userData.role === 'admin' ? '/admin-dashboard' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl"></div>
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Main card */}
        <div className="bg-gradient-to-b from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isLogin ? 'Sign in to your InsuraX account' : 'Join InsuraX today'}
            </p>
          </div>

          {/* Google Auth Button */}
          <GoogleButton onClick={handleGoogleAuth} loading={loading} />

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
            <span className="px-4 text-slate-400 text-sm font-medium">OR</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5">
            {/* Name Field (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full h-12 px-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-white placeholder-slate-400 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* Role Selection (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Account Type
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="w-full h-12 px-4 bg-slate-800/50 border border-slate-600 rounded-xl flex items-center justify-between text-white"
                  >
                    <div className="flex items-center gap-2">
                      {role === 'admin' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span>Admin</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span>User</span>
                        </>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showRoleDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setRole('user');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-slate-700 ${role === 'user' ? 'bg-slate-700/50' : ''}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>User</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRole('admin');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-slate-700 ${role === 'admin' ? 'bg-slate-700/50' : ''}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span>Admin</span>
                      </button>
                    </div>
                  )}
                </div>
                {role === 'admin' && (
                  <p className="text-xs text-purple-400 mt-1">
                    Note: Admin accounts require verification. You'll be able to access the admin dashboard after approval.
                  </p>
                )}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 px-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-white placeholder-slate-400 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-12 px-4 pr-12 bg-slate-800/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-white placeholder-slate-400 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <MagicButton
                title={loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                icon={<ArrowRight className="w-4 h-4" />}
                position="right"
                onClick={() => {}} // Form's onSubmit will handle the submission
                disabled={loading}
                otherClasses="hover:bg-slate-900"
              />
            </div>
          </form>

          {/* Toggle Form Type */}
          <div className="text-center mt-6 pt-6 border-t border-slate-700/50">
            <p className="text-slate-400 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;