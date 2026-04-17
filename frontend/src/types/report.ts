export interface GstSummary {
  collected: number;
  paid: number;
  net: number;
}

export interface PaygSummary {
  total_gross: number;
  total_payg: number;
  total_super: number;
  employee_count: number;
}

export interface RdSpendByProject {
  project_name: string;
  amount: number;
}

export interface UnresolvedException {
  type: string;
  count: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  gst_summary: GstSummary;
  payg_summary: PaygSummary;
  total_operating_spend: number;
  rd_eligible_spend: number;
  rd_spend_by_project: RdSpendByProject[];
  outstanding_issues_count: number;
  missing_evidence_count: number;
  unresolved_exceptions: UnresolvedException[];
}

export interface RdProjectSpend {
  project_id: string;
  project_name: string;
  spend: number;
  percentage: number;
}

export interface RdSummary {
  financial_year: string;
  total_rd_spend: number;
  by_project: RdProjectSpend[];
  by_category: Record<string, number>;
}

export interface BasStatusInfo {
  current_period: string | null;
  status: string;
}

export interface PaygStatusInfo {
  current_month: string | null;
  status: string;
}

export interface ComplianceStatus {
  bas_status: BasStatusInfo;
  payg_status: PaygStatusInfo;
  evidence_gaps_count: number;
  unresolved_exceptions_count: number;
  overall_status: 'good' | 'warning' | 'critical';
}
