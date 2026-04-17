'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { LinkedType, EvidenceFile } from '@/types/evidence';
import { uploadEvidence } from '@/lib/evidence';

interface EvidenceUploaderProps {
  linkedType: LinkedType;
  linkedId: string;
  onUploadComplete?: (evidence: EvidenceFile) => void;
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function EvidenceUploader({ linkedType, linkedId, onUploadComplete }: EvidenceUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: PDF, images, CSV, XLSX, DOC/DOCX';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    setSuccess(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const evidence = await uploadEvidence(
        selectedFile,
        linkedType,
        linkedId,
        description || undefined,
        tags || undefined
      );

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess(true);

      // Reset form after successful upload
      setTimeout(() => {
        setSelectedFile(null);
        setDescription('');
        setTags('');
        setUploadProgress(0);
        setSuccess(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1500);

      if (onUploadComplete) {
        onUploadComplete(evidence);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    return <File className="h-8 w-8 text-blue-600" />;
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Drop Zone */}
      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowseClick}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-slate-400'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleInputChange}
            className="hidden"
            accept={ALLOWED_FILE_TYPES.join(',')}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-slate-100 p-3">
              <Upload className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Drop your file here, or{' '}
                <span className="text-blue-600 hover:text-blue-700">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, Images, CSV, XLSX, DOC/DOCX up to 50MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Selected File Preview */
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-50 p-3">
              {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium text-slate-900">
                  {selectedFile.name}
                </p>
                {!isUploading && (
                  <button
                    onClick={handleRemoveFile}
                    className="ml-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatFileSize(selectedFile.size)}
              </p>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Upload successful!</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Field */}
          <div className="mt-4">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Add a description for this file..."
            />
          </div>

          {/* Tags Field */}
          <div className="mt-4">
            <label htmlFor="tags" className="block text-sm font-medium text-slate-700">
              Tags <span className="text-slate-400">(optional, comma-separated)</span>
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={isUploading}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="e.g. invoice, receipt, 2024"
            />
          </div>

          {/* Upload Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || success}
              className={`
                inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white
                ${isUploading || success
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Uploaded
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload File
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
