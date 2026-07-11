"use client";

import { Card, CardContent } from "@/components/ui";
import { Key, FileUp, PlusCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ALL_OPTIONS: ConnectionOption[] = [
  {
    id: "api",
    title: "Connect via API Key",
    description: "Securely link your exchange with a read-only API key.",
    icon: <Key className="w-6 h-6" />,
  },
  {
    id: "csv",
    title: "Upload CSV File",
    description: "Import your transaction history from a CSV export.",
    icon: <FileUp className="w-6 h-6" />,
  },
  {
    id: "manual",
    title: "Add Manual Assets",
    description: "Manually enter your holdings without connecting an exchange.",
    icon: <PlusCircle className="w-6 h-6" />,
  },
];

interface ConnectionOptionsProps {
  selected: string | null;
  onSelect: (id: string) => void;
  availableMethods?: string[];
}

export function ConnectionOptions({
  selected,
  onSelect,
  availableMethods,
}: ConnectionOptionsProps) {
  const options = availableMethods
    ? ALL_OPTIONS.filter((o) => availableMethods.includes(o.id))
    : ALL_OPTIONS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {options.map((option) => (
        <Card
          key={option.id}
          className={cn(
            "cursor-pointer transition-all",
            selected === option.id
              ? "border-accent-primary bg-accent-primary/5"
              : "hover:border-accent-primary/50"
          )}
          onClick={() => onSelect(option.id)}
        >
          <CardContent className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  selected === option.id
                    ? "bg-accent-primary text-background"
                    : "bg-accent-primary/20 text-accent-primary"
                )}
              >
                {option.icon}
              </div>
              <div>
                <p className="font-medium text-foreground">{option.title}</p>
                <p className="text-sm text-foreground-muted mt-1">{option.description}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
