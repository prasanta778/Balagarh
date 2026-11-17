import React, { useEffect, useState } from 'react';
import {
  Check, DownloadCloud, FileText, FolderOpen, Globe, Image as ImageIcon, RefreshCw, Search,
  Trash2, UploadCloud, Video, X, AlertTriangle, Edit3,
} from 'lucide-react';
import type { Language, MediaRecord } from '../../types/cms';
import { apiFetch } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/i18n';
import { SmartImage } from '../SmartImage';

const FOLDERS = ['all', 'heritage', 'tourism', 'panchayats', 'schools', 'hospitals', 'events', 'news', 'documents', 'general'];

interface MediaLibraryViewProps {
  lang: Language;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({ lang, canUpload, canEdit, canDelete }) => {
  const [mediaList, setMediaList] = useState<MediaRecord[]>([]);
  const [mediaType, setMediaType] = useState('all');
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [uploadFolder, setUploadFolder] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<MediaRecord | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<{ media: MediaRecord; usage: { total: number; contents: Array<{ title_en: string }>; galleries: Array<{ title_en: string }>; events: Array<{ title_en: string }>; banners: Array<{ title_en: string }> } } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const loadMedia = () => {
    const params = new URLSearchParams({ media_type: mediaType, folder, search });
    apiFetch<{ media: MediaRecord[] }>(`/api/admin/media?${params.toString()}`)
      .then((res) => setMediaList(res.media))
      .catch((err) => setFeedback({ type: 'err', msg: err.message }));
  };

  useEffect(() => {
    loadMedia();
  }, [mediaType, folder, search]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      fd.append('folder', uploadFolder);
      await apiFetch('/api/admin/media/upload', { method: 'POST', body: fd });
      setFeedback({ type: 'ok', msg: `Uploaded ${files.length} file(s) to "${uploadFolder}".` });
      loadMedia();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleImportFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrl.trim()) return;
    setImportingUrl(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ media: MediaRecord }>('/api/admin/media/import-url', {
        method: 'POST',
        body: JSON.stringify({ url: remoteUrl.trim(), folder: uploadFolder }),
      });
      setRemoteUrl('');
      setFeedback({ type: 'ok', msg: `Downloaded & saved "${res.media.original_name}" (${res.media.media_type}) locally into Media Library.` });
      loadMedia();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Failed to download from web URL' });
    } finally {
      setImportingUrl(false);
    }
  };

  const handleReplaceFile = async (id: number, file: File | null) => {
    if (!file) return;
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiFetch(`/api/admin/media/${id}/replace`, { method: 'POST', body: fd });
      setFeedback({ type: 'ok', msg: 'Media file replaced safely without breaking section links.' });
      setEditing(null);
      loadMedia();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Replace failed' });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await apiFetch(`/api/admin/media/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          caption_en: editing.caption_en,
          caption_bn: editing.caption_bn,
          alt_text: editing.alt_text,
          folder: editing.folder,
        }),
      });
      setEditing(null);
      setFeedback({ type: 'ok', msg: 'Media metadata updated.' });
      loadMedia();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const handleDeleteAttempt = async (item: MediaRecord, force = false) => {
    try {
      await apiFetch(`/api/admin/media/${item.id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
      setDeleteConflict(null);
      setFeedback({ type: 'ok', msg: `Deleted "${item.original_name}".` });
      loadMedia();
    } catch (err) {
      // Check if 409 conflict by re-fetching or parsing
      if (!force) {
        const res = await fetch(`/api/admin/media/${item.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('balagarh_cms_token') || ''}`,
            'X-CSRF-Token': localStorage.getItem('balagarh_cms_csrf') || '',
          },
        });
        if (res.status === 409) {
          const data = await res.json();
          setDeleteConflict({ media: item, usage: data.usage });
          return;
        }
      }
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {lang === 'bn' ? 'কেন্দ্রীয় মিডিয়া লাইব্রেরি / Central Media Library' : 'Central Media Library'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Upload, organize, edit bilingual captions, replace files in-place, and reuse media safely across all 24 sections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or caption..."
              className="text-sm bg-transparent focus:outline-none w-48"
            />
          </div>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="document">Documents</option>
          </select>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white capitalize"
          >
            {FOLDERS.map((f) => (
              <option key={f} value={f}>{f === 'all' ? 'All Folders' : f}</option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Drag & Drop Multi-File Upload + Download from Web URL */}
      {canUpload && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleUploadFiles(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed p-5 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
              dragOver ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Drag & drop multiple images, videos, or PDF/DOC files here
                </div>
                <div className="text-xs text-slate-500">
                  Validated MIME types only (.jpg, .png, .webp, .mp4, .webm, .pdf, .docx up to 15 MB). PHP & executable files are strictly blocked.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50"
              >
                {FOLDERS.filter((f) => f !== 'all').map((f) => (
                  <option key={f} value={f}>Folder: {f}</option>
                ))}
              </select>
              <label className="cursor-pointer px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                <span>{uploading ? 'Uploading...' : 'Select Files'}</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.doc,.docx"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <form onSubmit={handleImportFromUrl} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2.5 text-slate-700 shrink-0">
              <Globe className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold">Download from Web &amp; Save Locally:</span>
            </div>
            <input
              type="url"
              required
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="Paste image or video URL (https://... .jpg, .png, .mp4, .webm)"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={importingUrl}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>{importingUrl ? 'Downloading...' : 'Download & Save'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mediaList.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="relative aspect-[16/10] bg-slate-100">
              {m.media_type === 'image' ? (
                <SmartImage src={m.url} alt={m.alt_text || m.original_name} className="w-full h-full object-cover" />
              ) : m.media_type === 'video' ? (
                <video
                  src={m.url}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover bg-slate-900"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 text-amber-800">
                  <FileText className="w-8 h-8" />
                  <span className="text-xs mt-1 font-semibold">{m.mime_type.split('/').pop()?.toUpperCase()}</span>
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[11px] font-medium flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                <span>{m.folder}</span>
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-white/95 text-slate-800 text-[11px] font-bold tabular-nums shadow">
                Used: {m.usage_count || 0}
              </div>
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <div className="text-xs font-bold text-slate-900 truncate" title={m.original_name}>
                  {m.original_name}
                </div>
                <div className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                  {m.caption_en || 'No English caption'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {formatBytes(m.file_size)} · {formatDateTime(m.created_at)} · {m.uploaded_by}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit / Replace</span>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAttempt(m, false)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                    title="Delete media"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit & Replace Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Edit Media Metadata & Replace File</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">English Caption</label>
                <input
                  type="text"
                  value={editing.caption_en}
                  onChange={(e) => setEditing({ ...editing, caption_en: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bengali Caption (বাংলা ক্যাপশন)</label>
                <input
                  type="text"
                  value={editing.caption_bn}
                  onChange={(e) => setEditing({ ...editing, caption_bn: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alternative Text</label>
                  <input
                    type="text"
                    value={editing.alt_text}
                    onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Folder</label>
                  <select
                    value={editing.folder}
                    onChange={(e) => setEditing({ ...editing, folder: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    {FOLDERS.filter((f) => f !== 'all').map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <div className="font-semibold text-slate-800">Replace File In-Place</div>
                  <div>Updates file while keeping all section links intact.</div>
                </div>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.doc,.docx"
                    onChange={(e) => handleReplaceFile(editing.id, e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                  Save Metadata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Check Delete Warning Dialog */}
      {deleteConflict && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3 text-amber-700">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Media In Active Use ({deleteConflict.usage.total} references)</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Deleting <strong>{deleteConflict.media.original_name}</strong> will safely unlink it from the following records so no public pages break:
                </p>
              </div>
            </div>
            <ul className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
              {deleteConflict.usage.contents.map((c, i) => <li key={`c-${i}`}>Content Cover: {c.title_en}</li>)}
              {deleteConflict.usage.galleries.map((c, i) => <li key={`g-${i}`}>Gallery Attachment: {c.title_en}</li>)}
              {deleteConflict.usage.events.map((e, i) => <li key={`e-${i}`}>Event Cover: {e.title_en}</li>)}
              {deleteConflict.usage.banners.map((b, i) => <li key={`b-${i}`}>Homepage Banner: {b.title_en}</li>)}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConflict(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold">
                Keep Media
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAttempt(deleteConflict.media, true)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                Unlink & Delete Safely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  multiple?: boolean;
  onSelect: (selected: MediaRecord[]) => void;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({ open, onClose, multiple = false, onSelect }) => {
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = () => {
    apiFetch<{ media: MediaRecord[] }>(`/api/admin/media?search=${encodeURIComponent(search)}`)
      .then((res) => setMedia(res.media))
      .catch(() => {});
  };

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      load();
    }
  }, [open, search]);

  if (!open) return null;

  const toggle = (m: MediaRecord) => {
    if (!multiple) {
      onSelect([m]);
      onClose();
      return;
    }
    setSelectedIds((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]));
  };

  const quickUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      fd.append('folder', 'general');
      const res = await apiFetch<{ uploaded: MediaRecord[] }>('/api/admin/media/upload', { method: 'POST', body: fd });
      load();
      if (!multiple && res.uploaded[0]) {
        onSelect([res.uploaded[0]]);
        onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <span>{multiple ? 'Select Multiple Media Files' : 'Choose Media from Library'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search media..."
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
            />
            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              {uploading ? 'Uploading...' : '+ Upload New'}
              <input type="file" multiple={multiple} accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.pdf" onChange={(e) => quickUpload(e.target.files)} className="hidden" />
            </label>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {media.map((m) => {
            const isSel = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m)}
                className={`text-left rounded-xl border overflow-hidden transition-all relative ${
                  isSel ? 'border-blue-600 ring-2 ring-blue-500' : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="aspect-[16/10] bg-slate-100">
                  <SmartImage src={m.url} alt={m.original_name} className="w-full h-full object-cover" />
                </div>
                {isSel && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                )}
                <div className="p-2 text-xs font-semibold text-slate-800 truncate">{m.original_name}</div>
              </button>
            );
          })}
        </div>

        {multiple && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-600">{selectedIds.length} item(s) selected</span>
            <button
              type="button"
              onClick={() => {
                onSelect(media.filter((m) => selectedIds.includes(m.id)));
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Attach Selected Media
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
