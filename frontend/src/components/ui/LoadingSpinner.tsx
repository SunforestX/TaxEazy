"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className={cn("animate-spin text-teal-600", sizeClasses[size])} />
      {text && <p className="text-sm text-slate-600">{text}</p>}
    </div>
  );
}

export function LoadingOverlay({
  text = "Loading...",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50",
        className
      )}
    >
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function LoadingPage({
  text = "Loading...",
}: {
  text?: string;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
