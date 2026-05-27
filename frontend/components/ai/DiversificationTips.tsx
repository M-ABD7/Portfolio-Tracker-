"use client";

import { CheckCircle, Lightbulb } from "lucide-react";
import type { DiversificationTip } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DiversificationTipsProps {
  tips: DiversificationTip[];
}

export function DiversificationTips({ tips }: DiversificationTipsProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Diversification Tips
      </h3>
      <div className="space-y-3">
        {tips.map((tip, index) => {
          const isSuccess = tip.type === "success";
          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg",
                isSuccess
                  ? "bg-accent-success/10 border border-accent-success/20"
                  : "bg-accent-warning/10 border border-accent-warning/20"
              )}
            >
              {isSuccess ? (
                <CheckCircle className="w-5 h-5 text-accent-success flex-shrink-0 mt-0.5" />
              ) : (
                <Lightbulb className="w-5 h-5 text-accent-warning flex-shrink-0 mt-0.5" />
              )}
              <p
                className={cn(
                  "text-sm",
                  isSuccess ? "text-accent-success" : "text-accent-warning"
                )}
              >
                {tip.message}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

