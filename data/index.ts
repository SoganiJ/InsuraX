export const navItems = [
  { name: "About", link: "#about" },
  { name: "Testimonials", link: "#testimonials" },
   { name: "Insights", link: "#gridItems" },
  { name: "Contact", link: "#contact" },
];

export const gridItems = [
  {
    id: 1,
    title: "We prioritize ethical AI, ensuring transparency in every insurance claim decision",
    description: "",
    className: "lg:col-span-3 md:col-span-6 md:row-span-4 lg:min-h-[60vh]",
    imgClassName: "w-full h-full",
    titleClassName: "justify-end",
    img: "/logo2.png",
    spareImg: "",
  },
  {
    id: 2,
    title: "Globally scalable, locally insightful",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-2",
    imgClassName: "",
    titleClassName: "justify-start",
    img: "",
    spareImg: "",
  },
  {
    id: 3,
    title: "We build with",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-2",
    imgClassName: "",
    titleClassName: "justify-center",
    img: "",
    spareImg: "",
  },
  {
    id: 4,
    title: "AI innovators on a mission to fight fraud with ethics, data, and design.",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-1",
    imgClassName: "",
    titleClassName: "justify-start",
    img: "/grid.svg",
    spareImg: "/b4.svg",
  },

  {
    id: 5,
    title: "Built on research. Backed by real-world testing.",
    description: "The Inside Scoop",
    className: "md:col-span-3 md:row-span-2",
    imgClassName: "absolute right-0 bottom-0 md:w-96 w-60",
    titleClassName: "justify-center md:justify-start lg:justify-center",
    img: "/b5.svg",
    spareImg: "/grid.svg",
  },
  {
    id: 6,
    title: "Want to explore AI for real-world problems together?",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-1",
    imgClassName: "",
    titleClassName: "justify-center md:max-w-full max-w-60 text-center",
    img: "",
    spareImg: "",
  },
];


export const testimonials = [
  {
    quote:
      "Implementing the AI-Powered Claims Fraud Detection system transformed our investigation unit. The fraud propensity scores have 92% accuracy and the network analysis uncovered three major fraud rings in the first month alone. This system has already saved us millions in potential losses.",
    name: "Sarah Chen",
    title: "Head of Special Investigations, GlobalSure Insurance",
  },
  {
    quote:
      "The investigation prioritization dashboard has increased our team's efficiency by 300%. We're now focusing on the highest-risk claims with clear reason codes, rather than wasting time on false positives. The graph analytics revealed connections we would never have spotted manually.",
    name: "Raj Patel",
    title: "Fraud Investigation Director, ShieldCover Group",
  },
  {
    quote:
      "As an actuary, I was skeptical about AI fraud detection, but the explainability features won me over. The SHAP values show exactly why each claim was flagged, allowing us to continuously improve our models while maintaining regulatory compliance.",
    name: "David Müller",
    title: "Chief Actuary, EuroProtect Insurance",
  },
  {
    quote:
      "This system identified a sophisticated fraud network operating across four states that had evaded detection for years. The ROI was realized within weeks - it's now our most important anti-fraud tool.",
    name: "Maria Gonzalez",
    title: "VP of Claims Integrity, Americas Alliance Insurance",
  },
  {
    quote:
      "The combination of traditional machine learning and graph neural networks is revolutionary for our industry. We've reduced fraudulent payouts by 37% in the first quarter while actually decreasing investigation costs.",
    name: "James Okafor",
    title: "Chief Risk Officer, Pan-African Insurance Consortium",
  },
];


export const workExperience = [
  {
    id: 1,
    title: "Fraud Pattern Intelligence",
    desc: "Uncover suspicious behavior by mapping connections across patients, hospitals, and claims using Graph Machine Learning.",
    className: "md:col-span-2",
    thumbnail: "/exp1.svg",
  },
  {
    id: 2,
    title: "Explainable AI Engine",
    desc: "Every decision is backed by SHAP values, helping investigators understand why a claim was flagged — no black boxes.",
    className: "md:col-span-2", // change to md:col-span-2
    thumbnail: "/exp2.svg",
  },
  {
    id: 3,
    title: "Real-World Testing Dashboard",
    desc: "Simulating live claim flows through an interactive web dashboard, designed for Indian insurance use cases.",
    className: "md:col-span-2", // change to md:col-span-2
    thumbnail: "/exp3.svg",
  },
  {
    id: 4,
    title: "Ethics & Fairness by Design",
    desc: "Anonymization, bias checks, and fair AI practices are baked into every layer — making our system secure, private, and just.",
    className: "md:col-span-2",
    thumbnail: "/exp4.svg",
  },
];

