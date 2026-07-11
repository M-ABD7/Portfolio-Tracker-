"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/components/ui";
import {
  StepProgress,
  ConnectionOptions,
  ExchangeGrid,
} from "@/components/onboarding";
import { ApiKeyForm, ApiKeySuccess } from "@/components/onboarding/ApiKeyForm";
import { uploadBinanceCsv } from "@/lib/api";
import type { ConnectExchangeResponse, CsvImportResponse } from "@/lib/types";
import { FileUp, AlertTriangle, CheckCircle } from "lucide-react";

type Step = "exchange" | "method" | "apikey" | "csv" | "csv-success" | "success";

const API_EXCHANGES = new Set(["okx", "mexc"]);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("exchange");
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [activeExchange, setActiveExchange] = useState<string>("");
  const [successResult, setSuccessResult] = useState<ConnectExchangeResponse | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Which connection methods are available given the selected exchange
  const hasApiExchange = selectedExchange !== null && API_EXCHANGES.has(selectedExchange);
  const availableMethods = [
    ...(hasApiExchange ? ["api"] : []),
    "csv",
    "manual",
  ];

  // Show Binance in the exchange grid only when CSV is a possible choice
  // (always true since csv is always available, so show all 3)
  const currentStepNumber =
    step === "exchange" ? 1
    : step === "method" ? 2
    : step === "apikey" || step === "csv" ? 3
    : 3;

  const handleProceedExchange = () => {
    if (!selectedExchange) return;
    setSelectedConnection(null);
    setStep("method");
  };

  const handleProceedMethod = () => {
    if (!selectedConnection) return;

    if (selectedConnection === "manual") {
      router.push("/add-assets");
      return;
    }

    if (selectedConnection === "api") {
      if (selectedExchange && API_EXCHANGES.has(selectedExchange)) {
        setActiveExchange(selectedExchange);
        setStep("apikey");
      }
      return;
    }

    if (selectedConnection === "csv") {
      setStep("csv");
      return;
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Only .csv files are accepted. Please select a valid CSV file.");
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setCsvFile(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvError(null);
    setCsvUploading(true);
    try {
      const result = await uploadBinanceCsv(csvFile);
      setCsvResult(result);
      setStep("csv-success");
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "CSV import failed. Please try again.");
    } finally {
      setCsvUploading(false);
    }
  };

  if (step === "apikey") {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Connect Your Exchange</h1>
          <p className="text-foreground-muted mt-1">
            Securely link your account via a read-only API key.
          </p>
        </div>
        <StepProgress currentStep={3} totalSteps={3} />
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
          <p className="text-foreground-muted mt-1">
            Your exchange is connected and your portfolio is synced.
          </p>
        </div>
        <StepProgress currentStep={3} totalSteps={3} />
        <ApiKeySuccess result={successResult} onDone={() => router.push("/dashboard")} />
      </div>
    );
  }

  if (step === "csv") {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Upload CSV File</h1>
          <p className="text-foreground-muted mt-1">
            Import your transaction history from a CSV export.
          </p>
        </div>
        <StepProgress currentStep={3} totalSteps={3} />

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Upload your Binance Transaction History export (Wallet &gt; Transaction
                History &gt; Generate all statements). This is different from &quot;Trade
                History&quot;. Required columns: Time, Account, Operation, Coin, Change.
                Only .csv files are accepted.
              </p>
            </div>

            <div>
              <label className="block text-sm text-foreground-muted mb-2">
                Select CSV file
              </label>
              <div
                className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-xl bg-background-secondary cursor-pointer hover:border-accent-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-8 h-8 text-foreground-muted" />
                {csvFile ? (
                  <p className="text-sm font-medium text-accent-primary">{csvFile.name}</p>
                ) : (
                  <p className="text-sm text-foreground-muted">
                    Click to select a .csv file
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />
              </div>
            </div>

            {csvError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {csvError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("method")}
                disabled={csvUploading}
                className="flex-1 py-2 border border-border text-foreground-muted rounded-lg text-sm font-medium hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!csvFile || csvUploading}
                onClick={handleCsvImport}
                className="flex-1 py-2 bg-accent-primary text-background rounded-lg text-sm font-medium hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
              >
                {csvUploading ? "Importing…" : "Import CSV"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "csv-success" && csvResult) {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import Complete</h1>
          <p className="text-foreground-muted mt-1">{csvResult.message}</p>
        </div>
        <StepProgress currentStep={3} totalSteps={3} />

        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {csvResult.assets.length} asset{csvResult.assets.length !== 1 ? "s" : ""} imported
                </h3>
                <p className="text-sm text-foreground-muted">
                  Realized PnL:{" "}
                  <span className={csvResult.realizedPnl >= 0 ? "text-green-400" : "text-red-400"}>
                    {csvResult.realizedPnl >= 0 ? "+" : ""}
                    {csvResult.realizedPnl.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            {csvResult.assets.length > 0 && (
              <div className="space-y-2">
                {csvResult.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 bg-background-secondary border border-border rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
                      <p className="text-xs text-foreground-muted">
                        {asset.quantity} @ avg {asset.avgBuyPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{asset.value.toFixed(2)}</p>
                      <p className={`text-xs ${asset.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {asset.pl >= 0 ? "+" : ""}
                        {asset.pl.toFixed(2)} ({asset.plPercentage.toFixed(2)}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {csvResult.skippedRows.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-300">
                    {csvResult.skippedRows.length} row{csvResult.skippedRows.length !== 1 ? "s" : ""} skipped
                  </p>
                  <ul className="text-xs text-amber-300/80 leading-relaxed list-disc list-inside">
                    {csvResult.skippedRows.slice(0, 5).map((skipped) => (
                      <li key={skipped.row}>
                        Row {skipped.row}: {skipped.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-2 bg-accent-primary text-background rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Crypto/Forex/Commodity Portfolio Tracker
        </h1>
        <p className="text-foreground-muted mt-1">Set up your portfolio</p>
      </div>

      <StepProgress currentStep={currentStepNumber} totalSteps={3} />

      {step === "exchange" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Step 1 — Choose your exchange
            </h2>
            <p className="text-sm text-foreground-muted">
              Select your exchange to get started.
            </p>
          </div>
          <ExchangeGrid
            selected={selectedExchange}
            onSelect={setSelectedExchange}
            showCsvOnly={true}
          />
          <div className="flex justify-end pt-4">
            <Button
              variant="primary"
              size="lg"
              disabled={!selectedExchange}
              className={!selectedExchange ? "opacity-50 cursor-not-allowed" : ""}
              onClick={handleProceedExchange}
            >
              Next — Choose Connection Method
            </Button>
          </div>
        </div>
      )}

      {step === "method" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Step 2 — How would you like to connect?
            </h2>
            <p className="text-sm text-foreground-muted">
              {hasApiExchange
                ? "API key sync is available for OKX and MEXC."
                : "Binance supports CSV import only."}
            </p>
          </div>
          <ConnectionOptions
            selected={selectedConnection}
            onSelect={setSelectedConnection}
            availableMethods={availableMethods}
          />
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep("exchange")}>
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={selectedConnection === null}
              className={selectedConnection === null ? "opacity-50 cursor-not-allowed" : ""}
              onClick={handleProceedMethod}
            >
              {selectedConnection === "api"
                ? "Connect Exchange"
                : selectedConnection === "csv"
                ? "Upload CSV"
                : selectedConnection === "manual"
                ? "Add Assets Manually"
                : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
