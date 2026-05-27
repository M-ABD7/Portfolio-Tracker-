"use client";

import { Card, CardContent, ProgressBar } from "@/components/ui";

interface RiskScoreProps {
  score: number; // 0-100
}

export function RiskScore({ score }: RiskScoreProps) {
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: "High Risk", color: "text-accent-danger" };
    if (score >= 40) return { label: "Medium Risk", color: "text-accent-warning" };
    return { label: "Low Risk", color: "text-accent-success" };
  };

  const riskLevel = getRiskLevel(score);

  return (
    <Card>
      <CardContent>
        <p className="text-sm text-foreground-muted mb-3">Portfolio Risk Score</p>
        <ProgressBar value={score} max={100} variant="gradient" />
        <p className={`text-center mt-3 font-semibold ${riskLevel.color}`}>
          {riskLevel.label}
        </p>
      </CardContent>
    </Card>
  );
}

