import api from './api';
import {
  Project,
  ProjectListItem,
  ProjectDetail,
  ProjectCreate,
  ProjectUpdate,
  RdActivity,
  RdActivityCreate,
  RdActivityUpdate,
  SpendSummary,
  EvidenceStatus,
  PaginatedResponse,
  ProjectStatus
} from '@/types/project';

// Projects API
export async function getProjects(
  status?: ProjectStatus,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<ProjectListItem>> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  
  const response = await api.get(`/projects/?${params.toString()}`);
  return response.data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const response = await api.get(`/projects/${id}`);
  return response.data;
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  const response = await api.post('/projects/', data);
  return response.data;
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<Project> {
  const response = await api.patch(`/projects/${id}`, data);
  return response.data;
}

export async function getSpendSummary(id: string): Promise<SpendSummary> {
  const response = await api.get(`/projects/${id}/spend-summary`);
  return response.data;
}

export async function getEvidenceStatus(id: string): Promise<EvidenceStatus> {
  const response = await api.get(`/projects/${id}/evidence-status`);
  return response.data;
}

// R&D Activities API
export async function getActivities(
  projectId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<RdActivity>> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  
  const response = await api.get(`/projects/${projectId}/activities/?${params.toString()}`);
  return response.data;
}

export async function createActivity(
  projectId: string,
  data: RdActivityCreate
): Promise<RdActivity> {
  const response = await api.post(`/projects/${projectId}/activities/`, data);
  return response.data;
}

export async function updateActivity(
  projectId: string,
  activityId: string,
  data: RdActivityUpdate
): Promise<RdActivity> {
  const response = await api.patch(`/projects/${projectId}/activities/${activityId}`, data);
  return response.data;
}

export async function deleteActivity(projectId: string, activityId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/activities/${activityId}`);
}
