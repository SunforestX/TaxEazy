import api from './api';
import {
  BasPeriod,
  BasPeriodCreate,
  BasPeriodDetail,
  PaginatedBasPeriods,
  PaginatedBasTransactions,
  BasExportData,
  BasFinalizeResponse,
} from '@/types/bas';

/**
 * Get all BAS periods (paginated)
 */
export async function getBasPeriods(
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedBasPeriods> {
  const response = await api.get('/bas/', {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

/**
 * Create a new BAS period (admin only)
 */
export async function createBasPeriod(
  data: BasPeriodCreate
): Promise<BasPeriod> {
  const response = await api.post('/bas/', data);
  return response.data;
}

/**
 * Get a specific BAS period with summary
 */
export async function getBasPeriod(
  periodId: string
): Promise<BasPeriodDetail> {
  const response = await api.get(`/bas/${periodId}`);
  return response.data;
}

/**
 * Get transactions within a BAS period (paginated)
 */
export async function getBasTransactions(
  periodId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedBasTransactions> {
  const response = await api.get(`/bas/${periodId}/transactions`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

/**
 * Get unresolved transactions within a BAS period (paginated)
 */
export async function getBasUnresolved(
  periodId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedBasTransactions> {
  const response = await api.get(`/bas/${periodId}/unresolved`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

/**
 * Finalize a BAS period (admin only)
 */
export async function finalizeBasPeriod(
  periodId: string
): Promise<BasFinalizeResponse> {
  const response = await api.patch(`/bas/${periodId}/finalize`, {
    confirm: true,
  });
  return response.data;
}

/**
 * Export BAS period data as JSON
 */
export async function exportBasPeriod(
  periodId: string
): Promise<BasExportData> {
  const response = await api.get(`/bas/${periodId}/export`);
  return response.data;
}

/**
 * Download BAS period export as a file
 */
export function downloadBasExport(data: BasExportData, filename?: string): void {
  const defaultFilename = `BAS_${data.period_start}_${data.period_end}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
