"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Copy,
  Check,
  Trash2,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';
import { adminBulkApi } from '@/lib/api/admin/bulk';
import { adminProductApi } from '@/lib/api/admin/products';

export default function BulkExcelImportModal({ open, onClose, onImportComplete, onImportSuccess }) {
  const [activeTab, setActiveTab] = useState('upload'); // upload | images | history
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Media Tab state
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [uploadedMediaList, setUploadedMediaList] = useState([]);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminBulkApi.listImportHistory();
      setHistory(res?.imports || res?.history || []);
    } catch {
      // Handled
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError('');
      setSuccess('');
      setValidationResult(null);
      setJobStatus(null);
      setSelectedFile(null);
      setSelectedImages([]);
      if (activeTab === 'history') loadHistory();
    }
  }, [open, activeTab, loadHistory]);

  if (!open) return null;

  const notifyComplete = () => {
    if (onImportComplete) onImportComplete();
    if (onImportSuccess) onImportSuccess();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError('');
    try {
      await adminBulkApi.downloadTemplate();
      setSuccess('Template downloaded! Check your downloads folder for ThePurple_Product_Import_Template.xlsx');
    } catch (err) {
      setError(err?.message || 'Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValidationResult(null);
      setError('');
      setSuccess('');
    }
  };

  const handleImageFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedImages((prev) => [...prev, ...files]);
      setValidationResult(null);
      setError('');
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setValidationResult(null);
  };

  const handleClearAllImages = () => {
    setSelectedImages([]);
    setValidationResult(null);
  };

  const handleValidateFile = async () => {
    if (!selectedFile) return;
    setValidating(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminBulkApi.validateBulkFile(selectedFile, selectedImages);
      setValidationResult(res);
      if (res.errorCount > 0 || (res.errors && res.errors.length > 0)) {
        setError(`Found ${res.errorCount || res.errors.length} validation errors in your spreadsheet. Please fix them before importing.`);
      } else {
        setSuccess(`File passed validation! ${res.validCount || res.totalRows || 0} product rows ready for import.`);
      }
    } catch (err) {
      setError(err?.message || 'Failed to validate file');
    } finally {
      setValidating(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminBulkApi.executeBulkImport(selectedFile, selectedImages);
      setJobStatus(res?.job || { status: 'COMPLETED', successCount: res?.validRows || res?.count || 1 });
      setSuccess('Bulk import processed successfully! All products have been added to the store.');
      notifyComplete();
    } catch (err) {
      setError(err?.message || 'Failed to execute import');
    } finally {
      setUploading(false);
    }
  };

  // Direct Media Uploader Handlers
  const handleMediaUpload = async () => {
    if (mediaFiles.length === 0) return;
    setMediaUploading(true);
    setError('');
    try {
      const res = await adminProductApi.uploadMultipleImages(mediaFiles, 'products');
      const newItems = (res?.images || res?.uploads || []).map((img) => ({
        url: img.publicUrl || img.url || img.imageUrl,
        name: img.originalName || img.originalname || 'image.webp',
        size: img.size || 0,
      }));
      setUploadedMediaList((prev) => [...newItems, ...prev]);
      setMediaFiles([]);
      setSuccess(`Uploaded ${newItems.length} images to Cloudflare R2! Copy their URLs into your Excel.`);
    } catch (err) {
      setError(err?.message || 'Failed to upload images');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleCopyUrl = (url, index) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlIndex(index);
    setTimeout(() => setCopiedUrlIndex(null), 2000);
  };

  const handleCopyAllUrls = () => {
    const allUrls = uploadedMediaList.map((m) => m.url).join('\n');
    navigator.clipboard.writeText(allUrls);
    setSuccess('Copied all image URLs to clipboard!');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container large" style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #F3E8FF' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '6px', background: '#FAF5FF', borderRadius: '8px', border: '1px solid #E9D5FF' }}>
                <FileSpreadsheet size={20} color="#7E22CE" />
              </div>
              <h2 className="modal-title" style={{ fontSize: '18px', fontWeight: 800, color: '#1E1B4B', margin: 0 }}>
                Bulk Excel & Media Product Importer
              </h2>
            </div>
            <p className="modal-subtitle" style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px', margin: 0 }}>
              Add products in bulk with dynamic Category dropdowns, attributes, and automatic Cloudflare R2 WebP image optimization.
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" style={{ cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs" style={{ padding: '0 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`modal-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            style={{
              padding: '12px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderBottom: activeTab === 'upload' ? '2px solid #7E22CE' : '2px solid transparent',
              color: activeTab === 'upload' ? '#7E22CE' : '#6B7280',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Upload size={16} />
            <span>📥 Upload & Import</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`modal-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
            style={{
              padding: '12px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderBottom: activeTab === 'images' ? '2px solid #7E22CE' : '2px solid transparent',
              color: activeTab === 'images' ? '#7E22CE' : '#6B7280',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ImageIcon size={16} />
            <span>🖼️ Batch Image Uploader & Links</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`modal-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            style={{
              padding: '12px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderBottom: activeTab === 'history' ? '2px solid #7E22CE' : '2px solid transparent',
              color: activeTab === 'history' ? '#7E22CE' : '#6B7280',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={16} />
            <span>📜 Import History</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ margin: '12px 24px 0 24px', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', color: '#DC2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ margin: '12px 24px 0 24px', padding: '12px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', color: '#059669', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{success}</span>
          </div>
        )}

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Template Download Card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)', border: '1px solid #E9D5FF', borderRadius: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '14.5px', color: '#2E1065' }}>Download Excel Template (.XLSX)</span>
                    <span style={{ fontSize: '11px', background: '#7E22CE', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                      ⚡ Auto-Dropdowns
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#6B7280', lineHeight: 1.4 }}>
                    Pre-populated with your store&apos;s active Categories, Subcategories, Colors, and Sizes with interactive Excel dropdown validation.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingTemplate}
                  onClick={handleDownloadTemplate}
                  className="admin-btn admin-btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', background: '#7E22CE', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                >
                  {downloadingTemplate ? (
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>{downloadingTemplate ? 'Generating...' : 'Download Template'}</span>
                </button>
              </div>

              {/* Upload Grid: 1. Excel File + 2. Image Files */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* 1. Spreadsheet Dropzone */}
                <div style={{ border: selectedFile ? '2px solid #7E22CE' : '2px dashed #D8B4FE', borderRadius: '16px', padding: '24px 18px', textAlign: 'center', background: selectedFile ? '#FAF5FF' : '#FCF9FF', position: 'relative' }}>
                  <FileSpreadsheet size={32} color="#7E22CE" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#1E1B4B' }}>
                    {selectedFile ? selectedFile.name : '1. Select Product Excel File*'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', marginBottom: '14px' }}>
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports .xlsx or .csv'}
                  </div>
                  <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '7px 14px', fontSize: '12.5px' }}>
                    <span>{selectedFile ? 'Change Excel File' : 'Browse Excel File'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {/* 2. Images Dropzone */}
                <div style={{ border: selectedImages.length > 0 ? '2px solid #059669' : '2px dashed #A7F3D0', borderRadius: '16px', padding: '24px 18px', textAlign: 'center', background: selectedImages.length > 0 ? '#ECFDF5' : '#F0FDF4', position: 'relative' }}>
                  <ImageIcon size={32} color="#059669" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#064E3B' }}>
                    {selectedImages.length > 0 ? `${selectedImages.length} Image Files Attached` : '2. Attach Image Files (Optional)'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px', marginBottom: '14px' }}>
                    Match by filename or SKU code in Excel (Auto WebP optimization)
                  </div>
                  <label className="admin-btn admin-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '7px 14px', fontSize: '12.5px', background: '#059669', color: '#fff', border: 'none' }}>
                    <span>{selectedImages.length > 0 ? '+ Add More Images' : 'Browse Image Files'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageFilesChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Attached Images List Preview */}
              {selectedImages.length > 0 && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} color="#059669" />
                      <span>{selectedImages.length} Images Ready to Upload with Excel:</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllImages}
                      style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={13} />
                      <span>Remove All</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                    {selectedImages.map((img, idx) => (
                      <span
                        key={idx}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', border: '1px solid #86EFAC', borderRadius: '20px', padding: '3px 10px', fontSize: '11.5px', color: '#047857', fontWeight: 600 }}
                      >
                        <span>{img.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Summary Card */}
              {validationResult && (
                <div style={{ border: '1px solid #E9D5FF', borderRadius: '16px', padding: '18px 20px', background: '#ffffff', boxShadow: '0 4px 12px rgba(126, 34, 206, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#1E1B4B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} color="#7E22CE" />
                      <span>Pre-Flight Validation Results</span>
                    </div>
                    <span className={`badge ${validationResult.errorCount === 0 ? 'badge-success' : 'badge-danger'}`} style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '999px' }}>
                      {validationResult.errorCount === 0 ? '✓ Ready for Import' : `⚠️ ${validationResult.errorCount} Errors Found`}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ padding: '10px', background: '#FAF5FF', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Total Rows</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E1B4B' }}>{validationResult.totalRows || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: '#ECFDF5', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>Valid Rows</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857' }}>{validationResult.validCount || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: '#FEF2F2', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#B91C1C', fontWeight: 600 }}>Error Rows</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#B91C1C' }}>{validationResult.errorCount || 0}</div>
                    </div>
                    <div style={{ padding: '10px', background: '#EFF6FF', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 600 }}>Attached Images</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1D4ED8' }}>{validationResult.attachedImagesCount || 0}</div>
                    </div>
                  </div>

                  {/* Errors List */}
                  {validationResult.errors && validationResult.errors.length > 0 && (
                    <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#FEF2F2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FECACA', marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#B91C1C', marginBottom: '6px' }}>Errors to fix:</div>
                      {validationResult.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#7F1D1D', marginBottom: '4px' }}>
                          <strong>Row #{err.row} ({err.sku || 'No SKU'}):</strong> {err.messages?.join(', ') || err.message || JSON.stringify(err)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Row Preview Table */}
                  {validationResult.preview && validationResult.preview.length > 0 && (
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: '#FAF5FF', fontSize: '12px', fontWeight: 700, color: '#581C87', borderBottom: '1px solid #E5E7EB' }}>
                        Previewing First {validationResult.preview.length} Rows:
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '180px' }}>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>#</th>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>Product Name</th>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>SKU</th>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>Category</th>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>Price</th>
                              <th style={{ padding: '6px 10px', color: '#6B7280' }}>Image Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validationResult.preview.map((p, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '6px 10px', color: '#9CA3AF' }}>{p.rowNumber}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1F2937' }}>{p.name}</td>
                                <td style={{ padding: '6px 10px', color: '#4B5563', fontFamily: 'monospace' }}>{p.sku}</td>
                                <td style={{ padding: '6px 10px', color: '#7E22CE' }}>{p.category}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 700, color: '#059669' }}>₹{p.salePrice || p.price}</td>
                                <td style={{ padding: '6px 10px', color: '#4B5563', fontSize: '11px' }}>{p.imageMatchStatus}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Media Uploader Notice */}
              <div style={{ padding: '14px 18px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '14px', fontSize: '13px', color: '#1E40AF', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Info size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Direct Image Uploader & URL Generator</div>
                  <div style={{ marginTop: '2px', color: '#3B82F6', fontSize: '12.5px' }}>
                    Upload your product images in batch to Cloudflare R2 and copy their generated WebP URLs directly into your Excel spreadsheet.
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div style={{ border: '2px dashed #93C5FD', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', background: '#F8FAFC' }}>
                <ImageIcon size={36} color="#2563EB" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#1E293B' }}>
                  {mediaFiles.length > 0 ? `${mediaFiles.length} Images Selected` : 'Select Product Images to Upload'}
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', marginBottom: '16px' }}>
                  Upload multiple JPEG, PNG, or WebP product pictures (up to 50 files)
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '8px 16px' }}>
                    <span>Browse Images</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {mediaFiles.length > 0 && (
                    <button
                      type="button"
                      disabled={mediaUploading}
                      onClick={handleMediaUpload}
                      className="admin-btn admin-btn-secondary"
                      style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '8px 18px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {mediaUploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                      <span>{mediaUploading ? 'Uploading to R2...' : `Upload ${mediaFiles.length} Images`}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Uploaded Media Table */}
              {uploadedMediaList.length > 0 && (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px', background: '#FFFFFF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#1E293B' }}>
                      Uploaded Image URLs ({uploadedMediaList.length})
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAllUrls}
                      className="admin-btn admin-btn-outline"
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Copy size={12} />
                      <span>Copy All URLs</span>
                    </button>
                  </div>

                  <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {uploadedMediaList.map((item, idx) => (
                      <div
                        key={idx}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', gap: '12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <img
                            src={item.url}
                            alt={item.name}
                            style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                          />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '380px' }}>
                              {item.url}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(item.url, idx)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', background: copiedUrlIndex === idx ? '#ECFDF5' : '#FFFFFF', border: copiedUrlIndex === idx ? '1px solid #10B981' : '1px solid #CBD5E1', color: copiedUrlIndex === idx ? '#059669' : '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            {copiedUrlIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedUrlIndex === idx ? 'Copied!' : 'Copy URL'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
                  <RefreshCw size={22} color="#7E22CE" style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 8px auto', display: 'block' }} />
                  Loading past imports...
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', border: '1px dashed #E9D5FF', borderRadius: '12px' }}>
                  <FileSpreadsheet size={36} color="#C084FC" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <div style={{ fontWeight: 700, color: '#1E1B4B' }}>No bulk imports recorded yet</div>
                </div>
              ) : (
                <div className="admin-table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="admin-table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Filename</th>
                        <th>Total Rows</th>
                        <th>Success</th>
                        <th>Failed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.createdAt).toLocaleString('en-IN')}</td>
                          <td style={{ fontWeight: 600 }}>{h.fileName || 'Spreadsheet'}</td>
                          <td>{h.totalRows || 0}</td>
                          <td style={{ color: '#059669', fontWeight: 700 }}>{h.processedRows || h.createdCount || h.validRows || 0}</td>
                          <td style={{ color: '#DC2626', fontWeight: 700 }}>{h.failedRows || h.failedCount || 0}</td>
                          <td>
                            <span className={`badge ${h.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #F3E8FF', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Close
          </button>

          {activeTab === 'upload' && (
            <>
              {!validationResult ? (
                <button
                  type="button"
                  disabled={!selectedFile || validating}
                  onClick={handleValidateFile}
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '13px', background: '#7E22CE', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: (!selectedFile || validating) ? 'not-allowed' : 'pointer' }}
                >
                  {validating ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  <span>{validating ? 'Validating File...' : '1. Validate Spreadsheet'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={uploading || validationResult.errorCount > 0}
                  onClick={handleStartImport}
                  className="admin-btn admin-btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: (uploading || validationResult.errorCount > 0) ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                  <span>{uploading ? 'Importing Products...' : '2. Execute Database Import'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
