'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  BasPeriod,
  BasPeriodDetail,
  BasTransaction,
  PaginatedBasTransactions,
  formatCurrency,
  formatDate,
  formatPeriodRange,
  getBasStatusLabel,
  getBasStatusColor,
} from '@/types/bas';
import { getGstTreatmentLabel } from '@/types/transaction';
import {
  getBasPeriods,
  createBasPeriod,
  getBasPeriod,
  getBasTransactions,
  getBasUnresolved,
  finalizeBasPeriod,
  exportBasPeriod,
  downloadBasExport,
} from '@/lib/bas';

// Icons as simple SVG components
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function GstPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [periods, setPeriods] = useState<BasPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<BasPeriodDetail | null>(null);
  const [transactions, setTransactions] = useState<PaginatedBasTransactions | null>(null);
  const [unresolved, setUnresolved] = useState<PaginatedBasTransactions | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unresolved'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New period form
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Load periods on mount
  useEffect(() => {
    loadPeriods();
  }, []);

  // Load selected period details
  useEffect(() => {
    if (selectedPeriod?.id) {
      loadPeriodDetails(selectedPeriod.id);
    }
  }, [selectedPeriod?.id]);

  // Load transactions when tab or period changes
  useEffect(() => {
    if (selectedPeriod?.id) {
      loadTransactions(selectedPeriod.id, activeTab);
    }
  }, [selectedPeriod?.id, activeTab, currentPage]);

  const loadPeriods = async () => {
    try {
      setIsLoading(true);
      const response = await getBasPeriods(1, 100);
      setPeriods(response.items);
      if (response.items.length > 0 && !selectedPeriod) {
        // Load first period details
        await loadPeriodDetails(response.items[0].id);
      }
    } catch (err) {
      setError('Failed to load BAS periods');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriodDetails = async (periodId: string) => {
    try {
      const details = await getBasPeriod(periodId);
      setSelectedPeriod(details);
    } catch (err) {
      setError('Failed to load period details');
    }
  };

  const loadTransactions = async (periodId: string, tab: 'all' | 'unresolved') => {
    try {
      if (tab === 'unresolved') {
        const response = await getBasUnresolved(periodId, currentPage, pageSize);
        setUnresolved(response);
      } else {
        const response = await getBasTransactions(periodId, currentPage, pageSize);
        setTransactions(response);
      }
    } catch (err) {
      setError('Failed to load transactions');
    }
  };

  const handleCreatePeriod = async () => {
    if (!newPeriodStart || !newPeriodEnd) {
      setError('Please enter both start and end dates');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      await createBasPeriod({
        start_date: newPeriodStart,
        end_date: newPeriodEnd,
      });
      setShowNewPeriodModal(false);
      setNewPeriodStart('');
      setNewPeriodEnd('');
      await loadPeriods();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create period');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriod) return;

    try {
      setIsFinalizing(true);
      setError(null);
      await finalizeBasPeriod(selectedPeriod.id);
      setShowFinalizeModal(false);
      await loadPeriodDetails(selectedPeriod.id);
      await loadPeriods();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to finalize period');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExport = async () => {
    if (!selectedPeriod) return;

    try {
      setIsExporting(true);
      const data = await exportBasPeriod(selectedPeriod.id);
      downloadBasExport(data);
    } catch (err) {
      setError('Failed to export period');
    } finally {
      setIsExporting(false);
    }
  };

  const getNetGstColor = (netGst: string) => {
    const value = parseFloat(netGst);
    if (value > 0) return 'text-rose-600';
    if (value < 0) return 'text-emerald-600';
    return 'text-slate-600';
  };

  const getNetGstLabel = (netGst: string) => {
    const value = parseFloat(netGst);
    if (value > 0) return 'GST Payable';
    if (value < 0) return 'GST Refundable';
    return 'Net GST';
  };

  const currentTransactions = activeTab === 'unresolved' ? unresolved : transactions;
  const hasUnresolved = (selectedPeriod?.summary?.unresolved_count ?? 0) > 0;

  if (isLoading && periods.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST / BAS</h1>
          <p className="mt-1 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST / BAS</h1>
          <p className="mt-1 text-slate-600">
            Manage BAS periods and GST calculations
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewPeriodModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <PlusIcon />
            New Period
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
          <div className="text-rose-500 flex-shrink-0">
            <WarningIcon />
          </div>
          <div className="flex-1">
            <p className="text-rose-700 text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Period Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          BAS Period
        </label>
        <div className="relative">
          <select
            value={selectedPeriod?.id || ''}
            onChange={(e) => {
              const period = periods.find((p) => p.id === e.target.value);
              if (period) {
                setSelectedPeriod({ ...period, summary: selectedPeriod?.summary || {} as any });
              }
            }}
            className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {periods.length === 0 && (
              <option value="">No periods available</option>
            )}
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {formatPeriodRange(period.start_date, period.end_date)} ({getBasStatusLabel(period.status)})
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {periods.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No BAS Periods</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Create your first BAS period to start tracking GST calculations and prepare for BAS reporting.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowNewPeriodModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <PlusIcon />
              Create First Period
            </button>
          )}
        </div>
      )}

      {/* GST Summary Cards */}
      {selectedPeriod && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* GST Collected */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500 mb-1">GST Collected</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(selectedPeriod.gst_collected)}
              </p>
              <p className="text-xs text-slate-400 mt-1">On sales & income</p>
            </div>

            {/* GST Paid */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500 mb-1">GST Paid</p>
              <p className="text-2xl font-bold text-rose-600">
                {formatCurrency(selectedPeriod.gst_paid)}
              </p>
              <p className="text-xs text-slate-400 mt-1">On purchases & expenses</p>
            </div>

            {/* Net GST */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500 mb-1">
                {getNetGstLabel(selectedPeriod.net_gst)}
              </p>
              <p className={`text-2xl font-bold ${getNetGstColor(selectedPeriod.net_gst)}`}>
                {formatCurrency(Math.abs(parseFloat(selectedPeriod.net_gst)))}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {parseFloat(selectedPeriod.net_gst) > 0 ? 'You owe' : parseFloat(selectedPeriod.net_gst) < 0 ? 'You are owed' : 'Balanced'}
              </p>
            </div>

            {/* Total Sales */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500 mb-1">Total Sales</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(selectedPeriod.total_sales)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {formatCurrency(selectedPeriod.total_purchases)} purchases
              </p>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getBasStatusColor(
                  selectedPeriod.status
                )}`}
              >
                {getBasStatusLabel(selectedPeriod.status)}
              </span>
              {hasUnresolved && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <WarningIcon />
                  {selectedPeriod.summary?.unresolved_count} unresolved
                </span>
              )}
              <span className="text-sm text-slate-500">
                {selectedPeriod.summary?.transaction_count || 0} transactions
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
              >
                <DownloadIcon />
                {isExporting ? 'Exporting...' : 'Export Summary'}
              </button>
              {isAdmin && selectedPeriod.status === 'draft' && (
                <button
                  onClick={() => setShowFinalizeModal(true)}
                  disabled={hasUnresolved || isFinalizing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckIcon />
                  {isFinalizing ? 'Finalizing...' : 'Finalize Period'}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'all'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                All Transactions
              </button>
              <button
                onClick={() => setActiveTab('unresolved')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'unresolved'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Unresolved Items
                {hasUnresolved && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                    {selectedPeriod.summary?.unresolved_count}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Date
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Description
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Category
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Amount
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      GST
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      GST Treatment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {!currentTransactions?.items?.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        {activeTab === 'unresolved'
                          ? 'No unresolved transactions found'
                          : 'No transactions in this period'}
                      </td>
                    </tr>
                  ) : (
                    currentTransactions.items.map((transaction: BasTransaction) => (
                      <tr
                        key={transaction.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          activeTab === 'unresolved' ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          <div className="max-w-xs truncate" title={transaction.description}>
                            {transaction.description}
                          </div>
                          {transaction.supplier_name && (
                            <div className="text-xs text-slate-500">{transaction.supplier_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {transaction.category || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${
                          parseFloat(transaction.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600 whitespace-nowrap">
                          {transaction.gst_amount ? formatCurrency(transaction.gst_amount) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {transaction.gst_treatment ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {getGstTreatmentLabel(transaction.gst_treatment as any)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              Missing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {currentTransactions && currentTransactions.total > pageSize && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to{' '}
                  {Math.min(currentPage * pageSize, currentTransactions.total)} of{' '}
                  {currentTransactions.total} transactions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeftIcon />
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {Math.ceil(currentTransactions.total / pageSize)}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage * pageSize >= currentTransactions.total}
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* New Period Modal */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New BAS Period</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newPeriodStart}
                  onChange={(e) => setNewPeriodStart(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewPeriodModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePeriod}
                disabled={isCreating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Finalize BAS Period?</h2>
            <p className="text-slate-600 mb-4">
              This will lock the period and store the calculated GST values. You cannot modify transactions after finalization.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Period:</span>
                <span className="font-medium text-slate-900">
                  {formatPeriodRange(selectedPeriod.start_date, selectedPeriod.end_date)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST Collected:</span>
                <span className="font-medium text-emerald-600">
                  {formatCurrency(selectedPeriod.gst_collected)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST Paid:</span>
                <span className="font-medium text-rose-600">
                  {formatCurrency(selectedPeriod.gst_paid)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Net GST:</span>
                <span className={`font-medium ${getNetGstColor(selectedPeriod.net_gst)}`}>
                  {formatCurrency(selectedPeriod.net_gst)}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isFinalizing ? 'Finalizing...' : 'Confirm Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
