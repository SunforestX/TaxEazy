export enum LinkedType {
  TRANSACTION = 'transaction',
  PAYROLL = 'payroll',
  PROJECT = 'project',
  ACTIVITY = 'activity',
}

export interface EvidenceFile {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  file_size: string | null;
  linked_type: LinkedType;
  linked_id: string;
  uploaded_by: string;
  uploaded_at: string;
  description: string | null;
  tags: string[] | null;
}

export interface EvidenceUploadData {
  file: File;
  linked_type: LinkedType;
  linked_id: string;
  description?: string;
  tags?: string[];
}

export interface EvidenceFilter {
  linked_type?: LinkedType;
  linked_id?: string;
}

export interface PaginatedEvidenceResponse {
  items: EvidenceFile[];
  total: number;
  page: number;
  page_size: number;
}
