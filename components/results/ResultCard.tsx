"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface ResultCardProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export default function ResultCard({
  title,
  icon: Icon,
  iconColor = "text-accent",
  children,
  className = "",
  index = 0,
}: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className={`bg-card-bg rounded-xl border border-card-border shadow-sm p-6 ${className}`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <h3 className="text-sm font-semibold text-text-dark">{title}</h3>
      </div>
      <div className="text-sm text-slate-600">{children}</div>
    </motion.div>
  );
}
