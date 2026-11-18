import type { PublicBootstrapData } from '../components/public/PublicPortal';
import type { ContentCategory, ContentItem, ContentSection, EventItem } from '../types/cms';
import bundledSnapshotRaw from '../data/portal-snapshot.json';
import { buildLocalPublicBootstrap, localCmsFetch } from './localCms';

export interface PortalStaticSnapshot {
  bootstrap: PublicBootstrapData;
  sections: ContentSection[];
  categories: ContentCategory[];
  contents: ContentItem[];
  events: EventItem[];
}

const BUNDLED_SNAPSHOT = bundledSnapshotRaw as unknown as PortalStaticSnapshot;

export function getBundledBootstrap(): PublicBootstrapData {
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('balagarh_local_cms_v1')) {
      return buildLocalPublicBootstrap();
    }
  } catch {
    // ignore storage access issues
  }
  return BUNDLED_SNAPSHOT.bootstrap;
}

let cachedSnapshotPromise: Promise<PortalStaticSnapshot> | null = null;

export function loadStaticSnapshot(): Promise<PortalStaticSnapshot> {
  if (!cachedSnapshotPromise) {
    cachedSnapshotPromise = fetch('/data/portal-snapshot.json')
      .then((res) => {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || !ct.includes('application/json')) return BUNDLED_SNAPSHOT;
        return res.json() as Promise<PortalStaticSnapshot>;
      })
      .catch(() => BUNDLED_SNAPSHOT);
  }
  return cachedSnapshotPromise;
}

export async function getFallbackBootstrap(): Promise<PublicBootstrapData> {
  try {
    return buildLocalPublicBootstrap();
  } catch {
    const snap = await loadStaticSnapshot();
    return snap.bootstrap || BUNDLED_SNAPSHOT.bootstrap;
  }
}

export async function getFallbackSection(
  slug: string,
  page: number,
  limit: number,
  categoryId: number | null,
  search: string
) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
    });
    if (categoryId) params.set('category_id', String(categoryId));
    return await localCmsFetch<{
      section: ContentSection;
      categories: ContentCategory[];
      items: ContentItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/public/sections/${slug}?${params.toString()}`);
  } catch {
    const snap = await loadStaticSnapshot();
    const section = snap.sections.find((s) => s.slug === slug);
    if (!section) return null;

    const categories = snap.categories
      .filter((c) => c.section_slug === slug)
      .sort((a, b) => a.name_en.localeCompare(b.name_en));

    let items = snap.contents.filter((c) => c.section_slug === slug);
    if (categoryId) {
      items = items.filter((c) => Number(c.category_id) === categoryId);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (c) =>
          c.title_en.toLowerCase().includes(q) ||
          c.title_bn.toLowerCase().includes(q) ||
          c.summary_en.toLowerCase().includes(q) ||
          c.summary_bn.toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const offset = (page - 1) * limit;
    const paged = items.slice(offset, offset + limit);

    return {
      section,
      categories,
      items: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export async function getFallbackContentDetail(id: number) {
  try {
    return await localCmsFetch<{ item: ContentItem; related: ContentItem[] }>(`/api/public/contents/${id}`);
  } catch {
    const snap = await loadStaticSnapshot();
    const item = snap.contents.find((c) => Number(c.id) === Number(id));
    if (!item) return null;
    const related = snap.contents
      .filter((c) => c.section_slug === item.section_slug && Number(c.id) !== Number(id))
      .slice(0, 4);
    return { item, related };
  }
}

export async function getFallbackEvents(status: string) {
  try {
    return await localCmsFetch<{ events: EventItem[] }>(`/api/public/events?status=${encodeURIComponent(status)}`);
  } catch {
    const snap = await loadStaticSnapshot();
    let events = snap.events;
    if (['Upcoming', 'Ongoing', 'Completed', 'Cancelled'].includes(status)) {
      events = events.filter((e) => e.event_status === status);
    }
    return { events };
  }
}

export async function getFallbackEventDetail(id: number) {
  try {
    return await localCmsFetch<{ event: EventItem }>(`/api/public/events/${id}`);
  } catch {
    const snap = await loadStaticSnapshot();
    const event = snap.events.find((e) => Number(e.id) === Number(id));
    return event ? { event } : null;
  }
}

export async function getFallbackSearch(query: string) {
  try {
    return await localCmsFetch<{ contents: ContentItem[]; events: EventItem[] }>(
      `/api/public/search?q=${encodeURIComponent(query)}`
    );
  } catch {
    const snap = await loadStaticSnapshot();
    const q = query.trim().toLowerCase();
    if (!q) return { contents: [], events: [] };

    const contents = snap.contents
      .filter(
        (c) =>
          c.title_en.toLowerCase().includes(q) ||
          c.title_bn.toLowerCase().includes(q) ||
          c.summary_en.toLowerCase().includes(q) ||
          c.summary_bn.toLowerCase().includes(q) ||
          c.body_en.toLowerCase().includes(q) ||
          c.body_bn.toLowerCase().includes(q)
      )
      .slice(0, 24);

    const events = snap.events
      .filter(
        (e) =>
          e.title_en.toLowerCase().includes(q) ||
          e.title_bn.toLowerCase().includes(q) ||
          e.short_desc_en.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q)
      )
      .slice(0, 12);

    return { contents, events };
  }
}
