'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import auth from '@/lib/auth';

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

  // Add/Edit user form
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'accountant' as 'admin' | 'accountant',
    is_active: true,
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

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
  }, []);

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
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Accounting Integrations</h2>
              <p className="text-sm text-slate-500">Connect with external accounting software</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Xero Integration */}
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Xero</h3>
                    <p className="text-sm text-slate-500">Connect to Xero Accounting</p>
                  </div>
                </div>
                <button
                  disabled
                  className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>

              {/* MYOB Integration */}
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
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
                <button
                  disabled
                  className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
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
