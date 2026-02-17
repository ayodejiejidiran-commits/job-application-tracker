import { cn } from "@/lib/utils";
import React from "react";

export function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass p-4", className)}>{children}</div>;
}
