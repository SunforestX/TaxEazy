import api from './api';
import { EvidenceFile, PaginatedEvidenceResponse, LinkedType } from '@/types/evidence';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Upload an evidence file
 * @param file - The file to upload
 * @param linkedType - Type of entity this evidence is linked to
 * @param linkedId - UUID of the linked entity
 * @param description - Optional description
 * @param tags - Optional comma-separated tags
 * @returns The created evidence file
 */
export async function uploadEvidence(
  file: File,
  linkedType: LinkedType,
  linkedId: string,
  description?: string,
  tags?: string
): Promise<EvidenceFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('linked_type', linkedType);
  formData.append('linked_id', linkedId);
  if (description) {
    formData.append('description', description);
  }
  if (tags) {
    formData.append('tags', tags);
  }

  const response = await api.post<EvidenceFile>('/evidence/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Get a list of evidence files with optional filters
 * @param linkedType - Optional filter by linked entity type
 * @param linkedId - Optional filter by linked entity ID
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @returns Paginated list of evidence files
 */
export async function getEvidenceList(
  linkedType?: LinkedType,
  linkedId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedEvidenceResponse> {
  const params = new URLSearchParams();
  if (linkedType) {
    params.append('linked_type', linkedType);
  }
  if (linkedId) {
    params.append('linked_id', linkedId);
  }
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());

  const response = await api.get<PaginatedEvidenceResponse>(`/evidence/?${params.toString()}`);
  return response.data;
}

/**
 * Get a single evidence file by ID
 * @param id - The evidence file ID
 * @returns The evidence file metadata
 */
export async function getEvidence(id: string): Promise<EvidenceFile> {
  const response = await api.get<EvidenceFile>(`/evidence/${id}`);
  return response.data;
}

/**
 * Download an evidence file
 * @param id - The evidence file ID
 * @returns Blob of the file content
 */
export async function downloadEvidence(id: string): Promise<Blob> {
  const response = await api.get(`/evidence/${id}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Delete an evidence file (admin only)
 * @param id - The evidence file ID
 */
export async function deleteEvidence(id: string): Promise<void> {
  await api.delete(`/evidence/${id}`);
}

/**
 * Trigger a file download in the browser
 * @param blob - The file blob
 * @param filename - The filename to save as
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
