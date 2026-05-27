"use client";

import { ProgressBar } from "@/components/ui";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-foreground-muted">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-foreground-muted">{percentage}%</span>
      </div>
      <ProgressBar value={currentStep} max={totalSteps} />
    </div>
  );
}

