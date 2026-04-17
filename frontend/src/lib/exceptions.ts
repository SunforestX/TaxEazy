import api from './api';
import {
  Exception,
  PaginatedExceptions,
  ExceptionSummary,
  RuleDefinition,
  RulesRunSummary,
  ExceptionFilter,
  ExceptionResolveRequest,
} from '@/types/exception';

export async function getExceptions(
  filters?: ExceptionFilter,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedExceptions> {
  const params = new URLSearchParams();
  
  if (filters?.exception_type) {
    params.append('exception_type', filters.exception_type);
  }
  if (filters?.severity) {
    params.append('severity', filters.severity);
  }
  if (filters?.is_resolved !== undefined) {
    params.append('is_resolved', String(filters.is_resolved));
  }
  
  params.append('page', String(page));
  params.append('page_size', String(pageSize));
  
  const response = await api.get<PaginatedExceptions>(`/exceptions/?${params.toString()}`);
  return response.data;
}

export async function getException(id: string): Promise<Exception> {
  const response = await api.get<Exception>(`/exceptions/${id}`);
  return response.data;
}

export async function resolveException(
  id: string,
  notes: string
): Promise<Exception> {
  const data: ExceptionResolveRequest = { notes };
  const response = await api.patch<Exception>(`/exceptions/${id}/resolve`, data);
  return response.data;
}

export async function getExceptionSummary(): Promise<ExceptionSummary> {
  const response = await api.get<ExceptionSummary>('/exceptions/summary');
  return response.data;
}

export async function getRules(): Promise<RuleDefinition[]> {
  const response = await api.get<RuleDefinition[]>('/rules/');
  return response.data;
}

export async function runAllRules(): Promise<RulesRunSummary> {
  const response = await api.post<RulesRunSummary>('/rules/run');
  return response.data;
}

export async function runRule(ruleId: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/rules/run/${ruleId}`);
  return response.data;
}
