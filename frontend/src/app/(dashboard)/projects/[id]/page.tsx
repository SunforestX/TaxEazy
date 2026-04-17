'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Calendar,
  DollarSign,
  Activity,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  PauseCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  PieChart,
  Users,
  FileCheck,
  X,
} from 'lucide-react';
import {
  getProject,
  updateProject,
  getSpendSummary,
  getEvidenceStatus,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '@/lib/projects';
import {
  ProjectDetail,
  ProjectStatus,
  RdActivity,
  SpendSummary,
  EvidenceStatus,
  RdActivityCreate,
  RdActivityUpdate,
  ProjectUpdate,
} from '@/types/project';
import { formatCurrency, formatDate } from '@/lib/utils';

type Tab = 'overview' | 'activities' | 'spend' | 'evidence';

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  planning: {
    label: 'Planning',
    color: 'text-blue-800 border-blue-200',
    bgColor: 'bg-blue-50',
    icon: <Clock className="w-4 h-4" />,
  },
  active: {
    label: 'Active',
    color: 'text-emerald-800 border-emerald-200',
    bgColor: 'bg-emerald-50',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  completed: {
    label: 'Completed',
    color: 'text-slate-800 border-slate-200',
    bgColor: 'bg-slate-50',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  on_hold: {
    label: 'On Hold',
    color: 'text-amber-800 border-amber-200',
    bgColor: 'bg-amber-50',
    icon: <PauseCircle className="w-4 h-4" />,
  },
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [spendSummary, setSpendSummary] = useState<SpendSummary | null>(null);
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus | null>(null);
  const [activities, setActivities] = useState<RdActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<ProjectUpdate>({});
  const [editLoading, setEditLoading] = useState(false);

  // Activity modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityForm, setActivityForm] = useState<RdActivityCreate>({
    title: '',
    activity_date: new Date().toISOString().split('T')[0],
  });
  const [activityLoading, setActivityLoading] = useState(false);
  const [editingActivity, setEditingActivity] = useState<RdActivity | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setIsAdmin(payload.role === 'admin');
        } catch {
          setIsAdmin(false);
        }
      }
    };
    checkAdmin();
    fetchProjectData();
  }, [projectId]);

  async function fetchProjectData() {
    try {
      setLoading(true);
      const [projectData, spendData, evidenceData, activitiesData] = await Promise.all([
        getProject(projectId),
        getSpendSummary(projectId),
        getEvidenceStatus(projectId),
        getActivities(projectId),
      ]);
      setProject(projectData);
      setSpendSummary(spendData);
      setEvidenceStatus(evidenceData);
      setActivities(activitiesData.items);
      setError(null);
    } catch (err) {
      setError('Failed to load project data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      setEditLoading(true);
      await updateProject(projectId, editForm);
      setIsEditModalOpen(false);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to update project:', err);
      alert('Failed to update project');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      setActivityLoading(true);
      if (editingActivity) {
        await updateActivity(projectId, editingActivity.id, activityForm as RdActivityUpdate);
      } else {
        await createActivity(projectId, activityForm);
      }
      setIsActivityModalOpen(false);
      setEditingActivity(null);
      setActivityForm({
        title: '',
        activity_date: new Date().toISOString().split('T')[0],
      });
      fetchProjectData();
    } catch (err) {
      console.error('Failed to save activity:', err);
      alert('Failed to save activity');
    } finally {
      setActivityLoading(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('Are you sure you want to delete this activity?')) return;
    try {
      await deleteActivity(projectId, activityId);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to delete activity:', err);
      alert('Failed to delete activity');
    }
  }

  function openEditModal() {
    if (!project) return;
    setEditForm({
      name: project.name,
      description: project.description,
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date,
      budget: project.budget,
      scientific_rationale: project.scientific_rationale,
      eligibility_notes: project.eligibility_notes,
    });
    setIsEditModalOpen(true);
  }

  function openActivityModal(activity?: RdActivity) {
    if (activity) {
      setEditingActivity(activity);
      setActivityForm({
        title: activity.title,
        description: activity.description,
        activity_date: activity.activity_date,
        hours: activity.hours,
        personnel: activity.personnel,
        methodology: activity.methodology,
        results: activity.results,
        notes: activity.notes,
      });
    } else {
      setEditingActivity(null);
      setActivityForm({
        title: '',
        activity_date: new Date().toISOString().split('T')[0],
      });
    }
    setIsActivityModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
        <AlertCircle className="w-5 h-5" />
        {error || 'Project not found'}
      </div>
    );
  }

  const status = statusConfig[project.status];
  const budgetUsed = project.budget ? (project.total_spend / project.budget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/projects')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color}`}>
              {status.icon}
              {status.label}
            </span>
          </div>
          <p className="text-slate-600 mt-1">{project.code}</p>
        </div>
        {isAdmin && (
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: FileText },
            { id: 'activities', label: 'Activities', icon: Activity },
            { id: 'spend', label: 'Spend', icon: PieChart },
            { id: 'evidence', label: 'Evidence', icon: FileCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Budget Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Budget</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {project.budget ? formatCurrency(project.budget) : 'Not set'}
                </div>
                {project.budget && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">
                        {formatCurrency(project.total_spend)} spent
                      </span>
                      <span className={`font-medium ${budgetUsed > 100 ? 'text-red-600' : 'text-slate-600'}`}>
                        {budgetUsed.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${budgetUsed > 100 ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Activities Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Activities</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{project.activities_count}</div>
                <p className="text-sm text-slate-600 mt-1">
                  R&D activities logged
                </p>
              </div>

              {/* Evidence Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <FileCheck className="w-4 h-4" />
                  <span className="text-sm font-medium">Evidence</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {project.evidence_status?.completeness_percentage ?? 0}%
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (project.evidence_status?.completeness_percentage ?? 0) >= 80
                          ? 'bg-emerald-500'
                          : (project.evidence_status?.completeness_percentage ?? 0) >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${project.evidence_status?.completeness_percentage ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Project Details */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-slate-600">Date Range</label>
                  <div className="flex items-center gap-2 mt-1 text-slate-900">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {project.start_date ? formatDate(project.start_date) : 'Not set'}
                    {project.end_date && ` - ${formatDate(project.end_date)}`}
                  </div>
                </div>
                {project.description && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Description</label>
                    <p className="mt-1 text-slate-900">{project.description}</p>
                  </div>
                )}
                {project.scientific_rationale && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Scientific Rationale</label>
                    <p className="mt-1 text-slate-900">{project.scientific_rationale}</p>
                  </div>
                )}
                {project.eligibility_notes && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Eligibility Notes</label>
                    <p className="mt-1 text-slate-900">{project.eligibility_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">R&D Activities</h3>
              {isAdmin && (
                <button
                  onClick={() => openActivityModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Activity
                </button>
              )}
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No activities yet</h3>
                <p className="text-slate-600">Start logging R&D activities for this project</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div
                      className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-slate-900">{activity.title}</h4>
                          <span className="text-sm text-slate-500">{formatDate(activity.activity_date)}</span>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-1">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          {activity.hours !== undefined && activity.hours > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {activity.hours} hours
                            </span>
                          )}
                          {activity.personnel && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {activity.personnel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openActivityModal(activity);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteActivity(activity.id);
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {expandedActivity === activity.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                    {expandedActivity === activity.id && (
                      <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activity.methodology && (
                            <div>
                              <label className="text-sm font-medium text-slate-600">Methodology</label>
                              <p className="text-sm text-slate-900 mt-1">{activity.methodology}</p>
                            </div>
                          )}
                          {activity.results && (
                            <div>
                              <label className="text-sm font-medium text-slate-600">Results</label>
                              <p className="text-sm text-slate-900 mt-1">{activity.results}</p>
                            </div>
                          )}
                          {activity.notes && (
                            <div className="md:col-span-2">
                              <label className="text-sm font-medium text-slate-600">Notes</label>
                              <p className="text-sm text-slate-900 mt-1">{activity.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spend Tab */}
        {activeTab === 'spend' && spendSummary && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Spend Summary</h3>
              <div className="text-3xl font-bold text-slate-900 mb-6">
                {formatCurrency(spendSummary.total)}
              </div>

              <div className="space-y-4">
                {Object.entries(spendSummary.categories).map(([category, amount]) => {
                  const percentage = spendSummary.total > 0 ? (amount / spendSummary.total) * 100 : 0;
                  const categoryLabels: Record<string, string> = {
                    salaries: 'Salaries & Wages',
                    cro_contractor: 'CRO / Contractor',
                    consumables: 'Consumables',
                    equipment: 'Equipment',
                    other: 'Other',
                  };
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {categoryLabels[category] || category}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(amount)}
                          </span>
                          <span className="text-xs text-slate-500 w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && evidenceStatus && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Evidence Completeness</h3>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl font-bold text-slate-900">
                  {evidenceStatus.completeness_percentage}%
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        evidenceStatus.completeness_percentage >= 80
                          ? 'bg-emerald-500'
                          : evidenceStatus.completeness_percentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${evidenceStatus.completeness_percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${evidenceStatus.has_activities ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${evidenceStatus.has_activities ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">R&D Activities</p>
                    <p className="text-sm text-slate-600">
                      {evidenceStatus.activities_count} activities logged
                    </p>
                  </div>
                  {evidenceStatus.has_activities ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${evidenceStatus.has_transactions ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${evidenceStatus.has_transactions ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Linked Transactions</p>
                    <p className="text-sm text-slate-600">
                      {evidenceStatus.transactions_count} transactions linked
                    </p>
                  </div>
                  {evidenceStatus.has_transactions ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${evidenceStatus.has_evidence_files ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${evidenceStatus.has_evidence_files ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Evidence Files</p>
                    <p className="text-sm text-slate-600">
                      {evidenceStatus.evidence_files_count} files uploaded
                    </p>
                  </div>
                  {evidenceStatus.has_evidence_files ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Note:</strong> Evidence vault component will be added in a future update to manage all project-related files and documentation.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Edit Project</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status || 'planning'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Budget
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.budget || ''}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Scientific Rationale
                </label>
                <textarea
                  value={editForm.scientific_rationale || ''}
                  onChange={(e) => setEditForm({ ...editForm, scientific_rationale: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Eligibility Notes
                </label>
                <textarea
                  value={editForm.eligibility_notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, eligibility_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingActivity ? 'Edit Activity' : 'Add Activity'}
              </h2>
              <button
                onClick={() => setIsActivityModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleCreateActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Activity title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={activityForm.description || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Brief description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={activityForm.activity_date}
                    onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={activityForm.hours || ''}
                    onChange={(e) => setActivityForm({ ...activityForm, hours: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Personnel
                </label>
                <input
                  type="text"
                  value={activityForm.personnel || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, personnel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Names of people involved"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Methodology
                </label>
                <textarea
                  value={activityForm.methodology || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, methodology: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Methodology used"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Results
                </label>
                <textarea
                  value={activityForm.results || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, results: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Results achieved"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={activityForm.notes || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Additional notes"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={activityLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {activityLoading ? 'Saving...' : editingActivity ? 'Update Activity' : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
