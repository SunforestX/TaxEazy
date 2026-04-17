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

export interface Supplier {
  id: string;
  name: string;
  abn: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  gst_registered: boolean;
  default_gst_treatment: GstTreatment | null;
  default_category: Category | null;
  is_rd_supplier: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  name: string;
  abn?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst_registered?: boolean;
  default_gst_treatment?: GstTreatment | null;
  default_category?: Category | null;
  is_rd_supplier?: boolean;
  notes?: string | null;
  is_active?: boolean;
}

export interface SupplierUpdate {
  name?: string;
  abn?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst_registered?: boolean;
  default_gst_treatment?: GstTreatment | null;
  default_category?: Category | null;
  is_rd_supplier?: boolean;
  notes?: string | null;
  is_active?: boolean;
}

export interface PaginatedSuppliers {
  items: Supplier[];
  total: number;
  page: number;
  page_size: number;
}

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
