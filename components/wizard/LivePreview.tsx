"use client";

import { Eye } from "lucide-react";

interface PreviewItem {
  label: string;
  value: string | null;
}

interface LivePreviewProps {
  title: string;
  items: PreviewItem[];
}

export default function LivePreview({ title, items }: LivePreviewProps) {
  const completedCount = items.filter((i) => i.value).length;

  return (
    <div className="glass-card rounded-2xl p-6 sticky top-24">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-text-muted mb-0.5">{item.label}</p>
            <p
              className={`text-sm font-medium ${
                item.value ? "text-foreground" : "text-white/20"
              }`}
            >
              {item.value || "Not selected"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Progress</span>
          <span className="text-accent font-medium">
            {completedCount}/{items.length}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
