'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import auth from '@/lib/auth';
import { integrations, XeroStatus, SyncResult } from '@/lib/integrations';
import { useToast } from '@/components/ui/Toast';
import {
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  contact_email: string | null;
  financial_year_end: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface CompanyFormData {
  name: string;
  abn: string;
  address: string;
  contact_email: string;
  financial_year_end: string;
}

type Tab = 'company' | 'users' | 'integrations';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Company state
  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: '',
    abn: '',
    address: '',
    contact_email: '',
    financial_year_end: '',
  });
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Xero integration state
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [isLoadingXero, setIsLoadingXero] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [lastSyncResults, setLastSyncResults] = useState<Record<string, SyncResult>>({});
  const [isPushingRd, setIsPushingRd] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addToast } = useToast();

  // Add/Edit user form
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'accountant' as 'admin' | 'accountant',
    is_active: true,
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  const fetchXeroStatus = useCallback(async () => {
    try {
      const res = await integrations.getXeroStatus();
      setXeroStatus(res.data);
    } catch {
      setXeroStatus(null);
    } finally {
      setIsLoadingXero(false);
    }
  }, []);

  // Fetch current user, company, and users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await auth.getCurrentUser();
        setCurrentUser(user);

        const companyRes = await api.get('/company/');
        setCompany(companyRes.data);
        setCompanyForm({
          name: companyRes.data.name || '',
          abn: companyRes.data.abn || '',
          address: companyRes.data.address || '',
          contact_email: companyRes.data.contact_email || '',
          financial_year_end: companyRes.data.financial_year_end || '',
        });

        await fetchUsers();
      } catch (error) {
        console.error('Error fetching settings data:', error);
      }
    };
    fetchData();
    fetchXeroStatus();
  }, [fetchXeroStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConnectXero = async () => {
    setIsConnecting(true);
    try {
      const res = await integrations.getXeroAuthUrl();
      window.open(res.data.auth_url, '_blank');

      // Poll for connection status
      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 3000;
        if (elapsed > 300000) {
          // 5 min timeout
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsConnecting(false);
          addToast({ title: 'Authorization timed out', description: 'Please try again.', variant: 'error' });
          return;
        }
        try {
          const statusRes = await integrations.getXeroStatus();
          if (statusRes.data.connected) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setXeroStatus(statusRes.data);
            setIsConnecting(false);
            addToast({ title: 'Xero connected', description: `Connected to ${statusRes.data.tenant_name || 'Xero'}`, variant: 'success' });
          }
        } catch {
          // keep polling
        }
      }, 3000);
    } catch (error: any) {
      setIsConnecting(false);
      addToast({ title: 'Connection failed', description: error.response?.data?.detail || 'Could not start Xero authorization', variant: 'error' });
    }
  };

  const handleDisconnectXero = async () => {
    setIsDisconnecting(true);
    try {
      await integrations.disconnectXero();
      setXeroStatus(null);
      setShowDisconnectConfirm(false);
      setLastSyncResults({});
      addToast({ title: 'Xero disconnected', variant: 'success' });
    } catch (error: any) {
      addToast({ title: 'Disconnect failed', description: error.response?.data?.detail || 'Failed to disconnect', variant: 'error' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async (syncType: string) => {
    setSyncingType(syncType);
    try {
      const res = await integrations.sync(syncType);
      setLastSyncResults((prev) => ({ ...prev, [syncType]: res.data }));
      if (res.data.success) {
        addToast({ title: `Sync ${syncType} complete`, description: `${res.data.items_synced} items synced`, variant: 'success' });
      } else {
        addToast({ title: `Sync ${syncType} had errors`, description: res.data.errors.join(', '), variant: 'warning' });
      }
      await fetchXeroStatus();
    } catch (error: any) {
      addToast({ title: `Sync ${syncType} failed`, description: error.response?.data?.detail || 'Sync failed', variant: 'error' });
    } finally {
      setSyncingType(null);
    }
  };

  const handleSyncAll = async () => {
    const types = ['contacts', 'invoices', 'transactions'];
    for (const t of types) {
      setSyncingType(t);
      try {
        const res = await integrations.sync(t);
        setLastSyncResults((prev) => ({ ...prev, [t]: res.data }));
      } catch {
        addToast({ title: `Sync ${t} failed`, variant: 'error' });
      }
    }
    setSyncingType(null);
    await fetchXeroStatus();
    addToast({ title: 'Sync all complete', variant: 'success' });
  };

  const handlePushRd = async () => {
    setIsPushingRd(true);
    try {
      const res = await integrations.pushRdCategorization();
      if (res.data.success) {
        addToast({ title: 'R&D push complete', description: `${res.data.items_pushed ?? 0} items pushed to Xero`, variant: 'success' });
      } else {
        addToast({ title: 'R&D push had errors', description: (res.data.errors ?? []).join(', '), variant: 'warning' });
      }
    } catch (error: any) {
      addToast({ title: 'R&D push failed', description: error.response?.data?.detail || 'Push failed', variant: 'error' });
    } finally {
      setIsPushingRd(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCompanySave = async () => {
    setIsSavingCompany(true);
    try {
      const res = await api.patch('/company/', companyForm);
      setCompany(res.data);
      setIsEditingCompany(false);
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Failed to save company details');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleCompanyCancel = () => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        abn: company.abn || '',
        address: company.address || '',
        contact_email: company.contact_email || '',
        financial_year_end: company.financial_year_end || '',
      });
    }
    setIsEditingCompany(false);
  };

  const handleAddUser = async () => {
    setIsSavingUser(true);
    try {
      await api.post('/auth/users', userForm);
      setShowAddUserDialog(false);
      resetUserForm();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.response?.data?.detail || 'Failed to add user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      await api.patch(`/auth/users/${editingUser.id}`, {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        is_active: userForm.is_active,
      });
      setEditingUser(null);
      resetUserForm();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const resetUserForm = () => {
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'accountant',
      is_active: true,
    });
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-600">
          Manage company settings and user accounts
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('company')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Company Info
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'integrations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Integrations
          </button>
        </nav>
      </div>

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
              <p className="text-sm text-slate-500">Manage your company details and settings</p>
            </div>
            {isAdmin && !isEditingCompany && (
              <button
                onClick={() => setIsEditingCompany(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name
                </label>
                {isEditingCompany ? (
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-slate-900">{company?.name || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ABN
                </label>
                {isEditingCompany ? (
                  <input
                    type="text"
                    value={companyForm.abn}
                    onChange={(e) => setCompanyForm({ ...companyForm, abn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="XX XXX XXX XXX"
                  />
                ) : (
                  <p className="text-slate-900">{company?.abn || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact Email
                </label>
                {isEditingCompany ? (
                  <input
                    type="email"
                    value={companyForm.contact_email}
                    onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-slate-900">{company?.contact_email || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Financial Year End
                </label>
                {isEditingCompany ? (
                  <input
                    type="text"
                    value={companyForm.financial_year_end}
                    onChange={(e) => setCompanyForm({ ...companyForm, financial_year_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="MM-DD"
                  />
                ) : (
                  <p className="text-slate-900">{company?.financial_year_end || '-'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                {isEditingCompany ? (
                  <textarea
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-slate-900 whitespace-pre-wrap">{company?.address || '-'}</p>
                )}
              </div>
            </div>

            {isEditingCompany && (
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={handleCompanySave}
                  disabled={isSavingCompany}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingCompany ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCompanyCancel}
                  disabled={isSavingCompany}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
              <p className="text-sm text-slate-500">Manage user accounts and permissions</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddUserDialog(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Add User
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {user.role === 'admin' ? 'Admin' : 'Accountant'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDate(user.last_login_at)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => openEditUser(user)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Xero Connection Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Xero Integration</h2>
              <p className="text-sm text-slate-500">Connect your Xero account to sync invoices, expenses, and contacts</p>
            </div>

            <div className="p-6">
              {isLoadingXero ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-500">Loading status...</span>
                </div>
              ) : !xeroStatus?.connected ? (
                /* Not connected */
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-semibold text-slate-900">Connect to Xero</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Connect your Xero account to automatically sync invoices, expenses, and contacts for R&D tax tracking.
                    </p>
                  </div>
                  <button
                    onClick={handleConnectXero}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for authorization...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4" />
                        Connect to Xero
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Connected */
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{xeroStatus.tenant_name || 'Xero'}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Connected
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Last synced: {xeroStatus.last_sync_at ? formatDate(xeroStatus.last_sync_at) : 'Never'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Unlink className="h-4 w-4" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sync Section (only if connected) */}
          {xeroStatus?.connected && (
            <>
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Data Sync</h2>
                    <p className="text-sm text-slate-500">Pull data from Xero into TaxEazy</p>
                  </div>
                  <button
                    onClick={handleSyncAll}
                    disabled={syncingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {syncingType !== null ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Sync All
                      </>
                    )}
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['contacts', 'invoices', 'transactions'] as const).map((syncType) => {
                    const result = lastSyncResults[syncType];
                    const isSyncing = syncingType === syncType;
                    return (
                      <div
                        key={syncType}
                        className="p-4 border border-slate-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-slate-900 capitalize">{syncType}</h3>
                          {result && (
                            result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-500" />
                            )
                          )}
                        </div>
                        {result && (
                          <p className="text-xs text-slate-500">
                            {result.items_synced} items synced
                            {result.errors.length > 0 && (
                              <span className="text-rose-500 block">{result.errors.length} error(s)</span>
                            )}
                          </p>
                        )}
                        <button
                          onClick={() => handleSync(syncType)}
                          disabled={syncingType !== null}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              Sync {syncType}
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Push R&D to Xero */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Push R&D to Xero</h2>
                  <p className="text-sm text-slate-500">
                    Push R&D categorisation back to Xero for tagged expenses
                  </p>
                </div>
                <div className="p-6">
                  <button
                    onClick={handlePushRd}
                    disabled={isPushingRd}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPushingRd ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Push R&D Categorisation
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* MYOB - Coming Soon */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm opacity-60">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">MYOB</h3>
                  <p className="text-sm text-slate-500">Connect to MYOB AccountRight</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Disconnect Xero?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This will revoke access tokens and remove the integration. You can reconnect later.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 text-slate-700 text-sm font-medium hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectXero}
                disabled={isDisconnecting}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Dialog */}
      {showAddUserDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add New User</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Set password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'accountant' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddUserDialog(false);
                  resetUserForm();
                }}
                className="px-4 py-2 text-slate-700 text-sm font-medium hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isSavingUser || !userForm.name || !userForm.email || !userForm.password}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingUser ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Edit User</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'accountant' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={userForm.is_active}
                  onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  Active
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setEditingUser(null);
                  resetUserForm();
                }}
                className="px-4 py-2 text-slate-700 text-sm font-medium hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={isSavingUser || !userForm.name || !userForm.email}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingUser ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
