'use client';

import { useEffect, useState, useCallback } from 'react';
import { suppliers } from '@/lib/suppliers';
import { auth } from '@/lib/auth';
import type { Supplier, SupplierCreate, SupplierUpdate, Category, GstTreatment } from '@/types/supplier';
import { CATEGORY_OPTIONS, GST_TREATMENT_OPTIONS } from '@/types/supplier';
import {
  Search,
  Plus,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';

interface SupplierFormData {
  name: string;
  abn: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  address: string;
  gst_registered: boolean;
  default_gst_treatment: string;
  default_category: string;
  is_rd_supplier: boolean;
  notes: string;
}

const initialFormData: SupplierFormData = {
  name: '',
  abn: '',
  contact_name: '',
  contact_email: '',
  phone: '',
  address: '',
  gst_registered: true,
  default_gst_treatment: '',
  default_category: '',
  is_rd_supplier: false,
  notes: '',
};

export default function SuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await suppliers.getSuppliers({
        search: search || undefined,
        page,
        pageSize,
      });
      setSupplierList(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await auth.getCurrentUser();
        setIsAdmin(user.role === 'admin');
      } catch (error) {
        console.error('Failed to get current user:', error);
      }
    };
    checkAdmin();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const openAddDialog = () => {
    setEditingSupplier(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      abn: supplier.abn || '',
      contact_name: supplier.contact_name || '',
      contact_email: supplier.contact_email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      gst_registered: supplier.gst_registered,
      default_gst_treatment: supplier.default_gst_treatment || '',
      default_category: supplier.default_category || '',
      is_rd_supplier: supplier.is_rd_supplier,
      notes: supplier.notes || '',
    });
    setDialogOpen(true);
  };

  const openDeleteConfirm = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteConfirmOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        const updateData: SupplierUpdate = {
          name: formData.name,
          abn: formData.abn || null,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          gst_registered: formData.gst_registered,
          default_gst_treatment: (formData.default_gst_treatment as GstTreatment) || null,
          default_category: (formData.default_category as Category) || null,
          is_rd_supplier: formData.is_rd_supplier,
          notes: formData.notes || null,
        };
        await suppliers.updateSupplier(editingSupplier.id, updateData);
      } else {
        const createData: SupplierCreate = {
          name: formData.name,
          abn: formData.abn || null,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          gst_registered: formData.gst_registered,
          default_gst_treatment: (formData.default_gst_treatment as GstTreatment) || null,
          default_category: (formData.default_category as Category) || null,
          is_rd_supplier: formData.is_rd_supplier,
          notes: formData.notes || null,
        };
        await suppliers.createSupplier(createData);
      }

      setDialogOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to save supplier:', error);
      alert('Failed to save supplier. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    setIsSubmitting(true);
    try {
      await suppliers.deleteSupplier(supplierToDelete.id);
      setDeleteConfirmOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      alert('Failed to delete supplier. Please try again.');
    } finally {
      setIsSubmitting(false);
      setSupplierToDelete(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatCategory = (category: string | null) => {
    if (!category) return '-';
    return category.replace('_', ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="mt-1 text-slate-600">
            Manage suppliers and their default settings
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or ABN..."
          value={search}
          onChange={handleSearchChange}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : supplierList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No suppliers found</p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Try adjusting your search' : 'Add your first supplier to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">ABN</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">GST Registered</th>
                  <th className="px-6 py-3">R&D Supplier</th>
                  <th className="px-6 py-3">Default Category</th>
                  <th className="px-6 py-3">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {supplierList.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {supplier.abn || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {supplier.contact_name || supplier.contact_email ? (
                        <div>
                          {supplier.contact_name && <div>{supplier.contact_name}</div>}
                          {supplier.contact_email && (
                            <div className="text-xs text-slate-400">{supplier.contact_email}</div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {supplier.gst_registered ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {supplier.is_rd_supplier ? (
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatCategory(supplier.default_category)}
                    </td>
                    <td className="px-6 py-4">
                      {supplier.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditDialog(supplier)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(supplier)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && supplierList.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} suppliers
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500">
              {editingSupplier ? 'Update the supplier details below.' : 'Fill in the details to create a new supplier.'}
            </Dialog.Description>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label.Root htmlFor="name" className="text-sm font-medium text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Supplier name"
                  />
                </div>

                {/* ABN */}
                <div className="space-y-2">
                  <Label.Root htmlFor="abn" className="text-sm font-medium text-slate-700">
                    ABN
                  </Label.Root>
                  <input
                    id="abn"
                    type="text"
                    value={formData.abn}
                    onChange={(e) => setFormData(d => ({ ...d, abn: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="12 345 678 901"
                  />
                </div>

                {/* Contact Name */}
                <div className="space-y-2">
                  <Label.Root htmlFor="contact_name" className="text-sm font-medium text-slate-700">
                    Contact Name
                  </Label.Root>
                  <input
                    id="contact_name"
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData(d => ({ ...d, contact_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Contact person"
                  />
                </div>

                {/* Contact Email */}
                <div className="space-y-2">
                  <Label.Root htmlFor="contact_email" className="text-sm font-medium text-slate-700">
                    Contact Email
                  </Label.Root>
                  <input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(d => ({ ...d, contact_email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label.Root htmlFor="phone" className="text-sm font-medium text-slate-700">
                    Phone
                  </Label.Root>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(d => ({ ...d, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="+61 2 1234 5678"
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label.Root htmlFor="address" className="text-sm font-medium text-slate-700">
                    Address
                  </Label.Root>
                  <input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(d => ({ ...d, address: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Street address"
                  />
                </div>

                {/* Default Category */}
                <div className="space-y-2">
                  <Label.Root htmlFor="default_category" className="text-sm font-medium text-slate-700">
                    Default Category
                  </Label.Root>
                  <select
                    id="default_category"
                    value={formData.default_category}
                    onChange={(e) => setFormData(d => ({ ...d, default_category: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default GST Treatment */}
                <div className="space-y-2">
                  <Label.Root htmlFor="default_gst_treatment" className="text-sm font-medium text-slate-700">
                    Default GST Treatment
                  </Label.Root>
                  <select
                    id="default_gst_treatment"
                    value={formData.default_gst_treatment}
                    onChange={(e) => setFormData(d => ({ ...d, default_gst_treatment: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select treatment</option>
                    {GST_TREATMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.gst_registered}
                    onChange={(e) => setFormData(d => ({ ...d, gst_registered: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">GST Registered</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_rd_supplier}
                    onChange={(e) => setFormData(d => ({ ...d, is_rd_supplier: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">R&D Supplier</span>
                </label>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label.Root htmlFor="notes" className="text-sm font-medium text-slate-700">
                  Notes
                </Label.Root>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(d => ({ ...d, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Additional notes about this supplier"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingSupplier ? 'Update Supplier' : 'Create Supplier'
                  )}
                </button>
              </div>
            </form>

            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              Delete Supplier
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500">
              Are you sure you want to delete <strong>{supplierToDelete?.name}</strong>? This action will deactivate the supplier and cannot be undone.
            </Dialog.Description>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Supplier'
                )}
              </button>
            </div>

            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
