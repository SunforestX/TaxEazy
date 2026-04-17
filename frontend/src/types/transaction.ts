// Enums matching backend
export type Category =
  | 'Equipment'
  | 'Consumables'
  | 'Services'
  | 'CRO_Contract'
  | 'Salaries'
  | 'Overheads'
  | 'Travel'
  | 'Other';

export type GstTreatment =
  | 'CAP'  // Capital
  | 'EXP'  // Expense
  | 'FRE'  // GST Free
  | 'INP'  // Input Taxed
  | 'NTR'  // Not Reported
  | 'MIX'; // Mixed

export type RdRelevance =
  | 'yes'
  | 'partial'
  | 'no';

// Transaction Allocation
export interface TransactionAllocation {
  id: string;
  project_id: string;
  project_name?: string;
  percentage: string;
  amount: string;
}

// Main Transaction interface
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  gst_amount: string | null;
  account_code: string | null;
  reference: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  category: Category | null;
  gst_treatment: GstTreatment | null;
  rd_relevance: RdRelevance;
  notes: string | null;
  is_reconciled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  allocations: TransactionAllocation[];
}

// Create/Update interfaces
export interface TransactionCreate {
  date: string;
  description: string;
  amount: string;
  gst_amount?: string | null;
  account_code?: string | null;
  reference?: string | null;
  supplier_id?: string | null;
  category?: Category | null;
  gst_treatment?: GstTreatment | null;
  rd_relevance?: RdRelevance;
  notes?: string | null;
}

export interface TransactionUpdate {
  date?: string;
  description?: string;
  amount?: string;
  gst_amount?: string | null;
  account_code?: string | null;
  reference?: string | null;
  supplier_id?: string | null;
  category?: Category | null;
  gst_treatment?: GstTreatment | null;
  rd_relevance?: RdRelevance;
  notes?: string | null;
  project_id?: string | null;
  allocation_percentage?: string;
}

// Filter interface
export interface TransactionFilter {
  date_from?: string;
  date_to?: string;
  category?: Category;
  gst_treatment?: GstTreatment;
  rd_relevance?: RdRelevance;
  supplier_id?: string;
  has_project?: boolean;
  min_amount?: string;
  max_amount?: string;
  search?: string;
}

// Paginated response
export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

// Summary response
export interface TransactionSummary {
  total_count: number;
  total_amount: string;
  total_gst_amount: string;
  rd_eligible_amount: string;
  by_category: Record<string, string>;
  by_gst_treatment: Record<string, string>;
  by_rd_relevance: Record<string, string>;
}

// Bulk classify request
export interface BulkClassifyRequest {
  transaction_ids: string[];
  category?: Category;
  gst_treatment?: GstTreatment;
  rd_relevance?: RdRelevance;
  project_id?: string;
}

// CSV Import result
export interface CsvRowError {
  row_number: number;
  error: string;
}

export interface CsvImportResult {
  imported_count: number;
  error_count: number;
  errors: CsvRowError[];
}

// Project allocation request
export interface ProjectAllocationRequest {
  project_id: string;
  percentage: string;
}

// Display options for enums
export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Consumables', label: 'Consumables' },
  { value: 'Services', label: 'Services' },
  { value: 'CRO_Contract', label: 'CRO Contract' },
  { value: 'Salaries', label: 'Salaries' },
  { value: 'Overheads', label: 'Overheads' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Other', label: 'Other' },
];

export const GST_TREATMENT_OPTIONS: { value: GstTreatment; label: string }[] = [
  { value: 'CAP', label: 'CAP - Capital' },
  { value: 'EXP', label: 'EXP - Expense' },
  { value: 'FRE', label: 'FRE - GST Free' },
  { value: 'INP', label: 'INP - Input Taxed' },
  { value: 'NTR', label: 'NTR - Not Reported' },
  { value: 'MIX', label: 'MIX - Mixed' },
];

export const RD_RELEVANCE_OPTIONS: { value: RdRelevance; label: string; color: string }[] = [
  { value: 'yes', label: 'Yes - R&D Eligible', color: 'bg-green-100 text-green-700' },
  { value: 'partial', label: 'Partial - R&D Eligible', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'no', label: 'No - Not R&D', color: 'bg-slate-100 text-slate-600' },
];

// Helper functions for display
export function getCategoryLabel(category: Category | null): string {
  if (!category) return '-';
  const option = CATEGORY_OPTIONS.find(opt => opt.value === category);
  return option?.label || category.replace('_', ' ');
}

export function getGstTreatmentLabel(gstTreatment: GstTreatment | null): string {
  if (!gstTreatment) return '-';
  const option = GST_TREATMENT_OPTIONS.find(opt => opt.value === gstTreatment);
  return option?.label || gstTreatment;
}

export function getRdRelevanceLabel(rdRelevance: RdRelevance): string {
  const option = RD_RELEVANCE_OPTIONS.find(opt => opt.value === rdRelevance);
  return option?.label || rdRelevance;
}

export function getRdRelevanceColor(rdRelevance: RdRelevance): string {
  const option = RD_RELEVANCE_OPTIONS.find(opt => opt.value === rdRelevance);
  return option?.color || 'bg-slate-100 text-slate-600';
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

export function formatPercentage(value: string | number | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}
