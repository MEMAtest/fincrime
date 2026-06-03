"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * Floating glass metric card overlaid on the hero 3D scene.
 * Mirrors Nasara's AnimatedComplianceScore, retargeted to FinCrime.
 */
type Metric = { score: number; trend: string; isIncreasing: boolean };

export default function DetectionCoverageCard() {
  const [{ score, trend, isIncreasing }, setMetric] = useState<Metric>({
    score: 98,
    trend: "+5%",
    isIncreasing: true,
  });

  useEffect(() => {
    // Single stable 5s timer; derive the whole metric from the previous score
    // in one atomic update (no nested setters).
    const interval = setInterval(() => {
      setMetric((prev) => {
        const next = Math.floor(Math.random() * 5) + 95; // 95–99%
        const diff = next - prev.score;
        return {
          score: next,
          isIncreasing: diff >= 0,
          trend: `${diff >= 0 ? "+" : ""}${Math.abs(diff)}%`,
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      animate={{ y: [-10, 10, -10] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-8 right-6 sm:right-8 bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-emerald-500/20"
    >
      <div className="text-xs text-slate-400 mb-1">Detection Coverage</div>
      <motion.div
        key={score}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent"
      >
        {score}%
      </motion.div>
      <div
        className={`flex items-center gap-1 mt-2 text-xs ${
          isIncreasing ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {isIncreasing ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>{trend} this quarter</span>
      </div>
    </motion.div>
  );
}
