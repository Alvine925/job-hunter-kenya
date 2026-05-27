"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Check, AlertCircle, RefreshCw } from "lucide-react";

type RoleKey = "developer" | "accountant" | "hr";

interface RoleData {
  title: string;
  label: string;
  board: string;
  location: string;
  description: string;
  allSkills: string[];
}

interface InteractiveDemoProps {
  isFlat?: boolean;
}

export default function InteractiveDemo({ isFlat = false }: InteractiveDemoProps) {
  const [selectedRole, setSelectedRole] = useState<RoleKey>("developer");
  const [userSkills, setUserSkills] = useState<string[]>(["React", "Next.js", "TypeScript"]);
  const [preferredCounty, setPreferredCounty] = useState<string>("Nairobi");
  const [isMatching, setIsMatching] = useState(false);
  const [matchingStep, setMatchingStep] = useState("");
  const [matchResult, setMatchResult] = useState<any | null>(null);

  const roles: Record<RoleKey, RoleData> = {
    developer: {
      title: "Senior Full Stack Engineer",
      label: "Developer",
      board: "Company Portal",
      location: "Nairobi County",
      description: "Build robust SaaS products using React, Next.js, and TypeScript. Experience with cloud deployments is preferred.",
      allSkills: ["React", "Next.js", "TypeScript", "Python", "Docker", "PostgreSQL"],
    },
    accountant: {
      title: "Senior Accountant",
      label: "Accountant",
      board: "General Job Site",
      location: "Nairobi County",
      description: "Manage financial operations, ledger reconciliations, tax compliance (KRA), and prepare audit sheets using QuickBooks.",
      allSkills: ["QuickBooks", "KRA Tax", "Ledger Reconciliation", "Excel", "IFRS Standards", "Auditing"],
    },
    hr: {
      title: "HR Generalist",
      label: "HR Specialist",
      board: "NGO Portal",
      location: "Nairobi County",
      description: "Lead talent acquisition, execute employee onboarding, manage local labour laws, payroll, and conflict resolutions.",
      allSkills: ["Labour Laws", "Onboarding", "Payroll Management", "Talent Acquisition", "Conflict Resolution", "Workplace Safety"],
    },
  };

  const handleRoleChange = (role: RoleKey) => {
    setSelectedRole(role);
    setUserSkills(roles[role].allSkills.slice(0, 3));
    setMatchResult(null);
  };

  const toggleSkill = (skill: string) => {
    if (userSkills.includes(skill)) {
      setUserSkills(userSkills.filter((s) => s !== skill));
    } else {
      setUserSkills([...userSkills, skill]);
    }
  };

  const runMatch = async () => {
    setIsMatching(true);
    setMatchResult(null);

    const steps = [
      "Reading job listing details...",
      "Extracting skills from your mock CV...",
      "Analyzing semantic requirements...",
      "Running multi-dimensional match analyst...",
    ];

    for (const step of steps) {
      setMatchingStep(step);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const totalSkillsCount = roles[selectedRole].allSkills.length;
    const selectedSkillsCount = userSkills.filter((s) =>
      roles[selectedRole].allSkills.includes(s)
    ).length;

    let skillPercentage = (selectedSkillsCount / totalSkillsCount) * 80;
    let locationPercentage = preferredCounty === "Nairobi" ? 20 : 5;

    let totalScore = Math.round(skillPercentage + locationPercentage);
    if (totalScore > 100) totalScore = 100;
    if (totalScore < 10) totalScore = 10;

    let level = "Weak Fit";
    let color = "text-slate-600 border-slate-200 bg-slate-50";
    let reasoning = "";

    if (totalScore >= 80) {
      level = "Excellent Match";
      color = "text-emerald-700 border-emerald-200 bg-emerald-50";
      reasoning = `Great fit! You match the core skill requirements (${userSkills.join(", ")}) and your location aligns with the job's Nairobi requirements. Tellus will generate a highly optimized application.`;
    } else if (totalScore >= 50) {
      level = "Moderate Fit";
      color = "text-amber-700 border-amber-200 bg-amber-50";
      reasoning = `Decent fit. You possess key skills, but lack some preferred credentials like ${roles[selectedRole].allSkills
        .filter((s) => !userSkills.includes(s))
        .slice(0, 2)
        .join(" or ")}. We recommend tailoring your CV blurb to highlight your adaptable background.`;
    } else {
      level = "Weak Fit";
      color = "text-slate-600 border-slate-200 bg-slate-50";
      reasoning = `Limited match. Your current profile has gaps in technical requirements. You may want to update your resume skills list to better align.`;
    }

    setMatchResult({
      score: totalScore,
      level,
      color,
      reasoning,
      bullet: `Leveraged ${userSkills.join(" and ")} to execute standard procedures for a high-performing operations environment, aligning with local specifications.`,
    });
    setIsMatching(false);
  };

  const renderGrid = () => (
    <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">

      {/* Controls Panel */}
      <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-6">
            Configure Profile Parameters
          </h3>

          {/* Role Selection */}
          <div className="space-y-2.5 mb-6">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Target Job Listing
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {(Object.keys(roles) as RoleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleRoleChange(key)}
                  className={`py-2 px-1 sm:px-2 rounded-lg text-[10px] sm:text-xs font-medium border transition-all text-center cursor-pointer ${selectedRole === key
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                >
                  {roles[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Job Card Preview */}
          <div className={isFlat ? "py-4 border-y border-slate-100 mb-6" : "p-4 rounded-xl bg-white border border-slate-200 mb-6"}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-brand-primary uppercase tracking-wider">
                {roles[selectedRole].board} Listing
              </span>
              <span className="text-[11px] text-slate-400">{roles[selectedRole].location}</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-800">{roles[selectedRole].title}</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {roles[selectedRole].description}
            </p>
          </div>

          {/* Skills checklist */}
          <div className="space-y-2.5 mb-6">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Your CV Skills (Toggle to modify)
            </label>
            <div className="flex flex-wrap gap-2">
              {roles[selectedRole].allSkills.map((skill) => {
                const isSelected = userSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${isSelected
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Select */}
          <div className="space-y-2.5 mb-8">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Preferred Work County
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {["Nairobi", "Mombasa", "Kisumu"].map((county) => (
                <button
                  key={county}
                  onClick={() => setPreferredCounty(county)}
                  className={`py-2 px-1 sm:px-3 rounded-lg text-[10px] sm:text-xs font-medium border transition-all text-center cursor-pointer ${preferredCounty === county
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                >
                  {county}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={runMatch}
          disabled={isMatching}
          className="w-full py-3.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isMatching ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing Parameters...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Run Match Evaluation
            </>
          )}
        </button>
      </div>

      {/* Results Display Panel */}
      <div className="lg:col-span-6 flex flex-col justify-start relative min-h-[160px] lg:min-h-[350px] pt-2">
        <AnimatePresence mode="wait">
          {isMatching ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="w-10 h-10 rounded-full border-3 border-slate-200 border-t-brand-primary animate-spin" />
              <p className="text-sm text-slate-600 animate-pulse">{matchingStep}</p>
            </motion.div>
          ) : matchResult ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full space-y-6"
            >
              {/* Score Indicator */}
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-slate-200 bg-white flex items-center justify-center shrink-0">
                  <span className="text-xl sm:text-2xl font-semibold text-slate-900">
                    {matchResult.score}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className={`px-3 py-1 rounded-full border text-xs font-medium w-fit ${matchResult.color}`}>
                    {matchResult.level}
                  </div>
                  <p className="text-xs text-slate-400">Semantic fit score</p>
                </div>
              </div>

              {/* AI Reasoning Text */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Match Analyst Reasoning
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {matchResult.reasoning}
                </p>
              </div>

              {/* Generated Bullet Point */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tailored CV Skill Blurb
                </h4>
                <p className={`text-sm italic text-slate-500 ${isFlat ? "py-3 border-l-2 border-brand-primary pl-4" : "p-4 rounded-xl bg-white border border-slate-200"}`}>
                  &ldquo;{matchResult.bullet}&rdquo;
                </p>
              </div>

              <button
                onClick={() => setMatchResult(null)}
                className="py-2 px-5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Reset Simulator
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 max-w-sm"
            >
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-slate-700">Simulator Idle</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Set up your CV skills and target board listing in the left panel, then hit &ldquo;Run Match Evaluation&rdquo; to see calculations.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );

  if (isFlat) {
    return renderGrid();
  }

  return (
    <section id="demo" className="py-12 sm:py-20 bg-[#FAFAFA] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-14">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            See the Matcher in Action
          </h2>
          <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">
            Configure a mock profile below to see how Tellus evaluates job listings semantically rather than just searching for exact letters.
          </p>
        </div>

        {/* Demo Box */}
        {renderGrid()}

      </div>
    </section>
  );
}
