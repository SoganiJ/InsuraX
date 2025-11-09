// app/admin-dashboard/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import AdminDashboard from '../../components/AdminDashboardContent';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
          router.push('/dashboard');
        }
      } else {
        router.push('/auth/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return <AdminDashboard />;
}