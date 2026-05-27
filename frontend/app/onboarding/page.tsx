"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  StepProgress,
  ConnectionOptions,
  ExchangeGrid,
} from "@/components/onboarding";
import { ApiKeyForm, ApiKeySuccess } from "@/components/onboarding/ApiKeyForm";
import type { ConnectExchangeResponse } from "@/lib/types";

type Step = "method" | "exchange" | "apikey" | "success";

const SUPPORTED_API_EXCHANGES = new Set(["binance", "okx"]);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("method");
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  // When connecting via API, only one exchange at a time
  const [activeExchange, setActiveExchange] = useState<string>("");
  const [successResult, setSuccessResult] = useState<ConnectExchangeResponse | null>(null);

  const handleExchangeToggle = (id: string) => {
    setSelectedExchanges((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleProceed = () => {
    if (selectedConnection === "api") {
      // Pick the first supported exchange the user selected
      const supported = selectedExchanges.find((e) => SUPPORTED_API_EXCHANGES.has(e));
      if (supported) {
        setActiveExchange(supported);
        setStep("apikey");
        return;
      }
    }
    // manual / csv → go straight to dashboard
    router.push("/dashboard");
  };

  const currentStepNumber =
    step === "method" || step === "exchange" ? 1
    : step === "apikey" ? 2
    : 3;

  const canProceed = selectedConnection !== null && selectedExchanges.length > 0;

  if (step === "apikey") {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Connect Your Exchange</h1>
          <p className="text-foreground-muted mt-1">Securely link your account via a read-only API key</p>
        </div>
        <StepProgress currentStep={2} totalSteps={3} />
        <ApiKeyForm
          exchange={activeExchange}
          onSuccess={(result) => {
            setSuccessResult(result);
            setStep("success");
          }}
          onCancel={() => setStep("method")}
        />
      </div>
    );
  }

  if (step === "success" && successResult) {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Set!</h1>
          <p className="text-foreground-muted mt-1">Your exchange is connected and your portfolio is synced.</p>
        </div>
        <StepProgress currentStep={3} totalSteps={3} />
        <ApiKeySuccess result={successResult} onDone={() => router.push("/dashboard")} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Crypto/Forex/Commodity Portfolio Tracker
        </h1>
        <p className="text-foreground-muted mt-1">Connect Your Accounts</p>
      </div>

      {/* Progress */}
      <StepProgress currentStep={currentStepNumber} totalSteps={3} />

      {/* Connection Options */}
      <div className="space-y-6">
        <ConnectionOptions
          selected={selectedConnection}
          onSelect={setSelectedConnection}
        />

        {/* Exchange Grid */}
        <ExchangeGrid
          selected={selectedExchanges}
          onToggle={handleExchangeToggle}
        />

        {/* Note when a non-API exchange is selected with API mode */}
        {selectedConnection === "api" &&
          selectedExchanges.length > 0 &&
          !selectedExchanges.some((e) => SUPPORTED_API_EXCHANGES.has(e)) && (
          <p className="text-sm text-amber-400">
            MetaTrader, MEXC, and Kraken API connections are coming soon.
            Select Binance or OKX for automatic sync, or choose manual entry.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <Button
          variant="primary"
          size="lg"
          disabled={!canProceed}
          className={!canProceed ? "opacity-50 cursor-not-allowed" : ""}
          onClick={handleProceed}
        >
          {selectedConnection === "api" &&
          selectedExchanges.some((e) => SUPPORTED_API_EXCHANGES.has(e))
            ? "Connect Exchange"
            : "Proceed to Dashboard"}
        </Button>
      </div>
    </div>
  );
}
