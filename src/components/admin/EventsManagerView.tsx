import React, { useEffect, useState } from 'react';
import { CalendarDays, Edit3, Image as ImageIcon, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import type { ContentMediaAttachment, EventItem, EventStatus, Language, PublicationStatus, UserRecord } from '../../types/cms';
import { apiFetch } from '../../lib/api';
import { RichTextEditor } from '../RichTextEditor';
import { SmartImage } from '../SmartImage';
import { MediaPickerModal } from './MediaLibraryView';

export const EventsManagerView: React.FC<{ user: UserRecord; lang: Language }> = ({ user, lang }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<(Partial<EventItem> & { gallery: ContentMediaAttachment[] }) | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const canCreate = user.permissions.actions.includes('create');
  const canEdit = user.permissions.actions.includes('edit');
  const canPublish = user.permissions.actions.includes('publish');
  const canDelete = user.permissions.actions.includes('delete');

  const loadEvents = () => {
    const params = new URLSearchParams({ status: statusFilter, search });
    apiFetch<{ events: EventItem[] }>(`/api/admin/events?${params.toString()}`)
      .then((res) => setEvents(res.events))
      .catch((err) => setFeedback({ type: 'err', msg: err.message }));
  };

  useEffect(() => {
    loadEvents();
  }, [statusFilter, search]);

  const openNew = () => {
    setEditing({
      title_en: '',
      title_bn: '',
      short_desc_en: '',
      short_desc_bn: '',
      full_desc_en: '',
      full_desc_bn: '',
      start_datetime: '2026-12-20T10:00',
      end_datetime: '2026-12-20T17:00',
      venue: 'Balagarh Block Ground',
      organizer: 'Balagarh Block Administration',
      cover_media_id: null,
      cover_url: '',
      video_url: '',
      registration_url: '',
      contact_details: '+91 33-2636-XXXX',
      event_status: 'Upcoming',
      is_featured: 1,
      publication_status: 'published',
      gallery: [],
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFeedback(null);
    const payload = {
      ...editing,
      gallery: editing.gallery.map((g) => ({ media_id: g.media_id, caption_en: g.caption_en, caption_bn: g.caption_bn })),
    };
    try {
      if (editing.id) {
        await apiFetch(`/api/admin/events/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setFeedback({ type: 'ok', msg: `Updated event "${editing.title_en}".` });
      } else {
        await apiFetch('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
        setFeedback({ type: 'ok', msg: `Created event "${editing.title_en}".` });
      }
      setEditing(null);
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleDelete = async (ev: EventItem) => {
    if (!window.confirm(`Delete event "${ev.title_en}"?`)) return;
    try {
      await apiFetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: `Deleted "${ev.title_en}".` });
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {lang === 'bn' ? 'ইভেন্ট ও কর্মসূচি ব্যবস্থাপনা / Events Management' : 'Events & Programmes Management'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage upcoming, ongoing, completed, and cancelled events with posters, schedules, galleries, and registration links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events or venue..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
          >
            <option value="all">All Event Statuses</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          {canCreate && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => (
          <div key={ev.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="relative aspect-[16/9] bg-slate-100">
              <SmartImage src={ev.cover_url} alt={ev.title_en} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded bg-violet-700 text-white text-xs font-bold">
                {ev.event_status}
              </div>
              <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold ${
                ev.publication_status === 'published' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                {ev.publication_status}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{ev.title_en}</h3>
                  {ev.is_featured === 1 && <Star className="w-4 h-4 text-amber-500 fill-current shrink-0" />}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{ev.title_bn}</div>
                <div className="text-xs text-slate-500 mt-2 space-y-1 tabular-nums">
                  <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-violet-600" /> {ev.start_datetime.replace('T', ' ')}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-rose-600" /> {ev.venue}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...ev, gallery: ev.gallery || [] })}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Event</span>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(ev)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 text-red-700 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-violet-700 to-indigo-700 text-white flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{editing.id ? 'Edit Event' : 'Create New Event'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-white/15"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Title (English) *</label>
                  <input required type="text" value={editing.title_en || ''} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Title (বাংলা শিরোনাম) *</label>
                  <input required type="text" value={editing.title_bn || ''} onChange={(e) => setEditing({ ...editing, title_bn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Short Description (EN)</label>
                  <textarea rows={2} value={editing.short_desc_en || ''} onChange={(e) => setEditing({ ...editing, short_desc_en: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Short Description (BN)</label>
                  <textarea rows={2} value={editing.short_desc_bn || ''} onChange={(e) => setEditing({ ...editing, short_desc_bn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RichTextEditor label="Full Event Details (EN)" value={editing.full_desc_en || ''} onChange={(v) => setEditing({ ...editing, full_desc_en: v })} />
                <RichTextEditor label="Full Event Details (BN)" value={editing.full_desc_bn || ''} onChange={(v) => setEditing({ ...editing, full_desc_bn: v })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date & Time *</label>
                  <input required type="datetime-local" value={editing.start_datetime || ''} onChange={(e) => setEditing({ ...editing, start_datetime: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date & Time</label>
                  <input type="datetime-local" value={editing.end_datetime || ''} onChange={(e) => setEditing({ ...editing, end_datetime: e.target.value })} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Status</label>
                  <select value={editing.event_status} onChange={(e) => setEditing({ ...editing, event_status: e.target.value as EventStatus })} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs">
                    <option value="Upcoming">Upcoming</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Publication Status</label>
                  <select
                    value={editing.publication_status}
                    disabled={!canPublish}
                    onChange={(e) => setEditing({ ...editing, publication_status: e.target.value as PublicationStatus })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Venue *</label>
                  <input required type="text" value={editing.venue || ''} onChange={(e) => setEditing({ ...editing, venue: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Organising Committee / Dept</label>
                  <input type="text" value={editing.organizer || ''} onChange={(e) => setEditing({ ...editing, organizer: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Details</label>
                  <input type="text" value={editing.contact_details || ''} onChange={(e) => setEditing({ ...editing, contact_details: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registration URL</label>
                  <input type="url" value={editing.registration_url || ''} onChange={(e) => setEditing({ ...editing, registration_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Video / YouTube URL</label>
                  <input type="url" value={editing.video_url || ''} onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://youtube.com/..." className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Event Cover Poster</span>
                    <button type="button" onClick={() => setCoverPickerOpen(true)} className="px-3 py-1 rounded bg-violet-600 text-white text-xs font-bold inline-flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Choose Poster
                    </button>
                  </div>
                  {editing.cover_url && <img src={editing.cover_url} alt="" className="w-full h-32 object-cover rounded-lg" />}
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Event Photos ({editing.gallery.length})</span>
                    <button type="button" onClick={() => setGalleryPickerOpen(true)} className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold">+ Add Photos</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editing.gallery.map((g, i) => (
                      <div key={i} className="relative w-16 h-12 rounded overflow-hidden border border-slate-300">
                        <img src={g.url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setEditing({ ...editing, gallery: editing.gallery.filter((_, idx) => idx !== i) })} className="absolute top-0 right-0 bg-black/70 text-white p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 pt-2 text-xs font-bold text-slate-800">
                    <input type="checkbox" checked={Boolean(editing.is_featured)} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked ? 1 : 0 })} />
                    <span>Featured Event on Homepage</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold">Cancel</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold">Save Event</button>
            </div>
          </form>
        </div>
      )}

      <MediaPickerModal open={coverPickerOpen} onClose={() => setCoverPickerOpen(false)} onSelect={(sel) => sel[0] && editing && setEditing({ ...editing, cover_media_id: sel[0].id, cover_url: sel[0].url })} />
      <MediaPickerModal open={galleryPickerOpen} multiple onClose={() => setGalleryPickerOpen(false)} onSelect={(sel) => editing && setEditing({ ...editing, gallery: [...editing.gallery, ...sel.map((m, i) => ({ media_id: m.id, url: m.url, filename: m.original_name, media_type: m.media_type, caption_en: m.caption_en, caption_bn: m.caption_bn, alt_text: m.alt_text, sort_order: i + 1 }))] })} />
    </div>
  );
};
