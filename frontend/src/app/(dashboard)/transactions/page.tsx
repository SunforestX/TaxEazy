'use client';

import { useEffect, useState, useCallback } from 'react';
import { transactions, formatCurrency, formatDate } from '@/lib/transactions';
import { suppliers } from '@/lib/suppliers';
import { auth } from '@/lib/auth';
import type { Transaction, TransactionFilter, TransactionSummary, Category, GstTreatment, RdRelevance } from '@/types/transaction';
import type { Supplier } from '@/types/supplier';
import {
  Search,
  Plus,
  Upload,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Trash2,
  CheckSquare,
  Square,
  Download,
  AlertCircle,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Label from '@radix-ui/react-label';
import {
  CATEGORY_OPTIONS,
  GST_TREATMENT_OPTIONS,
  RD_RELEVANCE_OPTIONS,
  getRdRelevanceColor,
  getCategoryLabel,
  getGstTreatmentLabel,
} from '@/types/transaction';

interface TransactionFormData {
  date: string;
  description: string;
  amount: string;
  gst_amount: string;
  account_code: string;
  reference: string;
  supplier_id: string;
  category: string;
  gst_treatment: string;
  rd_relevance: RdRelevance;
  notes: string;
}

const initialFormData: TransactionFormData = {
  date: '',
  description: '',
  amount: '',
  gst_amount: '',
  account_code: '',
  reference: '',
  supplier_id: '',
  category: '',
  gst_treatment: '',
  rd_relevance: 'no',
  notes: '',
};

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export default function TransactionsPage() {
  // Data state
  const [transactionList, setTransactionList] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);

  // UI state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'date', direction: 'desc' });

  // Filter state
  const [filters, setFilters] = useState<TransactionFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkClassifyDialogOpen, setBulkClassifyDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported_count: number; error_count: number; errors: { row_number: number; error: string }[] } | null>(null);

  // Bulk classify state
  const [bulkClassifyData, setBulkClassifyData] = useState({
    category: '' as Category | '',
    gst_treatment: '' as GstTreatment | '',
    rd_relevance: '' as RdRelevance | '',
  });

  // Inline editing state
  const [inlineEditing, setInlineEditing] = useState<{
    id: string;
    field: 'category' | 'gst_treatment' | 'rd_relevance';
    value: string;
  } | null>(null);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [transactionsRes, summaryRes] = await Promise.all([
        transactions.getTransactions({
          ...filters,
          page,
          pageSize,
          sortBy: sortConfig.column,
          sortOrder: sortConfig.direction,
        }),
        transactions.getTransactionSummary(filters),
      ]);
      setTransactionList(transactionsRes.items);
      setTotal(transactionsRes.total);
      setSummary(summaryRes);
      setSelectedTransactions(new Set()); // Clear selection on refresh
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, pageSize, sortConfig]);

  // Fetch suppliers for dropdown
  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await suppliers.getSuppliers({ pageSize: 100 });
      setSupplierList(response.items);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  }, []);

  // Check admin status
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
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Fetch data when filters/page/sort change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle sort
  const handleSort = (column: string) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600" />
    );
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedTransactions.size === transactionList.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactionList.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedTransactions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTransactions(newSet);
  };

  // Filter handlers
  const handleFilterChange = (key: keyof TransactionFilter, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  // Create/Edit handlers
  const openCreateDialog = () => {
    setEditingTransaction(null);
    setFormData(initialFormData);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      gst_amount: transaction.gst_amount || '',
      account_code: transaction.account_code || '',
      reference: transaction.reference || '',
      supplier_id: transaction.supplier_id || '',
      category: transaction.category || '',
      gst_treatment: transaction.gst_treatment || '',
      rd_relevance: transaction.rd_relevance,
      notes: transaction.notes || '',
    });
    setCreateDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        ...formData,
        supplier_id: formData.supplier_id || null,
        category: formData.category as Category || null,
        gst_treatment: formData.gst_treatment as GstTreatment || null,
        gst_amount: formData.gst_amount || null,
        account_code: formData.account_code || null,
        reference: formData.reference || null,
        notes: formData.notes || null,
      };

      if (editingTransaction) {
        await transactions.updateTransaction(editingTransaction.id, data);
      } else {
        await transactions.createTransaction(data);
      }

      setCreateDialogOpen(false);
      fetchTransactions();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert('Failed to save transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handlers
  const openDeleteConfirm = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;

    setIsSubmitting(true);
    try {
      await transactions.deleteTransaction(transactionToDelete.id);
      setDeleteConfirmOpen(false);
      fetchTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
      setTransactionToDelete(null);
    }
  };

  // Inline editing handlers
  const startInlineEdit = (transaction: Transaction, field: 'category' | 'gst_treatment' | 'rd_relevance') => {
    setInlineEditing({
      id: transaction.id,
      field,
      value: transaction[field] || '',
    });
  };

  const saveInlineEdit = async () => {
    if (!inlineEditing) return;

    try {
      const updateData: { category?: Category | null; gst_treatment?: GstTreatment | null; rd_relevance?: RdRelevance } = {};
      if (inlineEditing.field === 'category') {
        updateData.category = inlineEditing.value as Category || null;
      } else if (inlineEditing.field === 'gst_treatment') {
        updateData.gst_treatment = inlineEditing.value as GstTreatment || null;
      } else if (inlineEditing.field === 'rd_relevance') {
        updateData.rd_relevance = inlineEditing.value as RdRelevance;
      }

      await transactions.updateTransaction(inlineEditing.id, updateData);
      setInlineEditing(null);
      fetchTransactions();
    } catch (error) {
      console.error('Failed to update transaction:', error);
      alert('Failed to update. Please try again.');
    }
  };

  // Bulk classify handlers
  const handleBulkClassify = async () => {
    if (selectedTransactions.size === 0) return;

    setIsSubmitting(true);
    try {
      await transactions.bulkClassify({
        transaction_ids: Array.from(selectedTransactions),
        category: bulkClassifyData.category || undefined,
        gst_treatment: bulkClassifyData.gst_treatment || undefined,
        rd_relevance: bulkClassifyData.rd_relevance || undefined,
      });

      setBulkClassifyDialogOpen(false);
      setBulkClassifyData({ category: '', gst_treatment: '', rd_relevance: '' });
      fetchTransactions();
    } catch (error) {
      console.error('Failed to bulk classify:', error);
      alert('Failed to bulk classify. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Import handlers
  const handleImport = async () => {
    if (!importFile) return;

    setIsSubmitting(true);
    try {
      const result = await transactions.importTransactionsCsv(importFile);
      setImportResult(result);
      if (result.imported_count > 0) {
        fetchTransactions();
      }
    } catch (error) {
      console.error('Failed to import:', error);
      alert('Failed to import CSV. Please check the file format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="mt-1 text-slate-600">
            Manage and track all company transactions
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={openCreateDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Transaction
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Total Transactions</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total_count}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Total Amount</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.total_amount)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Total GST</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.total_gst_amount)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-500">R&D Eligible</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.rd_eligible_amount)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <Filter className="h-4 w-4" />
            Filters
            {Object.keys(filters).length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
          {Object.keys(filters).length > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
            {/* Date Range */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Date From</Label.Root>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Date To</Label.Root>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            {/* Category */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Category</Label.Root>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* GST Treatment */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">GST Treatment</Label.Root>
              <select
                value={filters.gst_treatment || ''}
                onChange={(e) => handleFilterChange('gst_treatment', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Treatments</option>
                {GST_TREATMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* R&D Relevance */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">R&D Relevance</Label.Root>
              <select
                value={filters.rd_relevance || ''}
                onChange={(e) => handleFilterChange('rd_relevance', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {RD_RELEVANCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Supplier</Label.Root>
              <select
                value={filters.supplier_id || ''}
                onChange={(e) => handleFilterChange('supplier_id', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Suppliers</option>
                {supplierList.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>

            {/* Amount Range */}
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Min Amount</Label.Root>
              <input
                type="number"
                step="0.01"
                value={filters.min_amount || ''}
                onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label.Root className="text-xs font-medium text-slate-500">Max Amount</Label.Root>
              <input
                type="number"
                step="0.01"
                value={filters.max_amount || ''}
                onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>

            {/* Search */}
            <div className="md:col-span-2 lg:col-span-2">
              <Label.Root className="text-xs font-medium text-slate-500">Search</Label.Root>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search description or reference..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedTransactions.size > 0 && isAdmin && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 flex items-center justify-between">
          <span className="text-sm text-blue-900">
            {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setBulkClassifyDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <CheckSquare className="h-4 w-4" />
            Bulk Classify
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : transactionList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No transactions found</p>
            <p className="text-slate-400 text-sm mt-1">
              {Object.keys(filters).length > 0 ? 'Try adjusting your filters' : 'Add your first transaction to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 rounded hover:bg-slate-200"
                      >
                        {selectedTransactions.size === transactionList.length ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {getSortIcon('date')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center gap-1">
                      Description
                      {getSortIcon('description')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-slate-100 text-right"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Amount
                      {getSortIcon('amount')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">GST Treatment</th>
                  <th className="px-4 py-3">R&D</th>
                  <th className="px-4 py-3">Supplier</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactionList.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(transaction.id)}
                          className="p-1 rounded hover:bg-slate-200"
                        >
                          {selectedTransactions.has(transaction.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{transaction.description}</div>
                      {transaction.reference && (
                        <div className="text-xs text-slate-400">Ref: {transaction.reference}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(transaction.gst_amount)}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && inlineEditing?.id === transaction.id && inlineEditing?.field === 'category' ? (
                        <select
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          onBlur={saveInlineEdit}
                          autoFocus
                          className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">-</option>
                          {CATEGORY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => isAdmin && startInlineEdit(transaction, 'category')}
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            transaction.category
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          } ${isAdmin ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                          disabled={!isAdmin}
                        >
                          {getCategoryLabel(transaction.category)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && inlineEditing?.id === transaction.id && inlineEditing?.field === 'gst_treatment' ? (
                        <select
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          onBlur={saveInlineEdit}
                          autoFocus
                          className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">-</option>
                          {GST_TREATMENT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => isAdmin && startInlineEdit(transaction, 'gst_treatment')}
                          className={`text-xs ${isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          disabled={!isAdmin}
                        >
                          {getGstTreatmentLabel(transaction.gst_treatment)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && inlineEditing?.id === transaction.id && inlineEditing?.field === 'rd_relevance' ? (
                        <select
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          onBlur={saveInlineEdit}
                          autoFocus
                          className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-xs"
                        >
                          {RD_RELEVANCE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => isAdmin && startInlineEdit(transaction, 'rd_relevance')}
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRdRelevanceColor(transaction.rd_relevance)} ${isAdmin ? 'cursor-pointer' : ''}`}
                          disabled={!isAdmin}
                        >
                          {transaction.rd_relevance === 'yes' ? 'Yes' : transaction.rd_relevance === 'partial' ? 'Partial' : 'No'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {transaction.supplier_name || '-'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditDialog(transaction)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            title="Edit"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(transaction)}
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
        {!isLoading && transactionList.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} transactions
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

      {/* Create/Edit Dialog */}
      <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] border border-slate-200 bg-white p-6 shadow-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 mt-1">
              {editingTransaction ? 'Update the transaction details below.' : 'Fill in the details to create a new transaction.'}
            </Dialog.Description>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label.Root htmlFor="date" className="text-sm font-medium text-slate-700">
                    Date <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(d => ({ ...d, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label.Root htmlFor="amount" className="text-sm font-medium text-slate-700">
                    Amount <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData(d => ({ ...d, amount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2 md:col-span-2">
                  <Label.Root htmlFor="description" className="text-sm font-medium text-slate-700">
                    Description <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id="description"
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Transaction description"
                  />
                </div>

                {/* GST Amount */}
                <div className="space-y-2">
                  <Label.Root htmlFor="gst_amount" className="text-sm font-medium text-slate-700">
                    GST Amount
                  </Label.Root>
                  <input
                    id="gst_amount"
                    type="number"
                    step="0.01"
                    value={formData.gst_amount}
                    onChange={(e) => setFormData(d => ({ ...d, gst_amount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>

                {/* Account Code */}
                <div className="space-y-2">
                  <Label.Root htmlFor="account_code" className="text-sm font-medium text-slate-700">
                    Account Code
                  </Label.Root>
                  <input
                    id="account_code"
                    type="text"
                    value={formData.account_code}
                    onChange={(e) => setFormData(d => ({ ...d, account_code: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="e.g., 6100"
                  />
                </div>

                {/* Reference */}
                <div className="space-y-2">
                  <Label.Root htmlFor="reference" className="text-sm font-medium text-slate-700">
                    Reference
                  </Label.Root>
                  <input
                    id="reference"
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData(d => ({ ...d, reference: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Invoice or reference number"
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-2">
                  <Label.Root htmlFor="supplier_id" className="text-sm font-medium text-slate-700">
                    Supplier
                  </Label.Root>
                  <select
                    id="supplier_id"
                    value={formData.supplier_id}
                    onChange={(e) => setFormData(d => ({ ...d, supplier_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select supplier</option>
                    {supplierList.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label.Root htmlFor="category" className="text-sm font-medium text-slate-700">
                    Category
                  </Label.Root>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(d => ({ ...d, category: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select category</option>
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* GST Treatment */}
                <div className="space-y-2">
                  <Label.Root htmlFor="gst_treatment" className="text-sm font-medium text-slate-700">
                    GST Treatment
                  </Label.Root>
                  <select
                    id="gst_treatment"
                    value={formData.gst_treatment}
                    onChange={(e) => setFormData(d => ({ ...d, gst_treatment: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select treatment</option>
                    {GST_TREATMENT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* R&D Relevance */}
                <div className="space-y-2">
                  <Label.Root htmlFor="rd_relevance" className="text-sm font-medium text-slate-700">
                    R&D Relevance
                  </Label.Root>
                  <select
                    id="rd_relevance"
                    value={formData.rd_relevance}
                    onChange={(e) => setFormData(d => ({ ...d, rd_relevance: e.target.value as RdRelevance }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {RD_RELEVANCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Additional notes about this transaction"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateDialogOpen(false)}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingTransaction ? 'Update Transaction' : 'Create Transaction'
                  )}
                </button>
              </div>
            </form>

            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Bulk Classify Dialog */}
      <Dialog.Root open={bulkClassifyDialogOpen} onOpenChange={setBulkClassifyDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] border border-slate-200 bg-white p-6 shadow-lg rounded-lg">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              Bulk Classify Transactions
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 mt-1">
              Update classification for {selectedTransactions.size} selected transaction{selectedTransactions.size !== 1 ? 's' : ''}.
            </Dialog.Description>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label.Root className="text-sm font-medium text-slate-700">Category</Label.Root>
                <select
                  value={bulkClassifyData.category}
                  onChange={(e) => setBulkClassifyData(d => ({ ...d, category: e.target.value as Category | '' }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">No change</option>
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label.Root className="text-sm font-medium text-slate-700">GST Treatment</Label.Root>
                <select
                  value={bulkClassifyData.gst_treatment}
                  onChange={(e) => setBulkClassifyData(d => ({ ...d, gst_treatment: e.target.value as GstTreatment | '' }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">No change</option>
                  {GST_TREATMENT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label.Root className="text-sm font-medium text-slate-700">R&D Relevance</Label.Root>
                <select
                  value={bulkClassifyData.rd_relevance}
                  onChange={(e) => setBulkClassifyData(d => ({ ...d, rd_relevance: e.target.value as RdRelevance | '' }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">No change</option>
                  {RD_RELEVANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
              <button
                onClick={() => setBulkClassifyDialogOpen(false)}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkClassify}
                disabled={isSubmitting || (!bulkClassifyData.category && !bulkClassifyData.gst_treatment && !bulkClassifyData.rd_relevance)}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Selected'
                )}
              </button>
            </div>

            <Dialog.Close asChild>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Import Dialog */}
      <Dialog.Root open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border border-slate-200 bg-white p-6 shadow-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              Import Transactions from CSV
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 mt-1">
              Upload a CSV file with transaction data.
            </Dialog.Description>

            {!importResult ? (
              <div className="space-y-4 mt-4">
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                  <p className="font-medium mb-2">Expected CSV columns:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>date</strong> (required) - YYYY-MM-DD or DD/MM/YYYY</li>
                    <li><strong>description</strong> (required) - Transaction description</li>
                    <li><strong>amount</strong> (required) - Transaction amount</li>
                    <li><strong>gst_amount</strong> (optional) - GST amount</li>
                    <li><strong>account_code</strong> (optional) - Account code</li>
                    <li><strong>reference</strong> (optional) - Reference number</li>
                    <li><strong>supplier_name</strong> (optional) - Supplier name</li>
                    <li><strong>category</strong> (optional) - Expense category</li>
                    <li><strong>gst_treatment</strong> (optional) - CAP, EXP, FRE, etc.</li>
                  </ul>
                </div>

                <div>
                  <Label.Root className="text-sm font-medium text-slate-700">CSV File</Label.Root>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="mt-1 w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setImportDialogOpen(false)}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importFile || isSubmitting}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className={`rounded-lg p-4 ${importResult.error_count === 0 ? 'bg-green-50' : importResult.imported_count === 0 ? 'bg-red-50' : 'bg-yellow-50'}`}>
                  <div className="flex items-center gap-2">
                    {importResult.error_count === 0 ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : importResult.imported_count === 0 ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className={`font-medium ${importResult.error_count === 0 ? 'text-green-900' : importResult.imported_count === 0 ? 'text-red-900' : 'text-yellow-900'}`}>
                      Import {importResult.error_count === 0 ? 'Successful' : importResult.imported_count === 0 ? 'Failed' : 'Partial'}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm ${importResult.error_count === 0 ? 'text-green-700' : importResult.imported_count === 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                    {importResult.imported_count} transaction{importResult.imported_count !== 1 ? 's' : ''} imported successfully.
                    {importResult.error_count > 0 && ` ${importResult.error_count} row${importResult.error_count !== 1 ? 's' : ''} had errors.`}
                  </p>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    <p className="text-sm font-medium text-slate-700 mb-2">Errors:</p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {importResult.errors.slice(0, 10).map((error, idx) => (
                        <li key={idx}>Row {error.row_number}: {error.error}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>... and {importResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setImportResult(null);
                      setImportFile(null);
                    }}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Import Another File
                  </button>
                  <button
                    onClick={() => {
                      setImportDialogOpen(false);
                      setImportResult(null);
                      setImportFile(null);
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            <Dialog.Close asChild>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] border border-slate-200 bg-white p-6 shadow-lg rounded-lg">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              Delete Transaction
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </Dialog.Description>

            <div className="flex justify-end gap-3 pt-4 mt-4">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>

            <Dialog.Close asChild>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
