import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Calendar, ChevronRight, Download, ExternalLink, Eye,
  MapPin, Phone, Search, Tag as TagIcon, Users, Video,
} from 'lucide-react';
import type { ContentCategory, ContentItem, ContentSection, EventItem, Language } from '../../types/cms';
import { apiFetch } from '../../lib/api';
import { bi, extractDateBadge, formatDateTime, getEmbedVideoUrl } from '../../lib/i18n';
import { SmartImage } from '../SmartImage';
import { DynamicIcon } from '../DynamicIcon';

export const PublicSectionView: React.FC<{
  slug: string;
  lang: Language;
  onNavigate: (route: string) => void;
}> = ({ slug, lang, onNavigate }) => {
  const [section, setSection] = useState<ContentSection | null>(null);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
    setSelectedCat(null);
    setSearch('');
  }, [slug]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (selectedCat) params.set('category_id', String(selectedCat));
    if (search.trim()) params.set('search', search.trim());

    apiFetch<{
      section: ContentSection;
      categories: ContentCategory[];
      items: ContentItem[];
      pagination: { totalPages: number };
    }>(`/api/public/sections/${slug}?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setSection(res.section);
        setCategories(res.categories);
        setItems(res.items);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug, page, selectedCat, search]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden">
        <div className="h-1.5 w-full grid grid-cols-6">
          <div className="bg-emerald-500" />
          <div className="bg-sky-500" />
          <div className="bg-violet-500" />
          <div className="bg-rose-500" />
          <div className="bg-amber-400" />
          <div className="bg-teal-500" />
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <button type="button" onClick={() => onNavigate('/')} className="hover:text-blue-700 font-semibold">
              {lang === 'bn' ? 'হোম' : 'Home'}
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-blue-700">
              {section ? bi(lang, section.name_en, section.name_bn) : slug}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-sm">
                <DynamicIcon name={section?.icon || 'FileText'} className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {section ? bi(lang, section.name_en, section.name_bn) : slug}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {section ? bi(lang, section.description_en, section.description_bn) : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 w-full md:w-72">
              <Search className="w-4 h-4 text-blue-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={lang === 'bn' ? 'এই বিভাগে খুঁজুন...' : 'Filter this section...'}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setSelectedCat(null); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedCat === null ? 'bg-gradient-to-r from-[#1D4ED8] to-[#0284C7] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {lang === 'bn' ? 'সকল' : 'All'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setSelectedCat(cat.id); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selectedCat === cat.id ? 'bg-gradient-to-r from-[#1D4ED8] to-[#0284C7] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {bi(lang, cat.name_en, cat.name_bn)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-72 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-600 text-base font-medium">
            {lang === 'bn' ? 'এই বিভাগে বর্তমানে কোনো প্রকাশিত তথ্য নেই।' : 'No published items found in this section.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B4A6F] text-white text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'bn' ? 'হোম পেজে ফিরুন' : 'Back to Home'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <button
                type="button"
                onClick={() => onNavigate(`/content/${item.id}`)}
                className="aspect-[16/10] bg-slate-100 overflow-hidden block text-left"
              >
                <SmartImage
                  src={item.cover_url}
                  alt={bi(lang, item.title_en, item.title_bn)}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </button>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 tabular-nums">
                  {item.category_name_en && (
                    <>
                      <span>{bi(lang, item.category_name_en, item.category_name_bn)}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>{item.metadata?.Date || formatDateTime(item.created_at, lang)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(`/content/${item.id}`)}
                  className="text-left"
                >
                  <h2 className="text-base font-bold text-slate-900 hover:text-[#0B4A6F] leading-snug">
                    {bi(lang, item.title_en, item.title_bn)}
                  </h2>
                </button>
                <p className="text-sm text-slate-600 mt-2 line-clamp-3 leading-relaxed flex-1">
                  {bi(lang, item.summary_en, item.summary_bn)}
                </p>

                {Object.keys(item.metadata || {}).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {Object.entries(item.metadata).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="truncate">
                        <span className="text-slate-500">{k}: </span>
                        <span className="font-semibold text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/content/${item.id}`)}
                    className="text-xs font-bold text-[#0B4A6F] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Full Details'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-400 inline-flex items-center gap-1 tabular-nums">
                    <Eye className="w-3.5 h-3.5" />
                    {item.views_count}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold tabular-nums ${
                p === page ? 'bg-[#0B4A6F] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const PublicContentDetailView: React.FC<{
  contentId: number;
  lang: Language;
  onNavigate: (route: string) => void;
}> = ({ contentId, lang, onNavigate }) => {
  const [item, setItem] = useState<ContentItem | null>(null);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiFetch<{ item: ContentItem; related: ContentItem[] }>(`/api/public/contents/${contentId}`)
      .then((res) => {
        if (!active) return;
        setItem(res.item);
        setRelated(res.related);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Not found'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [contentId]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10"><div className="h-96 bg-white rounded-xl animate-pulse border border-slate-200" /></div>;
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center bg-white rounded-xl border border-slate-200 my-8">
        <h2 className="text-xl font-bold text-slate-900">Content Unavailable</h2>
        <p className="text-sm text-slate-600 mt-2">{error || 'This item is either unpublished or does not exist.'}</p>
        <button type="button" onClick={() => onNavigate('/')} className="mt-4 px-4 py-2 rounded-lg bg-[#0B4A6F] text-white text-sm font-semibold">
          Return Home
        </button>
      </div>
    );
  }

  const embedUrl = getEmbedVideoUrl(item.video_url);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <article className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {item.cover_url && (
          <div className="aspect-[16/9] bg-slate-100">
            <SmartImage src={item.cover_url} alt={bi(lang, item.title_en, item.title_bn)} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button type="button" onClick={() => onNavigate('/')} className="hover:text-[#0B4A6F]">Home</button>
            <ChevronRight className="w-3.5 h-3.5" />
            <button type="button" onClick={() => onNavigate(`/section/${item.section_slug}`)} className="hover:text-[#0B4A6F] font-semibold">
              {bi(lang, item.section_name_en, item.section_name_bn)}
            </button>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateTime(item.created_at, lang)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{item.views_count} views</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight text-balance">
            {bi(lang, item.title_en, item.title_bn)}
          </h1>

          <p className="text-base text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
            {bi(lang, item.summary_en, item.summary_bn)}
          </p>

          {/* Dynamic Body HTML */}
          <div
            className="prose-balagarh text-base"
            dangerouslySetInnerHTML={{ __html: bi(lang, item.body_en, item.body_bn) }}
          />

          {/* Embedded Video */}
          {item.video_url && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-red-600" />
                <span>{lang === 'bn' ? 'ভিডিও উপস্থাপনা' : 'Video Presentation'}</span>
              </h3>
              {embedUrl ? (
                <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-black">
                  <iframe
                    src={embedUrl}
                    title={item.title_en}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video src={item.video_url} controls className="w-full rounded-xl border border-slate-200 bg-black" />
              )}
            </div>
          )}

          {/* Attachments: Document / External URL */}
          {(item.document_url || item.external_url) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {item.document_url && (
                <a
                  href={item.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'নথি ডাউনলোড করুন' : 'Download Document'}</span>
                </a>
              )}
              {item.external_url && (
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B4A6F] hover:bg-[#083854] text-white text-sm font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'সম্পর্কিত ওয়েবসাইট দেখুন' : 'Visit Official Link'}</span>
                </a>
              )}
            </div>
          )}

          {/* Photo Gallery Strip */}
          {item.gallery && item.gallery.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-3">
                {lang === 'bn' ? 'সংশ্লিষ্ট আলোকচিত্র / Photo Gallery' : 'Attached Photographs'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {item.gallery.map((g, idx) => (
                  <div key={`${g.media_id}-${idx}`} className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="aspect-[4/3] overflow-hidden">
                      <SmartImage src={g.url} alt={g.alt_text || g.caption_en} className="w-full h-full object-cover" />
                    </div>
                    {(g.caption_en || g.caption_bn) && (
                      <div className="p-2 text-xs text-slate-600 line-clamp-2">
                        {bi(lang, g.caption_en, g.caption_bn)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <TagIcon className="w-3.5 h-3.5 text-slate-400" />
              {item.tags.map((t, i) => (
                <React.Fragment key={t.id}>
                  <span>{bi(lang, t.name_en, t.name_bn)}</span>
                  {i < item.tags!.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Sidebar */}
      <aside className="lg:col-span-4 space-y-5">
        {Object.keys(item.metadata || {}).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#0B4A6F] pb-2.5 mb-3 border-b border-slate-200">
              {lang === 'bn' ? 'মূল তথ্য / Key Details' : 'Key Specifications'}
            </h3>
            <dl className="divide-y divide-slate-100 text-sm">
              {Object.entries(item.metadata).map(([k, v]) => (
                <div key={k} className="py-2 flex items-center justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#0B4A6F] pb-2.5 mb-3 border-b border-slate-200">
            {lang === 'bn' ? 'সংশ্লিষ্ট অন্যান্য তথ্য' : 'Related Entries'}
          </h3>
          <div className="space-y-3">
            {related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onNavigate(`/content/${r.id}`)}
                className="w-full text-left flex items-start gap-3 group"
              >
                <div className="w-16 h-12 rounded-md overflow-hidden bg-slate-100 shrink-0">
                  <SmartImage src={r.cover_url} alt={r.title_en} className="w-full h-full object-cover" />
                </div>
                <div className="text-sm font-semibold text-slate-800 group-hover:text-[#0B4A6F] line-clamp-2">
                  {bi(lang, r.title_en, r.title_bn)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export const PublicEventsView: React.FC<{
  lang: Language;
  selectedEventId?: number | null;
  onNavigate: (route: string) => void;
}> = ({ lang, selectedEventId, onNavigate }) => {
  const [tab, setTab] = useState<'all' | 'Upcoming' | 'Ongoing' | 'Completed'>('all');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ events: EventItem[] }>(`/api/public/events?status=${tab}`)
      .then((res) => {
        if (!active) return;
        setEvents(res.events);
        if (selectedEventId) {
          const found = res.events.find((e) => e.id === selectedEventId);
          if (found) setDetailEvent(found);
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [tab, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      apiFetch<{ event: EventItem }>(`/api/public/events/${selectedEventId}`)
        .then((res) => setDetailEvent(res.event))
        .catch(() => {});
    } else {
      setDetailEvent(null);
    }
  }, [selectedEventId]);

  if (detailEvent) {
    const embedUrl = getEmbedVideoUrl(detailEvent.video_url);
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => { setDetailEvent(null); onNavigate('/events'); }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B4A6F] mb-4 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'bn' ? 'সকল ইভেন্টে ফিরুন' : 'Back to All Events'}</span>
        </button>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {detailEvent.cover_url && (
            <div className="aspect-[16/9] bg-slate-100">
              <SmartImage src={detailEvent.cover_url} alt={detailEvent.title_en} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded bg-violet-100 text-violet-800">{detailEvent.event_status}</span>
              <span className="text-slate-500">{detailEvent.organizer}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {bi(lang, detailEvent.title_en, detailEvent.title_bn)}
            </h1>
            <p className="text-base text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {bi(lang, detailEvent.short_desc_en, detailEvent.short_desc_bn)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-violet-50/60 p-4 rounded-lg border border-violet-100">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'তারিখ ও সময়' : 'Schedule'}</div>
                  <div className="font-semibold text-slate-900 tabular-nums">
                    {detailEvent.start_datetime.replace('T', ' ')} → {detailEvent.end_datetime.replace('T', ' ')}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'স্থান' : 'Venue'}</div>
                  <div className="font-semibold text-slate-900">{detailEvent.venue}</div>
                </div>
              </div>
              {detailEvent.contact_details && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">{lang === 'bn' ? 'যোগাযোগ' : 'Contact'}</div>
                    <div className="font-semibold text-slate-900">{detailEvent.contact_details}</div>
                  </div>
                </div>
              )}
              {detailEvent.organizer && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">{lang === 'bn' ? 'আয়োজক' : 'Organizer'}</div>
                    <div className="font-semibold text-slate-900">{detailEvent.organizer}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="prose-balagarh" dangerouslySetInnerHTML={{ __html: bi(lang, detailEvent.full_desc_en, detailEvent.full_desc_bn) }} />

            {detailEvent.registration_url && (
              <a
                href={detailEvent.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-violet-700 text-white text-sm font-semibold"
              >
                <span>{lang === 'bn' ? 'অনলাইন রেজিস্ট্রেশন করুন' : 'Event Registration'}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {embedUrl && (
              <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-black">
                <iframe src={embedUrl} title={detailEvent.title_en} className="w-full h-full" allowFullScreen />
              </div>
            )}

            {detailEvent.gallery && detailEvent.gallery.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-base font-bold mb-3">{lang === 'bn' ? 'ইভেন্ট ফটো গ্যালারি' : 'Event Photographs'}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {detailEvent.gallery.map((g, i) => (
                    <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200">
                      <SmartImage src={g.url} alt={g.caption_en} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {lang === 'bn' ? 'বলাগড়ের অনুষ্ঠান ও কর্মসূচি / Events & Programmes' : 'Balagarh Events & Programmes'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {lang === 'bn' ? 'আসন্ন, চলমান এবং পূর্ববর্তী সমস্ত অনুষ্ঠানের তালিকা' : 'Browse upcoming, ongoing, and completed block programmes'}
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {([
            { id: 'all', en: 'All Events', bn: 'সকল' },
            { id: 'Upcoming', en: 'Upcoming Events', bn: 'আসন্ন' },
            { id: 'Ongoing', en: 'Ongoing Events', bn: 'চলমান' },
            { id: 'Completed', en: 'Past Events', bn: 'সম্পন্ন' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t.id ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {lang === 'bn' ? t.bn : t.en}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          {lang === 'bn' ? 'এই বিভাগে কোনো ইভেন্ট পাওয়া যায়নি।' : 'No events found for this filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => {
            const badge = extractDateBadge(ev.start_datetime);
            return (
              <div key={ev.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="relative aspect-[16/10] bg-slate-100">
                  <SmartImage src={ev.cover_url} alt={ev.title_en} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 w-12 h-12 rounded-lg bg-white/95 shadow flex flex-col items-center justify-center text-[#6D28D9] tabular-nums">
                    <span className="text-base font-extrabold leading-none">{badge.day}</span>
                    <span className="text-[11px] font-bold">{badge.month}</span>
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-slate-900/80 text-white text-xs font-semibold">
                    {ev.event_status}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {bi(lang, ev.title_en, ev.title_bn)}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{ev.venue}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2 flex-1">
                    {bi(lang, ev.short_desc_en, ev.short_desc_bn)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/events/${ev.id}`)}
                    className="mt-4 w-full py-2 rounded-lg bg-violet-50 hover:bg-[#6D28D9] text-[#6D28D9] hover:text-white text-xs font-bold transition-colors"
                  >
                    {lang === 'bn' ? 'ইভেন্টের বিস্তারিত দেখুন' : 'View Event Details'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PublicSearchView: React.FC<{
  query: string;
  lang: Language;
  onNavigate: (route: string) => void;
}> = ({ query, lang, onNavigate }) => {
  const [results, setResults] = useState<{ contents: ContentItem[]; events: EventItem[] }>({ contents: [], events: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    setLoading(true);
    apiFetch<{ contents: ContentItem[]; events: EventItem[] }>(`/api/public/search?q=${encodeURIComponent(query)}`)
      .then((res) => active && setResults(res))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? `অনুসন্ধানের ফলাফল: "${query}"` : `Search Results for "${query}"`}
        </h1>
        <p className="text-sm text-slate-500 mt-1 tabular-nums">
          {results.contents.length} articles · {results.events.length} events found
        </p>
      </div>

      {loading ? (
        <div className="h-48 bg-white rounded-xl animate-pulse border border-slate-200" />
      ) : (
        <div className="space-y-4">
          {results.contents.map((c) => (
            <button
              key={`c-${c.id}`}
              type="button"
              onClick={() => onNavigate(`/content/${c.id}`)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <SmartImage src={c.cover_url} alt={c.title_en} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#0B4A6F]">
                  {bi(lang, c.section_name_en, c.section_name_bn)}
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {bi(lang, c.title_en, c.title_bn)}
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                  {bi(lang, c.summary_en, c.summary_bn)}
                </p>
              </div>
            </button>
          ))}

          {results.events.map((ev) => (
            <button
              key={`e-${ev.id}`}
              type="button"
              onClick={() => onNavigate(`/events/${ev.id}`)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <SmartImage src={ev.cover_url} alt={ev.title_en} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#6D28D9]">Event · {ev.event_status}</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{bi(lang, ev.title_en, ev.title_bn)}</div>
                <p className="text-sm text-slate-600 line-clamp-2 mt-1">{ev.venue} · {bi(lang, ev.short_desc_en, ev.short_desc_bn)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
