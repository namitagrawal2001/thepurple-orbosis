"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  X,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import { adminBulkApi } from '@/lib/api/admin/bulk';

export default function BulkProductUploadPage() {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Active Job Tracking
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  // Past Import History
  const [history, setHistory] = useState([]);

  useEffect(() => {
    adminBulkApi.listImportHistory().then((res) => {
      setHistory(res?.imports || []);
    });
  }, []);

  // Poll active BullMQ job status
  useEffect(() => {
    if (!activeJobId) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await adminBulkApi.getImportJobStatus(activeJobId);
        const job = res?.job;
        setJobStatus(job);

        if (
          job?.status === 'COMPLETED' ||
          job?.status === 'FAILED' ||
          job?.status === 'PARTIALLY_COMPLETED'
        ) {
          clearInterval(interval);
          setIsImporting(false);
          // Refresh history
          adminBulkApi.listImportHistory().then((hRes) => setHistory(hRes?.imports || []));
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleDownloadTemplate = async () => {
    try {
      await adminBulkApi.downloadTemplate();
    } catch {
      alert('Failed to download sample template');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationResult(null);
    setErrorMessage('');
    setIsValidating(true);

    try {
      const data = await adminBulkApi.validateBulkFile(file);
      setValidationResult(data);
    } catch (err) {
      setErrorMessage(err.message || 'File validation failed');
      setSelectedFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile || !validationResult || validationResult.validCount === 0) return;

    setIsImporting(true);
    setErrorMessage('');

    try {
      const res = await adminBulkApi.executeBulkImport(selectedFile);
      setActiveJobId(res?.importId || null);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start bulk import');
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setErrorMessage('');
    setActiveJobId(null);
    setJobStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/admin/products"
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: '#FAF5FF',
              border: '1px solid #E9D5FF',
              color: '#7E22CE',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2E1065', margin: 0 }}>
              Bulk Product Upload
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Import hundreds of products asynchronously via Excel (.xlsx) or CSV with BullMQ
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadTemplate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #E9D5FF',
            color: '#7E22CE',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(107, 33, 168, 0.05)',
          }}
        >
          <Download size={16} />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* Upload Box */}
      {!selectedFile && !activeJobId && (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: '#ffffff',
            border: '2px dashed #C084FC',
            borderRadius: '20px',
            padding: '50px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '28px',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .csv"
            style={{ display: 'none' }}
          />
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#FAF5FF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7E22CE',
            marginBottom: '16px',
          }}>
            <FileSpreadsheet size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1E1B4B', margin: '0 0 6px 0' }}>
            Click to choose or drop your Excel/CSV file here
          </h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Supports .xlsx and .csv files up to 25MB (300+ products per file)
          </p>
        </div>
      )}

      {/* Validation Loader */}
      {isValidating && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #E9D5FF',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '28px',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '3px solid #E9D5FF',
            borderTopColor: '#7E22CE',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <h4 style={{ color: '#1E1B4B', margin: '0 0 4px 0' }}>Validating Rows & Schema...</h4>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Checking duplicate SKUs, category taxonomy, and pricing rules
          </p>
        </div>
      )}

      {/* Validation Result Preview */}
      {validationResult && !activeJobId && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #E9D5FF',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '28px',
          boxShadow: '0 4px 12px rgba(107, 33, 168, 0.05)',
        }}>
          {/* Summary Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #FAF5FF',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} style={{ color: '#7E22CE' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E1B4B', margin: 0 }}>
                  {validationResult.fileName}
                </h3>
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                Total Rows in File: <strong>{validationResult.totalRows}</strong>
              </div>
            </div>

            <button
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                color: '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <X size={16} />
              <span>Choose Another File</span>
            </button>
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>Valid Products</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>
                {validationResult.validCount}
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: validationResult.errorCount > 0 ? '#FEF2F2' : '#F9FAFB',
              border: `1px solid ${validationResult.errorCount > 0 ? '#FECACA' : '#E5E7EB'}`,
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: validationResult.errorCount > 0 ? '#DC2626' : '#6B7280' }}>
                Row Errors
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: validationResult.errorCount > 0 ? '#991B1B' : '#374151', marginTop: '4px' }}>
                {validationResult.errorCount}
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: validationResult.warningCount > 0 ? '#FFFBEB' : '#F9FAFB',
              border: `1px solid ${validationResult.warningCount > 0 ? '#FDE68A' : '#E5E7EB'}`,
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: validationResult.warningCount > 0 ? '#D97706' : '#6B7280' }}>
                Warnings
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: validationResult.warningCount > 0 ? '#92400E' : '#374151', marginTop: '4px' }}>
                {validationResult.warningCount}
              </div>
            </div>
          </div>

          {/* Row Errors Breakdown if any */}
          {validationResult.errors?.length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <AlertCircle size={18} style={{ color: '#DC2626' }} />
                <strong style={{ color: '#991B1B', fontSize: '14px' }}>
                  Validation Errors Found ({validationResult.errors.length} rows will be skipped):
                </strong>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {validationResult.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#B91C1C', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #FEE2E2' }}>
                    <strong>Row {err.row}</strong> [{err.sku} - {err.productName}]: {err.messages?.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action to Start Import */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleStartImport}
              disabled={validationResult.validCount === 0 || isImporting}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: '#7E22CE',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: validationResult.validCount === 0 || isImporting ? 'not-allowed' : 'pointer',
                opacity: validationResult.validCount === 0 ? 0.5 : 1,
              }}
            >
              Confirm & Import {validationResult.validCount} Valid Products
            </button>
          </div>
        </div>
      )}

      {/* BullMQ Live Job Progress Tracker */}
      {activeJobId && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #E9D5FF',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '28px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(107, 33, 168, 0.05)',
        }}>
          {jobStatus?.status === 'COMPLETED' ? (
            <div>
              <CheckCircle2 size={48} style={{ color: '#10B981', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', margin: '0 0 6px 0' }}>
                Bulk Import Completed!
              </h3>
              <p style={{ fontSize: '14px', color: '#047857', margin: 0 }}>
                Successfully imported <strong>{jobStatus.createdCount}</strong> products into catalog and search index.
              </p>
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <Link
                  href="/admin/products"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#7E22CE',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    textDecoration: 'none',
                  }}
                >
                  View Product Catalog &rarr;
                </Link>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#FAF5FF',
                    border: '1px solid #E9D5FF',
                    color: '#7E22CE',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Upload Another File
                </button>
              </div>
            </div>
          ) : jobStatus?.status === 'FAILED' ? (
            <div>
              <AlertCircle size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#991B1B', margin: '0 0 6px 0' }}>
                Import Failed
              </h3>
              <p style={{ fontSize: '14px', color: '#B91C1C', margin: 0 }}>
                An error occurred while processing bulk batch products.
              </p>
              <button
                onClick={handleReset}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#7E22CE',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #E9D5FF',
                borderTopColor: '#7E22CE',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1E1B4B', margin: '0 0 6px 0' }}>
                BullMQ Background Processing...
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Status: <strong>{jobStatus?.status || 'PROCESSING'}</strong> | Processed: <strong>{jobStatus?.processedRows || 0} / {jobStatus?.validRows || validationResult?.validCount || 0}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import History Table */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #E9D5FF',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(107, 33, 168, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} style={{ color: '#7E22CE' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E1B4B', margin: 0 }}>
            Recent Bulk Import Jobs
          </h3>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '13px' }}>
            No past import history found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF5FF', borderBottom: '1px solid #E9D5FF' }}>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>File Name</th>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>Total</th>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>Created</th>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>Failed</th>
                  <th style={{ padding: '10px 14px', color: '#581C87', fontWeight: 700 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #F3E8FF' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1E1B4B' }}>{h.fileName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor:
                          h.status === 'COMPLETED'
                            ? '#ECFDF5'
                            : h.status === 'FAILED'
                            ? '#FEF2F2'
                            : '#EFF6FF',
                        color:
                          h.status === 'COMPLETED'
                            ? '#047857'
                            : h.status === 'FAILED'
                            ? '#DC2626'
                            : '#1D4ED8',
                      }}>
                        {h.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{h.totalRows}</td>
                    <td style={{ padding: '10px 14px', color: '#047857', fontWeight: 600 }}>{h.createdCount}</td>
                    <td style={{ padding: '10px 14px', color: '#DC2626', fontWeight: 600 }}>{h.failedCount}</td>
                    <td style={{ padding: '10px 14px', color: '#6B7280', fontSize: '12px' }}>
                      {new Date(h.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
