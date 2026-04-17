"use client";

import { ReactNode } from "react";
import { Inbox, Search, FileX, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: "inbox" | "search" | "file" | "alert" | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const iconMap = {
  inbox: Inbox,
  search: Search,
  file: FileX,
  alert: AlertCircle,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const IconComponent = typeof icon === "string" ? iconMap[icon as keyof typeof iconMap] : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-slate-200 bg-slate-50/50",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        {IconComponent ? (
          <IconComponent className="h-6 w-6 text-slate-400" />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function EmptySearchResults({
  searchTerm,
  onClear,
  className,
}: {
  searchTerm: string;
  onClear: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={`We couldn't find any results for "${searchTerm}". Try adjusting your search terms.`}
      className={className}
      action={
        <button
          onClick={onClear}
          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          Clear search
        </button>
      }
    />
  );
}

export function EmptyTableState({
  title = "No items yet",
  description = "Get started by creating your first item.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon="inbox"
      title={title}
      description={description}
      action={action}
      className={cn("py-12", className)}
    />
  );
}
