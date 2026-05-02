import api from './api';

export interface XeroStatus {
  connected: boolean;
  provider: string;
  status: string;
  last_sync_at: string | null;
  error_message: string | null;
  tenant_name: string | null;
}

export interface XeroAuthUrl {
  auth_url: string;
  provider: string;
}

export interface SyncResult {
  success: boolean;
  items_synced: number;
  errors: string[];
  sync_type: string;
  synced_at: string;
  details: Record<string, any> | null;
}

export const integrations = {
  /** Get Xero OAuth2 authorization URL */
  getXeroAuthUrl: () => api.get<XeroAuthUrl>('/integrations/xero/auth-url'),

  /** Get current Xero connection status */
  getXeroStatus: () => api.get<XeroStatus>('/integrations/xero/status'),

  /** Disconnect Xero integration */
  disconnectXero: () => api.post<{ message: string }>('/integrations/xero/disconnect'),

  /** Trigger sync by type: contacts | invoices | transactions | all */
  sync: (syncType: string, sinceDate?: string) =>
    api.post<SyncResult>('/integrations/xero/sync', {
      sync_type: syncType,
      since_date: sinceDate ?? null,
    }),

  /** Push R&D categorization back to Xero */
  pushRdCategorization: () => api.post<Record<string, any>>('/integrations/xero/push-rd'),
};
