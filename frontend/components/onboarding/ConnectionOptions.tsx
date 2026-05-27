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

const options: ConnectionOption[] = [
  {
    id: "api",
    title: "Connect via API Key",
    description: "Securely link your exchange.",
    icon: <Key className="w-6 h-6" />,
  },
  {
    id: "csv",
    title: "Upload CSV File",
    description: "Import transaction history.",
    icon: <FileUp className="w-6 h-6" />,
  },
  {
    id: "manual",
    title: "Add Manual Assets",
    description: "Manually add your assets.",
    icon: <PlusCircle className="w-6 h-6" />,
  },
];

interface ConnectionOptionsProps {
  selected: string | null;
  onSelect: (id: string) => void;
}

export function ConnectionOptions({ selected, onSelect }: ConnectionOptionsProps) {
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
              <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
                {option.icon}
              </div>
              <div>
                <p className="font-medium text-foreground">{option.title}</p>
                <p className="text-sm text-foreground-muted mt-1">
                  {option.description}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-foreground-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

