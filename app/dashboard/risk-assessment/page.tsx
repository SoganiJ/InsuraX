"use client";
import { useState, useEffect } from "react";
import { motion, animate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ----------------- Insurance Types -----------------
const insuranceTypes = [
  { id: "vehicle", label: "Vehicle Insurance", icon: "🚗" },
  { id: "health", label: "Health Insurance", icon: "🏥" },
  { id: "home", label: "Home Insurance", icon: "🏡" },
];

// ----------------- Questions -----------------
const vehicleQuestions = [
  { id: "v1", label: "Vehicle Age < 5 years" },
  { id: "v2", label: "Vehicle Age > 5 years" },
  { id: "v3", label: "No Claim History" },
  { id: "v4", label: "1+ Previous Claims" },
];

const healthQuestions = [
  { id: "h1", label: "Age < 40" },
  { id: "h2", label: "Age > 40" },
  { id: "h3", label: "Non-smoker" },
  { id: "h4", label: "Smoker / Pre-existing condition" },
];

const homeQuestions = [
  { id: "ho1", label: "New Property (< 10 yrs)" },
  { id: "ho2", label: "Old Property (> 10 yrs)" },
  { id: "ho3", label: "Secure Area / CCTV" },
  { id: "ho4", label: "High-risk Zone (Flood/Fire)" },
];

// ----------------- Risk Score Circle Component -----------------
function RiskScoreCircle({ score }: { score: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const controls = animate(0, score, {
      duration: 2,
      onUpdate(value) {
        setProgress(Math.round(value));
      },
    });
    return () => controls.stop();
  }, [score]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className="relative w-48 h-48 rounded-full flex items-center justify-center shadow-2xl"
        style={{
          background: `conic-gradient(
            ${progress < 40 ? "#10b981" : progress < 70 ? "#f59e0b" : "#ef4444"} ${progress * 3.6}deg,
            #1f2937 ${progress * 3.6}deg
          )`,
        }}
      >
        {/* Inner Circle */}
        <div className="absolute w-36 h-36 bg-gray-900 rounded-full flex items-center justify-center shadow-inner">
          <motion.span
            key={progress}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`text-3xl font-bold ${
              progress < 40
                ? "text-green-400"
                : progress < 70
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {progress}%
          </motion.span>
        </div>
      </div>

      {/* Risk Level Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className={`text-lg font-semibold ${
          progress < 40
            ? "text-green-400"
            : progress < 70
            ? "text-yellow-400"
            : "text-red-400"
        }`}
      >
        {progress < 40
          ? "✅ Low Risk - You're in a safe range!"
          : progress < 70
          ? "⚠️ Medium Risk - Some caution advised."
          : "❌ High Risk - Consider additional coverage."}
      </motion.div>
    </div>
  );
}

// ----------------- Main Page -----------------
export default function RiskAssessmentPage() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);

  // ----------------- Handle Selection -----------------
  const handleOptionClick = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  // ----------------- Risk Calculation -----------------
  const calculateRisk = () => {
    // simple scoring logic
    const base = selectedOptions.length * 20;
    setScore(Math.min(base, 100));
    setStep(3);
  };

  // ----------------- Load Questions -----------------
  const renderQuestions = () => {
    if (selectedType === "vehicle") return vehicleQuestions;
    if (selectedType === "health") return healthQuestions;
    if (selectedType === "home") return homeQuestions;
    return [];
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
      <Card className="w-full max-w-2xl bg-gray-900/80 border border-gray-700 shadow-2xl rounded-2xl">
        <CardContent className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* ----------------- Step 1: Select Insurance Type ----------------- */}
            {step === 1 && (
              <>
                <h2 className="text-2xl font-bold mb-6 text-center">
                  Select Insurance Type
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {insuranceTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`cursor-pointer p-6 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                        selectedType === type.id
                          ? "bg-blue-600 text-white border-blue-400"
                          : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                      }`}
                      onClick={() => setSelectedType(type.id)}
                    >
                      <div className="text-4xl mb-2 text-center">{type.icon}</div>
                      <p className="font-medium text-center">{type.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedType}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Next →
                  </Button>
                </div>
              </>
            )}

            {/* ----------------- Step 2: Questions ----------------- */}
            {step === 2 && (
              <>
                <h2 className="text-2xl font-bold mb-6 text-center">
                  Answer a few quick questions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderQuestions().map((q) => (
                    <div
                      key={q.id}
                      className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                        selectedOptions.includes(q.id)
                          ? "bg-green-600 text-white border-green-400"
                          : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                      }`}
                      onClick={() => handleOptionClick(q.id)}
                    >
                      {q.label}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-6">
                  <Button
                    onClick={() => setStep(1)}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={calculateRisk}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Calculate Risk
                  </Button>
                </div>
              </>
            )}

            {/* ----------------- Step 3: Risk Score ----------------- */}
            {step === 3 && score !== null && (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-6">Your Risk Score</h2>

                {/* Attractive Animated Circle */}
                <RiskScoreCircle score={score} />

                <div className="flex justify-between mt-6">
                  <Button
                    onClick={() => setStep(2)}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={() => {
                      setStep(1);
                      setSelectedType(null);
                      setSelectedOptions([]);
                      setScore(null);
                    }}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    Start Again
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
