"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: "pills" | "underline";
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  className,
  variant = "underline",
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  if (variant === "pills") {
    return (
      <div className={cn("flex gap-2", className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-accent-primary text-background"
                : "bg-background-card text-foreground-muted hover:text-foreground border border-border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-6 border-b border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative",
            activeTab === tab.id
              ? "text-accent-primary"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

