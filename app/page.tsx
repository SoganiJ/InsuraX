"use client";

import { navItems } from "@/data";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useEffect, useState } from "react";

import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Clients from "@/components/Clients";
import Approach from "@/components/Approach";
import Experience from "@/components/Experience";
import { FloatingNav } from "@/components/ui/FloatingNavbar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import dynamic from "next/dynamic";

// Dynamically import Grid to prevent SSR issues with lottie-web
const Grid = dynamic(() => import("@/components/Grid"), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center">Loading...</div>
});

const Home = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUser(user);
      const userDoc = await getDoc(doc(db, 'users', user.uid)); 
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);

        // Redirect based on role
        if (data?.role === 'admin') {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    } else {
      setUser(null);
      setUserData(null);
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, [router]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black-100">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <main className="relative bg-black-100 flex justify-center items-center flex-col overflow-hidden mx-auto sm:px-10 px-5">
      <div className="max-w-7xl w-full">
        <FloatingNav 
          navItems={[
            ...navItems,
            ...(user ? [
              {
                name: userData?.role === 'admin' ? '/admin-dashboard' : '/dashboard',
                link: userData?.role === 'admin' ? '/admin-dashboard' : '/dashboard',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                )
              }
            ] : [
              {
                name: "Login",
                link: "/auth/signin",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                )
              }
            ])
          ]} 
        />
        <Hero user={user} userData={userData} />
        <Grid />
        <Clients />
        <Experience />
        <Approach />
        <Footer />
      </div>
    </main>
  );
};

export default Home;