import api from './api';
import type { Supplier, SupplierCreate, SupplierUpdate, PaginatedSuppliers } from '@/types/supplier';

export interface GetSuppliersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export const suppliers = {
  /**
   * Get paginated list of suppliers with optional search
   */
  async getSuppliers(params: GetSuppliersParams = {}): Promise<PaginatedSuppliers> {
    const { search, page = 1, pageSize = 20 } = params;
    
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());
    
    const response = await api.get<PaginatedSuppliers>(`/suppliers?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get a single supplier by ID
   */
  async getSupplier(id: string): Promise<Supplier> {
    const response = await api.get<Supplier>(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Create a new supplier (admin only)
   */
  async createSupplier(data: SupplierCreate): Promise<Supplier> {
    const response = await api.post<Supplier>('/suppliers', data);
    return response.data;
  },

  /**
   * Update an existing supplier (admin only)
   */
  async updateSupplier(id: string, data: SupplierUpdate): Promise<Supplier> {
    const response = await api.patch<Supplier>(`/suppliers/${id}`, data);
    return response.data;
  },

  /**
   * Soft delete a supplier (admin only)
   */
  async deleteSupplier(id: string): Promise<{ message: string; id: string }> {
    const response = await api.delete<{ message: string; id: string }>(`/suppliers/${id}`);
    return response.data;
  },
};

export default suppliers;
