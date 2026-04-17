'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  importPayrollCSV,
  getPaygSummary,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  formatCurrency,
  formatDate,
} from '@/lib/payroll';
import {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  PayrollRun,
  PayrollRunListItem,
  PayrollRunCreate,
  PaygSummary,
  PayrollItem,
  PaginatedResponse,
} from '@/types/payroll';

// Tab types
type TabType = 'runs' | 'payg' | 'employees';

// Loading spinner component
function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
    </div>
  );
}

// Empty state component
function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12">
      {icon || (
        <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      <p className="mt-4 text-sm text-slate-500">{message}</p>
    </div>
  );
}

// Pagination component
function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-700">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                  pageNum === page
                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                    : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

// Employee Modal Component
function EmployeeModal({
  isOpen,
  onClose,
  onSave,
  employee,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeCreate | EmployeeUpdate) => void;
  employee?: Employee | null;
}) {
  const [formData, setFormData] = useState<EmployeeCreate>({
    name: '',
    email: '',
    position: '',
    is_scientist: false,
    is_active: true,
    annual_salary: undefined,
    notes: '',
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email || '',
        position: employee.position || '',
        is_scientist: employee.is_scientist,
        is_active: employee.is_active,
        annual_salary: employee.annual_salary || undefined,
        notes: employee.notes || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        position: '',
        is_scientist: false,
        is_active: true,
        annual_salary: undefined,
        notes: '',
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-semibold leading-6 text-slate-900">
              {employee ? 'Edit Employee' : 'Add Employee'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Employee name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Job title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Annual Salary</label>
                <input
                  type="number"
                  value={formData.annual_salary || ''}
                  onChange={(e) => setFormData({ ...formData, annual_salary: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_scientist}
                    onChange={(e) => setFormData({ ...formData, is_scientist: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Scientist</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={() => onSave(formData)}
              className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
            >
              {employee ? 'Save Changes' : 'Add Employee'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// New Run Modal Component
function NewRunModal({
  isOpen,
  onClose,
  onSave,
  employees,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PayrollRunCreate) => void;
  employees: Employee[];
}) {
  const [formData, setFormData] = useState<PayrollRunCreate>({
    pay_date: new Date().toISOString().split('T')[0],
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          employee_id: employees[0]?.id || '',
          gross_wages: '0',
          payg_withheld: '0',
          super_amount: '0',
          project_allocations: [],
        },
      ],
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-semibold leading-6 text-slate-900">New Payroll Run</h3>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Pay Date</label>
                  <input
                    type="date"
                    value={formData.pay_date}
                    onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Period Start</label>
                  <input
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Period End</label>
                  <input
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Optional notes..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Payroll Items</label>
                  <button
                    onClick={addItem}
                    className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
                      <select
                        value={item.employee_id}
                        onChange={(e) => updateItem(index, 'employee_id', e.target.value)}
                        className="block w-48 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Gross"
                        value={item.gross_wages}
                        onChange={(e) => updateItem(index, 'gross_wages', e.target.value)}
                        className="block w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                      <input
                        type="number"
                        placeholder="PAYG"
                        value={item.payg_withheld}
                        onChange={(e) => updateItem(index, 'payg_withheld', e.target.value)}
                        className="block w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                      <input
                        type="number"
                        placeholder="Super"
                        value={item.super_amount}
                        onChange={(e) => updateItem(index, 'super_amount', e.target.value)}
                        className="block w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => removeItem(index)}
                        className="ml-auto text-red-600 hover:text-red-800"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {formData.items.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No items added. Click "Add Item" to add payroll items.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={() => onSave(formData)}
              disabled={formData.items.length === 0}
              className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 sm:ml-3 sm:w-auto"
            >
              Create Run
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Payroll Page Component
export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<TabType>('runs');
  
  // Payroll runs state
  const [runs, setRuns] = useState<PaginatedResponse<PayrollRunListItem> | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsPage, setRunsPage] = useState(1);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<PayrollRun | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // PAYG summary state
  const [paygYear, setPaygYear] = useState(new Date().getFullYear());
  const [paygSummary, setPaygSummary] = useState<PaygSummary[]>([]);
  const [paygLoading, setPaygLoading] = useState(false);
  
  // Employees state
  const [employees, setEmployees] = useState<PaginatedResponse<Employee> | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Fetch payroll runs
  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const data = await getPayrollRuns({ page: runsPage, page_size: 10 });
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    } finally {
      setRunsLoading(false);
    }
  }, [runsPage]);

  // Fetch PAYG summary
  const fetchPaygSummary = useCallback(async () => {
    setPaygLoading(true);
    try {
      const data = await getPaygSummary(paygYear);
      setPaygSummary(data);
    } catch (error) {
      console.error('Failed to fetch PAYG summary:', error);
    } finally {
      setPaygLoading(false);
    }
  }, [paygYear]);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const data = await getEmployees({ page: employeesPage, page_size: 10 });
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setEmployeesLoading(false);
    }
  }, [employeesPage]);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'runs') {
      fetchRuns();
    } else if (activeTab === 'payg') {
      fetchPaygSummary();
    } else if (activeTab === 'employees') {
      fetchEmployees();
    }
  }, [activeTab, fetchRuns, fetchPaygSummary, fetchEmployees]);

  // Handle run expansion
  const handleExpandRun = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setRunDetails(null);
    } else {
      setExpandedRun(runId);
      try {
        const details = await getPayrollRun(runId);
        setRunDetails(details);
      } catch (error) {
        console.error('Failed to fetch run details:', error);
      }
    }
  };

  // Handle create run
  const handleCreateRun = async (data: PayrollRunCreate) => {
    try {
      await createPayrollRun(data);
      setIsNewRunModalOpen(false);
      fetchRuns();
    } catch (error) {
      console.error('Failed to create payroll run:', error);
    }
  };

  // Handle import CSV
  const handleImportCSV = async () => {
    if (!importFile) return;
    try {
      const result = await importPayrollCSV(importFile);
      setImportResult({
        success: result.success,
        message: result.success
          ? `Successfully imported ${result.items_created} items`
          : `Import failed: ${result.errors.join(', ')}`,
      });
      if (result.success) {
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportFile(null);
          setImportResult(null);
          fetchRuns();
        }, 2000);
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Import failed. Please try again.',
      });
    }
  };

  // Handle employee save
  const handleSaveEmployee = async (data: EmployeeCreate | EmployeeUpdate) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data as EmployeeUpdate);
      } else {
        await createEmployee(data as EmployeeCreate);
      }
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
    }
  };

  // Handle employee delete
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteEmployee(id);
      fetchEmployees();
    } catch (error) {
      console.error('Failed to delete employee:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payroll & PAYG</h1>
        <p className="mt-1 text-slate-600">
          Manage payroll runs, PAYG withholding, and employee records
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'runs', label: 'Payroll Runs' },
            { id: 'payg', label: 'PAYG Summary' },
            { id: 'employees', label: 'Employees' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Payroll Runs Tab */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <svg className="mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
            <button
              onClick={() => setIsNewRunModalOpen(true)}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Run
            </button>
          </div>

          {runsLoading ? (
            <LoadingSpinner className="py-12" />
          ) : runs && runs.items.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Pay Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Total Gross</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">PAYG</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Super</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Items</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {runs.items.map((run) => (
                    <React.Fragment key={run.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                          {formatDate(run.period_start)} - {formatDate(run.period_end)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {formatDate(run.pay_date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-slate-900">
                          {formatCurrency(run.total_gross)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                          {formatCurrency(run.total_payg)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                          {formatCurrency(run.total_super)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-600">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
                            {run.item_count}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                          <button
                            onClick={() => handleExpandRun(run.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {expandedRun === run.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expandedRun === run.id && runDetails && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-6 py-4">
                            <div className="rounded-md border border-slate-200 bg-white">
                              <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Employee</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Gross</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">PAYG</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Super</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {runDetails.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-900">
                                        {item.employee_id}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                                        {formatCurrency(item.gross_wages)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                                        {formatCurrency(item.payg_withheld)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                                        {formatCurrency(item.super_contribution)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={runs.page}
                pageSize={runs.page_size}
                total={runs.total}
                onPageChange={setRunsPage}
              />
            </div>
          ) : (
            <EmptyState message="No payroll runs found. Create a new run to get started." />
          )}
        </div>
      )}

      {/* PAYG Summary Tab */}
      {activeTab === 'payg' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-slate-700">Year:</label>
              <select
                value={paygYear}
                onChange={(e) => setPaygYear(parseInt(e.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {paygLoading ? (
            <LoadingSpinner className="py-12" />
          ) : paygSummary.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Month</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Total Gross</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">PAYG Withheld</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Super</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Employees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paygSummary.map((summary) => (
                    <tr key={`${summary.year}-${summary.month}`} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                        {summary.month_name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-900">
                        {formatCurrency(summary.total_gross)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                        {formatCurrency(summary.total_payg_withheld)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                        {formatCurrency(summary.total_super)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-600">
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                          {summary.employee_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-6 py-3 text-sm text-slate-900">Total</td>
                    <td className="px-6 py-3 text-right text-sm text-slate-900">
                      {formatCurrency(
                        paygSummary.reduce((sum, s) => sum + parseFloat(s.total_gross), 0)
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-slate-900">
                      {formatCurrency(
                        paygSummary.reduce((sum, s) => sum + parseFloat(s.total_payg_withheld), 0)
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-slate-900">
                      {formatCurrency(
                        paygSummary.reduce((sum, s) => sum + parseFloat(s.total_super), 0)
                      )}
                    </td>
                    <td className="px-6 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EmptyState message="No PAYG data found for the selected year." />
          )}
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingEmployee(null);
                setIsEmployeeModalOpen(true);
              }}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </button>
          </div>

          {employeesLoading ? (
            <LoadingSpinner className="py-12" />
          ) : employees && employees.items.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Position</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Salary</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {employees.items.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{employee.name}</div>
                            <div className="text-sm text-slate-500">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {employee.position || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {employee.is_scientist ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            Scientist
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
                            Staff
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                        {employee.annual_salary ? formatCurrency(employee.annual_salary) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            employee.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setIsEmployeeModalOpen(true);
                          }}
                          className="mr-2 text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={employees.page}
                pageSize={employees.page_size}
                total={employees.total}
                onPageChange={setEmployeesPage}
              />
            </div>
          ) : (
            <EmptyState message="No employees found. Add an employee to get started." />
          )}
        </div>
      )}

      {/* Modals */}
      <EmployeeModal
        isOpen={isEmployeeModalOpen}
        onClose={() => {
          setIsEmployeeModalOpen(false);
          setEditingEmployee(null);
        }}
        onSave={handleSaveEmployee}
        employee={editingEmployee}
      />

      <NewRunModal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        onSave={handleCreateRun}
        employees={employees?.items || []}
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={() => setIsImportModalOpen(false)}></div>
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-slate-900">Import Payroll CSV</h3>
                <div className="mt-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    CSV format: employee_id, gross_wages, payg_withheld, super_amount, project_allocations, notes
                  </p>
                  {importResult && (
                    <div className={`mt-3 rounded-md p-3 text-sm ${importResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      {importResult.message}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={handleImportCSV}
                  disabled={!importFile}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 sm:ml-3 sm:w-auto"
                >
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
