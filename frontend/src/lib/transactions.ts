import api from './api';
import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  TransactionFilter,
  PaginatedTransactions,
  TransactionSummary,
  BulkClassifyRequest,
  CsvImportResult,
} from '@/types/transaction';

export interface GetTransactionsParams extends TransactionFilter {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const transactions = {
  /**
   * Get paginated list of transactions with optional filters
   */
  async getTransactions(params: GetTransactionsParams = {}): Promise<PaginatedTransactions> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'date',
      sortOrder = 'desc',
      ...filters
    } = params;

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());
    queryParams.append('sort_by', sortBy);
    queryParams.append('sort_order', sortOrder);

    // Add filters
    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.gst_treatment) queryParams.append('gst_treatment', filters.gst_treatment);
    if (filters.rd_relevance) queryParams.append('rd_relevance', filters.rd_relevance);
    if (filters.supplier_id) queryParams.append('supplier_id', filters.supplier_id);
    if (filters.has_project !== undefined) queryParams.append('has_project', filters.has_project.toString());
    if (filters.min_amount) queryParams.append('min_amount', filters.min_amount);
    if (filters.max_amount) queryParams.append('max_amount', filters.max_amount);
    if (filters.search) queryParams.append('search', filters.search);

    const response = await api.get<PaginatedTransactions>(`/transactions?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get transaction summary/aggregations with filters
   */
  async getTransactionSummary(filters: TransactionFilter = {}): Promise<TransactionSummary> {
    const queryParams = new URLSearchParams();

    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.gst_treatment) queryParams.append('gst_treatment', filters.gst_treatment);
    if (filters.rd_relevance) queryParams.append('rd_relevance', filters.rd_relevance);
    if (filters.supplier_id) queryParams.append('supplier_id', filters.supplier_id);
    if (filters.has_project !== undefined) queryParams.append('has_project', filters.has_project.toString());
    if (filters.min_amount) queryParams.append('min_amount', filters.min_amount);
    if (filters.max_amount) queryParams.append('max_amount', filters.max_amount);
    if (filters.search) queryParams.append('search', filters.search);

    const response = await api.get<TransactionSummary>(`/transactions/summary?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get a single transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction> {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  /**
   * Create a new transaction (admin only)
   */
  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },

  /**
   * Update an existing transaction (admin only)
   */
  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    const response = await api.patch<Transaction>(`/transactions/${id}`, data);
    return response.data;
  },

  /**
   * Delete a transaction (admin only)
   */
  async deleteTransaction(id: string): Promise<{ message: string; id: string }> {
    const response = await api.delete<{ message: string; id: string }>(`/transactions/${id}`);
    return response.data;
  },

  /**
   * Bulk classify multiple transactions (admin only)
   */
  async bulkClassify(data: BulkClassifyRequest): Promise<{ message: string }> {
    const response = await api.patch<{ message: string }>('/transactions/bulk-classify', data);
    return response.data;
  },

  /**
   * Import transactions from CSV file (admin only)
   */
  async importTransactionsCsv(file: File): Promise<CsvImportResult> {
    const formData = new FormData();
    formData.append('csv_file', file);

    const response = await api.post<CsvImportResult>('/transactions/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Allocate transaction to project (admin only)
   */
  async allocateToProject(
    transactionId: string,
    projectId: string,
    percentage: string
  ): Promise<{ message: string; id: string }> {
    const response = await api.post<{ message: string; id: string }>(
      `/transactions/${transactionId}/allocate`,
      {
        project_id: projectId,
        percentage,
      }
    );
    return response.data;
  },
};

export default transactions;

// Format helpers
export function formatCurrency(amount: string | number | null): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPercentage(value: string | number | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}

export function parseCurrencyInput(value: string): string {
  // Remove currency symbols and commas
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';
  return num.toFixed(2);
}
