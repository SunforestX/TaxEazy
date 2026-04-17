// Enums matching backend
export type ExceptionType =
  | 'missing_gst'
  | 'uncategorized'
  | 'unlinked_rd_spend'
  | 'missing_evidence'
  | 'missing_payroll_allocation'
  | 'high_value_no_project';

export type Severity = 'low' | 'medium' | 'high';

export type EntityType = 'transaction' | 'payroll_item' | 'project';

// Main Exception interface
export interface Exception {
  id: string;
  exception_type: ExceptionType;
  severity: Severity;
  entity_type: EntityType;
  entity_id: string;
  message: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// Exception Summary
export interface ExceptionSummary {
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  unresolved_count: number;
}

// Rule Definition
export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  exception_type: string;
  severity: string;
  entity_type: string;
}

// Rules Run Summary
export interface RulesRunSummary {
  results: Record<string, number>;
  total_new_exceptions: number;
}

// Filter interface
export interface ExceptionFilter {
  exception_type?: ExceptionType;
  severity?: Severity;
  is_resolved?: boolean;
}

// Resolve request
export interface ExceptionResolveRequest {
  notes: string;
}

// Paginated response
export interface PaginatedExceptions {
  items: Exception[];
  total: number;
  page: number;
  page_size: number;
}

// Display options for enums
export const EXCEPTION_TYPE_OPTIONS: { value: ExceptionType; label: string }[] = [
  { value: 'missing_gst', label: 'Missing GST' },
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'unlinked_rd_spend', label: 'Unlinked R&D Spend' },
  { value: 'missing_evidence', label: 'Missing Evidence' },
  { value: 'missing_payroll_allocation', label: 'Missing Payroll Allocation' },
  { value: 'high_value_no_project', label: 'High Value No Project' },
];

export const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-700' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'payroll_item', label: 'Payroll Item' },
  { value: 'project', label: 'Project' },
];

// Helper functions for display
export function getExceptionTypeLabel(type: ExceptionType | null): string {
  if (!type) return '-';
  const option = EXCEPTION_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.label || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getSeverityLabel(severity: Severity | null): string {
  if (!severity) return '-';
  const option = SEVERITY_OPTIONS.find(opt => opt.value === severity);
  return option?.label || severity;
}

export function getSeverityColor(severity: Severity | null): string {
  if (!severity) return 'bg-slate-100 text-slate-600';
  const option = SEVERITY_OPTIONS.find(opt => opt.value === severity);
  return option?.color || 'bg-slate-100 text-slate-600';
}

export function getEntityTypeLabel(entityType: EntityType | null): string {
  if (!entityType) return '-';
  const option = ENTITY_TYPE_OPTIONS.find(opt => opt.value === entityType);
  return option?.label || entityType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
