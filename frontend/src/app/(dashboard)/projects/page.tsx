'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  PauseCircle
} from 'lucide-react';
import { getProjects, createProject } from '@/lib/projects';
import { ProjectListItem, ProjectStatus, ProjectCreate } from '@/types/project';
import { formatCurrency, formatDate } from '@/lib/utils';

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: React.ReactNode }> = {
  planning: { 
    label: 'Planning', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="w-3 h-3" />
  },
  active: { 
    label: 'Active', 
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  on_hold: { 
    label: 'On Hold', 
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <PauseCircle className="w-3 h-3" />
  },
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState<ProjectCreate>({
    code: '',
    name: '',
    description: '',
    status: 'planning',
    budget: undefined,
    start_date: '',
    end_date: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    // Check if user is admin from local storage or auth context
    const checkAdmin = () => {
      // This is a simplified check - in production, use proper auth context
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
    fetchProjects();
  }, [statusFilter]);

  async function fetchProjects() {
    try {
      setLoading(true);
      const status = statusFilter || undefined;
      const response = await getProjects(status, 1, 50);
      setProjects(response.items);
      setError(null);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreateLoading(true);
      await createProject({
        ...createForm,
        budget: createForm.budget ? Number(createForm.budget) : undefined,
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        code: '',
        name: '',
        description: '',
        status: 'planning',
        budget: undefined,
        start_date: '',
        end_date: '',
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getEvidenceColor(percentage: number): string {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">R&D Projects</h1>
          <p className="mt-1 text-slate-600">
            Manage R&D projects and track activities
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status];
            const budgetUsed = project.budget 
              ? (project.total_spend / project.budget) * 100 
              : 0;

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {project.code}
                    </span>
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </span>
                </div>

                {/* Description */}
                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Stats */}
                <div className="space-y-3">
                  {/* Date Range */}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>
                      {project.start_date 
                        ? formatDate(project.start_date)
                        : 'No start date'
                      }
                      {project.end_date && ` - ${formatDate(project.end_date)}`}
                    </span>
                  </div>

                  {/* Budget */}
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">
                          {formatCurrency(project.total_spend)} spent
                        </span>
                        {project.budget && (
                          <span className="text-slate-500">
                            of {formatCurrency(project.budget)}
                          </span>
                        )}
                      </div>
                      {project.budget && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              budgetUsed > 100 ? 'bg-red-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Activity className="w-4 h-4 text-slate-400" />
                        {project.activities_count} activities
                      </div>
                    </div>
                    
                    {/* Evidence Completeness */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Evidence</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getEvidenceColor(project.evidence_completeness)}`}
                          style={{ width: `${project.evidence_completeness}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {Math.round(project.evidence_completeness)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProjects.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No projects found</h3>
          <p className="text-slate-600">
            {searchQuery || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first R&D project'}
          </p>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Create New Project</h2>
              <p className="text-slate-600 mt-1">Enter the details for your new R&D project</p>
            </div>
            
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="PROJ-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as ProjectStatus })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Brief description of the project"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Budget
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.budget || ''}
                    onChange={(e) => setCreateForm({ ...createForm, budget: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
