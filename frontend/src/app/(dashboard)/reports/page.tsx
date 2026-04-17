'use client';

import { useState, useEffect } from 'react';
import { getMonthlyReport, exportMonthlyReport, getRdSummary, getComplianceStatus, downloadCsv } from '@/lib/reports';
import type { MonthlyReport, RdSummary, ComplianceStatus } from '@/types/report';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'monthly' | 'rd' | 'compliance'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Report data states
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [rdSummary, setRdSummary] = useState<RdSummary | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load monthly report
  const loadMonthlyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await getMonthlyReport(selectedYear, selectedMonth + 1);
      setMonthlyReport(report);
    } catch (err) {
      setError('Failed to load monthly report. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Export monthly report
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportMonthlyReport(selectedYear, selectedMonth + 1);
      const filename = `monthly_report_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.csv`;
      downloadCsv(blob, filename);
    } catch (err) {
      setError('Failed to export report. Please try again.');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  // Load R&D summary
  const loadRdSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await getRdSummary();
      setRdSummary(summary);
    } catch (err) {
      setError('Failed to load R&D summary. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load compliance status
  const loadComplianceStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getComplianceStatus();
      setComplianceStatus(status);
    } catch (err) {
      setError('Failed to load compliance status. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'monthly' && !monthlyReport) {
      loadMonthlyReport();
    } else if (activeTab === 'rd' && !rdSummary) {
      loadRdSummary();
    } else if (activeTab === 'compliance' && !complianceStatus) {
      loadComplianceStatus();
    }
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'complete':
      case 'finalised':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
      case 'incomplete':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
      case 'complete':
      case 'finalised':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
      case 'incomplete':
      case 'draft':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-slate-600">
          Generate monthly summaries, R&D reports, and compliance status
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'monthly'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Monthly Report
          </button>
          <button
            onClick={() => setActiveTab('rd')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rd'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            R&D Summary (YTD)
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'compliance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Compliance Status
          </button>
        </nav>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tab 1: Monthly Report */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadMonthlyReport}
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Load Report'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || !monthlyReport}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading report...</p>
            </div>
          )}

          {/* Report content */}
          {!loading && monthlyReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* GST Summary Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">GST Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Collected</span>
                    <span className="font-medium text-green-600">{formatCurrency(monthlyReport.gst_summary.collected)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Paid</span>
                    <span className="font-medium text-red-600">{formatCurrency(monthlyReport.gst_summary.paid)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-900">Net</span>
                      <span className={`font-bold ${monthlyReport.gst_summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(monthlyReport.gst_summary.net)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAYG Summary Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">PAYG Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Gross</span>
                    <span className="font-medium">{formatCurrency(monthlyReport.payg_summary.total_gross)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">PAYG Withheld</span>
                    <span className="font-medium">{formatCurrency(monthlyReport.payg_summary.total_payg)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Super</span>
                    <span className="font-medium">{formatCurrency(monthlyReport.payg_summary.total_super)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Employees</span>
                      <span className="font-medium">{monthlyReport.payg_summary.employee_count}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Spend Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Operating Spend</h3>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(monthlyReport.total_operating_spend)}</p>
                  <p className="text-sm text-slate-500 mt-1">Total for {MONTHS[monthlyReport.month - 1]} {monthlyReport.year}</p>
                </div>
              </div>

              {/* R&D Spend Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6 md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">R&D Spend</h3>
                <div className="mb-4">
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(monthlyReport.rd_eligible_spend)}</p>
                  <p className="text-sm text-slate-500">Eligible R&D expenditure</p>
                </div>
                {monthlyReport.rd_spend_by_project.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 font-medium text-slate-700">Project</th>
                          <th className="text-right py-2 font-medium text-slate-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyReport.rd_spend_by_project.map((proj, index) => (
                          <tr key={index} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 text-slate-900">{proj.project_name}</td>
                            <td className="py-2 text-right font-medium">{formatCurrency(proj.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No R&D spend allocated to projects this month.</p>
                )}
              </div>

              {/* Issues Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Issues</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Outstanding Issues</span>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      monthlyReport.outstanding_issues_count > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {monthlyReport.outstanding_issues_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Missing Evidence</span>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      monthlyReport.missing_evidence_count > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {monthlyReport.missing_evidence_count}
                    </span>
                  </div>
                  {monthlyReport.unresolved_exceptions.length > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">Unresolved Exceptions</p>
                      <div className="space-y-1">
                        {monthlyReport.unresolved_exceptions.map((exc, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-slate-600">{exc.type.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{exc.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !monthlyReport && !error && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Report Loaded</h3>
              <p className="text-slate-500 mb-4">Select a month and year, then click Load Report to view data.</p>
              <button
                onClick={loadMonthlyReport}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Load Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: R&D Summary */}
      {activeTab === 'rd' && (
        <div className="space-y-6">
          {loading && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading R&D summary...</p>
            </div>
          )}

          {!loading && rdSummary && (
            <>
              {/* Financial Year Header */}
              <div className="bg-indigo-600 rounded-lg p-6 text-white">
                <p className="text-indigo-100 text-sm font-medium">Financial Year</p>
                <h2 className="text-3xl font-bold">{rdSummary.financial_year}</h2>
                <p className="text-indigo-100 text-sm mt-1">July 1 - June 30</p>
              </div>

              {/* Total R&D Spend */}
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                <p className="text-slate-500 text-sm font-medium mb-2">Total R&D Spend</p>
                <p className="text-5xl font-bold text-indigo-600">{formatCurrency(rdSummary.total_rd_spend)}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Project */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">By Project</h3>
                  {rdSummary.by_project.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 font-medium text-slate-700">Project</th>
                            <th className="text-right py-3 font-medium text-slate-700">Spend</th>
                            <th className="text-right py-3 font-medium text-slate-700">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rdSummary.by_project.map((proj) => (
                            <tr key={proj.project_id} className="border-b border-slate-100 last:border-0">
                              <td className="py-3 text-slate-900">{proj.project_name}</td>
                              <td className="py-3 text-right font-medium">{formatCurrency(proj.spend)}</td>
                              <td className="py-3 text-right text-slate-500">{formatPercentage(proj.percentage)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No R&D spend allocated to projects.</p>
                  )}
                </div>

                {/* By Category */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">By Category</h3>
                  {Object.keys(rdSummary.by_category).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(rdSummary.by_category).map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                          <span className="text-slate-700">{category}</span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No R&D spend by category.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {!loading && !rdSummary && !error && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No R&D Data</h3>
              <p className="text-slate-500 mb-4">Unable to load R&D summary data.</p>
              <button
                onClick={loadRdSummary}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Compliance Status */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {loading && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading compliance status...</p>
            </div>
          )}

          {!loading && complianceStatus && (
            <>
              {/* Overall Status */}
              <div className={`rounded-lg p-6 border-2 ${getStatusColor(complianceStatus.overall_status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(complianceStatus.overall_status)}
                  <div>
                    <p className="text-sm font-medium opacity-80">Overall Status</p>
                    <p className="text-2xl font-bold capitalize">{complianceStatus.overall_status}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BAS Status */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">BAS Status</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(complianceStatus.bas_status.status)}`}>
                      {complianceStatus.bas_status.status}
                    </span>
                  </div>
                  {complianceStatus.bas_status.current_period ? (
                    <p className="text-slate-600">Current Period: {complianceStatus.bas_status.current_period}</p>
                  ) : (
                    <p className="text-slate-500">No BAS periods configured</p>
                  )}
                </div>

                {/* PAYG Status */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">PAYG Status</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(complianceStatus.payg_status.status)}`}>
                      {complianceStatus.payg_status.status}
                    </span>
                  </div>
                  {complianceStatus.payg_status.current_month && (
                    <p className="text-slate-600">Current Month: {complianceStatus.payg_status.current_month}</p>
                  )}
                </div>

                {/* Evidence Gaps */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Evidence Gaps</h3>
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl font-bold ${
                      complianceStatus.evidence_gaps_count > 0 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {complianceStatus.evidence_gaps_count}
                    </span>
                    <span className="text-slate-600">transactions &gt;$1000 without evidence</span>
                  </div>
                </div>

                {/* Unresolved Exceptions */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Unresolved Exceptions</h3>
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl font-bold ${
                      complianceStatus.unresolved_exceptions_count > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {complianceStatus.unresolved_exceptions_count}
                    </span>
                    <span className="text-slate-600">issues requiring attention</span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Recommendations</h3>
                <div className="space-y-2">
                  {complianceStatus.overall_status === 'good' && (
                    <p className="text-green-700 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Your compliance status is good. Keep up the good work!
                    </p>
                  )}
                  {complianceStatus.overall_status === 'warning' && (
                    <>
                      <p className="text-yellow-700 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Attention needed: Review evidence gaps and unresolved exceptions.
                      </p>
                      {complianceStatus.evidence_gaps_count > 0 && (
                        <p className="text-slate-600 ml-7">• Attach evidence to high-value transactions</p>
                      )}
                      {complianceStatus.unresolved_exceptions_count > 0 && (
                        <p className="text-slate-600 ml-7">• Resolve outstanding exceptions in the Exceptions page</p>
                      )}
                    </>
                  )}
                  {complianceStatus.overall_status === 'critical' && (
                    <>
                      <p className="text-red-700 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Critical: High severity issues require immediate attention!
                      </p>
                      <p className="text-slate-600 ml-7">• Address all high-severity exceptions immediately</p>
                      <p className="text-slate-600 ml-7">• Review and finalize pending BAS periods</p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {!loading && !complianceStatus && !error && (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Compliance Data</h3>
              <p className="text-slate-500 mb-4">Unable to load compliance status.</p>
              <button
                onClick={loadComplianceStatus}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
