// Employee Types
export interface Employee {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  is_scientist: boolean;
  is_active: boolean;
  employment_start_date: string | null;
  employment_end_date: string | null;
  annual_salary: number | null;
  notes: string | null;
  default_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  name: string;
  email?: string;
  position?: string;
  is_scientist?: boolean;
  is_active?: boolean;
  employment_start_date?: string;
  employment_end_date?: string;
  annual_salary?: number;
  notes?: string;
}

export interface EmployeeUpdate {
  name?: string;
  email?: string;
  position?: string;
  is_scientist?: boolean;
  is_active?: boolean;
  employment_start_date?: string;
  employment_end_date?: string;
  annual_salary?: number;
  notes?: string;
}

// Project Allocation for Payroll Items
export interface ProjectAllocation {
  project_id: string;
  percentage: number;
}

// Payroll Item Types
export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_wages: string;
  payg_withheld: string;
  super_contribution: string;
  project_allocations: ProjectAllocation[];
  notes: string | null;
}

export interface PayrollItemWithEmployee extends PayrollItem {
  employee_name?: string;
  employee_email?: string;
}

export interface PayrollItemCreate {
  employee_id: string;
  gross_wages: string;
  payg_withheld: string;
  super_amount: string;
  net_pay?: string;
  project_allocations?: ProjectAllocation[];
  notes?: string;
}

export interface PayrollItemUpdate {
  project_allocations?: ProjectAllocation[];
  notes?: string;
}

// Payroll Run Types
export interface PayrollRun {
  id: string;
  pay_date: string;
  period_start: string;
  period_end: string;
  total_gross: string;
  total_payg: string;
  total_super: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  items: PayrollItem[];
}

export interface PayrollRunListItem {
  id: string;
  pay_date: string;
  period_start: string;
  period_end: string;
  total_gross: string;
  total_payg: string;
  total_super: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  item_count: number;
}

export interface PayrollRunCreate {
  pay_date: string;
  period_start: string;
  period_end: string;
  notes?: string;
  items: PayrollItemCreate[];
}

export interface PayrollRunUpdate {
  pay_date?: string;
  period_start?: string;
  period_end?: string;
  notes?: string;
}

// PAYG Summary Types
export interface PaygSummary {
  month: number;
  month_name: string;
  year: number;
  total_gross: string;
  total_payg_withheld: string;
  total_super: string;
  employee_count: number;
}

// CSV Import Types
export interface PayrollImportResult {
  success: boolean;
  run_id: string | null;
  items_created: number;
  errors: string[];
}

// Paginated Response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Filter Types
export interface PayrollRunFilters {
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface EmployeeFilters {
  is_active?: boolean;
  is_scientist?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}
