import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const publicOut = path.resolve(process.cwd(), 'public', 'data', 'portal-snapshot.json');
  const srcOut = path.resolve(process.cwd(), 'src', 'data', 'portal-snapshot.json');

  let dbMod: typeof import('../src/server/db.ts');
  try {
    dbMod = await import('../src/server/db.ts');
  } catch (err) {
    if (fs.existsSync(srcOut) && fs.existsSync(publicOut)) {
      console.log('SQLite native module unavailable in this Node runtime; using committed portal-snapshot.json');
      return;
    }
    if (fs.existsSync(srcOut)) {
      fs.mkdirSync(path.dirname(publicOut), { recursive: true });
      fs.copyFileSync(srcOut, publicOut);
      console.log('Copied src/data/portal-snapshot.json -> public/data/portal-snapshot.json');
      return;
    }
    throw err;
  }

  const { db, initDatabase, promoteScheduledContent } = dbMod;
  initDatabase();
  promoteScheduledContent();

  function hydrateContentRow(row: Record<string, unknown>) {
    const id = Number(row.id);
    const tags = db.prepare(`
      SELECT t.* FROM content_tags t
      JOIN content_tag_relations r ON r.tag_id = t.id
      WHERE r.content_id = ?
    `).all(id);

    const gallery = db.prepare(`
      SELECT cm.id, cm.media_id, cm.caption_en, cm.caption_bn, cm.sort_order,
             m.url, m.filename, m.media_type, m.alt_text
      FROM content_media cm
      JOIN media m ON m.id = cm.media_id
      WHERE cm.content_id = ?
      ORDER BY cm.sort_order ASC, cm.id ASC
    `).all(id);

    let metadata: Record<string, string> = {};
    try {
      metadata = JSON.parse(String(row.metadata_json || '{}'));
    } catch {
      metadata = {};
    }

    return {
      ...row,
      metadata,
      tags,
      gallery,
    };
  }

  function hydrateEventRow(row: Record<string, unknown>) {
    const id = Number(row.id);
    const gallery = db.prepare(`
      SELECT em.id, em.media_id, em.caption_en, em.caption_bn, em.sort_order,
             m.url, m.filename, m.media_type, m.alt_text
      FROM event_media em
      JOIN media m ON m.id = em.media_id
      WHERE em.event_id = ?
      ORDER BY em.sort_order ASC, em.id ASC
    `).all(id);

    return {
      ...row,
      gallery,
    };
  }

  const banners = db.prepare(`
    SELECT b.*, m.url as image_url
    FROM homepage_banners b
    LEFT JOIN media m ON m.id = b.media_id
    WHERE b.is_active = 1
    ORDER BY b.sort_order ASC, b.id ASC
  `).all();

  const allBanners = db.prepare(`
    SELECT b.*, m.url as image_url
    FROM homepage_banners b
    LEFT JOIN media m ON m.id = b.media_id
    ORDER BY b.sort_order ASC, b.id ASC
  `).all();

  const homepageSections = db.prepare(`
    SELECT id, section_key, title_en, title_bn, is_visible, sort_order, config_json
    FROM homepage_sections
    ORDER BY sort_order ASC, id ASC
  `).all().map((s: Record<string, unknown>) => ({
    ...s,
    config: JSON.parse(String(s.config_json || '{}')),
  }));

  const quickCards = db.prepare(`
    SELECT * FROM homepage_quick_cards
    WHERE is_active = 1
    ORDER BY sort_order ASC, id ASC
  `).all();

  const allQuickCards = db.prepare(`
    SELECT * FROM homepage_quick_cards
    ORDER BY card_type ASC, sort_order ASC, id ASC
  `).all();

  const sections = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM contents c WHERE c.section_slug = s.slug AND c.status = 'published' AND c.deleted_at IS NULL) as published_count
    FROM content_sections s
    WHERE s.is_active = 1
    ORDER BY s.sort_order ASC
  `).all();

  const categories = db.prepare(`
    SELECT * FROM content_categories ORDER BY section_slug ASC, name_en ASC
  `).all();

  const tags = db.prepare(`
    SELECT * FROM content_tags ORDER BY name_en ASC
  `).all();

  const media = db.prepare(`
    SELECT * FROM media ORDER BY id DESC
  `).all();

  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all().map((r: Record<string, unknown>) => ({
    ...r,
    permissions: JSON.parse(String(r.permissions_json || '{"modules":[],"actions":[]}')),
  }));

  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.assigned_panchayat, u.assigned_institution,
           u.avatar_url, u.is_active, u.created_at,
           r.slug as role_slug, r.name_en as role_name_en, r.name_bn as role_name_bn, r.accent_color,
           r.description as role_description, r.permissions_json
    FROM users u JOIN roles r ON r.id = u.role_id
    ORDER BY u.id ASC
  `).all().map((u: Record<string, unknown>) => ({
    ...u,
    permissions: JSON.parse(String(u.permissions_json || '{"modules":[],"actions":[]}')),
  }));

  const allContents = db.prepare(`
    SELECT c.*, m.url as cover_url, m.alt_text as cover_alt,
           s.name_en as section_name_en, s.name_bn as section_name_bn,
           cat.name_en as category_name_en, cat.name_bn as category_name_bn,
           u.full_name as author_name
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    LEFT JOIN content_sections s ON s.slug = c.section_slug
    LEFT JOIN content_categories cat ON cat.id = c.category_id
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC, c.id DESC
  `).all().map(hydrateContentRow);

  const allEvents = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE e.publication_status = 'published' AND e.deleted_at IS NULL
    ORDER BY e.is_featured DESC, e.start_datetime ASC
  `).all().map(hydrateEventRow);

  const popups = db.prepare(`
    SELECT p.*, m.url as image_url
    FROM homepage_popups p
    LEFT JOIN media m ON m.id = p.media_id
    ORDER BY p.id DESC
  `).all();

  const latestNews = allContents.filter((c: Record<string, unknown>) => c.section_slug === 'news-announcements').slice(0, 6);
  const notices = allContents.filter((c: Record<string, unknown>) => c.section_slug === 'notices-circulars').slice(0, 6);
  const upcomingEvents = allEvents.filter((e: Record<string, unknown>) => e.event_status === 'Upcoming' || e.event_status === 'Ongoing').slice(0, 4);
  const aboutSummary = allContents.find((c: Record<string, unknown>) => c.section_slug === 'about-balagarh') || null;
  const photoGallery = allContents.filter((c: Record<string, unknown>) => c.section_slug === 'photo-gallery').slice(0, 2);
  const videoGallery = allContents.filter((c: Record<string, unknown>) => c.section_slug === 'video-gallery').slice(0, 2);
  const activePopup = popups.find((p: Record<string, unknown>) => p.is_active === 1) || null;

  const snapshot = {
    bootstrap: {
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
      popup: activePopup,
    },
    sections,
    categories,
    tags,
    media,
    roles,
    users,
    contents: allContents,
    events: allEvents,
    banners: allBanners,
    quickCards: allQuickCards,
    popups,
  };

  const json = JSON.stringify(snapshot);
  fs.mkdirSync(path.dirname(publicOut), { recursive: true });
  fs.mkdirSync(path.dirname(srcOut), { recursive: true });
  fs.writeFileSync(publicOut, json, 'utf8');
  fs.writeFileSync(srcOut, json, 'utf8');
  console.log(`Exported static portal snapshot (${allContents.length} contents, ${allEvents.length} events, ${sections.length} sections, ${media.length} media, ${users.length} users)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
