import api from './api';
import {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  PayrollRun,
  PayrollRunListItem,
  PayrollRunCreate,
  PayrollItem,
  PayrollItemUpdate,
  PaygSummary,
  PayrollImportResult,
  PaginatedResponse,
  EmployeeFilters,
  PayrollRunFilters
} from '@/types/payroll';

// Employee API Functions

export async function getEmployees(
  filters: EmployeeFilters = {}
): Promise<PaginatedResponse<Employee>> {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());
  if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
  if (filters.is_scientist !== undefined) params.append('is_scientist', filters.is_scientist.toString());
  if (filters.search) params.append('search', filters.search);
  
  const response = await api.get(`/employees/?${params.toString()}`);
  return response.data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const response = await api.get(`/employees/${id}`);
  return response.data;
}

export async function createEmployee(data: EmployeeCreate): Promise<Employee> {
  const response = await api.post('/employees/', data);
  return response.data;
}

export async function updateEmployee(id: string, data: EmployeeUpdate): Promise<Employee> {
  const response = await api.patch(`/employees/${id}`, data);
  return response.data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}

// Payroll Run API Functions

export async function getPayrollRuns(
  filters: PayrollRunFilters = {}
): Promise<PaginatedResponse<PayrollRunListItem>> {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  
  const response = await api.get(`/payroll/?${params.toString()}`);
  return response.data;
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  const response = await api.get(`/payroll/${id}`);
  return response.data;
}

export async function createPayrollRun(data: PayrollRunCreate): Promise<PayrollRun> {
  const response = await api.post('/payroll/', data);
  return response.data;
}

export async function deletePayrollRun(id: string): Promise<void> {
  await api.delete(`/payroll/${id}`);
}

// CSV Import

export async function importPayrollCSV(file: File): Promise<PayrollImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/payroll/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// PAYG Summary

export async function getPaygSummary(year: number): Promise<PaygSummary[]> {
  const response = await api.get(`/payroll/payg-summary?year=${year}`);
  return response.data;
}

// Payroll Item Allocation Update

export async function updateItemAllocation(
  runId: string,
  itemId: string,
  data: PayrollItemUpdate
): Promise<PayrollItem> {
  const response = await api.patch(`/payroll/${runId}/items/${itemId}`, data);
  return response.data;
}

// Helper function to format currency
export function formatCurrency(amount: string | number | null): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num);
}

// Helper function to format date
export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Helper function to format month name
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}
