'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  CheckCircle,
} from 'lucide-react';
import { LinkedType, EvidenceFile } from '@/types/evidence';
import {
  getEvidenceList,
  downloadEvidence,
  deleteEvidence,
  triggerFileDownload,
} from '@/lib/evidence';
import { useAuth } from '@/components/auth/AuthProvider';

interface EvidenceListProps {
  linkedType?: LinkedType;
  linkedId?: string;
}

interface User {
  id: string;
  role: string;
}

export function EvidenceList({ linkedType, linkedId }: EvidenceListProps) {
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { user } = useAuth() as { user: User | null };

  const isAdmin = user?.role === 'ADMIN';

  const fetchEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getEvidenceList(linkedType, linkedId);
      setEvidenceFiles(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence files');
    } finally {
      setIsLoading(false);
    }
  }, [linkedType, linkedId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleDownload = async (evidence: EvidenceFile) => {
    setDownloadingId(evidence.id);
    try {
      const blob = await downloadEvidence(evidence.id);
      triggerFileDownload(blob, evidence.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    setDeletingId(evidenceId);
    try {
      await deleteEvidence(evidenceId);
      setEvidenceFiles((prev) => prev.filter((e) => e.id !== evidenceId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <FileIcon className="h-5 w-5 text-slate-500" />;
    
    if (fileType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-purple-600" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-600" />;
    }
    if (
      fileType.includes('spreadsheet') ||
      fileType.includes('excel') ||
      fileType === 'text/csv'
    ) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }
    if (fileType.includes('word')) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    return <FileIcon className="h-5 w-5 text-slate-500" />;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileTypeLabel = (fileType: string | null): string => {
    if (!fileType) return 'Unknown';
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.startsWith('image/')) return 'Image';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'Spreadsheet';
    if (fileType === 'text/csv') return 'CSV';
    if (fileType.includes('word')) return 'Document';
    return 'File';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          onClick={fetchEvidence}
          className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (evidenceFiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
        <FileIcon className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">No evidence files</h3>
        <p className="mt-1 text-sm text-slate-500">
          No files have been uploaded for this {linkedType?.toLowerCase() || 'entity'} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-md bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="rounded-full p-1 text-red-600 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Evidence Files List */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-200">
          {evidenceFiles.map((evidence) => (
            <li
              key={evidence.id}
              className="flex items-start gap-4 p-4 hover:bg-slate-50"
            >
              {/* File Icon */}
              <div className="flex-shrink-0 rounded-lg bg-slate-100 p-2">
                {getFileIcon(evidence.file_type)}
              </div>

              {/* File Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {evidence.filename}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{getFileTypeLabel(evidence.file_type)}</span>
                      {evidence.file_size && (
                        <span>• {evidence.file_size}</span>
                      )}
                      <span>• {formatDate(evidence.uploaded_at)}</span>
                    </div>
                    
                    {/* Description */}
                    {evidence.description && (
                      <p className="mt-2 text-sm text-slate-600">
                        {evidence.description}
                      </p>
                    )}

                    {/* Tags */}
                    {evidence.tags && evidence.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {evidence.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Download Button */}
                    <button
                      onClick={() => handleDownload(evidence)}
                      disabled={downloadingId === evidence.id}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                      title="Download"
                    >
                      {downloadingId === evidence.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>

                    {/* Delete Button (Admin Only) */}
                    {isAdmin && (
                      <>
                        {deleteConfirmId === evidence.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(evidence.id)}
                              disabled={deletingId === evidence.id}
                              className="rounded-md bg-red-600 p-2 text-white hover:bg-red-700 disabled:opacity-50"
                              title="Confirm delete"
                            >
                              {deletingId === evidence.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deletingId === evidence.id}
                              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(evidence.id)}
                            className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Summary */}
      <p className="text-center text-xs text-slate-500">
        Showing {evidenceFiles.length} file{evidenceFiles.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
