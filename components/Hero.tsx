import { FaLocationArrow } from "react-icons/fa6";
import MagicButton from "./MagicButton";
import { Spotlight } from "./ui/Spotlight";
import { TextGenerateEffect } from "./ui/TextGenerateEffect";
import { useRouter } from "next/navigation";
import { User } from "firebase/auth";

interface HeroProps {
  user: User | null;
  userData: any;
}

const Hero = ({ user, userData }: HeroProps) => {
  const router = useRouter();

  const handleNavigation = () => {
    if (user) {
      // Navigate to appropriate dashboard based on role
      if (userData?.role === 'admin') {
        router.push('/admin-dashboard');
      } else {
        router.push('/dashboard');
      }
    } else {
      // Make sure this matches your actual auth page route
      router.push('/auth/signin');
    }
  };

  return (
    <div className="pb-20 pt-36 relative">
      {/* Spotlight effects */}
      <div className="spotlight-container">
        <Spotlight
          className="-top-40 -left-10 md:-left-32 md:-top-20 h-screen"
          fill="white"
        />
        <Spotlight
          className="h-[80vh] w-[50vw] top-10 left-full"
          fill="purple"
        />
        <Spotlight className="left-80 top-28 h-[80vh] w-[50vw]" fill="blue" />
      </div>

      {/* Background grid */}
      <div
        className="h-screen w-full dark:bg-black-100 bg-white dark:bg-grid-white/[0.03] bg-grid-black-100/[0.2]
       absolute top-0 left-0 flex items-center justify-center"
      >
        <div
          className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black-100
         bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"
        />
      </div>

      {/* Welcome back badge for authenticated users */}
      {user && (
        <div className="absolute top-10 right-10 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-3 py-1 rounded-full z-20 animate-pulse">
          Welcome back, {user.displayName || user.email?.split('@')[0]}
          {userData?.role === 'admin' && ' (Admin)'}
        </div>
      )}

      {/* Main content */}
      <div className="flex justify-center relative my-20 z-10">
        <div className="max-w-[89vw] md:max-w-2xl lg:max-w-[60vw] flex flex-col items-center justify-center">
          <TextGenerateEffect
            words={
              user 
                ? `Welcome back to InsuraX ${userData?.role === 'admin' ? 'Admin Portal' : ''}` 
                : "Smarter Insurance with AI-Powered Fraud Detection by InsuraX"
            }
            className="text-center text-[40px] md:text-5xl lg:text-6xl"
          />

          <p className="text-center md:tracking-wider mb-4 text-sm md:text-lg lg:text-2xl">
            {user
              ? userData?.role === 'admin'
                ? "Manage the InsuraX platform and user accounts"
                : "Continue managing your insurance solutions with AI-powered insights"
              : "Building Trustworthy, Real-World Solutions for India's Insurance Sector"}
          </p>

          <MagicButton
            title={user ? (userData?.role === 'admin' ? "Admin Dashboard" : "My Dashboard") : "Lets Get Started"}
            icon={<FaLocationArrow />}
            position="right"
            onClick={handleNavigation}
            otherClasses={user ? "hover:bg-slate-900" : ""}
          />
        </div>
      </div>
    </div>
  );
};

export default Hero;