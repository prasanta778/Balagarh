import React, { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowUp, CheckCircle2, Clock, Edit3, Eye, FileText, History,
  Image as ImageIcon, Plus, Search, Star, Trash2, X, Globe, Lock,
} from 'lucide-react';
import type {
  ContentCategory, ContentItem, ContentMediaAttachment, ContentRevision,
  ContentSection, ContentTag, Language, PublicationStatus, UserRecord,
} from '../../types/cms';
import { apiFetch } from '../../lib/api';
import { formatDateTime } from '../../lib/i18n';
import { RichTextEditor } from '../RichTextEditor';
import { SmartImage } from '../SmartImage';
import { MediaPickerModal } from './MediaLibraryView';

interface ContentManagerViewProps {
  user: UserRecord;
  lang: Language;
  initialSection?: string;
  sections: ContentSection[];
}

const STATUS_STYLE: Record<PublicationStatus, { bg: string; text: string; label: string }> = {
  published: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Published' },
  draft: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Draft' },
  scheduled: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Scheduled' },
  unpublished: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Unpublished' },
};

export const ContentManagerView: React.FC<ContentManagerViewProps> = ({
  user,
  lang,
  initialSection = '',
  sections,
}) => {
  const [sectionFilter, setSectionFilter] = useState(initialSection);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Editor state
  const [editingItem, setEditingItem] = useState<Partial<ContentItem> & {
    tag_ids: number[];
    gallery: ContentMediaAttachment[];
    metaPairs: Array<{ key: string; value: string }>;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewLang, setPreviewLang] = useState<Language>('en');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [revisionsItem, setRevisionsItem] = useState<{ title: string; list: ContentRevision[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);

  useEffect(() => {
    setSectionFilter(initialSection);
    setPage(1);
  }, [initialSection]);

  useEffect(() => {
    apiFetch<{ categories: ContentCategory[]; tags: ContentTag[] }>('/api/admin/taxonomy')
      .then((res) => {
        setCategories(res.categories);
        setTags(res.tags);
      })
      .catch(() => {});
  }, []);

  const loadContents = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: '12',
      status: statusFilter,
      search,
    });
    if (sectionFilter) params.set('section', sectionFilter);

    apiFetch<{ items: ContentItem[]; pagination: { totalPages: number; total: number } }>(
      `/api/admin/contents?${params.toString()}`
    )
      .then((res) => {
        setItems(res.items);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      })
      .catch((err) => setFeedback({ type: 'err', msg: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContents();
  }, [sectionFilter, statusFilter, search, page]);

  const canDo = (sec: string, act: 'view' | 'create' | 'edit' | 'publish' | 'delete') => {
    if (!user.permissions.actions.includes(act)) return false;
    return user.permissions.modules.includes('*') || user.permissions.modules.includes(sec);
  };

  const openNewEditor = () => {
    const defaultSec = sectionFilter || sections[0]?.slug || 'news-announcements';
    setPreviewMode(false);
    setEditingItem({
      section_slug: defaultSec,
      category_id: null,
      title_en: '',
      title_bn: '',
      summary_en: '',
      summary_bn: '',
      body_en: '',
      body_bn: '',
      cover_media_id: null,
      cover_url: '',
      video_url: '',
      document_url: '',
      external_url: '',
      status: 'draft',
      scheduled_at: '',
      is_featured: 0,
      sort_order: 1,
      tag_ids: [],
      gallery: [],
      metaPairs: [{ key: 'Location', value: 'Balagarh Block' }],
    });
  };

  const openEditEditor = (item: ContentItem) => {
    setPreviewMode(false);
    setEditingItem({
      ...item,
      tag_ids: (item.tags || []).map((t) => t.id),
      gallery: item.gallery || [],
      metaPairs: Object.entries(item.metadata || {}).map(([key, value]) => ({ key, value })),
    });
  };

  const handleSaveContent = async (forcedStatus?: PublicationStatus) => {
    if (!editingItem) return;
    setFeedback(null);

    const metadata: Record<string, string> = {};
    for (const p of editingItem.metaPairs) {
      if (p.key.trim()) metadata[p.key.trim()] = p.value;
    }

    const payload = {
      section_slug: editingItem.section_slug,
      category_id: editingItem.category_id || null,
      title_en: editingItem.title_en,
      title_bn: editingItem.title_bn,
      summary_en: editingItem.summary_en,
      summary_bn: editingItem.summary_bn,
      body_en: editingItem.body_en,
      body_bn: editingItem.body_bn,
      cover_media_id: editingItem.cover_media_id || null,
      video_url: editingItem.video_url || null,
      document_url: editingItem.document_url || null,
      external_url: editingItem.external_url || null,
      metadata,
      status: forcedStatus || editingItem.status || 'draft',
      scheduled_at: (forcedStatus || editingItem.status) === 'scheduled' ? editingItem.scheduled_at || null : null,
      is_featured: editingItem.is_featured ? 1 : 0,
      sort_order: Number(editingItem.sort_order || 1),
      tag_ids: editingItem.tag_ids,
      gallery: editingItem.gallery.map((g) => ({
        media_id: g.media_id,
        caption_en: g.caption_en,
        caption_bn: g.caption_bn,
      })),
    };

    try {
      if (editingItem.id) {
        await apiFetch(`/api/admin/contents/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setFeedback({ type: 'ok', msg: `Updated "${editingItem.title_en}" (${payload.status}).` });
      } else {
        await apiFetch('/api/admin/contents', { method: 'POST', body: JSON.stringify(payload) });
        setFeedback({ type: 'ok', msg: `Created "${editingItem.title_en}" (${payload.status}).` });
      }
      setEditingItem(null);
      loadContents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleQuickStatus = async (item: ContentItem, nextStatus: PublicationStatus) => {
    try {
      await apiFetch(`/api/admin/contents/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedback({ type: 'ok', msg: `"${item.title_en}" marked as ${nextStatus}.` });
      loadContents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Status update failed' });
    }
  };

  const handleToggleFeatured = async (item: ContentItem) => {
    try {
      await apiFetch(`/api/admin/contents/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_featured: !item.is_featured }),
      });
      loadContents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(swapIdx, 0, moved);
    setItems(next);
    try {
      await apiFetch('/api/admin/contents/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: next.map((x) => x.id), section_slug: sectionFilter || moved.section_slug }),
      });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Reorder failed' });
    }
  };

  const openRevisions = async (item: ContentItem) => {
    try {
      const res = await apiFetch<{ revisions: ContentRevision[] }>(`/api/admin/contents/${item.id}/revisions`);
      setRevisionsItem({ title: item.title_en, list: res.revisions });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Could not load revisions' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/contents/${deleteTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: `Deleted "${deleteTarget.title_en}".` });
      setDeleteTarget(null);
      loadContents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  const sectionCategories = editingItem
    ? categories.filter((c) => c.section_slug === editingItem.section_slug)
    : [];

  const activeSectionObj = sections.find((s) => s.slug === sectionFilter);

  return (
    <div className="space-y-5">
      {/* Header & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {activeSectionObj
                ? `${activeSectionObj.name_en} · ${activeSectionObj.name_bn}`
                : lang === 'bn'
                  ? 'সকল কনটেন্ট ম্যানেজমেন্ট / All Content Modules'
                  : 'Content Management (All Authorised Modules)'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
              {totalCount} record(s) found across your permitted sections. Published items update the public website immediately.
            </p>
          </div>

          {canDo(sectionFilter || sections[0]?.slug || '', 'create') && (
            <button
              type="button"
              onClick={openNewEditor}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-sm font-bold shadow-sm whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Content</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <select
            value={sectionFilter}
            onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
          >
            <option value="">All Authorised Sections ({sections.length})</option>
            {sections.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name_en} ({s.name_bn})
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'published', 'draft', 'scheduled', 'unpublished'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 ml-auto">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search title or summary..."
              className="text-xs bg-transparent focus:outline-none w-52"
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <th className="py-3 px-4">Content (EN & বাংলা)</th>
                <th className="py-3 px-3">Section</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Featured</th>
                <th className="py-3 px-3 text-center">Order</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">Loading content records...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No records match your filters. Click "Add New Content" to create one.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const st = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <SmartImage src={item.cover_url} alt={item.title_en} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 max-w-md">
                            <div className="font-bold text-slate-900 truncate">{item.title_en}</div>
                            <div className="text-xs text-slate-600 truncate">{item.title_bn}</div>
                            <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                              {formatDateTime(item.updated_at)} · {item.views_count} views · {item.gallery?.length || 0} photos
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {item.section_name_en || item.section_slug}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${st.bg} ${st.text}`}>
                          {item.status === 'published' && <CheckCircle2 className="w-3 h-3" />}
                          {item.status === 'scheduled' && <Clock className="w-3 h-3" />}
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!canDo(item.section_slug, 'edit')}
                          onClick={() => handleToggleFeatured(item)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.is_featured ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400'
                          }`}
                          title="Toggle Featured on Homepage"
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0 || !canDo(item.section_slug, 'edit')}
                            onClick={() => handleMove(idx, -1)}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1 || !canDo(item.section_slug, 'edit')}
                            onClick={() => handleMove(idx, 1)}
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canDo(item.section_slug, 'publish') && (
                            item.status === 'published' ? (
                              <button
                                type="button"
                                onClick={() => handleQuickStatus(item, 'unpublished')}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-semibold"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickStatus(item, 'published')}
                                className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-semibold transition-colors"
                              >
                                Publish
                              </button>
                            )
                          )}
                          {canDo(item.section_slug, 'edit') && (
                            <button
                              type="button"
                              onClick={() => openEditEditor(item)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white transition-colors"
                              title="Edit Content"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openRevisions(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                            title="Revision History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {canDo(item.section_slug, 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 text-red-700 hover:text-white transition-colors"
                              title="Delete Content"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-600 tabular-nums">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums ${
                    p === page ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bilingual Content Editor + Live Preview Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#0A2540] to-[#1D4ED8] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold">
                  {editingItem.id ? 'Edit Bilingual Content' : 'Create New Bilingual Content'}
                </h3>
                <p className="text-xs text-sky-200">Supports English & Bengali prose, multiple photos, videos, documents, and scheduled publishing.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode((p) => !p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                    previewMode ? 'bg-amber-400 text-slate-950' : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{previewMode ? 'Back to Editor' : 'Preview Before Publishing'}</span>
                </button>
                <button type="button" onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg hover:bg-white/15">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-5">
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Public Website Preview</span>
                  <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button type="button" onClick={() => setPreviewLang('en')} className={`px-3 py-1 rounded text-xs font-bold ${previewLang === 'en' ? 'bg-blue-600 text-white' : ''}`}>English</button>
                    <button type="button" onClick={() => setPreviewLang('bn')} className={`px-3 py-1 rounded text-xs font-bold ${previewLang === 'bn' ? 'bg-emerald-600 text-white' : ''}`}>বাংলা</button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-3xl mx-auto">
                  {editingItem.cover_url && (
                    <img src={editingItem.cover_url} alt="Cover preview" className="w-full aspect-[16/9] object-cover rounded-lg" />
                  )}
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    {previewLang === 'bn' ? editingItem.title_bn || editingItem.title_en : editingItem.title_en}
                  </h1>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {previewLang === 'bn' ? editingItem.summary_bn || editingItem.summary_en : editingItem.summary_en}
                  </p>
                  <div
                    className="prose-balagarh"
                    dangerouslySetInnerHTML={{
                      __html: previewLang === 'bn' ? editingItem.body_bn || editingItem.body_en || '' : editingItem.body_en || '',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Section *</label>
                    <select
                      value={editingItem.section_slug}
                      onChange={(e) => setEditingItem({ ...editingItem, section_slug: e.target.value, category_id: null })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      {sections.map((s) => (
                        <option key={s.slug} value={s.slug}>{s.name_en} ({s.name_bn})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={editingItem.category_id || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="">None</option>
                      {sectionCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name_en} ({c.name_bn})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Publication Status</label>
                    <select
                      value={editingItem.status}
                      onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as PublicationStatus })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>
                </div>

                {editingItem.status === 'scheduled' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <label className="text-xs font-bold text-blue-900">Schedule Publication Date & Time:</label>
                    <input
                      type="datetime-local"
                      value={editingItem.scheduled_at || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, scheduled_at: e.target.value })}
                      className="px-3 py-1.5 rounded-lg border border-blue-300 text-xs bg-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">English Title *</label>
                    <input
                      type="text"
                      value={editingItem.title_en || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, title_en: e.target.value })}
                      placeholder="Enter English title..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bengali Title (বাংলা শিরোনাম) *</label>
                    <input
                      type="text"
                      value={editingItem.title_bn || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, title_bn: e.target.value })}
                      placeholder="বাংলা শিরোনাম লিখুন..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Short Summary (English)</label>
                    <textarea
                      rows={2}
                      value={editingItem.summary_en || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, summary_en: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Short Summary (বাংলা সংক্ষিপ্ত বিবরণ)</label>
                    <textarea
                      rows={2}
                      value={editingItem.summary_bn || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, summary_bn: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RichTextEditor
                    label="Full Article Body (English)"
                    value={editingItem.body_en || ''}
                    onChange={(v) => setEditingItem({ ...editingItem, body_en: v })}
                    placeholder="Write full English article..."
                  />
                  <RichTextEditor
                    label="Full Article Body (বাংলা সম্পূর্ণ বিবরণ)"
                    value={editingItem.body_bn || ''}
                    onChange={(v) => setEditingItem({ ...editingItem, body_bn: v })}
                    placeholder="বাংলায় বিস্তারিত লিখুন..."
                  />
                </div>

                {/* Cover Image & Multi-Photo Gallery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Cover Photograph</span>
                      <button
                        type="button"
                        onClick={() => setCoverPickerOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Select / Upload Cover</span>
                      </button>
                    </div>
                    {editingItem.cover_url ? (
                      <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
                        <SmartImage src={editingItem.cover_url} alt="Cover" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, cover_media_id: null, cover_url: '' })}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        No cover photograph selected
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Multiple Gallery Photos ({editingItem.gallery.length})</span>
                      <button
                        type="button"
                        onClick={() => setGalleryPickerOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Attach Photos</span>
                      </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {editingItem.gallery.map((g, idx) => (
                        <div key={`${g.media_id}-${idx}`} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                          <img src={g.url} alt="" className="w-12 h-9 rounded object-cover shrink-0" />
                          <input
                            type="text"
                            value={g.caption_en}
                            onChange={(e) => {
                              const next = [...editingItem.gallery];
                              next[idx] = { ...next[idx], caption_en: e.target.value };
                              setEditingItem({ ...editingItem, gallery: next });
                            }}
                            placeholder="Photo caption..."
                            className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingItem({
                              ...editingItem,
                              gallery: editingItem.gallery.filter((_, i) => i !== idx),
                            })}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Video, Document, External URL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">YouTube / Video URL</label>
                    <input
                      type="url"
                      value={editingItem.video_url || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Document URL (PDF / DOC)</label>
                    <input
                      type="text"
                      value={editingItem.document_url || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, document_url: e.target.value })}
                      placeholder="/uploads/circular.pdf"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">External Website Link</label>
                    <input
                      type="url"
                      value={editingItem.external_url || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, external_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                {/* Tags & Featured & Key-Value Specs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-700">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => {
                        const active = editingItem.tag_ids.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setEditingItem({
                              ...editingItem,
                              tag_ids: active
                                ? editingItem.tag_ids.filter((id) => id !== t.id)
                                : [...editingItem.tag_ids, t.id],
                            })}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                              active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {t.name_en} ({t.name_bn})
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-2 pt-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingItem.is_featured)}
                        onChange={(e) => setEditingItem({ ...editingItem, is_featured: e.target.checked ? 1 : 0 })}
                      />
                      <span>Feature this content on Homepage</span>
                    </label>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Key Specifications (e.g. PIN, Beds, Helpline)</span>
                      <button
                        type="button"
                        onClick={() => setEditingItem({
                          ...editingItem,
                          metaPairs: [...editingItem.metaPairs, { key: '', value: '' }],
                        })}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        + Add Field
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {editingItem.metaPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => {
                              const next = [...editingItem.metaPairs];
                              next[idx] = { ...next[idx], key: e.target.value };
                              setEditingItem({ ...editingItem, metaPairs: next });
                            }}
                            placeholder="Field (e.g. PIN)"
                            className="w-1/3 px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                          <input
                            type="text"
                            value={pair.value}
                            onChange={(e) => {
                              const next = [...editingItem.metaPairs];
                              next[idx] = { ...next[idx], value: e.target.value };
                              setEditingItem({ ...editingItem, metaPairs: next });
                            }}
                            placeholder="Value (e.g. 712501)"
                            className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveContent('draft')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Save as Draft</span>
              </button>
              {canDo(editingItem.section_slug || '', 'publish') ? (
                <button
                  type="button"
                  onClick={() => handleSaveContent(editingItem.status === 'scheduled' ? 'scheduled' : 'published')}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{editingItem.status === 'scheduled' ? 'Schedule Publication' : 'Save & Publish Live'}</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 inline-flex items-center gap-1 px-3">
                  <Lock className="w-3.5 h-3.5" /> Publish requires publisher role
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revisions Modal */}
      {revisionsItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Revision History: {revisionsItem.title}</h3>
              <button type="button" onClick={() => setRevisionsItem(null)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {revisionsItem.list.length === 0 ? (
                <p className="text-xs text-slate-500">No revisions recorded yet.</p>
              ) : (
                revisionsItem.list.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="font-bold text-slate-800">{rev.change_note}</div>
                    <div className="text-slate-500 mt-0.5">{rev.changed_by} · {rev.created_at}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm Content Deletion</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleteTarget.title_en}</strong>? It will be safely removed from all public listings.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold">Cancel</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Delete Content</button>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        multiple={false}
        onSelect={(sel) => {
          if (sel[0] && editingItem) {
            setEditingItem({ ...editingItem, cover_media_id: sel[0].id, cover_url: sel[0].url });
          }
        }}
      />

      <MediaPickerModal
        open={galleryPickerOpen}
        onClose={() => setGalleryPickerOpen(false)}
        multiple={true}
        onSelect={(sel) => {
          if (editingItem) {
            const added: ContentMediaAttachment[] = sel.map((m, i) => ({
              media_id: m.id,
              url: m.url,
              filename: m.original_name,
              media_type: m.media_type,
              caption_en: m.caption_en || '',
              caption_bn: m.caption_bn || '',
              alt_text: m.alt_text || '',
              sort_order: editingItem.gallery.length + i + 1,
            }));
            setEditingItem({ ...editingItem, gallery: [...editingItem.gallery, ...added] });
          }
        }}
      />
    </div>
  );
};
