import bundledSnapshotRaw from '../data/portal-snapshot.json';
import type { PublicBootstrapData } from '../components/public/PublicPortal';
import type {
  ActivityLog,
  ContentCategory,
  ContentItem,
  ContentRevision,
  ContentSection,
  ContentTag,
  EventItem,
  HomepageBanner,
  HomepagePopup,
  HomepageQuickCard,
  HomepageSectionConfig,
  MediaRecord,
  RolePermissions,
  RoleRecord,
  UserRecord,
} from '../types/cms';

const STORAGE_KEY = 'balagarh_local_cms_v1';

interface LocalUser extends UserRecord {
  local_password?: string;
}

interface LocalCmsStore {
  sections: ContentSection[];
  categories: ContentCategory[];
  tags: ContentTag[];
  media: MediaRecord[];
  roles: RoleRecord[];
  users: LocalUser[];
  contents: ContentItem[];
  events: EventItem[];
  banners: HomepageBanner[];
  homepageSections: HomepageSectionConfig[];
  quickCards: HomepageQuickCard[];
  popups: HomepagePopup[];
  revisions: ContentRevision[];
  logs: ActivityLog[];
  resets?: Array<{ user_id: number; reset_code: string; expires_at: number; used: number }>;
  nextIds: Record<string, number>;
}

const SNAPSHOT = bundledSnapshotRaw as unknown as {
  bootstrap: PublicBootstrapData;
  sections: ContentSection[];
  categories: ContentCategory[];
  tags: ContentTag[];
  media: MediaRecord[];
  roles: RoleRecord[];
  users: UserRecord[];
  contents: ContentItem[];
  events: EventItem[];
  banners: HomepageBanner[];
  quickCards: HomepageQuickCard[];
  popups: HomepagePopup[];
};

function createInitialStore(): LocalCmsStore {
  const maxId = (arr: Array<{ id?: number }>) =>
    arr.reduce((m, x) => Math.max(m, Number(x.id || 0)), 0) + 1;

  return {
    sections: structuredClone(SNAPSHOT.sections || []),
    categories: structuredClone(SNAPSHOT.categories || []),
    tags: structuredClone(SNAPSHOT.tags || []),
    media: structuredClone(SNAPSHOT.media || []),
    roles: structuredClone(SNAPSHOT.roles || []),
    users: structuredClone(SNAPSHOT.users || []),
    contents: structuredClone(SNAPSHOT.contents || []),
    events: structuredClone(SNAPSHOT.events || []),
    banners: structuredClone(SNAPSHOT.banners || SNAPSHOT.bootstrap?.banners || []),
    homepageSections: structuredClone(SNAPSHOT.bootstrap?.homepageSections || []),
    quickCards: structuredClone(SNAPSHOT.quickCards || SNAPSHOT.bootstrap?.quickCards || []),
    popups: structuredClone(SNAPSHOT.popups || (SNAPSHOT.bootstrap?.popup ? [SNAPSHOT.bootstrap.popup] : [])),
    revisions: [],
    logs: [
      {
        id: 1,
        user_id: 1,
        user_name: 'Subhajit Chatterjee',
        role_name: 'Super Administrator',
        action: 'init',
        module: 'system',
        entity_id: null,
        details: 'Initialized Our Balagarh CMS Portal',
        created_at: new Date().toISOString(),
      },
    ],
    nextIds: {
      contents: maxId(SNAPSHOT.contents || []),
      events: maxId(SNAPSHOT.events || []),
      media: maxId(SNAPSHOT.media || []),
      banners: maxId(SNAPSHOT.banners || []),
      cards: maxId(SNAPSHOT.quickCards || []),
      popups: maxId(SNAPSHOT.popups || []),
      categories: maxId(SNAPSHOT.categories || []),
      tags: maxId(SNAPSHOT.tags || []),
      users: maxId(SNAPSHOT.users || []),
      logs: 2,
      revisions: 1,
    },
  };
}

function loadStore(): LocalCmsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalCmsStore;
      if (parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: LocalCmsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota error
  }
}

function nextId(store: LocalCmsStore, key: string): number {
  const id = store.nextIds[key] || 100;
  store.nextIds[key] = id + 1;
  return id;
}

function addLog(
  store: LocalCmsStore,
  user: UserRecord,
  action: string,
  moduleName: string,
  entityId: number | null,
  details: string
) {
  store.logs.unshift({
    id: nextId(store, 'logs'),
    user_id: user.id,
    user_name: user.full_name,
    role_name: user.role_name_en,
    action,
    module: moduleName,
    entity_id: entityId,
    details,
    created_at: new Date().toISOString(),
  });
  if (store.logs.length > 200) store.logs.length = 200;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

function mediaUrlById(store: LocalCmsStore, mediaId?: number | null): string | null {
  if (!mediaId) return null;
  return store.media.find((m) => m.id === Number(mediaId))?.url || null;
}

function hasPermission(user: UserRecord, moduleSlug: string, action: 'view' | 'create' | 'edit' | 'publish' | 'delete'): boolean {
  const { modules, actions } = user.permissions;
  if (!actions.includes(action)) return false;
  if (modules.includes('*')) return true;
  return modules.includes(moduleSlug);
}

function getAuthedUser(store: LocalCmsStore, headers: Headers): UserRecord | null {
  const auth = headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token.startsWith('local:')) return null;
  const uid = Number(token.slice(6));
  const u = store.users.find((x) => x.id === uid && x.is_active === 1);
  if (!u) return null;
  const role = store.roles.find((r) => r.id === u.role_id);
  return role
    ? {
        ...u,
        role_slug: role.slug,
        role_name_en: role.name_en,
        role_name_bn: role.name_bn,
        accent_color: role.accent_color,
        permissions: role.permissions,
      }
    : u;
}

function hydrateContent(store: LocalCmsStore, c: ContentItem): ContentItem {
  const sec = store.sections.find((s) => s.slug === c.section_slug);
  const cat = store.categories.find((x) => x.id === c.category_id);
  const coverUrl = c.cover_media_id ? mediaUrlById(store, c.cover_media_id) : c.cover_url;
  return {
    ...c,
    cover_url: coverUrl || c.cover_url || null,
    section_name_en: sec?.name_en || c.section_name_en,
    section_name_bn: sec?.name_bn || c.section_name_bn,
    category_name_en: cat?.name_en || c.category_name_en,
    category_name_bn: cat?.name_bn || c.category_name_bn,
  };
}

function hydrateEvent(store: LocalCmsStore, e: EventItem): EventItem {
  const coverUrl = e.cover_media_id ? mediaUrlById(store, e.cover_media_id) : e.cover_url;
  return {
    ...e,
    cover_url: coverUrl || e.cover_url || null,
  };
}

export function buildLocalPublicBootstrap(): PublicBootstrapData {
  const store = loadStore();
  const publishedContents = store.contents
    .filter((c) => c.status === 'published')
    .map((c) => hydrateContent(store, c));
  const publishedEvents = store.events
    .filter((e) => e.publication_status === 'published')
    .map((e) => hydrateEvent(store, e));

  const sections = store.sections
    .filter((s) => s.is_active === 1)
    .map((s) => ({
      ...s,
      published_count: publishedContents.filter((c) => c.section_slug === s.slug).length,
    }));

  const banners = store.banners
    .filter((b) => b.is_active === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((b) => ({
      ...b,
      image_url: mediaUrlById(store, b.media_id) || b.image_url || null,
    }));

  const quickCards = store.quickCards
    .filter((c) => c.is_active === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const homepageSections = [...store.homepageSections].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const latestNews = publishedContents
    .filter((c) => c.section_slug === 'news-announcements')
    .slice(0, 6);
  const notices = publishedContents
    .filter((c) => c.section_slug === 'notices-circulars')
    .slice(0, 6);
  const upcomingEvents = publishedEvents
    .filter((e) => e.event_status === 'Upcoming' || e.event_status === 'Ongoing')
    .slice(0, 4);
  const aboutSummary = publishedContents.find((c) => c.section_slug === 'about-balagarh') || null;
  const photoGallery = publishedContents.filter((c) => c.section_slug === 'photo-gallery').slice(0, 2);
  const videoGallery = publishedContents.filter((c) => c.section_slug === 'video-gallery').slice(0, 2);

  const activePopupRow = store.popups.find((p) => p.is_active === 1) || null;
  const popup = activePopupRow
    ? {
        ...activePopupRow,
        image_url: mediaUrlById(store, activePopupRow.media_id) || activePopupRow.image_url || null,
      }
    : null;

  return {
    banners,
    homepageSections,
    quickCards,
    sections,
    latestNews,
    notices,
    upcomingEvents,
    aboutSummary,
    photoGallery,
    videoGallery,
    popup,
  };
}

function makeError(message: string, status = 400, extra?: Record<string, unknown>): Error {
  const err = new Error(message) as Error & { status?: number; usage?: unknown };
  err.status = status;
  if (extra?.usage) err.usage = extra.usage;
  return err;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function localCmsFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const store = loadStore();
  const method = (options.method || 'GET').toUpperCase();
  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;
  const headers = new Headers(options.headers || {});

  let body: Record<string, unknown> = {};
  if (typeof options.body === 'string' && options.body.trim()) {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = {};
    }
  }

  // ---- AUTH ----
  if (pathname === '/api/auth/csrf') {
    return { csrfToken: 'local-csrf-token' } as T;
  }

  if (pathname === '/api/auth/demo-users') {
    const users = store.users.filter((u) => u.is_active === 1);
    return { users } as T;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const demoSwitch = Boolean(body.demoSwitch);
    const u = store.users.find((x) => x.username === username && x.is_active === 1);
    if (!u) throw makeError('Invalid credentials or inactive account', 401);
    if (!demoSwitch) {
      const validPass = u.local_password || 'balagarh2026';
      if (password !== validPass) {
        throw makeError('Incorrect password', 401);
      }
    }
    const role = store.roles.find((r) => r.id === u.role_id);
    const user: UserRecord = role
      ? {
          ...u,
          role_slug: role.slug,
          role_name_en: role.name_en,
          role_name_bn: role.name_bn,
          accent_color: role.accent_color,
          permissions: role.permissions,
        }
      : u;
    addLog(store, user, 'login', 'auth', user.id, `${user.full_name} signed in as ${user.role_name_en}`);
    saveStore(store);
    return {
      token: `local:${user.id}`,
      csrfToken: 'local-csrf-token',
      user,
    } as T;
  }

  if (pathname === '/api/auth/me') {
    const user = getAuthedUser(store, headers);
    if (!user) throw makeError('Authentication required', 401);
    return { user, csrfToken: 'local-csrf-token' } as T;
  }

  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    const identifier = String(body.identifier || '').trim().toLowerCase();
    if (!identifier) throw makeError('Enter your username or email address', 400);
    const u = store.users.find(
      (x) =>
        x.is_active === 1 &&
        (x.username.toLowerCase() === identifier || x.email.toLowerCase() === identifier)
    );
    if (!u) throw makeError('No active account found with that username or email', 404);
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    store.resets = (store.resets || []).map((r) => (r.user_id === u.id ? { ...r, used: 1 } : r));
    store.resets.push({
      user_id: u.id,
      reset_code: resetCode,
      expires_at: Date.now() + 15 * 60 * 1000,
      used: 0,
    });
    addLog(store, u, 'forgot_password', 'auth', u.id, `Password recovery requested for ${u.username}`);
    saveStore(store);
    const parts = u.email.split('@');
    const maskedEmail = parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : u.email;
    return {
      ok: true,
      username: u.username,
      full_name: u.full_name,
      maskedEmail,
      recoveryCode: resetCode,
    } as T;
  }

  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const code = String(body.resetCode || '').trim();
    const newPassword = String(body.newPassword || '');
    if (!identifier || !code || !newPassword) {
      throw makeError('Username/email, verification code, and new password are required', 400);
    }
    if (newPassword.length < 6) throw makeError('New password must be at least 6 characters long', 400);
    const u = store.users.find(
      (x) =>
        x.is_active === 1 &&
        (x.username.toLowerCase() === identifier || x.email.toLowerCase() === identifier)
    );
    if (!u) throw makeError('Account not found', 404);
    const resetEntry = [...(store.resets || [])]
      .reverse()
      .find((r) => r.user_id === u.id && r.reset_code === code && r.used === 0);
    if (!resetEntry || resetEntry.expires_at < Date.now()) {
      throw makeError('Invalid or expired verification code', 400);
    }
    u.local_password = newPassword;
    resetEntry.used = 1;
    addLog(store, u, 'reset_password', 'auth', u.id, `${u.full_name} reset password via recovery code`);
    saveStore(store);
    return { ok: true, username: u.username } as T;
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const authed = getAuthedUser(store, headers);
    if (!authed) throw makeError('Authentication required', 401);
    const curr = String(body.currentPassword || '');
    const nextPass = String(body.newPassword || '');
    if (!curr || !nextPass) throw makeError('Current password and new password are required', 400);
    if (nextPass.length < 6) throw makeError('New password must be at least 6 characters long', 400);
    const target = store.users.find((x) => x.id === authed.id);
    if (!target || (target.local_password || 'balagarh2026') !== curr) {
      throw makeError('Current password is incorrect', 401);
    }
    target.local_password = nextPass;
    addLog(store, authed, 'change_password', 'auth', authed.id, `${authed.full_name} changed own account password`);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- PUBLIC ----
  if (pathname === '/api/public/bootstrap') {
    return buildLocalPublicBootstrap() as T;
  }

  if (pathname.startsWith('/api/public/sections/')) {
    const slug = pathname.replace('/api/public/sections/', '');
    const section = store.sections.find((s) => s.slug === slug && s.is_active === 1);
    if (!section) throw makeError('Section not found', 404);
    const categories = store.categories.filter((c) => c.section_slug === slug);
    const page = Math.max(1, Number(query.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(query.get('limit') || 12)));
    const catId = query.get('category_id') ? Number(query.get('category_id')) : null;
    const search = String(query.get('search') || '').trim().toLowerCase();

    let items = store.contents
      .filter((c) => c.section_slug === slug && c.status === 'published')
      .map((c) => hydrateContent(store, c));
    if (catId) items = items.filter((c) => Number(c.category_id) === catId);
    if (search) {
      items = items.filter(
        (c) =>
          c.title_en.toLowerCase().includes(search) ||
          c.title_bn.toLowerCase().includes(search) ||
          c.summary_en.toLowerCase().includes(search) ||
          c.summary_bn.toLowerCase().includes(search)
      );
    }
    const total = items.length;
    const paged = items.slice((page - 1) * limit, page * limit);
    return {
      section,
      categories,
      items: paged,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    } as T;
  }

  if (pathname.startsWith('/api/public/contents/')) {
    const id = Number(pathname.replace('/api/public/contents/', ''));
    const idx = store.contents.findIndex((c) => c.id === id && c.status === 'published');
    if (idx === -1) throw makeError('Content not found or unpublished', 404);
    store.contents[idx].views_count = (store.contents[idx].views_count || 0) + 1;
    saveStore(store);
    const item = hydrateContent(store, store.contents[idx]);
    const related = store.contents
      .filter((c) => c.section_slug === item.section_slug && c.id !== id && c.status === 'published')
      .slice(0, 4)
      .map((c) => hydrateContent(store, c));
    return { item, related } as T;
  }

  if (pathname === '/api/public/events') {
    const status = String(query.get('status') || 'all');
    let events = store.events
      .filter((e) => e.publication_status === 'published')
      .map((e) => hydrateEvent(store, e));
    if (['Upcoming', 'Ongoing', 'Completed', 'Cancelled'].includes(status)) {
      events = events.filter((e) => e.event_status === status);
    }
    return { events } as T;
  }

  if (pathname.startsWith('/api/public/events/')) {
    const id = Number(pathname.replace('/api/public/events/', ''));
    const ev = store.events.find((e) => e.id === id && e.publication_status === 'published');
    if (!ev) throw makeError('Event not found', 404);
    return { event: hydrateEvent(store, ev) } as T;
  }

  if (pathname === '/api/public/search') {
    const q = String(query.get('q') || '').trim().toLowerCase();
    if (!q) return { contents: [], events: [] } as T;
    const contents = store.contents
      .filter(
        (c) =>
          c.status === 'published' &&
          (c.title_en.toLowerCase().includes(q) ||
            c.title_bn.toLowerCase().includes(q) ||
            c.summary_en.toLowerCase().includes(q) ||
            c.body_en.toLowerCase().includes(q))
      )
      .map((c) => hydrateContent(store, c))
      .slice(0, 24);
    const events = store.events
      .filter(
        (e) =>
          e.publication_status === 'published' &&
          (e.title_en.toLowerCase().includes(q) ||
            e.title_bn.toLowerCase().includes(q) ||
            e.venue.toLowerCase().includes(q))
      )
      .map((e) => hydrateEvent(store, e))
      .slice(0, 12);
    return { contents, events } as T;
  }

  // ---- ADMIN AUTH GUARD ----
  const user = getAuthedUser(store, headers);
  if (!user) throw makeError('Authentication required', 401);

  if (pathname === '/api/admin/dashboard') {
    const sectionCounts: Record<string, number> = {};
    for (const c of store.contents) {
      sectionCounts[c.section_slug] = (sectionCounts[c.section_slug] || 0) + 1;
    }
    const rolesSummary = store.roles.map((r) => ({
      slug: r.slug,
      name_en: r.name_en,
      name_bn: r.name_bn,
      accent_color: r.accent_color,
      user_count: store.users.filter((u) => u.role_id === r.id && u.is_active === 1).length,
    }));
    return {
      totalContents: store.contents.length,
      publishedContents: store.contents.filter((c) => c.status === 'published').length,
      draftContents: store.contents.filter((c) => c.status === 'draft').length,
      scheduledContents: store.contents.filter((c) => c.status === 'scheduled').length,
      unpublishedContents: store.contents.filter((c) => c.status === 'unpublished').length,
      totalEvents: store.events.length,
      totalMedia: store.media.length,
      totalUsers: store.users.filter((u) => u.is_active === 1).length,
      sectionCounts,
      recentActivities: store.logs.slice(0, 12),
      rolesSummary,
    } as T;
  }

  if (pathname === '/api/admin/sections') {
    const allSections = store.sections.map((s) => ({
      ...s,
      total_count: store.contents.filter((c) => c.section_slug === s.slug).length,
      published_count: store.contents.filter((c) => c.section_slug === s.slug && c.status === 'published').length,
    }));
    const sections = allSections.filter(
      (s) => user.permissions.modules.includes('*') || user.permissions.modules.includes(s.slug)
    );
    return { sections, allSections } as T;
  }

  // ---- CONTENTS CRUD ----
  if (pathname === '/api/admin/contents' && method === 'GET') {
    const section = String(query.get('section') || '');
    const status = String(query.get('status') || '');
    const categoryId = query.get('category_id') ? Number(query.get('category_id')) : null;
    const tagId = query.get('tag_id') ? Number(query.get('tag_id')) : null;
    const search = String(query.get('search') || '').trim().toLowerCase();
    const page = Math.max(1, Number(query.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(query.get('limit') || 20)));

    if (section && !hasPermission(user, section, 'view')) {
      throw makeError(`Permission denied for module: ${section}`, 403);
    }

    let items = store.contents
      .filter((c) => user.permissions.modules.includes('*') || user.permissions.modules.includes(c.section_slug))
      .map((c) => hydrateContent(store, c));

    if (section) items = items.filter((c) => c.section_slug === section);
    if (status && status !== 'all') items = items.filter((c) => c.status === status);
    if (categoryId) items = items.filter((c) => Number(c.category_id) === categoryId);
    if (tagId) items = items.filter((c) => c.tags?.some((t) => t.id === tagId));
    if (search) {
      items = items.filter(
        (c) =>
          c.title_en.toLowerCase().includes(search) ||
          c.title_bn.toLowerCase().includes(search) ||
          c.summary_en.toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => a.sort_order - b.sort_order || b.id - a.id);
    const total = items.length;
    const paged = items.slice((page - 1) * limit, page * limit);
    return {
      items: paged,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    } as T;
  }

  if (pathname === '/api/admin/contents' && method === 'POST') {
    const sectionSlug = String(body.section_slug || '').trim();
    const desiredStatus = String(body.status || 'draft') as ContentItem['status'];
    if (!sectionSlug) throw makeError('section_slug is required', 400);
    if (!hasPermission(user, sectionSlug, 'create')) throw makeError(`Create permission denied for ${sectionSlug}`, 403);
    if (desiredStatus === 'published' && !hasPermission(user, sectionSlug, 'publish')) {
      throw makeError(`Publish permission denied for ${sectionSlug}`, 403);
    }
    if (!body.title_en || !body.title_bn) throw makeError('Both English and Bengali titles are required', 400);

    const id = nextId(store, 'contents');
    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids.map(Number) : [];
    const galleryInput = Array.isArray(body.gallery) ? (body.gallery as Array<{ media_id: number; caption_en?: string; caption_bn?: string }>) : [];
    const gallery = galleryInput.map((g, idx) => {
      const m = store.media.find((x) => x.id === Number(g.media_id));
      return {
        id: idx + 1,
        media_id: Number(g.media_id),
        caption_en: String(g.caption_en || ''),
        caption_bn: String(g.caption_bn || ''),
        sort_order: idx + 1,
        url: m?.url || '',
        filename: m?.filename || '',
        media_type: m?.media_type || 'image',
        alt_text: m?.alt_text || '',
      };
    });

    const newItem: ContentItem = {
      id,
      section_slug: sectionSlug,
      category_id: body.category_id ? Number(body.category_id) : null,
      title_en: String(body.title_en).trim(),
      title_bn: String(body.title_bn).trim(),
      slug: body.slug ? slugify(String(body.slug)) : slugify(String(body.title_en)),
      summary_en: String(body.summary_en || ''),
      summary_bn: String(body.summary_bn || ''),
      body_en: String(body.body_en || ''),
      body_bn: String(body.body_bn || ''),
      cover_media_id: body.cover_media_id ? Number(body.cover_media_id) : null,
      cover_url: mediaUrlById(store, body.cover_media_id ? Number(body.cover_media_id) : null),
      video_url: body.video_url ? String(body.video_url) : null,
      document_url: body.document_url ? String(body.document_url) : null,
      external_url: body.external_url ? String(body.external_url) : null,
      metadata: (body.metadata as Record<string, string>) || {},
      status: desiredStatus,
      scheduled_at: body.scheduled_at ? String(body.scheduled_at) : null,
      is_featured: body.is_featured ? 1 : 0,
      sort_order: Number(body.sort_order || 0),
      views_count: 0,
      author_id: user.id,
      author_name: user.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: store.tags.filter((t) => tagIds.includes(t.id)),
      gallery,
    };

    store.contents.unshift(newItem);
    store.revisions.unshift({
      id: nextId(store, 'revisions'),
      entity_type: 'content',
      entity_id: id,
      snapshot_json: JSON.stringify(newItem),
      changed_by: user.full_name,
      change_note: 'Initial creation',
      created_at: new Date().toISOString(),
    });
    addLog(store, user, desiredStatus === 'published' ? 'publish' : 'create', sectionSlug, id, `${desiredStatus === 'published' ? 'Published' : 'Created'} "${newItem.title_en}"`);
    saveStore(store);
    return { item: hydrateContent(store, newItem) } as T;
  }

  if (pathname === '/api/admin/contents/reorder' && method === 'POST') {
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(Number) : [];
    orderedIds.forEach((cid, idx) => {
      const c = store.contents.find((x) => x.id === cid);
      if (c) c.sort_order = idx + 1;
    });
    addLog(store, user, 'reorder', String(body.section_slug || 'contents'), null, `Reordered ${orderedIds.length} content items`);
    saveStore(store);
    return { ok: true } as T;
  }

  const contentRevMatch = pathname.match(/^\/api\/admin\/contents\/(\d+)\/revisions$/);
  if (contentRevMatch) {
    const id = Number(contentRevMatch[1]);
    return { revisions: store.revisions.filter((r) => r.entity_id === id) } as T;
  }

  const contentStatusMatch = pathname.match(/^\/api\/admin\/contents\/(\d+)\/status$/);
  if (contentStatusMatch && method === 'PATCH') {
    const id = Number(contentStatusMatch[1]);
    const item = store.contents.find((c) => c.id === id);
    if (!item) throw makeError('Content not found', 404);
    if (body.status && !hasPermission(user, item.section_slug, 'publish')) {
      throw makeError(`Publish permission denied in ${item.section_slug}`, 403);
    }
    if (body.status) item.status = String(body.status) as ContentItem['status'];
    if (body.scheduled_at !== undefined) item.scheduled_at = body.scheduled_at ? String(body.scheduled_at) : null;
    if (body.is_featured !== undefined) item.is_featured = body.is_featured ? 1 : 0;
    item.updated_at = new Date().toISOString();
    addLog(store, user, String(body.status || 'feature'), item.section_slug, id, `Changed "${item.title_en}" status=${item.status}`);
    saveStore(store);
    return { item: hydrateContent(store, item) } as T;
  }

  const contentIdMatch = pathname.match(/^\/api\/admin\/contents\/(\d+)$/);
  if (contentIdMatch && method === 'PUT') {
    const id = Number(contentIdMatch[1]);
    const idx = store.contents.findIndex((c) => c.id === id);
    if (idx === -1) throw makeError('Content not found', 404);
    const existing = store.contents[idx];
    const sectionSlug = String(body.section_slug || existing.section_slug);
    if (!hasPermission(user, sectionSlug, 'edit')) throw makeError(`Edit permission denied for ${sectionSlug}`, 403);

    store.revisions.unshift({
      id: nextId(store, 'revisions'),
      entity_type: 'content',
      entity_id: id,
      snapshot_json: JSON.stringify(existing),
      changed_by: user.full_name,
      change_note: String(body.change_note || 'Content updated'),
      created_at: new Date().toISOString(),
    });

    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids.map(Number) : existing.tags?.map((t) => t.id) || [];
    const galleryInput = Array.isArray(body.gallery) ? (body.gallery as Array<{ media_id: number; caption_en?: string; caption_bn?: string }>) : null;
    const gallery = galleryInput
      ? galleryInput.map((g, gIdx) => {
          const m = store.media.find((x) => x.id === Number(g.media_id));
          return {
            id: gIdx + 1,
            media_id: Number(g.media_id),
            caption_en: String(g.caption_en || ''),
            caption_bn: String(g.caption_bn || ''),
            sort_order: gIdx + 1,
            url: m?.url || '',
            filename: m?.filename || '',
            media_type: m?.media_type || 'image',
            alt_text: m?.alt_text || '',
          };
        })
      : existing.gallery;

    const updated: ContentItem = {
      ...existing,
      section_slug: sectionSlug,
      category_id: body.category_id !== undefined ? (body.category_id ? Number(body.category_id) : null) : existing.category_id,
      title_en: String(body.title_en ?? existing.title_en),
      title_bn: String(body.title_bn ?? existing.title_bn),
      summary_en: String(body.summary_en ?? existing.summary_en),
      summary_bn: String(body.summary_bn ?? existing.summary_bn),
      body_en: String(body.body_en ?? existing.body_en),
      body_bn: String(body.body_bn ?? existing.body_bn),
      cover_media_id: body.cover_media_id !== undefined ? (body.cover_media_id ? Number(body.cover_media_id) : null) : existing.cover_media_id,
      video_url: body.video_url !== undefined ? (body.video_url ? String(body.video_url) : null) : existing.video_url,
      document_url: body.document_url !== undefined ? (body.document_url ? String(body.document_url) : null) : existing.document_url,
      external_url: body.external_url !== undefined ? (body.external_url ? String(body.external_url) : null) : existing.external_url,
      metadata: (body.metadata as Record<string, string>) ?? existing.metadata,
      status: (body.status as ContentItem['status']) ?? existing.status,
      scheduled_at: body.scheduled_at !== undefined ? (body.scheduled_at ? String(body.scheduled_at) : null) : existing.scheduled_at,
      is_featured: body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
      updated_at: new Date().toISOString(),
      tags: store.tags.filter((t) => tagIds.includes(t.id)),
      gallery,
    };
    store.contents[idx] = updated;
    addLog(store, user, 'update', sectionSlug, id, `Updated "${updated.title_en}" (${updated.status})`);
    saveStore(store);
    return { item: hydrateContent(store, updated) } as T;
  }

  if (contentIdMatch && method === 'DELETE') {
    const id = Number(contentIdMatch[1]);
    const idx = store.contents.findIndex((c) => c.id === id);
    if (idx === -1) throw makeError('Content not found', 404);
    const existing = store.contents[idx];
    if (!hasPermission(user, existing.section_slug, 'delete')) throw makeError('Delete permission denied', 403);
    store.contents.splice(idx, 1);
    addLog(store, user, 'delete', existing.section_slug, id, `Deleted "${existing.title_en}"`);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- EVENTS CRUD ----
  if (pathname === '/api/admin/events' && method === 'GET') {
    const status = String(query.get('status') || 'all');
    const search = String(query.get('search') || '').trim().toLowerCase();
    let events = store.events.map((e) => hydrateEvent(store, e));
    if (status !== 'all') events = events.filter((e) => e.event_status === status);
    if (search) {
      events = events.filter(
        (e) =>
          e.title_en.toLowerCase().includes(search) ||
          e.title_bn.toLowerCase().includes(search) ||
          e.venue.toLowerCase().includes(search)
      );
    }
    return { events } as T;
  }

  if (pathname === '/api/admin/events' && method === 'POST') {
    if (!hasPermission(user, 'events', 'create')) throw makeError('Create permission required for Events', 403);
    if (!body.title_en || !body.title_bn || !body.start_datetime || !body.venue) {
      throw makeError('English & Bengali titles, start date/time, and venue are required', 400);
    }
    const id = nextId(store, 'events');
    const coverId = body.cover_media_id ? Number(body.cover_media_id) : null;
    const ev: EventItem = {
      id,
      title_en: String(body.title_en).trim(),
      title_bn: String(body.title_bn).trim(),
      short_desc_en: String(body.short_desc_en || ''),
      short_desc_bn: String(body.short_desc_bn || ''),
      full_desc_en: String(body.full_desc_en || ''),
      full_desc_bn: String(body.full_desc_bn || ''),
      start_datetime: String(body.start_datetime),
      end_datetime: String(body.end_datetime || body.start_datetime),
      venue: String(body.venue),
      organizer: String(body.organizer || ''),
      cover_media_id: coverId,
      cover_url: mediaUrlById(store, coverId),
      video_url: body.video_url ? String(body.video_url) : null,
      registration_url: body.registration_url ? String(body.registration_url) : null,
      contact_details: body.contact_details ? String(body.contact_details) : null,
      event_status: (body.event_status as EventItem['event_status']) || 'Upcoming',
      is_featured: body.is_featured ? 1 : 0,
      publication_status: (body.publication_status as EventItem['publication_status']) || 'draft',
      scheduled_at: body.scheduled_at ? String(body.scheduled_at) : null,
      author_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      gallery: [],
    };
    store.events.unshift(ev);
    addLog(store, user, 'create', 'events', id, `Created event "${ev.title_en}"`);
    saveStore(store);
    return { event: hydrateEvent(store, ev) } as T;
  }

  const eventIdMatch = pathname.match(/^\/api\/admin\/events\/(\d+)$/);
  if (eventIdMatch && method === 'PUT') {
    const id = Number(eventIdMatch[1]);
    const idx = store.events.findIndex((e) => e.id === id);
    if (idx === -1) throw makeError('Event not found', 404);
    const ex = store.events[idx];
    const updated: EventItem = {
      ...ex,
      title_en: String(body.title_en ?? ex.title_en),
      title_bn: String(body.title_bn ?? ex.title_bn),
      short_desc_en: String(body.short_desc_en ?? ex.short_desc_en),
      short_desc_bn: String(body.short_desc_bn ?? ex.short_desc_bn),
      full_desc_en: String(body.full_desc_en ?? ex.full_desc_en),
      full_desc_bn: String(body.full_desc_bn ?? ex.full_desc_bn),
      start_datetime: String(body.start_datetime ?? ex.start_datetime),
      end_datetime: String(body.end_datetime ?? ex.end_datetime),
      venue: String(body.venue ?? ex.venue),
      organizer: String(body.organizer ?? ex.organizer),
      cover_media_id: body.cover_media_id !== undefined ? (body.cover_media_id ? Number(body.cover_media_id) : null) : ex.cover_media_id,
      video_url: body.video_url !== undefined ? (body.video_url ? String(body.video_url) : null) : ex.video_url,
      registration_url: body.registration_url !== undefined ? (body.registration_url ? String(body.registration_url) : null) : ex.registration_url,
      contact_details: body.contact_details !== undefined ? (body.contact_details ? String(body.contact_details) : null) : ex.contact_details,
      event_status: (body.event_status as EventItem['event_status']) ?? ex.event_status,
      is_featured: body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : ex.is_featured,
      publication_status: (body.publication_status as EventItem['publication_status']) ?? ex.publication_status,
      updated_at: new Date().toISOString(),
    };
    store.events[idx] = updated;
    addLog(store, user, 'update', 'events', id, `Updated event "${updated.title_en}"`);
    saveStore(store);
    return { event: hydrateEvent(store, updated) } as T;
  }

  if (eventIdMatch && method === 'DELETE') {
    const id = Number(eventIdMatch[1]);
    const idx = store.events.findIndex((e) => e.id === id);
    if (idx === -1) throw makeError('Event not found', 404);
    const ex = store.events[idx];
    store.events.splice(idx, 1);
    addLog(store, user, 'delete', 'events', id, `Deleted event "${ex.title_en}"`);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- MEDIA LIBRARY ----
  if (pathname === '/api/admin/media' && method === 'GET') {
    const mediaType = String(query.get('media_type') || 'all');
    const folder = String(query.get('folder') || 'all');
    const search = String(query.get('search') || '').trim().toLowerCase();

    let items = store.media.map((m) => {
      const usageCount =
        store.contents.filter((c) => c.cover_media_id === m.id).length +
        store.events.filter((e) => e.cover_media_id === m.id).length +
        store.banners.filter((b) => b.media_id === m.id).length +
        store.popups.filter((p) => p.media_id === m.id).length;
      return { ...m, usage_count: usageCount };
    });

    if (mediaType !== 'all') items = items.filter((m) => m.media_type === mediaType);
    if (folder !== 'all') items = items.filter((m) => m.folder === folder);
    if (search) {
      items = items.filter(
        (m) =>
          m.filename.toLowerCase().includes(search) ||
          m.original_name.toLowerCase().includes(search) ||
          m.caption_en.toLowerCase().includes(search)
      );
    }
    return { media: items } as T;
  }

  if (pathname === '/api/admin/media/upload' && method === 'POST') {
    if (!hasPermission(user, 'media', 'create')) throw makeError('Upload permission denied', 403);
    const fd = options.body as FormData;
    const files = fd.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) throw makeError('No files uploaded', 400);
    const folder = String(fd.get('folder') || 'general');
    const captionEn = String(fd.get('caption_en') || '');
    const captionBn = String(fd.get('caption_bn') || '');
    const altText = String(fd.get('alt_text') || '');

    const uploaded: MediaRecord[] = [];
    for (const f of files) {
      const dataUrl = await readFileAsDataUrl(f);
      const id = nextId(store, 'media');
      const mType: MediaRecord['media_type'] = f.type.startsWith('image/')
        ? 'image'
        : f.type.startsWith('video/')
          ? 'video'
          : 'document';
      const rec: MediaRecord = {
        id,
        filename: f.name,
        original_name: f.name,
        url: dataUrl,
        mime_type: f.type || 'application/octet-stream',
        media_type: mType,
        folder,
        file_size: f.size,
        caption_en: captionEn || f.name,
        caption_bn: captionBn,
        alt_text: altText || f.name,
        uploaded_by: user.full_name,
        created_at: new Date().toISOString(),
        usage_count: 0,
      };
      store.media.unshift(rec);
      uploaded.push(rec);
    }
    addLog(store, user, 'upload', 'media', null, `Uploaded ${uploaded.length} file(s)`);
    saveStore(store);
    return { uploaded } as T;
  }

  if (pathname === '/api/admin/media/import-url' && method === 'POST') {
    if (!hasPermission(user, 'media', 'create')) throw makeError('Upload permission denied', 403);
    const rawUrl = String(body.url || '').trim();
    if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('/'))) {
      throw makeError('Valid http://, https://, or /uploads/ URL is required', 400);
    }
    const id = nextId(store, 'media');
    const isVideo = /\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(rawUrl);
    const name = rawUrl.split('/').pop()?.split('?')[0] || `web-media-${id}`;
    const rec: MediaRecord = {
      id,
      filename: name,
      original_name: name,
      url: rawUrl,
      mime_type: isVideo ? 'video/webm' : 'image/jpeg',
      media_type: isVideo ? 'video' : 'image',
      folder: String(body.folder || 'general'),
      file_size: 0,
      caption_en: String(body.caption_en || name),
      caption_bn: String(body.caption_bn || ''),
      alt_text: String(body.alt_text || name),
      uploaded_by: user.full_name,
      created_at: new Date().toISOString(),
      usage_count: 0,
    };
    store.media.unshift(rec);
    addLog(store, user, 'upload', 'media', id, `Imported remote media "${name}"`);
    saveStore(store);
    return { media: rec } as T;
  }

  const mediaReplaceMatch = pathname.match(/^\/api\/admin\/media\/(\d+)\/replace$/);
  if (mediaReplaceMatch && method === 'POST') {
    const id = Number(mediaReplaceMatch[1]);
    const idx = store.media.findIndex((m) => m.id === id);
    if (idx === -1) throw makeError('Media not found', 404);
    const fd = options.body as FormData;
    const f = fd.get('file');
    if (!(f instanceof File)) throw makeError('Replacement file required', 400);
    const dataUrl = await readFileAsDataUrl(f);
    store.media[idx] = {
      ...store.media[idx],
      filename: f.name,
      original_name: f.name,
      url: dataUrl,
      mime_type: f.type,
      file_size: f.size,
    };
    saveStore(store);
    return { media: store.media[idx] } as T;
  }

  const mediaIdMatch = pathname.match(/^\/api\/admin\/media\/(\d+)$/);
  if (mediaIdMatch && method === 'PUT') {
    const id = Number(mediaIdMatch[1]);
    const idx = store.media.findIndex((m) => m.id === id);
    if (idx === -1) throw makeError('Media not found', 404);
    store.media[idx] = {
      ...store.media[idx],
      caption_en: body.caption_en !== undefined ? String(body.caption_en) : store.media[idx].caption_en,
      caption_bn: body.caption_bn !== undefined ? String(body.caption_bn) : store.media[idx].caption_bn,
      alt_text: body.alt_text !== undefined ? String(body.alt_text) : store.media[idx].alt_text,
      folder: body.folder !== undefined ? String(body.folder) : store.media[idx].folder,
    };
    saveStore(store);
    return { media: store.media[idx] } as T;
  }

  if (mediaIdMatch && method === 'DELETE') {
    const id = Number(mediaIdMatch[1]);
    const force = query.get('force') === 'true';
    const contentRefs = store.contents.filter((c) => c.cover_media_id === id).map((c) => ({ id: c.id, title_en: c.title_en }));
    const eventRefs = store.events.filter((e) => e.cover_media_id === id).map((e) => ({ id: e.id, title_en: e.title_en }));
    const bannerRefs = store.banners.filter((b) => b.media_id === id).map((b) => ({ id: b.id, title_en: b.title_en }));
    const popupRefs = store.popups.filter((p) => p.media_id === id).map((p) => ({ id: p.id, title_en: p.title_en }));
    const total = contentRefs.length + eventRefs.length + bannerRefs.length + popupRefs.length;

    if (total > 0 && !force) {
      throw makeError('Media is actively used in published or draft sections. Confirm unlink & delete to proceed safely.', 409, {
        usage: { contents: contentRefs, galleries: [], events: eventRefs, banners: bannerRefs, popups: popupRefs, total },
      });
    }
    store.contents.forEach((c) => {
      if (c.cover_media_id === id) c.cover_media_id = null;
    });
    store.events.forEach((e) => {
      if (e.cover_media_id === id) e.cover_media_id = null;
    });
    store.banners.forEach((b) => {
      if (b.media_id === id) b.media_id = null;
    });
    store.popups.forEach((p) => {
      if (p.media_id === id) p.media_id = null;
    });
    store.media = store.media.filter((m) => m.id !== id);
    addLog(store, user, 'delete', 'media', id, `Deleted media #${id}`);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- HOMEPAGE MANAGEMENT ----
  if (pathname === '/api/admin/homepage' && method === 'GET') {
    const banners = store.banners.map((b) => ({ ...b, image_url: mediaUrlById(store, b.media_id) || b.image_url || null }));
    const popups = store.popups.map((p) => ({ ...p, image_url: mediaUrlById(store, p.media_id) || p.image_url || null }));
    return { banners, sections: store.homepageSections, cards: store.quickCards, popups } as T;
  }

  if (pathname === '/api/admin/homepage/banners' && method === 'POST') {
    const id = nextId(store, 'banners');
    store.banners.push({
      id,
      title_en: String(body.title_en || ''),
      title_bn: String(body.title_bn || ''),
      subtitle_en: String(body.subtitle_en || ''),
      subtitle_bn: String(body.subtitle_bn || ''),
      button_text_en: String(body.button_text_en || 'Explore'),
      button_text_bn: String(body.button_text_bn || 'বিস্তারিত দেখুন'),
      button_link: String(body.button_link || '/section/about-balagarh'),
      media_id: body.media_id ? Number(body.media_id) : null,
      image_url: mediaUrlById(store, body.media_id ? Number(body.media_id) : null),
      sort_order: Number(body.sort_order || 1),
      is_active: body.is_active === false ? 0 : 1,
    });
    saveStore(store);
    return { id } as T;
  }

  const bannerIdMatch = pathname.match(/^\/api\/admin\/homepage\/banners\/(\d+)$/);
  if (bannerIdMatch && method === 'PUT') {
    const id = Number(bannerIdMatch[1]);
    const idx = store.banners.findIndex((b) => b.id === id);
    if (idx !== -1) {
      const ex = store.banners[idx];
      const nextMediaId = body.media_id !== undefined ? (body.media_id ? Number(body.media_id) : null) : ex.media_id;
      store.banners[idx] = {
        ...ex,
        title_en: body.title_en !== undefined ? String(body.title_en) : ex.title_en,
        title_bn: body.title_bn !== undefined ? String(body.title_bn) : ex.title_bn,
        subtitle_en: body.subtitle_en !== undefined ? String(body.subtitle_en) : ex.subtitle_en,
        subtitle_bn: body.subtitle_bn !== undefined ? String(body.subtitle_bn) : ex.subtitle_bn,
        button_text_en: body.button_text_en !== undefined ? String(body.button_text_en) : ex.button_text_en,
        button_text_bn: body.button_text_bn !== undefined ? String(body.button_text_bn) : ex.button_text_bn,
        button_link: body.button_link !== undefined ? String(body.button_link) : ex.button_link,
        media_id: nextMediaId,
        image_url: mediaUrlById(store, nextMediaId) || ex.image_url,
        sort_order: body.sort_order !== undefined ? Number(body.sort_order) : ex.sort_order,
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : ex.is_active,
      };
      saveStore(store);
    }
    return { ok: true } as T;
  }

  if (bannerIdMatch && method === 'DELETE') {
    const id = Number(bannerIdMatch[1]);
    store.banners = store.banners.filter((b) => b.id !== id);
    saveStore(store);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/homepage/sections' && method === 'PUT') {
    const incoming = Array.isArray(body.sections) ? (body.sections as HomepageSectionConfig[]) : [];
    incoming.forEach((s, idx) => {
      const target = store.homepageSections.find((x) => x.id === Number(s.id));
      if (target) {
        target.is_visible = s.is_visible ? 1 : 0;
        target.sort_order = s.sort_order ?? idx + 1;
        target.title_en = s.title_en;
        target.title_bn = s.title_bn;
      }
    });
    saveStore(store);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/homepage/cards' && method === 'POST') {
    const id = nextId(store, 'cards');
    store.quickCards.push({
      id,
      card_type: (body.card_type as HomepageQuickCard['card_type']) || 'quick_link',
      label_en: String(body.label_en || ''),
      label_bn: String(body.label_bn || ''),
      value_text: String(body.value_text || ''),
      target_section: String(body.target_section || ''),
      url: String(body.url || ''),
      icon: String(body.icon || 'Link'),
      color_hex: String(body.color_hex || '#16A34A'),
      sort_order: Number(body.sort_order || 1),
      is_active: body.is_active === false ? 0 : 1,
    });
    saveStore(store);
    return { id } as T;
  }

  const cardIdMatch = pathname.match(/^\/api\/admin\/homepage\/cards\/(\d+)$/);
  if (cardIdMatch && method === 'PUT') {
    const id = Number(cardIdMatch[1]);
    const idx = store.quickCards.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const ex = store.quickCards[idx];
      store.quickCards[idx] = {
        ...ex,
        label_en: body.label_en !== undefined ? String(body.label_en) : ex.label_en,
        label_bn: body.label_bn !== undefined ? String(body.label_bn) : ex.label_bn,
        value_text: body.value_text !== undefined ? String(body.value_text) : ex.value_text,
        target_section: body.target_section !== undefined ? String(body.target_section) : ex.target_section,
        url: body.url !== undefined ? String(body.url) : ex.url,
        color_hex: body.color_hex !== undefined ? String(body.color_hex) : ex.color_hex,
        sort_order: body.sort_order !== undefined ? Number(body.sort_order) : ex.sort_order,
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : ex.is_active,
      };
      saveStore(store);
    }
    return { ok: true } as T;
  }

  if (cardIdMatch && method === 'DELETE') {
    const id = Number(cardIdMatch[1]);
    store.quickCards = store.quickCards.filter((c) => c.id !== id);
    saveStore(store);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/homepage/popups' && method === 'POST') {
    const id = nextId(store, 'popups');
    const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
    if (isActive === 1) store.popups.forEach((p) => { p.is_active = 0; });
    const mediaId = body.media_id ? Number(body.media_id) : null;
    store.popups.unshift({
      id,
      title_en: String(body.title_en || ''),
      title_bn: String(body.title_bn || ''),
      subtitle_en: String(body.subtitle_en || ''),
      subtitle_bn: String(body.subtitle_bn || ''),
      body_en: String(body.body_en || ''),
      body_bn: String(body.body_bn || ''),
      badge_en: String(body.badge_en || 'ANNOUNCEMENT'),
      badge_bn: String(body.badge_bn || 'জরুরি ঘোষণা'),
      button_text_en: String(body.button_text_en || 'View Details'),
      button_text_bn: String(body.button_text_bn || 'বিস্তারিত দেখুন'),
      button_link: String(body.button_link || '/section/notices-circulars'),
      media_id: mediaId,
      image_url: mediaUrlById(store, mediaId),
      theme_color: String(body.theme_color || 'royal') as HomepagePopup['theme_color'],
      show_once_per_session: body.show_once_per_session ? 1 : 0,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    });
    saveStore(store);
    return { id } as T;
  }

  const popupIdMatch = pathname.match(/^\/api\/admin\/homepage\/popups\/(\d+)$/);
  if (popupIdMatch && method === 'PUT') {
    const id = Number(popupIdMatch[1]);
    const idx = store.popups.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const ex = store.popups[idx];
      const nextActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : ex.is_active;
      if (nextActive === 1) store.popups.forEach((p) => { if (p.id !== id) p.is_active = 0; });
      const mediaId = body.media_id !== undefined ? (body.media_id ? Number(body.media_id) : null) : ex.media_id;
      store.popups[idx] = {
        ...ex,
        title_en: String(body.title_en ?? ex.title_en),
        title_bn: String(body.title_bn ?? ex.title_bn),
        subtitle_en: String(body.subtitle_en ?? ex.subtitle_en),
        subtitle_bn: String(body.subtitle_bn ?? ex.subtitle_bn),
        body_en: String(body.body_en ?? ex.body_en),
        body_bn: String(body.body_bn ?? ex.body_bn),
        badge_en: String(body.badge_en ?? ex.badge_en),
        badge_bn: String(body.badge_bn ?? ex.badge_bn),
        button_text_en: String(body.button_text_en ?? ex.button_text_en),
        button_text_bn: String(body.button_text_bn ?? ex.button_text_bn),
        button_link: String(body.button_link ?? ex.button_link),
        media_id: mediaId,
        image_url: mediaUrlById(store, mediaId) || ex.image_url,
        theme_color: String(body.theme_color ?? ex.theme_color) as HomepagePopup['theme_color'],
        show_once_per_session: body.show_once_per_session !== undefined ? (body.show_once_per_session ? 1 : 0) : ex.show_once_per_session,
        is_active: nextActive,
        updated_at: new Date().toISOString(),
      };
      saveStore(store);
    }
    return { ok: true } as T;
  }

  if (popupIdMatch && method === 'DELETE') {
    const id = Number(popupIdMatch[1]);
    store.popups = store.popups.filter((p) => p.id !== id);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- TAXONOMY ----
  if (pathname === '/api/admin/taxonomy') {
    return { categories: store.categories, tags: store.tags } as T;
  }

  if (pathname === '/api/admin/categories' && method === 'POST') {
    const id = nextId(store, 'categories');
    const cat: ContentCategory = {
      id,
      section_slug: String(body.section_slug),
      name_en: String(body.name_en),
      name_bn: String(body.name_bn),
      slug: slugify(String(body.name_en)),
    };
    store.categories.push(cat);
    saveStore(store);
    return { category: cat } as T;
  }

  const catDelMatch = pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
  if (catDelMatch && method === 'DELETE') {
    const id = Number(catDelMatch[1]);
    store.categories = store.categories.filter((c) => c.id !== id);
    saveStore(store);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/tags' && method === 'POST') {
    const id = nextId(store, 'tags');
    const tag: ContentTag = {
      id,
      name_en: String(body.name_en),
      name_bn: String(body.name_bn),
      slug: slugify(String(body.name_en)),
    };
    store.tags.push(tag);
    saveStore(store);
    return { tag } as T;
  }

  const tagDelMatch = pathname.match(/^\/api\/admin\/tags\/(\d+)$/);
  if (tagDelMatch && method === 'DELETE') {
    const id = Number(tagDelMatch[1]);
    store.tags = store.tags.filter((t) => t.id !== id);
    saveStore(store);
    return { ok: true } as T;
  }

  // ---- USERS, ROLES & LOGS ----
  if (pathname === '/api/admin/users-roles') {
    const isSuperAdmin = user.role_slug === 'super_admin' || user.permissions.modules.includes('*');
    const safeUsers = store.users.map((u) => {
      const { local_password, ...rest } = u;
      return isSuperAdmin ? { ...rest, visible_password: local_password || 'balagarh2026' } : rest;
    });
    return { roles: store.roles, users: safeUsers } as T;
  }

  const userResetMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
  if (userResetMatch && method === 'POST') {
    if (user.role_slug !== 'super_admin' && !user.permissions.modules.includes('*')) {
      throw makeError('Only Super Administrator can reset user passwords', 403);
    }
    const id = Number(userResetMatch[1]);
    const nextPass = String(body.newPassword || '').trim();
    if (nextPass.length < 6) throw makeError('Password must be at least 6 characters long', 400);
    const target = store.users.find((u) => u.id === id);
    if (!target) throw makeError('Target user not found', 404);
    target.local_password = nextPass;
    addLog(store, user, 'admin_reset_password', 'users', id, `Super Admin reset password for ${target.full_name} (${target.username})`);
    saveStore(store);
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/users' && method === 'POST') {
    const id = nextId(store, 'users');
    const roleId = Number(body.role_id);
    const role = store.roles.find((r) => r.id === roleId) || store.roles[0];
    store.users.push({
      id,
      username: String(body.username),
      full_name: String(body.full_name),
      email: String(body.email),
      role_id: roleId,
      assigned_panchayat: body.assigned_panchayat ? String(body.assigned_panchayat) : null,
      assigned_institution: body.assigned_institution ? String(body.assigned_institution) : null,
      avatar_url: null,
      is_active: 1,
      created_at: new Date().toISOString(),
      role_slug: role.slug,
      role_name_en: role.name_en,
      role_name_bn: role.name_bn,
      accent_color: role.accent_color,
      permissions: role.permissions,
      local_password: String(body.password || 'balagarh2026'),
    });
    saveStore(store);
    return { id } as T;
  }

  const userPutMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userPutMatch && method === 'PUT') {
    const id = Number(userPutMatch[1]);
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      const ex = store.users[idx];
      const nextRoleId = body.role_id ? Number(body.role_id) : ex.role_id;
      const role = store.roles.find((r) => r.id === nextRoleId);
      store.users[idx] = {
        ...ex,
        full_name: body.full_name !== undefined ? String(body.full_name) : ex.full_name,
        email: body.email !== undefined ? String(body.email) : ex.email,
        role_id: nextRoleId,
        assigned_panchayat: body.assigned_panchayat !== undefined ? (body.assigned_panchayat ? String(body.assigned_panchayat) : null) : ex.assigned_panchayat,
        assigned_institution: body.assigned_institution !== undefined ? (body.assigned_institution ? String(body.assigned_institution) : null) : ex.assigned_institution,
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : ex.is_active,
        ...(role
          ? {
              role_slug: role.slug,
              role_name_en: role.name_en,
              role_name_bn: role.name_bn,
              accent_color: role.accent_color,
              permissions: role.permissions,
            }
          : {}),
      };
      saveStore(store);
    }
    return { ok: true } as T;
  }

  const rolePermMatch = pathname.match(/^\/api\/admin\/roles\/(\d+)\/permissions$/);
  if (rolePermMatch && method === 'PUT') {
    const id = Number(rolePermMatch[1]);
    const role = store.roles.find((r) => r.id === id);
    if (role && body.permissions) {
      role.permissions = body.permissions as RolePermissions;
      store.users.forEach((u) => {
        if (u.role_id === id) u.permissions = role.permissions;
      });
      saveStore(store);
    }
    return { ok: true } as T;
  }

  if (pathname === '/api/admin/logs') {
    const moduleFilter = String(query.get('module') || 'all');
    const logs = moduleFilter === 'all' ? store.logs : store.logs.filter((l) => l.module === moduleFilter);
    return { logs: logs.slice(0, 60) } as T;
  }

  throw makeError(`Unsupported local CMS endpoint: ${pathname}`, 404);
}
