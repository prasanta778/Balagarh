import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BellRing, Edit3, Eye, EyeOff, Image as ImageIcon, Plus, Save, Trash2, X } from 'lucide-react';
import type { HomepageBanner, HomepagePopup, HomepageQuickCard, HomepageSectionConfig, Language } from '../../types/cms';
import { apiFetch } from '../../lib/api';
import { SmartImage } from '../SmartImage';
import { MediaPickerModal } from './MediaLibraryView';

const POPUP_THEMES: Record<string, { label: string; badge: string }> = {
  royal: { label: 'Royal Blue', badge: 'bg-blue-600 text-white' },
  crimson: { label: 'Crimson Rose', badge: 'bg-rose-600 text-white' },
  emerald: { label: 'Emerald Teal', badge: 'bg-emerald-600 text-white' },
  amber: { label: 'Sunset Amber', badge: 'bg-amber-500 text-slate-950' },
  violet: { label: 'Purple Violet', badge: 'bg-violet-600 text-white' },
};

export const HomepageManagerView: React.FC<{ lang: Language }> = ({ lang }) => {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [sections, setSections] = useState<HomepageSectionConfig[]>([]);
  const [cards, setCards] = useState<HomepageQuickCard[]>([]);
  const [popups, setPopups] = useState<HomepagePopup[]>([]);
  const [editingBanner, setEditingBanner] = useState<Partial<HomepageBanner> | null>(null);
  const [editingCard, setEditingCard] = useState<Partial<HomepageQuickCard> | null>(null);
  const [editingPopup, setEditingPopup] = useState<Partial<HomepagePopup> | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'banner' | 'popup' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = () => {
    apiFetch<{ banners: HomepageBanner[]; sections: HomepageSectionConfig[]; cards: HomepageQuickCard[]; popups: HomepagePopup[] }>('/api/admin/homepage')
      .then((res) => {
        setBanners(res.banners);
        setSections(res.sections);
        setCards(res.cards);
        setPopups(res.popups || []);
      })
      .catch((err) => setFeedback({ type: 'err', msg: err.message }));
  };

  useEffect(() => {
    load();
  }, []);

  const saveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    try {
      if (editingBanner.id) {
        await apiFetch(`/api/admin/homepage/banners/${editingBanner.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingBanner),
        });
      } else {
        await apiFetch('/api/admin/homepage/banners', {
          method: 'POST',
          body: JSON.stringify(editingBanner),
        });
      }
      setEditingBanner(null);
      setFeedback({ type: 'ok', msg: 'Homepage banner saved and synced live.' });
      load();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const deleteBanner = async (id: number) => {
    if (!window.confirm('Delete this homepage banner?')) return;
    await apiFetch(`/api/admin/homepage/banners/${id}`, { method: 'DELETE' });
    load();
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= sections.length) return;
    const next = [...sections];
    const [m] = next.splice(idx, 1);
    next.splice(swap, 0, m);
    setSections(next.map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const toggleSectionVisibility = (id: number) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, is_visible: s.is_visible ? 0 : 1 } : s)));
  };

  const saveSectionsOrder = async () => {
    try {
      await apiFetch('/api/admin/homepage/sections', {
        method: 'PUT',
        body: JSON.stringify({ sections }),
      });
      setFeedback({ type: 'ok', msg: 'Homepage section ordering & visibility updated.' });
      load();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Failed to update sections' });
    }
  };

  const saveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    try {
      if (editingCard.id) {
        await apiFetch(`/api/admin/homepage/cards/${editingCard.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingCard),
        });
      } else {
        await apiFetch('/api/admin/homepage/cards', {
          method: 'POST',
          body: JSON.stringify(editingCard),
        });
      }
      setEditingCard(null);
      setFeedback({ type: 'ok', msg: 'Homepage card updated.' });
      load();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const deleteCard = async (id: number) => {
    if (!window.confirm('Delete this homepage card/link?')) return;
    await apiFetch(`/api/admin/homepage/cards/${id}`, { method: 'DELETE' });
    load();
  };

  const savePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPopup) return;
    try {
      if (editingPopup.id) {
        await apiFetch(`/api/admin/homepage/popups/${editingPopup.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingPopup),
        });
      } else {
        await apiFetch('/api/admin/homepage/popups', {
          method: 'POST',
          body: JSON.stringify(editingPopup),
        });
      }
      setEditingPopup(null);
      setFeedback({ type: 'ok', msg: 'Homepage popup saved and synced to the public portal.' });
      load();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Failed to save popup' });
    }
  };

  const togglePopupActive = async (popup: HomepagePopup) => {
    try {
      await apiFetch(`/api/admin/homepage/popups/${popup.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: popup.is_active ? 0 : 1 }),
      });
      setFeedback({
        type: 'ok',
        msg: popup.is_active ? 'Homepage popup hidden from visitors.' : `"${popup.title_en}" is now active on the homepage.`,
      });
      load();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const deletePopup = async (id: number) => {
    if (!window.confirm('Delete this homepage popup?')) return;
    await apiFetch(`/api/admin/homepage/popups/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-900">
          {lang === 'bn' ? 'ডাইনামিক হোমপেজ ম্যানেজমেন্ট / Homepage Management' : 'Dynamic Homepage Management'}
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Control hero banners, section visibility & ordering, Block at a Glance counters, quick links, and shortcuts without editing code.
        </p>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* 0. Homepage Announcement Popups */}
      <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Homepage Announcement Popup ({popups.length})</h3>
              <p className="text-xs text-slate-500">
                Manage the welcome/announcement popup displayed when visitors open the public homepage. Only one popup can be active at a time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditingPopup({
                title_en: '',
                title_bn: '',
                subtitle_en: '',
                subtitle_bn: '',
                body_en: '',
                body_bn: '',
                badge_en: 'ANNOUNCEMENT',
                badge_bn: 'জরুরি ঘোষণা',
                button_text_en: 'View Details',
                button_text_bn: 'বিস্তারিত দেখুন',
                button_link: '/section/notices-circulars',
                theme_color: 'royal',
                show_once_per_session: 0,
                is_active: 1,
              })
            }
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-purple-600 hover:brightness-110 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Popup</span>
          </button>
        </div>

        {popups.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
            No homepage popups created yet. Click &ldquo;Create Popup&rdquo; to publish one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popups.map((p) => {
              const themeMeta = POPUP_THEMES[p.theme_color] || POPUP_THEMES.royal;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 flex gap-3.5 items-start ${
                    p.is_active ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                    {p.image_url ? (
                      <SmartImage src={p.image_url} alt={p.title_en} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.is_active ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'}`}>
                        {p.is_active ? 'Active on Homepage' : 'Hidden'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${themeMeta.badge}`}>
                        {themeMeta.label}
                      </span>
                      {p.show_once_per_session === 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Once / Session
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 line-clamp-1">{p.title_en}</div>
                    <div className="text-xs text-slate-600 line-clamp-1">{p.title_bn}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{p.body_en || p.subtitle_en}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={() => togglePopupActive(p)}
                        className={`px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${
                          p.is_active ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {p.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{p.is_active ? 'Disable' : 'Activate'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPopup(p)}
                        className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePopup(p.id)}
                        className="p-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                        title="Delete popup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Hero Banners */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Hero Carousel Banners ({banners.length})</h3>
          <button
            type="button"
            onClick={() => setEditingBanner({
              title_en: '',
              title_bn: '',
              subtitle_en: '',
              subtitle_bn: '',
              button_text_en: 'Explore More',
              button_text_bn: 'বিস্তারিত দেখুন',
              button_link: '/section/about-balagarh',
              sort_order: banners.length + 1,
              is_active: 1,
            })}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Banner</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="relative aspect-[16/9] bg-slate-100">
                <SmartImage src={b.image_url} alt={b.title_en} className="w-full h-full object-cover" />
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[11px] font-bold ${b.is_active ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}`}>
                  {b.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-sm font-bold text-slate-900 line-clamp-1">{b.title_en}</div>
                  <div className="text-xs text-slate-600 line-clamp-1">{b.title_bn}</div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setEditingBanner(b)} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => deleteBanner(b.id)} className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Section Visibility & Ordering */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Homepage Section Ordering & Show/Hide</h3>
            <p className="text-xs text-slate-500">Reorder or hide sections on the public homepage.</p>
          </div>
          <button
            type="button"
            onClick={saveSectionsOrder}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Section Layout</span>
          </button>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          {sections.map((s, idx) => (
            <div key={s.id} className="px-4 py-3 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center tabular-nums">
                  {idx + 1}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{s.title_en}</div>
                  <div className="text-xs text-slate-500">{s.title_bn}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSectionVisibility(s.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                    s.is_visible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {s.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{s.is_visible ? 'Visible' : 'Hidden'}</span>
                </button>
                <button type="button" disabled={idx === 0} onClick={() => moveSection(idx, -1)} className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" disabled={idx === sections.length - 1} onClick={() => moveSection(idx, 1)} className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Quick Cards: At a Glance, Quick Links, Category Shortcuts */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Quick Links, Block at a Glance & Shortcuts</h3>
            <p className="text-xs text-slate-500">Edit homepage quick links, counters, and shortcut tiles.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingCard({
              card_type: 'quick_link',
              label_en: '',
              label_bn: '',
              value_text: '',
              target_section: 'public-services',
              url: '/section/public-services',
              icon: 'Link',
              color_hex: '#16A34A',
              sort_order: 1,
              is_active: 1,
            })}
            className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Quick Card</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Label (EN / BN)</th>
                <th className="py-2.5 px-3">Value / Route</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold uppercase text-slate-500">{c.card_type}</td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-slate-900">{c.label_en}</span>
                    <span className="text-slate-500 ml-2">{c.label_bn}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600">{c.value_text || c.url}</td>
                  <td className="py-2 px-3 text-right space-x-2">
                    <button type="button" onClick={() => setEditingCard(c)} className="text-blue-600 font-bold hover:underline">Edit</button>
                    <button type="button" onClick={() => deleteCard(c.id)} className="text-red-600 font-bold hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Banner Editor Modal */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={saveBanner} className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingBanner.id ? 'Edit Banner' : 'Add Banner'}</h3>
              <button type="button" onClick={() => setEditingBanner(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">English Title *</label>
                <input required type="text" value={editingBanner.title_en || ''} onChange={(e) => setEditingBanner({ ...editingBanner, title_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Bengali Title *</label>
                <input required type="text" value={editingBanner.title_bn || ''} onChange={(e) => setEditingBanner({ ...editingBanner, title_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Subtitle (EN)</label>
                <input type="text" value={editingBanner.subtitle_en || ''} onChange={(e) => setEditingBanner({ ...editingBanner, subtitle_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Subtitle (BN)</label>
                <input type="text" value={editingBanner.subtitle_bn || ''} onChange={(e) => setEditingBanner({ ...editingBanner, subtitle_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Button Text (EN)</label>
                <input type="text" value={editingBanner.button_text_en || ''} onChange={(e) => setEditingBanner({ ...editingBanner, button_text_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Button Text (BN)</label>
                <input type="text" value={editingBanner.button_text_bn || ''} onChange={(e) => setEditingBanner({ ...editingBanner, button_text_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Target Link</label>
                <input type="text" value={editingBanner.button_link || ''} onChange={(e) => setEditingBanner({ ...editingBanner, button_link: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => setPickerTarget('banner')} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1">
                  <ImageIcon className="w-4 h-4" /> Choose Banner Photo
                </button>
                <label className="flex items-center gap-1.5 text-xs font-bold pb-2">
                  <input type="checkbox" checked={Boolean(editingBanner.is_active)} onChange={(e) => setEditingBanner({ ...editingBanner, is_active: e.target.checked ? 1 : 0 })} />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingBanner(null)} className="px-4 py-2 rounded-lg border text-xs font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Save Banner</button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Card Editor Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={saveCard} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingCard.id ? 'Edit Quick Card' : 'Add Quick Card'}</h3>
              <button type="button" onClick={() => setEditingCard(null)}><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Card Type</label>
              <select value={editingCard.card_type} onChange={(e) => setEditingCard({ ...editingCard, card_type: e.target.value as HomepageQuickCard['card_type'] })} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="shortcut">Category Shortcut</option>
                <option value="glance">Block at a Glance Stat</option>
                <option value="quick_link">Quick Link</option>
                <option value="scheme">Government Scheme</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Label (English)</label>
              <input required type="text" value={editingCard.label_en || ''} onChange={(e) => setEditingCard({ ...editingCard, label_en: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Label (Bengali)</label>
              <input required type="text" value={editingCard.label_bn || ''} onChange={(e) => setEditingCard({ ...editingCard, label_bn: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Stat Value (for Glance) or Subtitle</label>
              <input type="text" value={editingCard.value_text || ''} onChange={(e) => setEditingCard({ ...editingCard, value_text: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Target URL (e.g. /section/schools)</label>
              <input type="text" value={editingCard.url || ''} onChange={(e) => setEditingCard({ ...editingCard, url: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingCard(null)} className="px-4 py-2 rounded-lg border text-xs font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">Save Card</button>
            </div>
          </form>
        </div>
      )}

      {/* Popup Editor Modal */}
      {editingPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={savePopup} className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold">{editingPopup.id ? 'Edit Homepage Popup' : 'Create Homepage Popup'}</h3>
              </div>
              <button type="button" onClick={() => setEditingPopup(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">English Title *</label>
                <input required type="text" value={editingPopup.title_en || ''} onChange={(e) => setEditingPopup({ ...editingPopup, title_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Bengali Title *</label>
                <input required type="text" value={editingPopup.title_bn || ''} onChange={(e) => setEditingPopup({ ...editingPopup, title_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Subtitle (EN)</label>
                <input type="text" value={editingPopup.subtitle_en || ''} onChange={(e) => setEditingPopup({ ...editingPopup, subtitle_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Subtitle (BN)</label>
                <input type="text" value={editingPopup.subtitle_bn || ''} onChange={(e) => setEditingPopup({ ...editingPopup, subtitle_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Message Body (EN)</label>
                <textarea rows={3} value={editingPopup.body_en || ''} onChange={(e) => setEditingPopup({ ...editingPopup, body_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Message Body (BN)</label>
                <textarea rows={3} value={editingPopup.body_bn || ''} onChange={(e) => setEditingPopup({ ...editingPopup, body_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Badge Label (EN)</label>
                <input type="text" value={editingPopup.badge_en || ''} onChange={(e) => setEditingPopup({ ...editingPopup, badge_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Badge Label (BN)</label>
                <input type="text" value={editingPopup.badge_bn || ''} onChange={(e) => setEditingPopup({ ...editingPopup, badge_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">CTA Button Text (EN)</label>
                <input type="text" value={editingPopup.button_text_en || ''} onChange={(e) => setEditingPopup({ ...editingPopup, button_text_en: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">CTA Button Text (BN)</label>
                <input type="text" value={editingPopup.button_text_bn || ''} onChange={(e) => setEditingPopup({ ...editingPopup, button_text_bn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Target Link (e.g. /events or /section/notices-circulars)</label>
                <input type="text" value={editingPopup.button_link || ''} onChange={(e) => setEditingPopup({ ...editingPopup, button_link: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Popup Color Theme</label>
                <select
                  value={editingPopup.theme_color || 'royal'}
                  onChange={(e) => setEditingPopup({ ...editingPopup, theme_color: e.target.value as HomepagePopup['theme_color'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="royal">Royal Blue</option>
                  <option value="crimson">Crimson Rose</option>
                  <option value="emerald">Emerald Teal</option>
                  <option value="amber">Sunset Amber</option>
                  <option value="violet">Purple Violet</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPickerTarget('popup')} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" /> {editingPopup.image_url ? 'Change Popup Image' : 'Choose Popup Image'}
                </button>
                {editingPopup.image_url && (
                  <button type="button" onClick={() => setEditingPopup({ ...editingPopup, media_id: null, image_url: null })} className="text-xs font-bold text-red-600 hover:underline">
                    Remove Image
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPopup.show_once_per_session)}
                    onChange={(e) => setEditingPopup({ ...editingPopup, show_once_per_session: e.target.checked ? 1 : 0 })}
                  />
                  Show once per session
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPopup.is_active)}
                    onChange={(e) => setEditingPopup({ ...editingPopup, is_active: e.target.checked ? 1 : 0 })}
                  />
                  Active on Homepage
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingPopup(null)} className="px-4 py-2 rounded-lg border text-xs font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-purple-600 text-white text-xs font-bold">Save Popup</button>
            </div>
          </form>
        </div>
      )}

      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={(sel) => {
          if (!sel[0]) return;
          if (pickerTarget === 'banner' && editingBanner) {
            setEditingBanner({ ...editingBanner, media_id: sel[0].id, image_url: sel[0].url });
          } else if (pickerTarget === 'popup' && editingPopup) {
            setEditingPopup({ ...editingPopup, media_id: sel[0].id, image_url: sel[0].url });
          }
          setPickerTarget(null);
        }}
      />
    </div>
  );
};
