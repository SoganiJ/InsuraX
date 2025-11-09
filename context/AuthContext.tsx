'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser);
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const { getDoc } = await import('firebase/firestore');
          
          // Check if user document exists
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            // User exists, only update auth-related fields
            await setDoc(
              userRef,
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || '',
                lastLogin: new Date(),
                provider: firebaseUser.providerData[0]?.providerId || 'email',
              },
              { merge: true }
            );
            console.log('Existing user synced to Firestore (preserving profile data)');
          } else {
            // New user, create with basic fields
            await setDoc(
              userRef,
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || '',
                createdAt: new Date(),
                lastLogin: new Date(),
                provider: firebaseUser.providerData[0]?.providerId || 'email',
              },
              { merge: true }
            );
            console.log('New user created in Firestore');
          }
        } catch (error) {
          console.error('Error syncing user to Firestore:', error);
        }
      }
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  console.log('useAuth hook called - user:', context.user, 'loading:', context.loading);
  return context;
};
