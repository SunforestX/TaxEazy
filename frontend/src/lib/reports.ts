import api from './api';
import type { MonthlyReport, RdSummary, ComplianceStatus } from '@/types/report';

export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const response = await api.get('/reports/monthly', {
    params: { year, month }
  });
  return response.data;
}

export async function exportMonthlyReport(year: number, month: number): Promise<Blob> {
  const response = await api.get('/reports/monthly/export', {
    params: { year, month },
    responseType: 'blob'
  });
  return response.data;
}

export async function getRdSummary(financialYearStart?: string): Promise<RdSummary> {
  const params: Record<string, string> = {};
  if (financialYearStart) {
    params.financial_year_start = financialYearStart;
  }
  const response = await api.get('/reports/rd-summary', { params });
  return response.data;
}

export async function getComplianceStatus(): Promise<ComplianceStatus> {
  const response = await api.get('/reports/compliance-status');
  return response.data;
}

export function downloadCsv(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
