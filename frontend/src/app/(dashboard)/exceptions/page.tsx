'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Exception,
  ExceptionType,
  Severity,
  ExceptionSummary,
  ExceptionFilter,
  PaginatedExceptions,
  getSeverityColor,
  getExceptionTypeLabel,
  getEntityTypeLabel,
  formatDateTime,
  EXCEPTION_TYPE_OPTIONS,
  SEVERITY_OPTIONS,
} from '@/types/exception';
import {
  getExceptions,
  getExceptionSummary,
  resolveException,
  runAllRules,
} from '@/lib/exceptions';

// Icons
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// Toast component
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : type === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg border shadow-lg ${bgColor} z-50`}
    >
      <div className="flex items-center gap-2">
        {type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
        {type === 'error' && <AlertTriangleIcon className="w-5 h-5" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-lg leading-none hover:opacity-70">
          &times;
        </button>
      </div>
    </div>
  );
}

// Resolve Modal
function ResolveModal({
  exception,
  onClose,
  onResolve,
  isLoading,
}: {
  exception: Exception;
  onClose: () => void;
  onResolve: (notes: string) => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResolve(notes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Resolve Exception
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            {exception.message}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resolution Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe how this exception was resolved..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Resolving...' : 'Resolve'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Exception Detail Panel
function ExceptionDetail({ exception }: { exception: Exception }) {
  return (
    <div className="bg-slate-50 p-4 rounded-lg mt-2 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-slate-500">Entity Type:</span>
          <span className="ml-2 font-medium text-slate-900">
            {getEntityTypeLabel(exception.entity_type)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Entity ID:</span>
          <span className="ml-2 font-mono text-slate-700">
            {exception.entity_id}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Created:</span>
          <span className="ml-2 text-slate-700">
            {formatDateTime(exception.created_at)}
          </span>
        </div>
        {exception.resolved_at && (
          <div>
            <span className="text-slate-500">Resolved:</span>
            <span className="ml-2 text-slate-700">
              {formatDateTime(exception.resolved_at)}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}

export default function ExceptionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [summary, setSummary] = useState<ExceptionSummary | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
  });
  const [filters, setFilters] = useState<ExceptionFilter>({});
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [loading, setLoading] = useState(true);
  const [runningRules, setRunningRules] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch exceptions
  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: ExceptionFilter = { ...filters };
      if (resolvedFilter === 'unresolved') {
        filterParams.is_resolved = false;
      } else if (resolvedFilter === 'resolved') {
        filterParams.is_resolved = true;
      }

      const response: PaginatedExceptions = await getExceptions(
        filterParams,
        pagination.page,
        pagination.page_size
      );
      setExceptions(response.items);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }));
    } catch (error) {
      setToast({ message: 'Failed to load exceptions', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.page_size, resolvedFilter]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await getExceptionSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchExceptions();
    fetchSummary();
  }, [fetchExceptions, fetchSummary]);

  // Handle run rules
  const handleRunRules = async () => {
    if (!isAdmin) return;
    setRunningRules(true);
    try {
      const result = await runAllRules();
      setToast({
        message: `Rules executed: ${result.total_new_exceptions} new exceptions found`,
        type: result.total_new_exceptions > 0 ? 'info' : 'success',
      });
      await fetchExceptions();
      await fetchSummary();
    } catch (error) {
      setToast({ message: 'Failed to run rules', type: 'error' });
    } finally {
      setRunningRules(false);
    }
  };

  // Handle resolve
  const handleResolve = async (exceptionId: string, notes: string) => {
    setResolvingId(exceptionId);
    try {
      await resolveException(exceptionId, notes);
      setToast({ message: 'Exception resolved successfully', type: 'success' });
      setResolvingId(null);
      await fetchExceptions();
      await fetchSummary();
    } catch (error) {
      setToast({ message: 'Failed to resolve exception', type: 'error' });
      setResolvingId(null);
    }
  };

  // Pagination
  const totalPages = Math.ceil(pagination.total / pagination.page_size);
  const startItem = (pagination.page - 1) * pagination.page_size + 1;
  const endItem = Math.min(pagination.page * pagination.page_size, pagination.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exceptions</h1>
          <p className="mt-1 text-slate-600">
            Review and resolve data quality issues
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleRunRules}
            disabled={runningRules}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningRules ? (
              <RefreshIcon className="w-5 h-5 animate-spin" />
            ) : (
              <PlayIcon className="w-5 h-5" />
            )}
            {runningRules ? 'Running...' : 'Run Rules'}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Exceptions</div>
            <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Unresolved</div>
            <div className="text-2xl font-bold text-red-600">{summary.unresolved_count}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">High Severity</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.by_severity.high || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Medium Severity</div>
            <div className="text-2xl font-bold text-amber-600">
              {summary.by_severity.medium || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Exception Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Exception Type
            </label>
            <select
              value={filters.exception_type || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  exception_type: (e.target.value as ExceptionType) || undefined,
                }))
              }
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {EXCEPTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Severity
            </label>
            <select
              value={filters.severity || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  severity: (e.target.value as Severity) || undefined,
                }))
              }
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resolved Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Status
            </label>
            <select
              value={resolvedFilter}
              onChange={(e) =>
                setResolvedFilter(e.target.value as 'all' | 'unresolved' | 'resolved')
              }
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({});
                setResolvedFilter('unresolved');
              }}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
            Loading exceptions...
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-medium text-slate-900">No exceptions found</h3>
            <p className="text-slate-500 mt-1">
              {resolvedFilter === 'unresolved'
                ? 'Great! No unresolved exceptions at the moment.'
                : 'No exceptions match your filters.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exceptions.map((exception) => (
                  <>
                    <tr
                      key={exception.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        setExpandedId(expandedId === exception.id ? null : exception.id)
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(
                            exception.severity
                          )}`}
                        >
                          {exception.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        {getExceptionTypeLabel(exception.exception_type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-md truncate">
                        {exception.message}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {getEntityTypeLabel(exception.entity_type)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {formatDateTime(exception.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {exception.is_resolved ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <CheckCircleIcon className="w-4 h-4" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <span className="w-2 h-2 bg-red-500 rounded-full" />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!exception.is_resolved && isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResolvingId(exception.id);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Resolve
                            </button>
                          )}
                          {expandedId === exception.id ? (
                            <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === exception.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-0">
                          <ExceptionDetail exception={exception} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing {startItem} to {endItem} of {pagination.total} results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {pagination.page} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page >= totalPages}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Resolve Modal */}
      {resolvingId && (
        <ResolveModal
          exception={exceptions.find((e) => e.id === resolvingId)!}
          onClose={() => setResolvingId(null)}
          onResolve={(notes) => handleResolve(resolvingId, notes)}
          isLoading={false}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
