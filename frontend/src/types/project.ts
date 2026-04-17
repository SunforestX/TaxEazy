export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListItem extends Project {
  activities_count: number;
  total_spend: number;
  evidence_completeness: number;
}

export interface ProjectDetail extends Project {
  scientific_rationale?: string;
  eligibility_notes?: string;
  activities_count: number;
  total_spend: number;
  evidence_status: EvidenceStatus;
}

export interface ProjectCreate {
  code: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  scientific_rationale?: string;
  eligibility_notes?: string;
  eligibility_rationale?: string;
  notes?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  scientific_rationale?: string;
  eligibility_notes?: string;
  eligibility_rationale?: string;
  notes?: string;
}

export interface RdActivity {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  activity_date: string;
  hours?: number;
  personnel?: string;
  methodology?: string;
  results?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RdActivityCreate {
  title: string;
  description?: string;
  activity_date: string;
  hours?: number;
  personnel?: string;
  methodology?: string;
  results?: string;
  notes?: string;
}

export interface RdActivityUpdate {
  title?: string;
  description?: string;
  activity_date?: string;
  hours?: number;
  personnel?: string;
  methodology?: string;
  results?: string;
  notes?: string;
}

export interface SpendSummary {
  project_id: string;
  categories: {
    salaries: number;
    cro_contractor: number;
    consumables: number;
    equipment: number;
    other: number;
  };
  total: number;
}

export interface EvidenceStatus {
  project_id: string;
  has_activities: boolean;
  activities_count: number;
  has_transactions: boolean;
  transactions_count: number;
  has_evidence_files: boolean;
  evidence_files_count: number;
  completeness_percentage: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
