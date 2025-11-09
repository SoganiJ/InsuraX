import { FaLocationArrow } from "react-icons/fa6";
import MagicButton from "./MagicButton";
import { useRouter } from "next/navigation";

const Footer = () => {
  const router = useRouter();
  
    const handleClick = () => {
      console.log('Button clicked - attempting navigation');
      router.push('/dashboard');
      console.log('Navigation attempted');
    };
  return (
    <footer className="w-full pt-20 pb-10" id="contact">
      {/* background grid */}
      <div className="w-full absolute left-0 -bottom-72 min-h-96">
        <img
          src="/footer-grid.svg"
          alt="grid"
          className="w-full h-full opacity-50 "
        />
      </div>

      <div className="flex flex-col items-center">
        <h1 className="heading lg:max-w-[45vw]">
          Ready to <span className="text-purple">protect</span> your company from costly insurance fraud?
        </h1>
        <p className="text-white-200 md:mt-10 my-5 text-center">
          Partner with us — and take the lead in ethical, explainable fraud prevention.
        </p>
        
          <MagicButton
            title="Lets Get Started"
            icon={<FaLocationArrow />}
            position="right"
            onClick={handleClick}
          />
        
        
      </div>
      <div className="flex mt-16 md:flex-row flex-col justify-between items-center">
        <p className="md:text-base text-sm md:font-normal font-light">
          Copyright © InsuraX
        </p>

        
      </div>
    </footer>
  );
};

export default Footer;
