import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const bundledStorageDir = path.resolve(process.cwd(), 'storage');
export const bundledUploadsDir = path.resolve(process.cwd(), 'uploads');
const storageDir = isServerless ? '/tmp/balagarh_storage' : bundledStorageDir;
export const uploadsDir = isServerless ? '/tmp/balagarh_uploads' : bundledUploadsDir;

if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(storageDir, 'balagarh_portal.db');
const bundledDbPath = path.join(bundledStorageDir, 'balagarh_portal.db');
if (isServerless && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
  fs.copyFileSync(bundledDbPath, dbPath);
}

export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = 'balagarh-cms-salt-2026';
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      accent_color TEXT NOT NULL DEFAULT '#2563EB',
      permissions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      visible_password TEXT NOT NULL DEFAULT 'balagarh2026',
      role_id INTEGER NOT NULL REFERENCES roles(id),
      assigned_panchayat TEXT,
      assigned_institution TEXT,
      avatar_url TEXT,
      phone TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      address TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      group_name TEXT NOT NULL,
      description_en TEXT NOT NULL DEFAULT '',
      description_bn TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'FileText',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS content_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_slug TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      media_type TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'general',
      file_size INTEGER NOT NULL DEFAULT 0,
      caption_en TEXT NOT NULL DEFAULT '',
      caption_bn TEXT NOT NULL DEFAULT '',
      alt_text TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL DEFAULT 'Super Administrator',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_slug TEXT NOT NULL REFERENCES content_sections(slug) ON DELETE CASCADE,
      category_id INTEGER REFERENCES content_categories(id) ON DELETE SET NULL,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      slug TEXT NOT NULL,
      summary_en TEXT NOT NULL DEFAULT '',
      summary_bn TEXT NOT NULL DEFAULT '',
      body_en TEXT NOT NULL DEFAULT '',
      body_bn TEXT NOT NULL DEFAULT '',
      cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      video_url TEXT,
      document_url TEXT,
      external_url TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contents_section_status ON contents(section_slug, status, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_contents_featured ON contents(is_featured, status);

    CREATE TABLE IF NOT EXISTS content_tag_relations (
      content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES content_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (content_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS content_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      caption_en TEXT NOT NULL DEFAULT '',
      caption_bn TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      short_desc_en TEXT NOT NULL DEFAULT '',
      short_desc_bn TEXT NOT NULL DEFAULT '',
      full_desc_en TEXT NOT NULL DEFAULT '',
      full_desc_bn TEXT NOT NULL DEFAULT '',
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      venue TEXT NOT NULL,
      organizer TEXT NOT NULL DEFAULT '',
      cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      video_url TEXT,
      registration_url TEXT,
      contact_details TEXT,
      event_status TEXT NOT NULL DEFAULT 'Upcoming',
      is_featured INTEGER NOT NULL DEFAULT 0,
      publication_status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_status ON events(event_status, publication_status, deleted_at);

    CREATE TABLE IF NOT EXISTS event_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      caption_en TEXT NOT NULL DEFAULT '',
      caption_bn TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS homepage_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      subtitle_en TEXT NOT NULL DEFAULT '',
      subtitle_bn TEXT NOT NULL DEFAULT '',
      button_text_en TEXT NOT NULL DEFAULT 'View Details',
      button_text_bn TEXT NOT NULL DEFAULT 'বিস্তারিত দেখুন',
      button_link TEXT NOT NULL DEFAULT '/section/about-balagarh',
      media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS homepage_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_key TEXT UNIQUE NOT NULL,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      is_visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS homepage_quick_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_type TEXT NOT NULL,
      label_en TEXT NOT NULL,
      label_bn TEXT NOT NULL,
      value_text TEXT NOT NULL DEFAULT '',
      target_section TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'Link',
      color_hex TEXT NOT NULL DEFAULT '#16A34A',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS content_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      change_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      role_name TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS homepage_popups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      subtitle_en TEXT NOT NULL DEFAULT '',
      subtitle_bn TEXT NOT NULL DEFAULT '',
      body_en TEXT NOT NULL DEFAULT '',
      body_bn TEXT NOT NULL DEFAULT '',
      badge_en TEXT NOT NULL DEFAULT 'IMPORTANT',
      badge_bn TEXT NOT NULL DEFAULT 'জরুরি ঘোষণা',
      button_text_en TEXT NOT NULL DEFAULT 'View Details',
      button_text_bn TEXT NOT NULL DEFAULT 'বিস্তারিত দেখুন',
      button_link TEXT NOT NULL DEFAULT '/section/notices-circulars',
      media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      theme_color TEXT NOT NULL DEFAULT 'royal',
      show_once_per_session INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === 'visible_password')) {
    db.exec("ALTER TABLE users ADD COLUMN visible_password TEXT NOT NULL DEFAULT 'balagarh2026'");
  }
  if (!userCols.some((c) => c.name === 'phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''");
  }
  if (!userCols.some((c) => c.name === 'designation')) {
    db.exec("ALTER TABLE users ADD COLUMN designation TEXT DEFAULT ''");
  }
  if (!userCols.some((c) => c.name === 'bio')) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
  }
  if (!userCols.some((c) => c.name === 'address')) {
    db.exec("ALTER TABLE users ADD COLUMN address TEXT DEFAULT ''");
  }

  const roleCount = (db.prepare('SELECT COUNT(*) as c FROM roles').get() as { c: number }).c;
  if (roleCount === 0) {
    seedDatabase();
  }

  const popupCount = (db.prepare('SELECT COUNT(*) as c FROM homepage_popups').get() as { c: number }).c;
  if (popupCount === 0) {
    const firstMedia = db.prepare('SELECT id FROM media ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
    db.prepare(`
      INSERT INTO homepage_popups (
        title_en, title_bn, subtitle_en, subtitle_bn, body_en, body_bn,
        badge_en, badge_bn, button_text_en, button_text_bn, button_link,
        media_id, theme_color, show_once_per_session, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Balagarh Block Mega Health Camp & Public Service Drive 2026',
      'বলাগড় ব্লক মেগা স্বাস্থ্য শিবির ও জনপরিষেবা ক্যাম্প ২০২৬',
      'Free Health Check-up, Eye Screening & Duare Sarkar Assistance',
      'বিনামূল্যে স্বাস্থ্য পরীক্ষা, চক্ষু পরীক্ষা ও দুয়ারে সরকার সহায়তা কেন্দ্র',
      'Residents of all Gram Panchayats in Balagarh Block are invited to avail free medical consultations, essential medicines, and welfare scheme registration at Balagarh Rural Hospital Premises.',
      'বলাগড় ব্লকের সমস্ত গ্রাম পঞ্চায়েতের নাগরিকদের বিনামূল্যে স্বাস্থ্য পরীক্ষা, প্রয়োজনীয় ওষুধ এবং সরকারি প্রকল্পের সহায়তার জন্য বলাগড় গ্রামীণ হাসপাতাল প্রাঙ্গণে আমন্ত্রণ জানানো হচ্ছে।',
      'ANNOUNCEMENT',
      'জরুরি বিজ্ঞপ্তি',
      'Explore Notices & Events',
      'বিস্তারিত তথ্য দেখুন',
      '/section/notices-circulars',
      firstMedia ? firstMedia.id : null,
      'royal',
      0,
      1
    );
  }

  syncDownloadedWebMedia();
}

function syncDownloadedWebMedia() {
  const downloadedCatalog: Array<{
    file: string;
    mime: string;
    type: 'image' | 'video';
    folder: string;
    caption_en: string;
    caption_bn: string;
    alt: string;
  }> = [
    {
      file: 'guptipara_terracotta_temple.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'heritage',
      caption_en: 'Bindhyabasini Temple, Guptipara (Balagarh Block Heritage)',
      caption_bn: 'বিন্ধ্যবাসিনী মন্দির, গুপ্তিপাড়া (বলাগড় ব্লক ঐতিহ্য)',
      alt: 'Guptipara terracotta temple in Balagarh Block',
    },
    {
      file: 'guptipara_heritage_temple_02.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'heritage',
      caption_en: 'Historic Guptipara Temple Complex Architecture',
      caption_bn: 'ঐতিহাসিক গুপ্তিপাড়া মন্দির প্রাঙ্গণ স্থাপত্য',
      alt: 'Historic temples of Guptipara, Hooghly',
    },
    {
      file: 'hooghly_river_boats.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'tourism',
      caption_en: 'Traditional Wooden Boats on the Hooghly Riverfront',
      caption_bn: 'হুগলি নদীতে ঐতিহ্যবাহী কাঠের নৌকা',
      alt: 'Boats on Hooghly River, West Bengal',
    },
    {
      file: 'hooghly_river_boat_travel.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'tourism',
      caption_en: 'Boat Journey Across Hooghly River Waters',
      caption_bn: 'হুগলি নদীর বুকে নৌকা যাত্রা',
      alt: 'Boat travelling down the Hooghly River',
    },
    {
      file: 'bengal_high_school.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'schools',
      caption_en: 'Historic High School Campus in Hooghly-Nadia Belt',
      caption_bn: 'হুগলি-নদীয়া অঞ্চলের ঐতিহ্যবাহী উচ্চ বিদ্যালয় প্রাঙ্গণ',
      alt: 'West Bengal high school building',
    },
    {
      file: 'bengal_festival_puja.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'events',
      caption_en: 'Traditional Sharadiya Festival & Cultural Celebration',
      caption_bn: 'বাংলার শারদোৎসব ও ঐতিহ্যবাহী সাংস্কৃতিক অনুষ্ঠান',
      alt: 'Bengal cultural puja festival celebration',
    },
    {
      file: 'hooghly_railway_transport.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'general',
      caption_en: 'Bandel–Katwa Rail Corridor & Local Commuter Connectivity',
      caption_bn: 'ব্যান্ডেল–কাটোয়া রেলপথ ও যাত্রী পরিষেবা',
      alt: 'Hooghly local railway station and train service',
    },
    {
      file: 'bengal_agriculture_paddy.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'general',
      caption_en: 'Lush Green Paddy Cultivation Across Rural West Bengal',
      caption_bn: 'বাংলার সবুজ ধানক্ষেত ও কৃষি সমৃদ্ধি',
      alt: 'Paddy fields in rural West Bengal',
    },
    {
      file: 'bengal_health_hospital.jpg',
      mime: 'image/jpeg',
      type: 'image',
      folder: 'hospitals',
      caption_en: 'Public Healthcare & Medical Centre Facility',
      caption_bn: 'জনস্বাস্থ্য ও হাসপাতাল চিকিৎসা কেন্দ্র',
      alt: 'West Bengal public hospital facility',
    },
    {
      file: 'balagarh_river_boat_reel.webm',
      mime: 'video/webm',
      type: 'video',
      folder: 'tourism',
      caption_en: 'Riverfront Boat Crossing & Scenic Waterway Video Reel',
      caption_bn: 'নদীপথে নৌকা পারাপার ও প্রাকৃতিক দৃশ্যের ভিডিও',
      alt: 'Scenic river boat video background',
    },
    {
      file: 'balagarh_river_journey_doc.webm',
      mime: 'video/webm',
      type: 'video',
      folder: 'tourism',
      caption_en: 'Traditional Wooden River Boat Craft Documentary Footage',
      caption_bn: 'নৌকা শিল্প ও নদীপথের প্রামাণ্য ভিডিও',
      alt: 'River boat craft documentary video',
    },
  ];

  const findMedia = db.prepare('SELECT id FROM media WHERE url = ?');
  const insertMedia = db.prepare(`
    INSERT INTO media (filename, original_name, url, mime_type, media_type, folder, file_size, caption_en, caption_bn, alt_text, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mediaIds: Record<string, number> = {};
  let newlyRegistered = 0;

  const resolveUploadPath = (file: string) => {
    const primary = path.join(uploadsDir, file);
    if (fs.existsSync(primary)) return primary;
    const bundled = path.join(bundledUploadsDir, file);
    if (fs.existsSync(bundled)) return bundled;
    return null;
  };

  for (const item of downloadedCatalog) {
    const filePath = resolveUploadPath(item.file);
    if (!filePath) continue;
    const url = `/uploads/${item.file}`;
    const existing = findMedia.get(url) as { id: number } | undefined;
    if (existing) {
      mediaIds[item.file] = existing.id;
    } else {
      const size = fs.statSync(filePath).size;
      const res = insertMedia.run(
        item.file,
        item.file,
        url,
        item.mime,
        item.type,
        item.folder,
        size,
        item.caption_en,
        item.caption_bn,
        item.alt,
        'System Web Sync'
      );
      mediaIds[item.file] = Number(res.lastInsertRowid);
      newlyRegistered++;
    }
  }

  // Upgrade any broken placeholder YouTube URLs in contents and events to locally saved .webm videos
  if (mediaIds['balagarh_river_journey_doc.webm']) {
    db.prepare(`
      UPDATE contents
      SET video_url = ?, cover_media_id = COALESCE(?, cover_media_id)
      WHERE section_slug = 'video-gallery' AND (video_url LIKE '%dQw4w9WgXcQ%' OR video_url IS NULL OR video_url = '')
    `).run(
      '/uploads/balagarh_river_journey_doc.webm',
      mediaIds['hooghly_river_boat_travel.jpg'] || null
    );
  }
  if (mediaIds['balagarh_river_boat_reel.webm']) {
    db.prepare(`
      UPDATE events
      SET video_url = ?
      WHERE video_url LIKE '%dQw4w9WgXcQ%'
    `).run('/uploads/balagarh_river_boat_reel.webm');
  }

  // Upgrade any unbundled /src/assets/images/* URLs to locally saved /uploads/* web downloads
  const legacyUrlMap: Array<[string, string]> = [
    ['/src/assets/images/balagarh_hero_heritage_1794933203220.jpg', '/uploads/guptipara_terracotta_temple.jpg'],
    ['/src/assets/images/balagarh_river_panorama_1794933202948.jpg', '/uploads/hooghly_river_boats.jpg'],
    ['/src/assets/images/balagarh_civic_building_1794933202842.jpg', '/uploads/guptipara_heritage_temple_02.jpg'],
    ['/src/assets/images/balagarh_school_campus_1794933202955.jpg', '/uploads/bengal_high_school.jpg'],
    ['/src/assets/images/balagarh_hospital_center_1794933204402.jpg', '/uploads/bengal_health_hospital.jpg'],
    ['/src/assets/images/balagarh_community_festival_1794933204840.jpg', '/uploads/bengal_festival_puja.jpg'],
  ];
  const updateLegacyMediaUrl = db.prepare('UPDATE media SET url = ? WHERE url = ?');
  for (const [oldUrl, newUrl] of legacyUrlMap) {
    const newFilename = newUrl.replace(/^\/uploads\//, '');
    if (resolveUploadPath(newFilename)) {
      updateLegacyMediaUrl.run(newUrl, oldUrl);
    }
  }

  // On initial registration of web downloads, connect them to Hero Banner #1 (live video), sections, and Video Gallery
  if (newlyRegistered > 0) {
    if (mediaIds['balagarh_river_boat_reel.webm']) {
      db.prepare(`
        UPDATE homepage_banners SET media_id = ? WHERE sort_order = 1
      `).run(mediaIds['balagarh_river_boat_reel.webm']);
    }
    if (mediaIds['hooghly_river_boats.jpg']) {
      db.prepare(`UPDATE homepage_banners SET media_id = ? WHERE sort_order = 2`).run(mediaIds['hooghly_river_boats.jpg']);
    }
    if (mediaIds['bengal_festival_puja.jpg']) {
      db.prepare(`UPDATE homepage_banners SET media_id = ? WHERE sort_order = 3`).run(mediaIds['bengal_festival_puja.jpg']);
    }
    if (mediaIds['guptipara_terracotta_temple.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug IN ('culture-heritage', 'tourist-attractions', 'photo-gallery')`).run(mediaIds['guptipara_terracotta_temple.jpg']);
    }
    if (mediaIds['hooghly_river_boats.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug IN ('about-balagarh', 'tourism')`).run(mediaIds['hooghly_river_boats.jpg']);
    }
    if (mediaIds['bengal_agriculture_paddy.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug = 'agriculture'`).run(mediaIds['bengal_agriculture_paddy.jpg']);
    }
    if (mediaIds['hooghly_railway_transport.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug = 'roads-infrastructure'`).run(mediaIds['hooghly_railway_transport.jpg']);
    }
    if (mediaIds['bengal_high_school.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug IN ('schools', 'colleges')`).run(mediaIds['bengal_high_school.jpg']);
    }
    if (mediaIds['bengal_health_hospital.jpg']) {
      db.prepare(`UPDATE contents SET cover_media_id = ? WHERE section_slug = 'hospitals'`).run(mediaIds['bengal_health_hospital.jpg']);
    }
    if (mediaIds['guptipara_heritage_temple_02.jpg']) {
      db.prepare(`UPDATE homepage_popups SET media_id = ? WHERE id = 1`).run(mediaIds['bengal_festival_puja.jpg'] || mediaIds['guptipara_heritage_temple_02.jpg']);
    }

    // Ensure at least 2 published Video Gallery entries with real local .webm videos
    const vidCount = (db.prepare(`SELECT COUNT(*) as c FROM contents WHERE section_slug = 'video-gallery' AND deleted_at IS NULL`).get() as { c: number }).c;
    if (vidCount < 2 && mediaIds['balagarh_river_boat_reel.webm']) {
      db.prepare(`
        INSERT INTO contents (
          section_slug, slug, title_en, title_bn, summary_en, summary_bn,
          body_en, body_bn, cover_media_id, video_url, status, is_featured, sort_order, author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, 2, 1)
      `).run(
        'video-gallery',
        'hooghly-riverfront-boat-crossing-reel',
        'Hooghly Riverfront & Boat Crossing Scenic Video',
        'হুগলি নদীর ঘাট ও নৌকা পারাপারের দৃশ্য',
        'Scenic video footage showcasing river transport and serene waterways across Balagarh.',
        'বলাগড়ের নদীপথ, ঘাট ও নৌকা পারাপারের প্রাকৃতিক দৃশ্যের ভিডিও।',
        '<p>Watch serene riverfront boat crossings and natural waterways representing daily riverine life in Balagarh Block.</p>',
        '<p>বলাগড় ব্লকের নদীতীরবর্তী জীবনযাত্রা ও নৌকা চলাচলের সুন্দর ভিডিও দৃশ্য দেখুন।</p>',
        mediaIds['hooghly_river_boats.jpg'] || null,
        '/uploads/balagarh_river_boat_reel.webm'
      );
    }
  }
}

export function promoteScheduledContent() {
  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE contents
    SET status = 'published', updated_at = datetime('now')
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ? AND deleted_at IS NULL
  `).run(nowIso);

  db.prepare(`
    UPDATE events
    SET publication_status = 'published', updated_at = datetime('now')
    WHERE publication_status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ? AND deleted_at IS NULL
  `).run(nowIso);
}

function seedDatabase() {
  // 1. Seed Roles
  const rolesData = [
    {
      slug: 'super_admin',
      name_en: 'Super Administrator',
      name_bn: 'সুপার অ্যাডমিনিস্ট্রেটর',
      description: 'Full control over all CMS modules, homepage, media, users, roles, and logs.',
      accent_color: '#7C3AED',
      permissions: { modules: ['*'], actions: ['view', 'create', 'edit', 'publish', 'delete'] },
    },
    {
      slug: 'admin',
      name_en: 'Administrator',
      name_bn: 'অ্যাডমিনিস্ট্রেটর',
      description: 'Manage all content modules, homepage sections, events, and media library.',
      accent_color: '#2563EB',
      permissions: {
        modules: [
          'about-balagarh', 'block-information', 'history-geography', 'gram-panchayats', 'villages',
          'schools', 'colleges', 'hospitals', 'government-offices', 'police-stations',
          'public-representatives', 'roads-infrastructure', 'agriculture', 'tourism',
          'tourist-attractions', 'culture-heritage', 'news-announcements', 'notices-circulars',
          'events-programmes', 'photo-gallery', 'video-gallery', 'important-links',
          'public-services', 'contact-information', 'events', 'media', 'homepage', 'categories', 'logs'
        ],
        actions: ['view', 'create', 'edit', 'publish', 'delete'],
      },
    },
    {
      slug: 'panchayat_editor',
      name_en: 'Panchayat Editor',
      name_bn: 'পঞ্চায়েত সম্পাদক',
      description: 'Manage assigned Gram Panchayat profile, villages, schemes, notices, and photos.',
      accent_color: '#16A34A',
      permissions: {
        modules: ['gram-panchayats', 'villages', 'notices-circulars', 'news-announcements', 'public-services', 'photo-gallery', 'events', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'police_editor',
      name_en: 'Police Station Editor',
      name_bn: 'পুলিশ স্টেশন সম্পাদক',
      description: 'Manage police station profile, emergency contacts, safety notices, and awareness drives.',
      accent_color: '#1D4ED8',
      permissions: {
        modules: ['police-stations', 'notices-circulars', 'public-services', 'events', 'photo-gallery', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'hospital_editor',
      name_en: 'Hospital Editor',
      name_bn: 'হাসপাতাল সম্পাদক',
      description: 'Manage hospital/health centre services, health camps, notices, and gallery.',
      accent_color: '#DC2626',
      permissions: {
        modules: ['hospitals', 'notices-circulars', 'events', 'photo-gallery', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'school_editor',
      name_en: 'School / College Editor',
      name_bn: 'বিদ্যালয় / মহাবিদ্যালয় সম্পাদক',
      description: 'Manage school and college profiles, admissions, notices, and activities.',
      accent_color: '#D97706',
      permissions: {
        modules: ['schools', 'colleges', 'notices-circulars', 'events', 'photo-gallery', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'news_editor',
      name_en: 'News Editor',
      name_bn: 'সংবাদ সম্পাদক',
      description: 'Manage news articles, block announcements, and official circulars.',
      accent_color: '#0891B2',
      permissions: {
        modules: ['news-announcements', 'notices-circulars', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'event_editor',
      name_en: 'Event Editor',
      name_bn: 'ইভেন্ট সম্পাদক',
      description: 'Manage block events, cultural programmes, and event photo galleries.',
      accent_color: '#9333EA',
      permissions: {
        modules: ['events', 'events-programmes', 'photo-gallery', 'video-gallery', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'gallery_editor',
      name_en: 'Gallery Editor',
      name_bn: 'গ্যালারি সম্পাদক',
      description: 'Manage photo galleries, video galleries, tourism and heritage visuals.',
      accent_color: '#0D9488',
      permissions: {
        modules: ['photo-gallery', 'video-gallery', 'tourism', 'culture-heritage', 'media'],
        actions: ['view', 'create', 'edit', 'publish'],
      },
    },
    {
      slug: 'viewer',
      name_en: 'General User / Viewer',
      name_bn: 'সাধারণ ব্যবহারকারী',
      description: 'Read-only access to preview dashboard statistics and published content.',
      accent_color: '#64748B',
      permissions: {
        modules: ['about-balagarh', 'news-announcements', 'notices-circulars', 'events'],
        actions: ['view'],
      },
    },
  ];

  const insertRole = db.prepare(
    'INSERT INTO roles (slug, name_en, name_bn, description, accent_color, permissions_json) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const roleIdBySlug: Record<string, number> = {};
  for (const r of rolesData) {
    const res = insertRole.run(r.slug, r.name_en, r.name_bn, r.description, r.accent_color, JSON.stringify(r.permissions));
    roleIdBySlug[r.slug] = Number(res.lastInsertRowid);
  }

  // 2. Seed Users
  const defaultHash = hashPassword('balagarh2026');
  const usersData = [
    { username: 'superadmin', full_name: 'Subhajit Chatterjee', email: 'superadmin@ourbalagarh.in', role: 'super_admin', gp: null, inst: null },
    { username: 'admin', full_name: 'Anirban Mukherjee', email: 'admin@ourbalagarh.in', role: 'admin', gp: null, inst: null },
    { username: 'panchayat_gp', full_name: 'Tapas Mondal', email: 'gp.balagarh@ourbalagarh.in', role: 'panchayat_editor', gp: 'Balagarh Gram Panchayat', inst: null },
    { username: 'police_ps', full_name: 'SI Debashis Roy', email: 'ps.balagarh@ourbalagarh.in', role: 'police_editor', gp: null, inst: 'Balagarh Police Station' },
    { username: 'hospital_bphc', full_name: 'Dr. Moumita Sen', email: 'bphc.jirat@ourbalagarh.in', role: 'hospital_editor', gp: null, inst: 'Balagarh Rural Hospital (Jirat)' },
    { username: 'school_editor', full_name: 'Srabani Dasgupta', email: 'schools@ourbalagarh.in', role: 'school_editor', gp: null, inst: 'Balagarh High School' },
    { username: 'news_editor', full_name: 'Arindam Ghosh', email: 'news@ourbalagarh.in', role: 'news_editor', gp: null, inst: null },
    { username: 'event_editor', full_name: 'Rituparna Basu', email: 'events@ourbalagarh.in', role: 'event_editor', gp: null, inst: null },
    { username: 'gallery_editor', full_name: 'Soumen Halder', email: 'gallery@ourbalagarh.in', role: 'gallery_editor', gp: null, inst: null },
    { username: 'viewer', full_name: 'Citizen Observer', email: 'viewer@ourbalagarh.in', role: 'viewer', gp: null, inst: null },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (username, full_name, email, password_hash, visible_password, role_id, assigned_panchayat, assigned_institution) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const u of usersData) {
    insertUser.run(u.username, u.full_name, u.email, defaultHash, 'balagarh2026', roleIdBySlug[u.role], u.gp, u.inst);
  }

  // 3. Seed 24 Content Sections
  const sectionsData = [
    { slug: 'about-balagarh', en: 'About Balagarh', bn: 'বলাগড় পরিচিতি', group: 'Block Profile', icon: 'Info', desc_en: 'Overview, heritage, and administrative introduction of Balagarh Block.', desc_bn: 'বলাগড় ব্লকের সামগ্রিক পরিচিতি ও প্রশাসনিক তথ্য।' },
    { slug: 'block-information', en: 'Block Information', bn: 'ব্লক তথ্য', group: 'Block Profile', icon: 'Landmark', desc_en: 'Key demographic, administrative, and block office facts.', desc_bn: 'ব্লক অফিসের প্রশাসনিক ও জনসংখ্যা সংক্রান্ত তথ্য।' },
    { slug: 'history-geography', en: 'History and Geography', bn: 'ইতিহাস ও ভূগোল', group: 'Block Profile', icon: 'Compass', desc_en: 'Historical legacy, Ganga/Hooghly riverbank geography, and climate.', desc_bn: 'বলাগড়ের প্রাচীন ইতিহাস, গঙ্গার তীরবর্তী ভূগোল ও প্রাকৃতিক পরিবেশ।' },
    { slug: 'gram-panchayats', en: 'Gram Panchayats', bn: 'গ্রাম পঞ্চায়েত', group: 'Administration', icon: 'Building2', desc_en: 'Directory of all 13 Gram Panchayats under Balagarh Block.', desc_bn: 'বলাগড় ব্লকের সমস্ত গ্রাম পঞ্চায়েতের বিস্তারিত তথ্য।' },
    { slug: 'villages', en: 'Villages', bn: 'গ্রাম সমূহ', group: 'Administration', icon: 'Home', desc_en: 'Village profiles, mouzas, pin codes, and local amenities.', desc_bn: 'বলাগড়ের গ্রাম, মৌজা ও স্থানীয় পরিষেবার বিবরণ।' },
    { slug: 'schools', en: 'Schools', bn: 'বিদ্যালয়', group: 'Education', icon: 'School', desc_en: 'Primary, secondary, and higher secondary schools across Balagarh.', desc_bn: 'প্রাথমিক, মাধ্যমিক ও উচ্চমাধ্যমিক বিদ্যালয়সমূহের তালিকা।' },
    { slug: 'colleges', en: 'Colleges', bn: 'মহাবিদ্যালয়', group: 'Education', icon: 'GraduationCap', desc_en: 'Degree colleges and technical institutes serving Balagarh students.', desc_bn: 'স্নাতক কলেজ ও কারিগরি শিক্ষা প্রতিষ্ঠানসমূহ।' },
    { slug: 'hospitals', en: 'Hospitals & Healthcare', bn: 'হাসপাতাল ও স্বাস্থ্যকেন্দ্র', group: 'Health & Safety', icon: 'HeartPulse', desc_en: 'Block Primary Health Centres, rural hospitals, and clinics.', desc_bn: 'ব্লক প্রাথমিক স্বাস্থ্যকেন্দ্র, গ্রামীণ হাসপাতাল ও চিকিৎসা পরিষেবা।' },
    { slug: 'government-offices', en: 'Government Offices', bn: 'সরকারি দপ্তর', group: 'Administration', icon: 'Briefcase', desc_en: 'BDO office, BL&LRO, agriculture, electricity, and postal offices.', desc_bn: 'বিডিও অফিস, ভূমি ও রাজস্ব দপ্তর এবং অন্যান্য সরকারি অফিস।' },
    { slug: 'police-stations', en: 'Police Stations', bn: 'পুলিশ স্টেশন', group: 'Health & Safety', icon: 'ShieldCheck', desc_en: 'Balagarh Police Station, outposts, helplines, and public safety drives.', desc_bn: 'বলাগড় থানা, পুলিশ ফাঁড়ি ও জরুরি নিরাপত্তা পরিষেবা।' },
    { slug: 'public-representatives', en: 'Public Representatives', bn: 'জনপ্রতিনিধি', group: 'Administration', icon: 'Users', desc_en: 'MP, MLA, Zilla Parishad, Panchayat Samiti, and Gram Pradhan directory.', desc_bn: 'সাংসদ, বিধায়ক, পঞ্চায়েত সমিতি ও গ্রাম প্রধানদের তালিকা।' },
    { slug: 'roads-infrastructure', en: 'Roads and Infrastructure', bn: 'সড়ক ও পরিকাঠামো', group: 'Development', icon: 'Route', desc_en: 'STKK Road, railway connectivity, ferry ghats, and rural bridges.', desc_bn: 'এসটিকেকে রোড, রেল যোগাযোগ, ফেরি ঘাট ও সেতু পরিকাঠামো।' },
    { slug: 'agriculture', en: 'Agriculture', bn: 'কৃষি ও অর্থনীতি', group: 'Development', icon: 'Sprout', desc_en: 'Paddy, potato, jute farming, orchards, and traditional boat-building.', desc_bn: 'ধান, আলু, পাট চাষ, উদ্যানপালন এবং বলাগড়ের ঐতিহ্যবাহী নৌকা নির্মাণ শিল্প।' },
    { slug: 'tourism', en: 'Tourism', bn: 'পর্যটন', group: 'Heritage & Tourism', icon: 'Mountain', desc_en: 'Eco-tourism, river retreats, Sabuj Dwip, and seasonal boat tours.', desc_bn: 'সবুজ দ্বীপ, নদী পর্যটন ও বলাগড় ভ্রমণ গাইড।' },
    { slug: 'tourist-attractions', en: 'Tourist Attractions', bn: 'দর্শনীয় স্থান', group: 'Heritage & Tourism', icon: 'MapPin', desc_en: 'Landmarks, picnic spots, ghats, and heritage sites to visit.', desc_bn: 'বলাগড়ের জনপ্রিয় দর্শনীয় ও ভ্রমণ স্থানসমূহ।' },
    { slug: 'culture-heritage', en: 'Culture and Heritage', bn: 'সংস্কৃতি ও ঐতিহ্য', group: 'Heritage & Tourism', icon: 'Sparkles', desc_en: 'Guptipara Rath Yatra, terracotta temples, traditional boat craft, and fairs.', desc_bn: 'গুপ্তিপাড়ার রথযাত্রা, টেরাকোটা মন্দির, নৌকা শিল্প ও লোকসংস্কৃতি।' },
    { slug: 'news-announcements', en: 'News and Announcements', bn: 'সংবাদ ও ঘোষণা', group: 'Updates', icon: 'Newspaper', desc_en: 'Latest local news, development milestones, and community stories.', desc_bn: 'বলাগড়ের সাম্প্রতিক সংবাদ, উন্নয়নমূলক কাজ ও ঘোষণা।' },
    { slug: 'notices-circulars', en: 'Notices and Circulars', bn: 'বিজ্ঞপ্তি ও সার্কুলার', group: 'Updates', icon: 'Megaphone', desc_en: 'Official block circulars, health camp notices, and admission alerts.', desc_bn: 'সরকারি বিজ্ঞপ্তি, স্বাস্থ্য শিবির ও জরুরি নোটিশ বোর্ড।' },
    { slug: 'events-programmes', en: 'Events and Programmes', bn: 'অনুষ্ঠান ও কর্মসূচি', group: 'Updates', icon: 'CalendarDays', desc_en: 'Cultural festivals, sports meets, fairs, and civic programmes.', desc_bn: 'সাংস্কৃতিক অনুষ্ঠান, বইমেলা, ক্রীড়া ও জনকল্যাণমূলক কর্মসূচি।' },
    { slug: 'photo-gallery', en: 'Photo Gallery', bn: 'ছবি গ্যালারি', group: 'Media', icon: 'Image', desc_en: 'Curated photographs of Balagarh temples, rivers, festivals, and schools.', desc_bn: 'বলাগড়ের মন্দির, নদী, উৎসব ও বিভিন্ন প্রতিষ্ঠানের আলোকচিত্র।' },
    { slug: 'video-gallery', en: 'Video Gallery', bn: 'ভিডিও গ্যালারি', group: 'Media', icon: 'Video', desc_en: 'Documentary videos, YouTube stories, and cultural event recordings.', desc_bn: 'বলাগড়ের প্রামাণ্যচিত্র, ইউটিউব ভিডিও এবং সাংস্কৃতিক অনুষ্ঠানের রেকর্ডিং।' },
    { slug: 'important-links', en: 'Important Links', bn: 'গুরুত্বপূর্ণ লিঙ্ক', group: 'Citizen Services', icon: 'ExternalLink', desc_en: 'Direct portals for Hooghly District, West Bengal Govt, and public schemes.', desc_bn: 'হুগলি জেলা ও পশ্চিমবঙ্গ সরকারের গুরুত্বপূর্ণ পোর্টাল লিঙ্ক।' },
    { slug: 'public-services', en: 'Public Services', bn: 'জনপরিষেবা ও প্রকল্প', group: 'Citizen Services', icon: 'HandHelping', desc_en: 'Duare Sarkar, Lakshmir Bhandar, Swasthya Sathi, and citizen certificates.', desc_bn: 'দুয়ারে সরকার, লক্ষ্মীর ভাণ্ডার, স্বাস্থ্যসাথী ও নাগরিক পরিষেবা।' },
    { slug: 'contact-information', en: 'Contact Information', bn: 'যোগাযোগের তথ্য', group: 'Citizen Services', icon: 'Phone', desc_en: 'Emergency helplines, block office address, and citizen feedback desk.', desc_bn: 'জরুরি হেল্পলাইন, ব্লক অফিসের ঠিকানা ও যোগাযোগ কেন্দ্র।' },
  ];

  const insertSection = db.prepare(
    'INSERT INTO content_sections (slug, name_en, name_bn, group_name, description_en, description_bn, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  sectionsData.forEach((s, idx) => {
    insertSection.run(s.slug, s.en, s.bn, s.group, s.desc_en, s.desc_bn, s.icon, idx + 1);
  });

  // 4. Seed Media Library with verified locally saved assets
  const mediaSeed = [
    {
      filename: 'guptipara_terracotta_temple.jpg',
      original_name: 'guptipara_terracotta_temple_hooghly.jpg',
      url: '/uploads/guptipara_terracotta_temple.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'heritage',
      file_size: 342804,
      caption_en: 'Historic terracotta temple along the tranquil Hooghly riverbank in Balagarh',
      caption_bn: 'বলাগড়ের হুগলি নদীর তীরে ঐতিহাসিক টেরাকোটা মন্দির ও নৌকা',
      alt_text: 'Terracotta temple by the Hooghly river in Balagarh at golden hour',
    },
    {
      filename: 'hooghly_river_boats.jpg',
      original_name: 'balagarh_river_aerial_sabuj_dwip.jpg',
      url: '/uploads/hooghly_river_boats.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'tourism',
      file_size: 151059,
      caption_en: 'Panorama of lush green Balagarh riverbanks and wooden boats on the Hooghly',
      caption_bn: 'বলাগড়ের সবুজ গ্রামাঞ্চল, হুগলি নদী ও ফেরি ঘাটের মনোরম দৃশ্য',
      alt_text: 'Scenic view of Hooghly river boats in Balagarh',
    },
    {
      filename: 'guptipara_heritage_temple_02.jpg',
      original_name: 'balagarh_gram_panchayat_office.jpg',
      url: '/uploads/guptipara_heritage_temple_02.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'panchayats',
      file_size: 331964,
      caption_en: 'Civic heritage and Gram Panchayat landmark serving local residents in Balagarh Block',
      caption_bn: 'বলাগড় ব্লকের ঐতিহ্য ও গ্রাম পঞ্চায়েত পরিষেবা কেন্দ্র',
      alt_text: 'Heritage civic landmark in Balagarh Block',
    },
    {
      filename: 'bengal_high_school.jpg',
      original_name: 'balagarh_high_school_campus.jpg',
      url: '/uploads/bengal_high_school.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'schools',
      file_size: 218411,
      caption_en: 'Balagarh High School campus and sports ground during morning hours',
      caption_bn: 'বলাগড় উচ্চ বিদ্যালয় প্রাঙ্গণ ও খেলার মাঠ',
      alt_text: 'High school building and playground in Bengal',
    },
    {
      filename: 'bengal_health_hospital.jpg',
      original_name: 'balagarh_rural_hospital_bphc.jpg',
      url: '/uploads/bengal_health_hospital.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'hospitals',
      file_size: 433649,
      caption_en: 'Block Primary Health Centre & Rural Hospital providing 24x7 emergency care',
      caption_bn: 'বলাগড় ব্লক প্রাথমিক স্বাস্থ্যকেন্দ্র ও গ্রামীণ হাসপাতাল',
      alt_text: 'Rural hospital building providing 24x7 healthcare services',
    },
    {
      filename: 'bengal_festival_puja.jpg',
      original_name: 'balagarh_cultural_book_fair.jpg',
      url: '/uploads/bengal_festival_puja.jpg',
      mime_type: 'image/jpeg',
      media_type: 'image',
      folder: 'events',
      file_size: 594793,
      caption_en: 'Balagarh rural cultural festival, folk music stage, and community fair',
      caption_bn: 'বলাগড় পল্লী সংস্কৃতি উৎসব, লোকসংগীত ও গ্রামীণ মেলা',
      alt_text: 'Vibrant cultural festival celebration in Bengal',
    },
  ];

  const insertMedia = db.prepare(`
    INSERT INTO media (filename, original_name, url, mime_type, media_type, folder, file_size, caption_en, caption_bn, alt_text, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Subhajit Chatterjee')
  `);
  const mediaIds: number[] = [];
  for (const m of mediaSeed) {
    const res = insertMedia.run(
      m.filename, m.original_name, m.url, m.mime_type, m.media_type,
      m.folder, m.file_size, m.caption_en, m.caption_bn, m.alt_text
    );
    mediaIds.push(Number(res.lastInsertRowid));
  }
  const [mHeritage, mRiver, mPanchayat, mSchool, mHospital, mFestival] = mediaIds;

  // 5. Seed Categories & Tags
  const insertCat = db.prepare('INSERT INTO content_categories (section_slug, name_en, name_bn, slug) VALUES (?, ?, ?, ?)');
  const catNewsDev = Number(insertCat.run('news-announcements', 'Block Development', 'ব্লক উন্নয়ন', 'block-development').lastInsertRowid);
  const catNewsHealth = Number(insertCat.run('news-announcements', 'Health & Welfare', 'স্বাস্থ্য ও জনকল্যাণ', 'health-welfare').lastInsertRowid);
  const catNoticeOfficial = Number(insertCat.run('notices-circulars', 'Official Circular', 'সরকারি সার্কুলার', 'official-circular').lastInsertRowid);
  const catSchoolHS = Number(insertCat.run('schools', 'Higher Secondary', 'উচ্চ মাধ্যমিক', 'higher-secondary').lastInsertRowid);
  const catGP = Number(insertCat.run('gram-panchayats', 'Gram Panchayat', 'গ্রাম পঞ্চায়েত', 'gram-panchayat').lastInsertRowid);
  const catHeritage = Number(insertCat.run('culture-heritage', 'Terracotta & Temples', 'টেরাকোটা ও মন্দির', 'terracotta-temples').lastInsertRowid);

  const insertTag = db.prepare('INSERT INTO content_tags (name_en, name_bn, slug) VALUES (?, ?, ?)');
  const tHeritage = Number(insertTag.run('Heritage', 'ঐতিহ্য', 'heritage').lastInsertRowid);
  const tEducation = Number(insertTag.run('Education', 'শিক্ষা', 'education').lastInsertRowid);
  const tHealthcare = Number(insertTag.run('Healthcare', 'স্বাস্থ্য', 'healthcare').lastInsertRowid);
  const tPanchayat = Number(insertTag.run('Panchayat', 'পঞ্চায়েত', 'panchayat').lastInsertRowid);
  const tDevelopment = Number(insertTag.run('Development', 'উন্নয়ন', 'development').lastInsertRowid);
  const tTourism = Number(insertTag.run('Tourism', 'পর্যটন', 'tourism').lastInsertRowid);

  // 6. Seed Comprehensive Bilingual Contents Across All 24 Sections
  const insertContent = db.prepare(`
    INSERT INTO contents (
      section_slug, category_id, title_en, title_bn, slug,
      summary_en, summary_bn, body_en, body_bn,
      cover_media_id, video_url, document_url, external_url, metadata_json,
      status, is_featured, sort_order, views_count, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const linkTag = db.prepare('INSERT OR IGNORE INTO content_tag_relations (content_id, tag_id) VALUES (?, ?)');
  const linkGallery = db.prepare('INSERT INTO content_media (content_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');

  const contentSeed = [
    // About Balagarh
    {
      section: 'about-balagarh',
      cat: null,
      title_en: 'Balagarh Block: Land of Heritage, Rivers & Living Craft',
      title_bn: 'বলাগড় ব্লক: ঐতিহ্য, নদী ও জীবন্ত লোকশিল্পের পীঠস্থান',
      slug: 'about-balagarh-overview',
      sum_en: 'Located on the western bank of the Hooghly River in Hooghly district, Balagarh CD Block blends centuries-old terracotta temples, famed wooden boat craftsmanship, and vibrant agricultural communities.',
      sum_bn: 'হুগলি জেলার উত্তর-পূর্ব প্রান্তে ভাগীরথী-হুগলি নদীর তীরে অবস্থিত বলাগড় ব্লক প্রাচীন টেরাকোটা মন্দির, ঐতিহ্যবাহী নৌকা নির্মাণ শিল্প এবং সমৃদ্ধ গ্রামীণ সংস্কৃতির জন্য সুপরিচিত।',
      body_en: '<p>Balagarh Community Development Block lies in the Chinsurah subdivision of Hooghly district, West Bengal. Bordered by the Bhagirathi-Hooghly river on the east, it connects seamlessly with Nadia district via historic ferry ghats and rail corridors.</p><p>Known globally for Guptipara\'s Rath Yatra (the oldest in Bengal after Puri), centuries-old terracotta temples, Sabuj Dwip eco-island, and traditional wooden boat-makers along the Hooghly, Balagarh stands as a pillar of rural heritage and progressive civic administration.</p>',
      body_bn: '<p>পশ্চিমবঙ্গের হুগলি জেলার চুঁচুড়া মহকুমার অন্তর্গত বলাগড় সমষ্টি উন্নয়ন ব্লক পূর্বে ভাগীরথী-হুগলি নদী দ্বারা বেষ্টিত। প্রাচীন কাল থেকেই এই অঞ্চল ব্যবসা-বাণিজ্য, শিক্ষা ও সংস্কৃতির অন্যতম কেন্দ্র।</p><p>গুপ্তিপাড়ার ঐতিহাসিক রথযাত্রা, বৃন্দাবন চন্দ্র মঠ, সবুজ দ্বীপ এবং বলাগড়ের বিশ্বখ্যাত কাঠের নৌকা শিল্প এই ব্লককে এক অনন্য পরিচিতি দিয়েছে।</p>',
      cover: mRiver,
      video: null,
      doc: null,
      ext: null,
      meta: { District: 'Hooghly', Subdivision: 'Chinsurah', Headquarters: 'Balagarh', PIN: '712501', Area: '205.45 sq. km' },
      status: 'published',
      featured: 1,
      order: 1,
      views: 1840,
      tags: [tHeritage, tTourism],
      gallery: [mRiver, mHeritage],
    },
    // Block Information
    {
      section: 'block-information',
      cat: null,
      title_en: 'Balagarh Community Development Block Administrative Profile',
      title_bn: 'বলাগড় সমষ্টি উন্নয়ন ব্লক প্রশাসনিক পরিচিতি',
      slug: 'block-administrative-profile',
      sum_en: 'Complete administrative profile covering 13 Gram Panchayats, 134 inhabited villages, population metrics, and block offices.',
      sum_bn: 'বলাগড় ব্লকের ১৩টি গ্রাম পঞ্চায়েত, ১৩৪টি গ্রাম, জনসংখ্যা এবং ব্লক দপ্তরের প্রশাসনিক বিবরণ।',
      body_en: '<p>Balagarh Block encompasses 13 Gram Panchayats, 134 mouzas/villages, 185+ schools, 4 colleges, and 6 primary & rural healthcare centres serving over 2.48 lakh residents.</p>',
      body_bn: '<p>বলাগড় ব্লকের অধীনে ১৩টি গ্রাম পঞ্চায়েত, ১৩৪টি গ্রাম, ১৮৫টিরও বেশি বিদ্যালয়, ৪টি কলেজ এবং ৬টি স্বাস্থ্যকেন্দ্র রয়েছে। প্রায় ২.৪৮ লক্ষ মানুষ এই ব্লকে বসবাস করেন।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { 'Total Panchayats': '13', 'Total Villages': '134', 'Population': '2.48 Lakh+', 'BDO Office': 'Jirat-Balagarh' },
      status: 'published', featured: 1, order: 1, views: 920,
      tags: [tDevelopment], gallery: [mPanchayat],
    },
    // History and Geography
    {
      section: 'history-geography',
      cat: null,
      title_en: 'From Ancient Saptagram Trade Routes to Riverine Geography',
      title_bn: 'প্রাচীন বাণিজ্য পথ থেকে হুগলি নদীর পলিমাটির ভূগোল',
      slug: 'history-and-geography-balagarh',
      sum_en: 'Explore the historical evolution of Guptipara, Somra, and Balagarh alongside its fertile alluvial floodplains.',
      sum_bn: 'গুপ্তিপাড়া, সোমরা ও বলাগড়ের ঐতিহাসিক বিবর্তন এবং গঙ্গার তীরবর্তী উর্বর ভূপ্রকৃতির বিবরণ।',
      body_en: '<p>Balagarh\'s fertile alluvial plains sit between 12m and 18m above sea level along the meandering Hooghly river, nurturing multi-crop agriculture and historic riverine trade settlements.</p>',
      body_bn: '<p>হুগলি নদীর পশ্চিম তীরে অবস্থিত বলাগড়ের উর্বর পলিমাটি বহুমুখী কৃষি ও প্রাচীন নৌ-বাণিজ্যের বিকাশে গুরুত্বপূর্ণ ভূমিকা পালন করেছে।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { River: 'Bhagirathi-Hooghly', Soil: 'Fertile Alluvial', Latitude: '23.12° N', Longitude: '88.46° E' },
      status: 'published', featured: 0, order: 1, views: 610,
      tags: [tHeritage], gallery: [mHeritage, mRiver],
    },
    // Gram Panchayats
    {
      section: 'gram-panchayats',
      cat: catGP,
      title_en: 'Sripur-Balagarh Gram Panchayat',
      title_bn: 'শ্রীপুর-বলাগড় গ্রাম পঞ্চায়েত',
      slug: 'sripur-balagarh-gp',
      sum_en: 'Administrative hub covering Balagarh headquarters, railway station locality, and surrounding riverside villages.',
      sum_bn: 'বলাগড় সদর, রেল স্টেশন সংলগ্ন এলাকা ও পার্শ্ববর্তী গ্রামগুলির প্রশাসনিক গ্রাম পঞ্চায়েত।',
      body_en: '<p>Sripur-Balagarh Gram Panchayat delivers birth/death registration, MGNREGA works, rural sanitation, street lighting, and drinking water services to over 24,000 residents.</p>',
      body_bn: '<p>শ্রীপুর-বলাগড় গ্রাম পঞ্চায়েত এলাকার পানীয় জল, রাস্তাঘাট, নিকাশি ব্যবস্থা এবং জনকল্যাণমূলক প্রকল্প পরিচালনার প্রধান কেন্দ্র।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { 'GP Code': 'WB-HGL-BLG-01', Villages: '14', 'PIN Code': '712501', Office: 'Balagarh Station Road' },
      status: 'published', featured: 1, order: 1, views: 740,
      tags: [tPanchayat, tDevelopment], gallery: [mPanchayat],
    },
    {
      section: 'gram-panchayats',
      cat: catGP,
      title_en: 'Guptipara-I & Guptipara-II Gram Panchayats',
      title_bn: 'গুপ্তিপাড়া-১ ও গুপ্তিপাড়া-২ গ্রাম পঞ্চায়েত',
      slug: 'guptipara-gp',
      sum_en: 'Heritage-rich panchayat zone home to the historic Brindabanchandra Math, Rath Yatra, and famed sweetmakers.',
      sum_bn: 'ঐতিহাসিক বৃন্দাবনচন্দ্র মঠ, রথযাত্রা এবং বিখ্যাত মিষ্টান্ন শিল্পের জন্য পরিচিত গুপ্তিপাড়া পঞ্চায়েত এলাকা।',
      body_en: '<p>Guptipara GP coordinates festival infrastructure, heritage conservation, rural road maintenance, and citizen grievance redressal.</p>',
      body_bn: '<p>গুপ্তিপাড়া গ্রাম পঞ্চায়েত এলাকার ঐতিহ্য সংরক্ষণ, রথযাত্রা পরিকাঠামো এবং গ্রামীণ উন্নয়নমূলক কাজ পরিচালনা করে।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { 'GP Code': 'WB-HGL-BLG-02', Villages: '18', 'PIN Code': '712512', Landmark: 'Brindabanchandra Math' },
      status: 'published', featured: 0, order: 2, views: 580,
      tags: [tPanchayat, tHeritage], gallery: [mHeritage],
    },
    {
      section: 'gram-panchayats',
      cat: catGP,
      title_en: 'Jirat Gram Panchayat',
      title_bn: 'জিরাট গ্রাম পঞ্চায়েত',
      slug: 'jirat-gp',
      sum_en: 'Key civic and healthcare centre hosting Balagarh Rural Hospital and educational campuses.',
      sum_bn: 'বলাগড় গ্রামীণ হাসপাতাল এবং বহু শিক্ষা প্রতিষ্ঠানের প্রাণকেন্দ্র জিরাট গ্রাম পঞ্চায়েত।',
      body_en: '<p>Jirat Gram Panchayat serves one of the fastest-growing residential and commercial corridors along STKK Road in Balagarh Block.</p>',
      body_bn: '<p>এসটিকেকে রোড সংলগ্ন জিরাট গ্রাম পঞ্চায়েত বলাগড় ব্লকের অন্যতম ব্যস্ত বাণিজ্যিক ও শিক্ষা কেন্দ্র।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { 'GP Code': 'WB-HGL-BLG-03', Villages: '12', 'PIN Code': '712501', Office: 'Jirat Bazar' },
      status: 'published', featured: 0, order: 3, views: 495,
      tags: [tPanchayat], gallery: [mPanchayat],
    },
    // Villages
    {
      section: 'villages',
      cat: null,
      title_en: 'Somra & Sabuj Dwip Riverside Belt',
      title_bn: 'সোমরা ও সবুজ দ্বীপ নদী তীরবর্তী গ্রামাঞ্চল',
      slug: 'somra-village-profile',
      sum_en: 'Scenic riverside village cluster renowned for Behula-Hooghly confluence, boat-building yards, and orchards.',
      sum_bn: 'বেহুলা ও হুগলি নদীর সঙ্গমস্থল, নৌকা তৈরি কারখানা ও ফলের বাগানের জন্য বিখ্যাত সোমরা গ্রাম।',
      body_en: '<p>Somra village sits at the confluence of the Behula and Hooghly rivers, serving as the gateway to Sabuj Dwip eco-tourism island.</p>',
      body_bn: '<p>সোমরা গ্রাম সবুজ দ্বীপ ভ্রমণের প্রবেশদ্বার এবং ঐতিহ্যবাহী কাঠের নৌকা শিল্পের জন্য পরিচিত।</p>',
      cover: mRiver,
      video: null, doc: null, ext: null,
      meta: { Panchayat: 'Somra-I', 'PIN Code': '712515', 'Nearest Station': 'Somra Bazar' },
      status: 'published', featured: 0, order: 1, views: 430,
      tags: [tTourism], gallery: [mRiver],
    },
    // Schools
    {
      section: 'schools',
      cat: catSchoolHS,
      title_en: 'Balagarh High School (H.S.)',
      title_bn: 'বলাগড় উচ্চ বিদ্যালয় (উঃ মাঃ)',
      slug: 'balagarh-high-school',
      sum_en: 'Premier government-aided higher secondary institution nurturing generations of scholars across Balagarh.',
      sum_bn: 'বলাগড়ের অন্যতম প্রাচীন ও ঐতিহ্যবাহী উচ্চ মাধ্যমিক বিদ্যালয়।',
      body_en: '<p>Equipped with smart classrooms, science laboratories, a spacious playground, and digital library facilities for Classes V to XII.</p>',
      body_bn: '<p>পঞ্চম থেকে দ্বাদশ শ্রেণি পর্যন্ত বিজ্ঞান গবেষণাগার, ডিজিটাল লাইব্রেরি ও ক্রীড়া পরিকাঠামো সমৃদ্ধ শিক্ষা প্রতিষ্ঠান।</p>',
      cover: mSchool,
      video: null, doc: null, ext: null,
      meta: { Board: 'WBBSE & WBCHSE', Established: '1948', Location: 'Balagarh', Medium: 'Bengali' },
      status: 'published', featured: 1, order: 1, views: 1120,
      tags: [tEducation], gallery: [mSchool],
    },
    {
      section: 'schools',
      cat: catSchoolHS,
      title_en: 'Jirat Colony High School (H.S.)',
      title_bn: 'জিরাট কলোনি উচ্চ বিদ্যালয় (উঃ মাঃ)',
      slug: 'jirat-colony-high-school',
      sum_en: 'Co-educational higher secondary school recognized for academic excellence and cultural sports activities.',
      sum_bn: 'শিক্ষা, ক্রীড়া ও সাংস্কৃতিক কর্মকাণ্ডে অগ্রণী জিরাট কলোনি উচ্চ বিদ্যালয়।',
      body_en: '<p>Serving students from Jirat and adjoining Gram Panchayats with dedicated science, arts, and vocational streams.</p>',
      body_bn: '<p>জিরাট ও পার্শ্ববর্তী গ্রামগুলির ছাত্রছাত্রীদের জন্য বিজ্ঞান ও কলা বিভাগের উন্নত পাঠদান ব্যবস্থা।</p>',
      cover: mSchool,
      video: null, doc: null, ext: null,
      meta: { Board: 'WBBSE & WBCHSE', Location: 'Jirat, Balagarh', PIN: '712501' },
      status: 'published', featured: 0, order: 2, views: 640,
      tags: [tEducation], gallery: [mSchool],
    },
    // Colleges
    {
      section: 'colleges',
      cat: null,
      title_en: 'Balagarh Bijoy Krishna Mahavidyalaya',
      title_bn: 'বলাগড় বিজয় কৃষ্ণ মহাবিদ্যালয়',
      slug: 'balagarh-bijoy-krishna-mahavidyalaya',
      sum_en: 'Affiliated to the University of Burdwan, offering undergraduate degree programmes in Arts, Science, and Commerce.',
      sum_bn: 'বর্ধমান বিশ্ববিদ্যালয়ের অধিভুক্ত বলাগড়ের প্রধান স্নাতক মহাবিদ্যালয় (কলা, বিজ্ঞান ও বাণিজ্য বিভাগ)।',
      body_en: '<p>Founded in 1985 at Jirat, Balagarh Bijoy Krishna Mahavidyalaya serves thousands of first-generation and rural college learners across Hooghly and Nadia.</p>',
      body_bn: '<p>১৯৮৫ সালে জিরাটে প্রতিষ্ঠিত এই কলেজটি বলাগড় ও পার্শ্ববর্তী এলাকার উচ্চশিক্ষার প্রধান পীঠস্থান।</p>',
      cover: mSchool,
      video: null, doc: null, ext: 'https://bbkm.ac.in',
      meta: { University: 'University of Burdwan', Established: '1985', Location: 'Jirat, Balagarh' },
      status: 'published', featured: 1, order: 1, views: 890,
      tags: [tEducation], gallery: [mSchool],
    },
    // Hospitals
    {
      section: 'hospitals',
      cat: null,
      title_en: 'Balagarh Block Primary Health Centre & Rural Hospital (Jirat)',
      title_bn: 'বলাগড় ব্লক প্রাথমিক স্বাস্থ্যকেন্দ্র ও গ্রামীণ হাসপাতাল (জিরাট)',
      slug: 'balagarh-rural-hospital',
      sum_en: '30-bed rural hospital providing 24x7 emergency trauma care, maternity ward, OPD clinics, and diagnostic pathology.',
      sum_bn: '২৪ ঘণ্টা জরুরি চিকিৎসা, প্রসূতি বিভাগ, বহির্বিভাগ ও রোগ নির্ণয় পরিষেবা যুক্ত ৩০ শয্যার গ্রামীণ হাসপাতাল।',
      body_en: '<p>Operated under the Department of Health & Family Welfare, Govt of West Bengal, offering free medicines, immunization drives, and ambulance referral services.</p>',
      body_bn: '<p>পশ্চিমবঙ্গ সরকারের স্বাস্থ্য ও পরিবার কল্যাণ দপ্তরের অধীনে পরিচালিত এই হাসপাতালে বিনামূল্যে ওষুধ, টিকাকরণ ও অ্যাম্বুলেন্স পরিষেবা পাওয়া যায়।</p>',
      cover: mHospital,
      video: null, doc: null, ext: null,
      meta: { Beds: '30', Emergency: '24x7 Open', Helpline: '102 / +91 33-2636-XXXX', Location: 'Jirat, Balagarh' },
      status: 'published', featured: 1, order: 1, views: 1320,
      tags: [tHealthcare], gallery: [mHospital],
    },
    // Government Offices
    {
      section: 'government-offices',
      cat: null,
      title_en: 'Office of the Block Development Officer (BDO), Balagarh',
      title_bn: 'সমষ্টি উন্নয়ন আধিকারিকের দপ্তর (বিডিও অফিস), বলাগড়',
      slug: 'bdo-office-balagarh',
      sum_en: 'Central administrative office overseeing rural development schemes, disaster relief, and panchayat coordination.',
      sum_bn: 'বলাগড় ব্লকের সমস্ত সরকারি প্রকল্প, ত্রাণ ও পঞ্চায়েত সমন্বয়ের প্রধান প্রশাসনিক দপ্তর।',
      body_en: '<p>Open Monday to Friday (10:00 AM – 5:30 PM) for citizen certificates, Duare Sarkar coordination, and public grievances.</p>',
      body_bn: '<p>সোম থেকে শুক্রবার সকাল ১০টা থেকে বিকাল ৫:৩০ পর্যন্ত নাগরিক শংসাপত্র ও সরকারি প্রকল্প সংক্রান্ত সহায়তার জন্য খোলা থাকে।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Hours: 'Mon–Fri, 10 AM – 5:30 PM', Location: 'Jirat, Balagarh', PIN: '712501' },
      status: 'published', featured: 0, order: 1, views: 780,
      tags: [tDevelopment], gallery: [mPanchayat],
    },
    // Police Stations
    {
      section: 'police-stations',
      cat: null,
      title_en: 'Balagarh Police Station (Hooghly Rural Police)',
      title_bn: 'বলাগড় থানা (হুগলি গ্রামীণ পুলিশ)',
      slug: 'balagarh-police-station',
      sum_en: '24x7 law enforcement, cyber safety desk, traffic regulation, and community policing across Balagarh Block.',
      sum_bn: 'বলাগড় ব্লকে ২৪ ঘণ্টা আইন-শৃঙ্খলা রক্ষা, সাইবার নিরাপত্তা ও জনসচেতনতা মূলক পুলিশি পরিষেবা।',
      body_en: '<p>Emergency Dial 100 / 112. Dedicated women helpdesk, senior citizen assistance cell, and river patrol units operate round the clock.</p>',
      body_bn: '<p>জরুরি প্রয়োজনে ডায়াল করুন ১০০ বা ১১২। মহিলা হেল্পডেস্ক ও প্রবীণ নাগরিক সহায়তা কেন্দ্র সর্বদা সক্রিয়।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Emergency: '100 / 112', 'Women Helpline': '1091', Jurisdiction: 'Balagarh CD Block' },
      status: 'published', featured: 1, order: 1, views: 940,
      tags: [tDevelopment], gallery: [mPanchayat],
    },
    // Public Representatives
    {
      section: 'public-representatives',
      cat: null,
      title_en: 'Balagarh Panchayat Samiti & Constituency Directory',
      title_bn: 'বলাগড় পঞ্চায়েত সমিতি ও জনপ্রতিনিধি পরিচিতি',
      slug: 'public-representatives-directory',
      sum_en: 'Updated public directory of elected representatives from Balagarh Assembly Constituency and Panchayat Samiti.',
      sum_bn: 'বলাগড় বিধানসভা কেন্দ্র ও পঞ্চায়েত সমিতির নির্বাচিত জনপ্রতিনিধিদের তালিকা ও যোগাযোগ তথ্য।',
      body_en: '<p>Includes Sabhapati, Sahakari Sabhapati, Karma Adhyakshas, and Gram Panchayat Pradhans serving the 13 Panchayats of Balagarh.</p>',
      body_bn: '<p>বলাগড় পঞ্চায়েত সমিতির সভাপতি, সহ-সভাপতি, কর্মাধ্যক্ষ এবং ১৩টি গ্রাম পঞ্চায়েতের প্রধানদের বিবরণ।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Constituency: 'Balagarh (SC)', 'Lok Sabha': 'Hooghly', 'Panchayat Samiti': 'Balagarh' },
      status: 'published', featured: 0, order: 1, views: 510,
      tags: [tPanchayat], gallery: [],
    },
    // Roads and Infrastructure
    {
      section: 'roads-infrastructure',
      cat: null,
      title_en: 'STKK Road Corridor, Rail Stations & Ferry Ghats',
      title_bn: 'এসটিকেকে রোড, রেল যোগাযোগ ও ফেরি ঘাট পরিকাঠামো',
      slug: 'roads-rail-ferry-infrastructure',
      sum_en: 'Bandel–Katwa railway stations (Balagarh, Jirat, Somra Bazar, Guptipara) and Hooghly river ferry connectivity.',
      sum_bn: 'ব্যান্ডেল-কাটোয়া রেলপথের স্টেশনসমূহ (বলাগড়, জিরাট, সোমরা বাজার, গুপ্তিপাড়া) এবং হুগলি নদীর ফেরি ঘাট পরিষেবা।',
      body_en: '<p>State Highway 6 (Saptagram–Tribeni–Kalna–Katwa Road) and electrified suburban rail connect Balagarh to Kolkata and Howrah in under 2 hours.</p>',
      body_bn: '<p>৬ নম্বর রাজ্য সড়ক (এসটিকেকে রোড) এবং বৈদ্যুতিক লোকাল ট্রেনের মাধ্যমে বলাগড় সরাসরি হাওড়া ও শিয়ালদহের সঙ্গে যুক্ত।</p>',
      cover: mRiver,
      video: null, doc: null, ext: null,
      meta: { Highway: 'SH-6 (STKK Road)', Railway: 'Eastern Railway (BAK)', 'Major Ghats': 'Balagarh, Guptipara, Somra' },
      status: 'published', featured: 0, order: 1, views: 670,
      tags: [tDevelopment], gallery: [mRiver],
    },
    // Agriculture
    {
      section: 'agriculture',
      cat: null,
      title_en: 'Fertile Farming & Traditional Wooden Boat Craft of Balagarh',
      title_bn: 'বলাগড়ের সমৃদ্ধ কৃষি ও ঐতিহ্যবাহী কাঠের নৌকা নির্মাণ শিল্প',
      slug: 'agriculture-and-boat-craft',
      sum_en: 'High-yield Aman/Boro paddy, potato cultivation, and GI-celebrated wooden country boat carpentry along the riverbanks.',
      sum_bn: 'উচ্চ ফলনশীল ধান, আলু ও সবজি চাষ এবং বলাগড়ের বিশ্বখ্যাত কাঠের নৌকা তৈরি কারিগরি।',
      body_en: '<p>Generations of master carpenters in Balagarh and Sripur craft sturdy sal and teak wooden boats that ply across Bengal\'s rivers.</p>',
      body_bn: '<p>বলাগড় ও শ্রীপুরের দক্ষ কারিগররা প্রজন্মের পর প্রজন্ম ধরে শাল ও সেগুন কাঠ দিয়ে ঐতিহ্যবাহী নৌকা তৈরি করে চলেছেন।</p>',
      cover: mRiver,
      video: null, doc: null, ext: null,
      meta: { 'Main Crops': 'Paddy, Potato, Jute, Mango', 'Signature Craft': 'Traditional Boat Building' },
      status: 'published', featured: 0, order: 1, views: 590,
      tags: [tHeritage, tDevelopment], gallery: [mRiver, mHeritage],
    },
    // Tourism
    {
      section: 'tourism',
      cat: null,
      title_en: 'Sabuj Dwip River Island Eco-Tourism Retreat',
      title_bn: 'সবুজ দ্বীপ: প্রকৃতি ও নদী পর্যটনের এক অনন্য ঠিকানা',
      slug: 'sabuj-dwip-tourism',
      sum_en: 'A verdant island at the confluence of the Behula and Hooghly rivers near Somra, ideal for winter picnics and birdwatching.',
      sum_bn: 'সোমরার কাছে বেহুলা ও হুগলি নদীর সঙ্গমস্থলে অবস্থিত সবুজ দ্বীপ শীতকালীন ভ্রমণ ও পিকনিকের অন্যতম আকর্ষণ।',
      body_en: '<p>Accessible by short boat rides from Somra and Sukharia ghats, Sabuj Dwip features dense casuarina groves, migratory birds, and tranquil river views.</p>',
      body_bn: '<p>সোমরা ও সুখরিয়া ঘাট থেকে নৌকাযোগে সবুজ দ্বীপে পৌঁছানো যায়। ঝাউবন, পরিযায়ী পাখি ও নদীর নির্মল বাতাস পর্যটকদের মুগ্ধ করে।</p>',
      cover: mRiver,
      video: null, doc: null, ext: null,
      meta: { 'Best Season': 'October – March', Access: 'Boat from Somra Ghat', Distance: '65 km from Kolkata' },
      status: 'published', featured: 1, order: 1, views: 1450,
      tags: [tTourism], gallery: [mRiver, mHeritage],
    },
    // Tourist Attractions
    {
      section: 'tourist-attractions',
      cat: null,
      title_en: 'Sukharia Ananda Bhairavi Temple Complex & 25-Pinnacle Shrine',
      title_bn: 'সুখরিয়া আনন্দ ভৈরবী মন্দির ও পঁচিশ চূড়া ঐতিহ্য',
      slug: 'sukharia-ananda-bhairavi-temple',
      sum_en: '19th-century Pancha-Vimsati Ratna (25-spired) terracotta temple overlooking the Hooghly River at Sukharia.',
      sum_bn: 'সুখরিয়ায় হুগলি নদীর তীরে অবস্থিত উনবিংশ শতাব্দীর ২৫ চূড়া বিশিষ্ট আনন্দ ভৈরবী মন্দির।',
      body_en: '<p>Built in 1813 by Bireswar Mustafi, the sprawling temple complex stands out for its rare 25-ratna architecture and serene ghat steps.</p>',
      body_bn: '<p>১৮১৩ সালে নির্মিত এই প্রাচীন মন্দির কমপ্লেক্সটি বিরল পঁচিশ-রত্ন স্থাপত্যশৈলীর জন্য ঐতিহাসিকদের কাছে অত্যন্ত গুরুত্বপূর্ণ।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { Built: '1813 CE', Style: '25-Ratna Terracotta', Location: 'Sukharia, Balagarh' },
      status: 'published', featured: 1, order: 1, views: 1080,
      tags: [tHeritage, tTourism], gallery: [mHeritage],
    },
    // Culture and Heritage
    {
      section: 'culture-heritage',
      cat: catHeritage,
      title_en: 'Guptipara Rath Yatra & Brindabanchandra Math Heritage',
      title_bn: 'গুপ্তিপাড়ার ঐতিহাসিক রথযাত্রা ও বৃন্দাবনচন্দ্র মঠ',
      slug: 'guptipara-rath-yatra-heritage',
      sum_en: 'Celebrating over 280 years of Bengal\'s iconic Chariot Festival and classic Atchala terracotta art in Guptipara.',
      sum_bn: '২৮০ বছরের বেশি প্রাচীন গুপ্তিপাড়ার রথযাত্রা উৎসব, ভান্ডার লুট এবং আটচালা টেরাকোটা শিল্পকলা।',
      body_en: '<p>Guptipara hosts Bengal\'s second-largest Rath Yatra, featuring a towering four-storey wooden chariot and the famous Bhandar Loot tradition.</p>',
      body_bn: '<p>গুপ্তিপাড়ার ঐতিহাসিক রথযাত্রা এবং ভান্ডার লুট উৎসব দেখতে প্রতি বছর লক্ষ লক্ষ ভক্ত ও পর্যটক সমবেত হন।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { Tradition: '280+ Years Old', Festival: 'Ashadha Shukla Dwitiya', Sweet: 'Guptipara Gupo Sandesh' },
      status: 'published', featured: 1, order: 1, views: 1520,
      tags: [tHeritage, tTourism], gallery: [mHeritage, mFestival],
    },
    // News and Announcements
    {
      section: 'news-announcements',
      cat: catNewsDev,
      title_en: 'Balagarh Block Development Review Announces New Road & Drinking Water Projects',
      title_bn: 'বলাগড় ব্লকে উন্নয়নমূলক সভা, একাধিক নতুন সড়ক ও পানীয় জল প্রকল্পের ঘোষণা',
      slug: 'balagarh-development-review-2025',
      sum_en: 'Block administration and Panchayat representatives finalized new rural road concretization and solar drinking water units across 13 GPs.',
      sum_bn: 'বলাগড় ব্লক প্রশাসন ও পঞ্চায়েত প্রতিনিধিদের সমন্বয় সভায় ১৩টি গ্রাম পঞ্চায়েতে নতুন ঢালাই রাস্তা ও পানীয় জল প্রকল্পের অনুমোদন।',
      body_en: '<p>In a joint development meeting at the Balagarh Block Office, priority was approved for river-embankment strengthening, solar street lighting, and upgraded school sanitation facilities.</p><p>Work orders for Phase 1 across Sripur-Balagarh, Jirat, and Guptipara will commence this month with transparent public tracking.</p>',
      body_bn: '<p>বলাগড় ব্লক উন্নয়ন সভায় প্রতিশ্রুতি ও উন্নয়নের নতুন অধ্যায় সূচিত হয়েছে। ১৩টি গ্রাম পঞ্চায়েতে গ্রামীণ সড়ক সংস্কার, সৌর বাতি এবং বিশুদ্ধ পানীয় জল প্রকল্পের কাজ দ্রুত শুরু হবে।</p><p>বিদ্যালয় ও স্বাস্থ্যকেন্দ্রগুলির পরিকাঠামো উন্নয়নেও বিশেষ বরাদ্দ ঘোষণা করা হয়েছে।</p>',
      cover: mFestival,
      video: null, doc: null, ext: null,
      meta: { Date: '12 January 2025', Author: 'Block Information Desk' },
      status: 'published', featured: 1, order: 1, views: 456,
      tags: [tDevelopment, tPanchayat], gallery: [mFestival, mPanchayat],
    },
    {
      section: 'news-announcements',
      cat: catNewsHealth,
      title_en: 'Large Public Turnout at Balagarh Rural Mega Health Camp',
      title_bn: 'বলাগড় গ্রামীণ স্বাস্থ্য শিবিরে সাধারণ মানুষের ব্যাপক ভিড় ও বিনামূল্যে চিকিৎসা',
      slug: 'balagarh-rural-health-camp-turnout',
      sum_en: 'Over 650 residents received free eye check-ups, maternal care consultations, and essential medicines at Jirat BPHC.',
      sum_bn: 'জিরাট গ্রামীণ হাসপাতালে আয়োজিত বিশেষ স্বাস্থ্য শিবিরে ৬৫০-এর বেশি মানুষ বিনামূল্যে চক্ষু পরীক্ষা ও চিকিৎসা পরিষেবা পান।',
      body_en: '<p>Specialist doctors from Hooghly District Hospital joined Balagarh BPHC staff to conduct diagnostic screening and distribute corrective spectacles.</p>',
      body_bn: '<p>হুগলি জেলা হাসপাতালের বিশেষজ্ঞ চিকিৎসকদের উপস্থিতিতে সাধারণ মানুষের স্বাস্থ্য পরীক্ষা ও বিনামূল্যে ওষুধ প্রদান করা হয়।</p>',
      cover: mHospital,
      video: null, doc: null, ext: null,
      meta: { Date: '11 January 2025', Beneficiaries: '650+' },
      status: 'published', featured: 1, order: 2, views: 342,
      tags: [tHealthcare], gallery: [mHospital],
    },
    {
      section: 'news-announcements',
      cat: null,
      title_en: 'Annual Inter-School Sports Meet Concludes Across Balagarh Schools',
      title_bn: 'বিভিন্ন স্কুলে বার্ষিক ক্রীড়া প্রতিযোগিতা ও পুরস্কার বিতরণী অনুষ্ঠান সম্পন্ন',
      slug: 'annual-inter-school-sports-meet',
      sum_en: 'Students from 32 primary and high schools competed in athletics, football, and traditional sports events.',
      sum_bn: 'বলাগড় ব্লকের ৩২টি বিদ্যালয়ের ছাত্রছাত্রীদের নিয়ে বার্ষিক ক্রীড়া প্রতিযোগিতা উৎসাহের সঙ্গে অনুষ্ঠিত হলো।',
      body_en: '<p>Winners of the block-level athletics championship will represent Balagarh at the Hooghly District Youth Meet next month.</p>',
      body_bn: '<p>ব্লক স্তরের ক্রীড়া প্রতিযোগিতায় বিজয়ীরা আগামী মাসে হুগলি জেলা ক্রীড়া প্রতিযোগিতায় অংশ নেবে।</p>',
      cover: mSchool,
      video: null, doc: null, ext: null,
      meta: { Date: '10 January 2025', Schools: '32 Participating' },
      status: 'published', featured: 1, order: 3, views: 289,
      tags: [tEducation], gallery: [mSchool],
    },
    {
      section: 'news-announcements',
      cat: null,
      title_en: 'Heritage Temple Festivals & Saraswati Puja Preparations Underway',
      title_bn: 'ঐতিহ্যবাহী মন্দিরে সরস্বতী পূজার ও গ্রামীণ মেলার প্রস্তুতি তুঙ্গে',
      slug: 'heritage-saraswati-puja-preparations',
      sum_en: 'Artisans and local clubs prepare traditional eco-friendly pandals across Balagarh and Guptipara.',
      sum_bn: 'বলাগড় ও গুপ্তিপাড়ার বিভিন্ন ক্লাব ও বিদ্যালয়ে পরিবেশবান্ধব সরস্বতী পূজার মণ্ডপ সজ্জার কাজ শুরু হয়েছে।',
      body_en: '<p>Cultural committees and police administration coordinated smooth crowd management and heritage illumination plans.</p>',
      body_bn: '<p>পুলিশ প্রশাসন ও পূজা কমিটিগুলির যৌথ উদ্যোগে শান্তিপূর্ণ উৎসব পালনের ব্যবস্থা নেওয়া হয়েছে।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { Date: '09 January 2025' },
      status: 'published', featured: 1, order: 4, views: 215,
      tags: [tHeritage], gallery: [mHeritage],
    },
    {
      section: 'news-announcements',
      cat: null,
      title_en: 'New Covered Market Sheds Inaugurated at Balagarh Bazar',
      title_bn: 'বলাগড় বাজারে নতুন আধুনিক মার্কেট শেড ও পানীয় জলের উদ্বোধন',
      slug: 'balagarh-bazar-new-market-shed',
      sum_en: 'Farmers and local traders welcome weather-proof market stalls and improved drainage.',
      sum_bn: 'কৃষক ও স্থানীয় ব্যবসায়ীদের সুবিধার্থে বলাগড় বাজারে নতুন ছাউনি ও নিকাশি ব্যবস্থার সূচনা।',
      body_en: '<p>The upgraded bazaar sheds ensure year-round protection for perishable agricultural produce and smoother pedestrian flow.</p>',
      body_bn: '<p>নতুন মার্কেট শেডের ফলে বর্ষা ও গ্রীষ্মে কৃষিপণ্য কেনাবেচা আরও সহজ ও স্বাস্থ্যকর হলো।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Date: '08 January 2025' },
      status: 'published', featured: 1, order: 5, views: 198,
      tags: [tDevelopment], gallery: [mPanchayat],
    },
    // Draft news example (should NOT appear publicly!)
    {
      section: 'news-announcements',
      cat: catNewsDev,
      title_en: 'Upcoming Monsoon Embankment Inspection Report (Internal Draft)',
      title_bn: 'আসন্ন বর্ষা মৌসুমের নদী বাঁধ পরিদর্শন প্রতিবেদন (খসড়া)',
      slug: 'monsoon-embankment-draft',
      sum_en: 'Draft engineering review awaiting BDO sign-off before public release.',
      sum_bn: 'জনসমক্ষে প্রকাশের আগে প্রশাসনিক অনুমোদনের অপেক্ষায় খসড়া প্রতিবেদন।',
      body_en: '<p>Internal draft note for upcoming irrigation department review.</p>',
      body_bn: '<p>সেচ দপ্তরের পর্যালোচনার জন্য প্রস্তুত খসড়া নোট।</p>',
      cover: mRiver,
      video: null, doc: null, ext: null,
      meta: { Note: 'Internal Review' },
      status: 'draft', featured: 0, order: 99, views: 0,
      tags: [tDevelopment], gallery: [],
    },
    // Notices and Circulars
    {
      section: 'notices-circulars',
      cat: catNoticeOfficial,
      title_en: 'Balagarh Block Mega Health Camp — 15 February',
      title_bn: 'বলাগড় ব্লকে স্বাস্থ্য শিবির – ১৫ই ফেব্রুয়ারি',
      slug: 'notice-health-camp-feb-15',
      sum_en: 'Free general medicine, eye screening, and Swasthya Sathi card verification camp at Balagarh Rural Hospital.',
      sum_bn: 'বলাগড় গ্রামীণ হাসপাতালে বিনামূল্যে স্বাস্থ্য পরীক্ষা ও স্বাস্থ্য সাথী সহায়তা শিবির।',
      body_en: '<p>Citizens are requested to bring Aadhaar / Swasthya Sathi documents from 9:30 AM onwards.</p>',
      body_bn: '<p>সকাল ৯:৩০ থেকে বিকাল ৪টা পর্যন্ত স্বাস্থ্য শিবির চলবে। প্রয়োজনীয় নথিপত্র সাথে আনুন।</p>',
      cover: mHospital,
      video: null, doc: null, ext: null,
      meta: { Badge: 'NEW', 'Circular No': 'BLG/HLTH/2025/04' },
      status: 'published', featured: 1, order: 1, views: 890,
      tags: [tHealthcare], gallery: [],
    },
    {
      section: 'notices-circulars',
      cat: catNoticeOfficial,
      title_en: 'Panchayat Department Notice — Gram Sabha Schedule',
      title_bn: 'পঞ্চায়েত দপ্তরের বিজ্ঞপ্তি – গ্রাম সভা সময়সূচি',
      slug: 'notice-gram-sabha-schedule',
      sum_en: 'Annual Gram Sabha meetings across all 13 Gram Panchayats to finalize village development priorities.',
      sum_bn: 'বলাগড়ের ১৩টি গ্রাম পঞ্চায়েতে বার্ষিক গ্রাম সভার সময়সূচি প্রকাশিত হয়েছে।',
      body_en: '<p>All voters and ward residents are invited to participate in Gram Sabha budget planning sessions.</p>',
      body_bn: '<p>সকল গ্রামবাসীকে গ্রাম সভায় উপস্থিত থেকে এলাকার উন্নয়নে মতামত দেওয়ার অনুরোধ জানানো হচ্ছে।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Badge: 'NEW', 'Circular No': 'BLG/GP/2025/11' },
      status: 'published', featured: 1, order: 2, views: 640,
      tags: [tPanchayat], gallery: [],
    },
    {
      section: 'notices-circulars',
      cat: catNoticeOfficial,
      title_en: 'School Admission Process Open (2025–26 Academic Session)',
      title_bn: 'স্কুলে ভর্তি প্রক্রিয়া শুরু (২০২৫-২৬ শিক্ষাবর্ষ)',
      slug: 'notice-school-admission-2025-26',
      sum_en: 'Admission forms for Classes V to IX and XI available at government-aided high schools across Balagarh.',
      sum_bn: 'বলাগড়ের সমস্ত সরকারি ও সরকার পোষিত বিদ্যালয়ে ২০২৫-২৬ শিক্ষাবর্ষে ভর্তির ফর্ম বিতরণ শুরু হয়েছে।',
      body_en: '<p>Parents may collect admission forms from respective school offices during working hours.</p>',
      body_bn: '<p>অভিভাবকগণ বিদ্যালয়ের অফিস চলাকালীন ভর্তির আবেদনপত্র সংগ্রহ করতে পারবেন।</p>',
      cover: mSchool,
      video: null, doc: null, ext: null,
      meta: { 'Circular No': 'BLG/EDU/2025/02' },
      status: 'published', featured: 1, order: 3, views: 530,
      tags: [tEducation], gallery: [],
    },
    {
      section: 'notices-circulars',
      cat: catNoticeOfficial,
      title_en: 'Swasthya Sathi Health Card Renewal & Update Guidelines',
      title_bn: 'স্বাস্থ্য কার্ড হালনাগাদ – নির্দেশিকা ও প্রয়োজনীয় নথি',
      slug: 'notice-health-card-update',
      sum_en: 'Procedure for adding new family members and updating ration/Aadhaar linkage at Block Helpdesk.',
      sum_bn: 'স্বাস্থ্য সাথী কার্ডে পরিবারের নতুন সদস্যের নাম নথিভুক্তি ও সংশোধনের নির্দেশিকা।',
      body_en: '<p>Visit the Block Swasthya Sathi Helpdesk at BDO Complex on Tuesdays and Thursdays with original documents.</p>',
      body_bn: '<p>প্রতি মঙ্গলবার ও বৃহস্পতিবার ব্লক অফিসের হেল্পডেস্কে এসে স্বাস্থ্য কার্ড সংশোধন করা যাবে।</p>',
      cover: mHospital,
      video: null, doc: null, ext: null,
      meta: { 'Circular No': 'BLG/SS/2025/08' },
      status: 'published', featured: 1, order: 4, views: 710,
      tags: [tHealthcare], gallery: [],
    },
    // Events and Programmes (CMS page sync)
    {
      section: 'events-programmes',
      cat: null,
      title_en: 'Balagarh Cultural & Heritage Programme Calendar',
      title_bn: 'বলাগড় সাংস্কৃতিক ও ঐতিহ্যবাহী অনুষ্ঠান সূচি',
      slug: 'balagarh-cultural-calendar',
      sum_en: 'Annual festivals, book fairs, boat races, and community welfare camps hosted across Balagarh Block.',
      sum_bn: 'বলাগড় ব্লকে আয়োজিত বাৎসরিক মেলা, বইমেলা, নৌকা বাইচ ও স্বাস্থ্য শিবিরের বিবরণ।',
      body_en: '<p>Browse live Upcoming, Ongoing, and Past events managed dynamically from the Events Management module.</p>',
      body_bn: '<p>আসন্ন, চলমান এবং পূর্ববর্তী সমস্ত অনুষ্ঠানের বিস্তারিত বিবরণ ইভেন্টস বিভাগে দেখুন।</p>',
      cover: mFestival,
      video: null, doc: null, ext: null,
      meta: { Frequency: 'Year-Round' },
      status: 'published', featured: 1, order: 1, views: 410,
      tags: [tHeritage], gallery: [mFestival],
    },
    // Photo Gallery
    {
      section: 'photo-gallery',
      cat: null,
      title_en: 'Golden Hour Along the Hooghly & Heritage Temples',
      title_bn: 'হুগলি নদীর তীর ও বলাগড়ের ঐতিহ্যবাহী মন্দিরের আলোকচিত্র',
      slug: 'gallery-hooghly-heritage',
      sum_en: 'A curated photographic collection showcasing terracotta temples, river ferries, and green villages of Balagarh.',
      sum_bn: 'বলাগড়ের টেরাকোটা মন্দির, নদী ঘাট ও সবুজ প্রকৃতির নির্বাচিত ফটো অ্যালবাম।',
      body_en: '<p>Captured across Sukharia, Guptipara, Somra, and Balagarh Ghat.</p>',
      body_bn: '<p>সুখরিয়া, গুপ্তিপাড়া, সোমরা ও বলাগড় ঘাট থেকে সংগৃহীত আলোকচিত্র।</p>',
      cover: mHeritage,
      video: null, doc: null, ext: null,
      meta: { Photos: '6', Photographer: 'Our Balagarh Media Team' },
      status: 'published', featured: 1, order: 1, views: 1240,
      tags: [tHeritage, tTourism], gallery: [mHeritage, mRiver, mFestival, mSchool, mHospital, mPanchayat],
    },
    // Video Gallery
    {
      section: 'video-gallery',
      cat: null,
      title_en: 'Boat Makers of Balagarh & Riverfront Documentary',
      title_bn: 'আমাদের বলাগড়: ঐতিহ্যবাহী নৌকা শিল্প ও নদী তীরের প্রামাণ্যচিত্র',
      slug: 'video-boat-makers-balagarh',
      sum_en: '5-minute documentary film highlighting traditional boat carpentry and scenic river life along Balagarh Ghat.',
      sum_bn: 'বলাগড় ঘাটের নৌকা তৈরির কারিগরদের জীবন ও নদীকেন্দ্রিক সংস্কৃতির প্রামাণ্য ভিডিও।',
      body_en: '<p>Watch how skilled craftsmen shape sal timber into traditional Bengali country boats using time-honored tools.</p>',
      body_bn: '<p>বলাগড়ের দক্ষ কারিগরদের হাতে তৈরি ঐতিহ্যবাহী কাঠের নৌকা নির্মাণের সম্পূর্ণ ভিডিও দেখুন।</p>',
      cover: mRiver,
      video: '/uploads/balagarh_river_journey_doc.webm',
      doc: null, ext: null,
      meta: { Duration: '05:32', Format: 'HD Documentary' },
      status: 'published', featured: 1, order: 1, views: 980,
      tags: [tHeritage], gallery: [mRiver],
    },
    // Important Links
    {
      section: 'important-links',
      cat: null,
      title_en: 'Hooghly District & West Bengal Government Citizen Portals',
      title_bn: 'হুগলি জেলা প্রশাসন ও পশ্চিমবঙ্গ সরকারের গুরুত্বপূর্ণ নাগরিক পোর্টাল',
      slug: 'hooghly-wb-govt-portals',
      sum_en: 'Verified official portals for Banglar Bhumi, Duare Sarkar, West Bengal e-District, and Hooghly District.',
      sum_bn: 'বাংলার ভূমি, দুয়ারে সরকার, ই-ডিস্ট্রিক্ট ও হুগলি জেলা প্রশাসনের সরকারি ওয়েবসাইট লিঙ্ক।',
      body_en: '<p>Quick access links for land records, caste/income certificates, scholarships, and district alerts.</p>',
      body_bn: '<p>জমির খতিয়ান, শংসাপত্র, বৃত্তি ও জেলা প্রশাসনের তথ্যের জন্য সরাসরি সরকারি লিঙ্ক।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: 'https://hooghly.nic.in',
      meta: { Category: 'Official Portals' },
      status: 'published', featured: 0, order: 1, views: 620,
      tags: [tDevelopment], gallery: [],
    },
    // Public Services
    {
      section: 'public-services',
      cat: null,
      title_en: 'Duare Sarkar & State Welfare Schemes Desk',
      title_bn: 'দুয়ারে সরকার ও রাজ্য সরকারের জনকল্যাণমূলক প্রকল্পসমূহ',
      slug: 'duare-sarkar-public-services',
      sum_en: 'Guidance for Lakshmir Bhandar, Swasthya Sathi, Kanyashree, Rupashree, Krishak Bandhu, and Student Credit Card.',
      sum_bn: 'লক্ষ্মীর ভাণ্ডার, স্বাস্থ্য সাথী, কন্যাশ্রী, রূপশ্রী, কৃষক বন্ধু এবং স্টুডেন্ট ক্রেডিট কার্ড প্রকল্পের আবেদন ও সহায়তা তথ্য।',
      body_en: '<p>Check eligibility criteria, required documents, and Gram Panchayat camp dates for all West Bengal public welfare schemes.</p>',
      body_bn: '<p>প্রতিটি প্রকল্পের যোগ্যতা, প্রয়োজনীয় নথি এবং গ্রাম পঞ্চায়েত স্তরের ক্যাম্পের তারিখ এখান থেকে জেনে নিন।</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Schemes: '12+ Active', Nodal: 'Balagarh BDO Office' },
      status: 'published', featured: 1, order: 1, views: 1580,
      tags: [tPanchayat, tDevelopment], gallery: [mPanchayat],
    },
    // Contact Information
    {
      section: 'contact-information',
      cat: null,
      title_en: 'Balagarh Block Helplines & Portal Editorial Desk',
      title_bn: 'বলাগড় ব্লক জরুরি হেল্পলাইন ও পোর্টাল যোগাযোগ কেন্দ্র',
      slug: 'balagarh-contact-helplines',
      sum_en: 'Reach Balagarh BDO Office, Police Station, Rural Hospital, Fire Station, and Our Balagarh portal administrators.',
      sum_bn: 'বলাগড় বিডিও অফিস, থানা, গ্রামীণ হাসপাতাল ও আমাদের বলাগড় পোর্টালের যোগাযোগ ঠিকানা ও ফোন নম্বর।',
      body_en: '<p>Address: Balagarh Block, Hooghly, West Bengal - 712501. Phone: +91 33-2636-XXXX. Email: info@ourbalagarh.in</p>',
      body_bn: '<p>ঠিকানা: বলাগড় ব্লক, হুগলি, পশ্চিমবঙ্গ - ৭১২৫০১। ফোন: +৯১ ৩৩-২৬৩৬-XXXX। ইমেইল: info@ourbalagarh.in</p>',
      cover: mPanchayat,
      video: null, doc: null, ext: null,
      meta: { Phone: '+91 33-2636-XXXX', Email: 'info@ourbalagarh.in', PIN: '712501' },
      status: 'published', featured: 0, order: 1, views: 740,
      tags: [tDevelopment], gallery: [],
    },
  ];

  for (const item of contentSeed) {
    const res = insertContent.run(
      item.section, item.cat, item.title_en, item.title_bn, item.slug,
      item.sum_en, item.sum_bn, item.body_en, item.body_bn,
      item.cover, item.video, item.doc, item.ext, JSON.stringify(item.meta),
      item.status, item.featured, item.order, item.views
    );
    const cid = Number(res.lastInsertRowid);
    for (const tid of item.tags) linkTag.run(cid, tid);
    item.gallery.forEach((mid, idx) => {
      linkGallery.run(cid, mid, item.title_en, item.title_bn, idx + 1);
    });
  }

  // 7. Seed Dedicated Events (Upcoming, Ongoing, Completed)
  const insertEvent = db.prepare(`
    INSERT INTO events (
      title_en, title_bn, short_desc_en, short_desc_bn, full_desc_en, full_desc_bn,
      start_datetime, end_datetime, venue, organizer, cover_media_id, video_url,
      registration_url, contact_details, event_status, is_featured, publication_status, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertEventMedia = db.prepare('INSERT INTO event_media (event_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');

  const eventsSeed = [
    {
      title_en: 'Balagarh Block Mega Health & Eye Camp',
      title_bn: 'বলাগড় ব্লক স্বাস্থ্য ও চক্ষু পরীক্ষা শিবির',
      short_en: 'Free specialist consultation, blood screening, and spectacle distribution at Balagarh Rural Hospital.',
      short_bn: 'বলাগড় গ্রামীণ হাসপাতালে বিনামূল্যে বিশেষজ্ঞ চিকিৎসা ও চক্ষু পরীক্ষা শিবির।',
      full_en: '<p>Organized jointly by Balagarh Block Health Administration and District Hospital specialists. Open to all residents across 13 Gram Panchayats.</p>',
      full_bn: '<p>বলাগড় ব্লক স্বাস্থ্য দপ্তর ও হুগলি জেলা হাসপাতালের যৌথ উদ্যোগে আয়োজিত বিশেষ স্বাস্থ্য শিবির।</p>',
      start: '2026-12-15T09:30',
      end: '2026-12-15T16:30',
      venue: 'Balagarh Rural Hospital, Jirat',
      organizer: 'Balagarh Block Health Department',
      cover: mHospital,
      video: null,
      reg: 'https://ourbalagarh.in/register/health-camp',
      contact: 'Dr. Moumita Sen (+91 33-2636-XXXX)',
      status: 'Upcoming',
      featured: 1,
      pub: 'published',
      gallery: [mHospital, mPanchayat],
    },
    {
      title_en: 'Panchayat Coordination & Rural Development Summit',
      title_bn: 'পঞ্চায়েত সমন্বয় ও গ্রামীণ উন্নয়ন সভা',
      short_en: 'Block-level review of MGNREGA, rural housing, and clean drinking water initiatives.',
      short_bn: 'পঞ্চায়েত প্রতিনিধিদের নিয়ে ব্লক উন্নয়ন ও পানীয় জল প্রকল্প পর্যালোচনা সভা।',
      full_en: '<p>All 13 Gram Panchayat Pradhans, secretaries, and block engineers will present quarterly progress reports.</p>',
      full_bn: '<p>১৩টি গ্রাম পঞ্চায়েতের প্রধান ও আধিকারিকদের উপস্থিতিতে ত্রৈমাসিক উন্নয়ন পর্যালোচনা।</p>',
      start: '2026-12-21T11:00',
      end: '2026-12-21T15:00',
      venue: 'Balagarh Block Office Auditorium',
      organizer: 'Balagarh Panchayat Samiti',
      cover: mPanchayat,
      video: null,
      reg: '',
      contact: 'BDO Office Desk (+91 33-2636-XXXX)',
      status: 'Upcoming',
      featured: 1,
      pub: 'published',
      gallery: [mPanchayat],
    },
    {
      title_en: 'Balagarh Annual Book Fair & Folk Culture Festival',
      title_bn: 'বলাগড় বার্ষিক বইমেলা ও পল্লী সংস্কৃতি উৎসব',
      short_en: 'Week-long celebration of Bengali literature, Baul folk music, terracotta crafts, and student competitions.',
      short_bn: 'বাংলা সাহিত্য, বাউল গান, হস্তশিল্প প্রদর্শনী ও ছাত্রছাত্রীদের সাংস্কৃতিক প্রতিযোগিতা।',
      full_en: '<p>Over 45 book stalls, evening folk concerts, local artisan showcases, and youth quiz contests at Balagarh High School Ground.</p>',
      full_bn: '<p>৪৫টিরও বেশি বইয়ের স্টল, লোকসংগীত সন্ধ্যা এবং স্থানীয় শিল্পীদের হস্তশিল্প প্রদর্শনী।</p>',
      start: '2026-11-15T10:00',
      end: '2026-11-22T20:30',
      venue: 'Balagarh High School Ground',
      organizer: 'Balagarh Cultural Committee',
      cover: mFestival,
      video: '/uploads/balagarh_river_boat_reel.webm',
      reg: 'https://ourbalagarh.in/events/book-fair',
      contact: 'Rituparna Basu (+91 98300-XXXXX)',
      status: 'Ongoing',
      featured: 1,
      pub: 'published',
      gallery: [mFestival, mSchool],
    },
    {
      title_en: 'Guptipara Heritage Boat Regatta & River Cleanliness Drive',
      title_bn: 'গুপ্তিপাড়া ঐতিহ্যবাহী নৌকা বাইচ ও নদী পরিচ্ছন্নতা অভিযান',
      short_en: 'Traditional wooden boat race along the Hooghly paired with community riverfront conservation.',
      short_bn: 'হুগলি নদীতে ঐতিহ্যবাহী নৌকা বাইচ প্রতিযোগিতা ও নদী ঘাট পরিচ্ছন্নতা কর্মসূচি।',
      full_en: '<p>Completed successfully with 18 local boat crews and over 2,000 spectators cheering along Guptipara and Balagarh Ghats.</p>',
      full_bn: '<p>১৮টি নৌকা দলের অংশগ্রহণে ও দুই হাজারেরও বেশি দর্শকের উপস্থিতিতে সাফল্যের সাথে সম্পন্ন হয়েছে।</p>',
      start: '2026-10-12T08:00',
      end: '2026-10-12T17:00',
      venue: 'Balagarh & Guptipara Ferry Ghat',
      organizer: 'Our Balagarh Boatmen Association',
      cover: mRiver,
      video: null,
      reg: '',
      contact: 'info@ourbalagarh.in',
      status: 'Completed',
      featured: 0,
      pub: 'published',
      gallery: [mRiver, mHeritage],
    },
  ];

  for (const ev of eventsSeed) {
    const res = insertEvent.run(
      ev.title_en, ev.title_bn, ev.short_en, ev.short_bn, ev.full_en, ev.full_bn,
      ev.start, ev.end, ev.venue, ev.organizer, ev.cover, ev.video,
      ev.reg, ev.contact, ev.status, ev.featured, ev.pub
    );
    const eid = Number(res.lastInsertRowid);
    ev.gallery.forEach((mid, idx) => insertEventMedia.run(eid, mid, ev.title_en, ev.title_bn, idx + 1));
  }

  // 8. Seed Homepage Banners
  const insertBanner = db.prepare(`
    INSERT INTO homepage_banners (
      title_en, title_bn, subtitle_en, subtitle_bn, button_text_en, button_text_bn, button_link, media_id, sort_order, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  insertBanner.run(
    'Balagarh – A Land of Heritage, Culture and Development',
    'ঐতিহ্য, সংস্কৃতি ও উন্নয়নের বলাগড়',
    'Discover historic terracotta temples, riverfront boat craft, schools, and civic services across Balagarh Block.',
    'প্রাচীন টেরাকোটা মন্দির, ঐতিহ্যবাহী নৌকা শিল্প, শিক্ষা ও নাগরিক পরিষেবার সমন্বিত ডিজিটাল পোর্টাল।',
    'Explore Heritage',
    'বিস্তারিত দেখুন',
    '/section/culture-heritage',
    mHeritage,
    1
  );
  insertBanner.run(
    'Sabuj Dwip & Hooghly Riverfront Eco-Tourism',
    'সবুজ দ্বীপ ও হুগলি নদীর অপরূপ প্রকৃতি',
    'Experience serene rural Bengal landscapes, ferry ghats, and seasonal tourism across Balagarh.',
    'সোমরা ও বলাগড় ঘাটের মনোরম প্রাকৃতিক সৌন্দর্য ও নদী পর্যটনের সম্পূর্ণ তথ্য।',
    'Plan Your Visit',
    'পর্যটন তথ্য দেখুন',
    '/section/tourism',
    mRiver,
    2
  );
  insertBanner.run(
    'Balagarh Cultural Fair & Community Programmes',
    'বলাগড় পল্লী সংস্কৃতি উৎসব ও জনকল্যাণ কর্মসূচি',
    'Stay updated with block book fairs, health camps, Panchayat meetings, and educational events.',
    'বলাগড়ের বইমেলা, স্বাস্থ্য শিবির ও গ্রাম পঞ্চায়েতের সমস্ত অনুষ্ঠানের লাইভ তথ্য।',
    'View Events',
    'সকল ইভেন্ট দেখুন',
    '/events',
    mFestival,
    3
  );

  // 9. Seed Homepage Sections Order & Visibility
  const insertHpSec = db.prepare('INSERT INTO homepage_sections (section_key, title_en, title_bn, is_visible, sort_order, config_json) VALUES (?, ?, ?, 1, ?, ?)');
  const hpSections = [
    { key: 'hero_and_notices', en: 'Hero Banner & Important Notices', bn: 'হিরো ব্যানার ও গুরুত্বপূর্ণ ঘোষণা', order: 1 },
    { key: 'category_shortcuts', en: 'Quick Category Shortcuts', bn: 'দ্রুত বিভাগ শর্টকাট', order: 2 },
    { key: 'news_and_events', en: 'Latest News & Upcoming Events', bn: 'সর্বশেষ খবর ও আসন্ন অনুষ্ঠান', order: 3 },
    { key: 'about_and_glance', en: 'About Balagarh, Block at a Glance & Quick Links', bn: 'বলাগড় পরিচিতি, এক নজরে ব্লক ও দ্রুত লিঙ্ক', order: 4 },
    { key: 'explore_grid', en: 'Explore Balagarh Directory Grid', bn: 'আমাদের বলাগড়ের তথ্যভাণ্ডার', order: 5 },
    { key: 'media_galleries', en: 'Photo Gallery, Video Gallery & Live Broadcast', bn: 'ছবি গ্যালারি, ভিডিও গ্যালারি ও সরাসরি সম্প্রচার', order: 6 },
  ];
  hpSections.forEach((s) => insertHpSec.run(s.key, s.en, s.bn, s.order, '{}'));

  // 10. Seed Homepage Quick Cards (Category Shortcuts, Block at a Glance, Quick Links, Schemes)
  const insertCard = db.prepare(`
    INSERT INTO homepage_quick_cards (card_type, label_en, label_bn, value_text, target_section, url, icon, color_hex, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // 8 Category Shortcuts matching Attachment 6
  const shortcuts = [
    { en: 'Panchayat', bn: 'পঞ্চায়েত', sec: 'gram-panchayats', icon: 'Landmark', color: '#15803D' },
    { en: 'Schools', bn: 'স্কুল', sec: 'schools', icon: 'GraduationCap', color: '#1D4ED8' },
    { en: 'Colleges', bn: 'কলেজ', sec: 'colleges', icon: 'Building2', color: '#3730A3' },
    { en: 'Hospitals', bn: 'হাসপাতাল', sec: 'hospitals', icon: 'HeartPulse', color: '#DC2626' },
    { en: 'Police Station', bn: 'পুলিশ স্টেশন', sec: 'police-stations', icon: 'ShieldCheck', color: '#0369A1' },
    { en: 'Tourism', bn: 'পর্যটন', sec: 'tourism', icon: 'Mountain', color: '#0F766E' },
    { en: 'Heritage', bn: 'ঐতিহ্য', sec: 'culture-heritage', icon: 'Sparkles', color: '#B45309' },
    { en: 'Events', bn: 'ইভেন্ট', sec: 'events-programmes', icon: 'CalendarDays', color: '#BE123C' },
  ];
  shortcuts.forEach((s, i) => insertCard.run('shortcut', s.en, s.bn, '', s.sec, s.sec === 'events-programmes' ? '/events' : `/section/${s.sec}`, s.icon, s.color, i + 1));

  // Block at a Glance metrics matching Attachment 6
  const glance = [
    { en: 'Total Panchayats', bn: 'মোট পঞ্চায়েত', val: '13', icon: 'Landmark', color: '#16A34A' },
    { en: 'Total Villages', bn: 'মোট গ্রাম', val: '134', icon: 'Home', color: '#65A30D' },
    { en: 'Total Schools', bn: 'মোট স্কুল', val: '185+', icon: 'GraduationCap', color: '#1D4ED8' },
    { en: 'Total Colleges', bn: 'মোট কলেজ', val: '4', icon: 'Building2', color: '#7C3AED' },
    { en: 'Hospitals / Health Centres', bn: 'হাসপাতাল / স্বাস্থ্যকেন্দ্র', val: '6', icon: 'HeartPulse', color: '#DC2626' },
    { en: 'Population (Approx.)', bn: 'জনসংখ্যা (প্রায়)', val: '2.48 Lakh+', icon: 'Users', color: '#0F766E' },
  ];
  glance.forEach((g, i) => insertCard.run('glance', g.en, g.bn, g.val, 'block-information', '/section/block-information', g.icon, g.color, i + 1));

  // Quick Links matching Attachment 6
  const qLinks = [
    { en: 'Balagarh Block Office', bn: 'বলাগড় ব্লক অফিস', sec: 'government-offices', url: '/section/government-offices' },
    { en: 'Hooghly District Admin', bn: 'হুগলি জেলা প্রশাসন', sec: 'important-links', url: '/section/important-links' },
    { en: 'Govt. of West Bengal', bn: 'পশ্চিমবঙ্গ সরকার', sec: 'important-links', url: '/section/important-links' },
    { en: 'Government Schemes & Benefits', bn: 'সরকারি প্রকল্প ও সুবিধা', sec: 'public-services', url: '/section/public-services' },
    { en: 'Important Downloads & Forms', bn: 'গুরুত্বপূর্ণ ডাউনলোড', sec: 'notices-circulars', url: '/section/notices-circulars' },
    { en: 'Emergency Services & Helplines', bn: 'জরুরি পরিষেবা (Emergency)', sec: 'contact-information', url: '/section/contact-information' },
  ];
  qLinks.forEach((l, i) => insertCard.run('quick_link', l.en, l.bn, '', l.sec, l.url, 'Link', '#15803D', i + 1));

  // Government Scheme Spotlight
  insertCard.run('scheme', 'Duare Sarkar & Welfare Schemes', 'দুয়ারে সরকার ও জনকল্যাণ প্রকল্প', 'Lakshmir Bhandar, Swasthya Sathi, Kanyashree & more', 'public-services', '/section/public-services', 'HandHelping', '#0369A1', 1);

  // 11. Seed Initial Activity Logs
  const insertLog = db.prepare('INSERT INTO activity_logs (user_id, user_name, role_name, action, module, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertLog.run(1, 'Subhajit Chatterjee', 'Super Administrator', 'publish', 'events', 1, 'Published upcoming event: Balagarh Block Mega Health & Eye Camp');
  insertLog.run(2, 'Anirban Mukherjee', 'Administrator', 'update', 'news-announcements', 19, 'Updated news article: Balagarh Block Development Review');
  insertLog.run(3, 'Tapas Mondal', 'Panchayat Editor', 'publish', 'notices-circulars', 25, 'Published official circular: Panchayat Department Notice — Gram Sabha');
  insertLog.run(9, 'Soumen Halder', 'Gallery Editor', 'upload', 'media', 1, 'Uploaded heritage and riverfront photographs to Media Library');
}
