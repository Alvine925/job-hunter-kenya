import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DollarSign,
  Calculator,
  Briefcase,
  HelpCircle,
  TrendingUp,
  MapPin,
  FileText,
  Sliders,
  CheckCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/salary")({
  head: () => ({
    title: "Salary Intel - Tellus",
    meta: [
      { title: "Salary Intel - Tellus" },
      { name: "description", content: "Salary benchmarks, Kenya PAYE tax calculator, and professional negotiation worksheet." },
    ],
  }),
  component: SalaryPage,
});

interface SalaryScale {
  role: string;
  nairobiRange: string;
  remoteRange: string;
  equityRank: string;
}

const BENCHMARKS: SalaryScale[] = [
  { role: "Software Engineer (Mid)", nairobiRange: "Ksh 150k - 250k", remoteRange: "USD 2,500 - 4,500", equityRank: "High" },
  { role: "Senior Software Engineer", nairobiRange: "Ksh 350k - 550k", remoteRange: "USD 5,000 - 8,500", equityRank: "Very High" },
  { role: "Product Manager (Mid)", nairobiRange: "Ksh 180k - 300k", remoteRange: "USD 3,000 - 5,000", equityRank: "High" },
  { role: "Project Manager / Lead", nairobiRange: "Ksh 140k - 220k", remoteRange: "USD 2,000 - 3,500", equityRank: "Medium" },
  { role: "DevOps Engineer", nairobiRange: "Ksh 220k - 380k", remoteRange: "USD 4,000 - 6,500", equityRank: "High" },
  { role: "Data / Finance Analyst", nairobiRange: "Ksh 100k - 180k", remoteRange: "USD 1,800 - 3,000", equityRank: "Medium" },
];

function SalaryPage() {
  const queryClient = useQueryClient();
  const [grossInput, setGrossInput] = useState("250000");
  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Negotiation worksheet State
  const [targetSalary, setTargetSalary] = useState("");
  const [reserveSalary, setReserveSalary] = useState("270000");
  const [perks, setPerks] = useState("Health insurance, remote setup allowance, 24 days leave");

  // Load target salary from profile minimum_salary
  const { data: profile } = useQuery({
    queryKey: ["profile-salary"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("minimum_salary")
        .eq("id", data.user.id)
        .single();
      return prof;
    }
  });

  useEffect(() => {
    if (profile?.minimum_salary) {
      setTargetSalary(String(profile.minimum_salary));
    } else {
      setTargetSalary("320000");
    }
  }, [profile]);

  const updateMinimumSalaryMutation = useMutation({
    mutationFn: async (minSal: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const { error } = await supabase
        .from("profiles")
        .update({ minimum_salary: minSal })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-salary"] });
      toast.success("Profile minimum salary requirement saved!");
    },
    onError: () => {
      toast.error("Failed to update salary requirement");
    }
  });

  const saveWorksheet = () => {
    const val = parseInt(targetSalary);
    if (!isNaN(val)) {
      updateMinimumSalaryMutation.mutate(val);
    }
  };

  const calculateKenyaTax = () => {
    const gross = parseFloat(grossInput);
    if (isNaN(gross) || gross <= 0) {
      toast.error("Please enter a valid gross monthly salary");
      return;
    }

    const nssf = Math.min(gross * 0.06, 2160);
    const taxableIncome = gross - nssf;

    let payeRaw = 0;
    if (taxableIncome <= 24000) {
      payeRaw = taxableIncome * 0.1;
    } else if (taxableIncome <= 32333) {
      payeRaw = (24000 * 0.1) + ((taxableIncome - 24000) * 0.25);
    } else if (taxableIncome <= 500000) {
      payeRaw = (24000 * 0.1) + (8333 * 0.25) + ((taxableIncome - 32333) * 0.3);
    } else if (taxableIncome <= 800000) {
      payeRaw = (24000 * 0.1) + (8333 * 0.25) + (467667 * 0.3) + ((taxableIncome - 500000) * 0.325);
    } else {
      payeRaw = (24000 * 0.1) + (8333 * 0.25) + (467667 * 0.3) + (300000 * 0.325) + ((taxableIncome - 800000) * 0.35);
    }

    const personalRelief = 2400;
    const paye = Math.max(0, payeRaw - personalRelief);
    const housingLevy = gross * 0.015;
    const shif = gross * 0.0275;

    const totalDeductions = paye + nssf + housingLevy + shif;
    const netPay = gross - totalDeductions;

    setCalcResult({
      gross,
      nssf,
      paye,
      housingLevy,
      shif,
      totalDeductions,
      netPay
    });
    toast.success("Deductions calculated successfully!");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
            <DollarSign className="w-7 h-7 text-[#FD5D28]" />
            Salary Intelligence
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Benchmarks, Kenya PAYE deductions calculator, and interactive negotiation prep cards.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Benchmarks List - Cardless */}
        <div className="lg:col-span-1 space-y-6 text-left border-r border-slate-200/20 dark:border-border/5 pr-4">
          <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Briefcase className="w-4.5 h-4.5 text-primary" />
              Industry Benchmarks
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Average ranges (2026 data)</p>
          </div>

          <div className="space-y-4">
            {BENCHMARKS.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs border-b border-slate-200/20 dark:border-border/5 pb-3 last:border-0 last:pb-0">
                <span className="font-bold text-foreground block">{item.role}</span>
                <div className="flex items-center justify-between text-muted-foreground/80 font-semibold mt-1">
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" /> Nairobi: {item.nairobiRange}</span>
                  <span>Remote: {item.remoteRange}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Negotiator helper - Cardless outline */}
          <div className="pt-6 border-t border-slate-200/30 dark:border-border/5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Negotiation Speaking Guide</h3>
            <div className="space-y-4 text-xs">
              {[
                { label: "State target first:", val: `"Based on market benchmarks for similar roles in Nairobi, I am targeting a base of KSH ${parseInt(targetSalary || "0").toLocaleString()}..."` },
                { label: "Handle lowball offer:", val: `"Thank you for this offer. KSH ${parseInt(reserveSalary).toLocaleString()} is a bit below my target. Can we bridge this gap through remote allowance or extra leave?"` }
              ].map((talk, i) => (
                <div key={i} className="space-y-1.5">
                  <span className="font-bold text-slate-400 block uppercase text-[9px]">{talk.label}</span>
                  <p className="text-foreground leading-relaxed font-semibold italic bg-slate-100/60 dark:bg-slate-900/35 p-3 rounded-xl">
                    {talk.val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Kenya PAYE Calculator & Negotiation planner - Cardless */}
        <div className="lg:col-span-2 space-y-8 text-left">
          {/* Tax Calculator */}
          <div className="space-y-4">
            <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-4.5 h-4.5 text-primary" />
                Kenya PAYE Tax Calculator
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Computes PAYE, Housing Levy, NSSF, and SHIF health contributions.</p>
            </div>

            <div className="flex gap-3 max-w-sm items-end">
              <div className="space-y-1 flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Monthly Salary (KSH)</label>
                <Input
                  type="number"
                  value={grossInput}
                  onChange={(e) => setGrossInput(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-xl text-xs sm:text-sm"
                />
              </div>
              <Button
                onClick={calculateKenyaTax}
                className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-extrabold text-xs sm:text-sm h-9.5 px-5 rounded-xl shadow-sm"
              >
                Calculate Deductions
              </Button>
            </div>

            {calcResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                {/* Detailed list of deductions */}
                <div className="space-y-2.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deductions Summary</span>
                  <div className="space-y-2 border border-slate-200/40 dark:border-border/10 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/10">
                    {[
                      { label: "PAYE Tax (Income Tax)", val: calcResult.paye },
                      { label: "NSSF Pension Contribution", val: calcResult.nssf },
                      { label: "Housing Levy (1.5%)", val: calcResult.housingLevy },
                      { label: "SHIF Health Contribution (2.75%)", val: calcResult.shif },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between font-semibold">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="text-foreground font-black">Ksh {Math.round(item.val).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t border-slate-200/50 dark:border-border/5 pt-2 text-[#FD5D28]">
                      <span>Total Deductions</span>
                      <span>Ksh {Math.round(calcResult.totalDeductions).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Big take home pay banner */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/20 dark:to-teal-950/5 border border-emerald-500/10 rounded-2xl p-5 flex flex-col justify-center items-center text-center space-y-1 shadow-sm">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-1" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Net Monthly Take-Home Pay</span>
                  <div className="text-2xl sm:text-3xl font-black text-foreground">
                    Ksh {Math.round(calcResult.netPay).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground pt-1.5 border-t border-emerald-500/10 mt-2.5 w-full font-semibold">
                    Approx. {Math.round((calcResult.netPay / calcResult.gross) * 100)}% of your gross salary.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Negotiation Planner */}
          <div className="space-y-4 pt-6 border-t border-slate-200/30 dark:border-border/5">
            <div className="flex items-center justify-between border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Negotiation Worksheet</h3>
              <Button
                onClick={saveWorksheet}
                disabled={updateMinimumSalaryMutation.isPending}
                className="bg-[#FD5D28]/10 text-[#FD5D28] hover:bg-[#FD5D28]/15 font-bold text-[10px] px-3.5 py-1.5 h-auto rounded-lg border border-[#FD5D28]/10"
              >
                {updateMinimumSalaryMutation.isPending ? "Saving..." : "Save Worksheet"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Salary (Ksh/month)</label>
                <Input
                  value={targetSalary}
                  onChange={(e) => setTargetSalary(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-xl text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reserve Salary (Minimum acceptable)</label>
                <Input
                  value={reserveSalary}
                  onChange={(e) => setReserveSalary(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non-Monetary Perks to Trade</label>
              <Input
                value={perks}
                onChange={(e) => setPerks(e.target.value)}
                className="bg-background/50 border-border/50 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      <LearnMoreSlider
        pageId="salary"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
