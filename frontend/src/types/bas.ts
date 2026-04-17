// BAS Period Status
export type BasStatus = 'draft' | 'finalised';

// BAS Period interfaces
export interface BasPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: BasStatus;
  gst_collected: string;
  gst_paid: string;
  net_gst: string;
  total_sales: string;
  total_purchases: string;
  created_at: string;
  updated_at?: string;
  finalised_at?: string;
}

// BAS Summary
export interface BasSummary {
  gst_collected: string;
  gst_paid: string;
  net_gst: string;
  total_sales: string;
  total_purchases: string;
  transaction_count: number;
  unresolved_count: number;
}

// BAS Transaction Item (for drill-down view)
export interface BasTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  gst_amount: string | null;
  gst_treatment: string | null;
  category: string | null;
  supplier_name: string | null;
  reference: string | null;
}

// Create/Update interfaces
export interface BasPeriodCreate {
  start_date: string;
  end_date: string;
}

// Paginated response
export interface PaginatedBasPeriods {
  items: BasPeriod[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginatedBasTransactions {
  items: BasTransaction[];
  total: number;
  page: number;
  page_size: number;
}

// Period detail with summary
export interface BasPeriodDetail extends BasPeriod {
  summary: BasSummary;
}

// Export data
export interface BasExportData {
  period_id: string;
  period_start: string;
  period_end: string;
  status: string;
  generated_at: string;
  summary: BasSummary;
  gst_collected: string;
  gst_paid: string;
  net_gst: string;
  total_sales: string;
  total_purchases: string;
}

// Finalize response
export interface BasFinalizeResponse {
  message: string;
  period_id: string;
  status: BasStatus;
  finalised_at: string;
}

// Display options for status
export const BAS_STATUS_OPTIONS: { value: BasStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'finalised', label: 'Finalised', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

// Helper functions for display
export function getBasStatusLabel(status: BasStatus): string {
  const option = BAS_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
}

export function getBasStatusColor(status: BasStatus): string {
  const option = BAS_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.color || 'bg-slate-100 text-slate-600 border-slate-200';
}

// Format helpers
export function formatCurrency(amount: string | number | null): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num);
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

export function formatPeriodRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
