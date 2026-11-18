import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db, initDatabase, promoteScheduledContent, hashPassword, uploadsDir, bundledUploadsDir } from './db.ts';
import type { RolePermissions, UserRecord } from '../types/cms.ts';

initDatabase();
promoteScheduledContent();

export const app = express();
const TOKEN_SECRET = process.env.CMS_TOKEN_SECRET || 'our-balagarh-cms-hmac-secret-2026';
const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

app.use(express.json({ limit: '4mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-CMS-Persistence', isServerlessRuntime ? 'ephemeral' : 'persistent');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    persistent: !isServerlessRuntime,
    mode: isServerlessRuntime ? 'ephemeral' : 'node-sqlite',
  });
});

// Static serve uploaded media safely outside source tree
const uploadsRoot = uploadsDir;
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
if (bundledUploadsDir !== uploadsDir && fs.existsSync(bundledUploadsDir)) {
  app.use('/uploads', express.static(bundledUploadsDir, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
}

// Also serve generated src/assets/images in production & dev cleanly
const srcAssetsRoot = path.resolve(process.cwd(), 'src/assets');
if (fs.existsSync(srcAssetsRoot)) {
  app.use('/src/assets', express.static(srcAssetsRoot));
}

// ============================================================================
// SECURITY HELPERS: Tokens, CSRF, URL validation, File Upload Security
// ============================================================================

function createCsrfToken(): string {
  const payload = Buffer.from(JSON.stringify({ nonce: crypto.randomBytes(12).toString('hex'), iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(`csrf:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(`csrf:${payload}`).digest('base64url');
  if (sig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.iat !== 'number') return false;
    return Date.now() - data.iat < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function signAuthToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAuthToken(token: string): { uid: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.uid === 'number') return { uid: data.uid };
    return null;
  } catch {
    return null;
  }
}

function isValidExternalUrl(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') return true;
  if (value.startsWith('/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

function getUserById(uid: number): UserRecord | null {
  const row = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.assigned_panchayat,
           u.assigned_institution, u.avatar_url, u.phone, u.designation, u.bio, u.address,
           u.is_active, u.created_at,
           r.slug as role_slug, r.name_en as role_name_en, r.name_bn as role_name_bn,
           r.accent_color, r.permissions_json
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ? AND u.is_active = 1
  `).get(uid) as (Omit<UserRecord, 'permissions'> & { permissions_json: string }) | undefined;

  if (!row) return null;
  return {
    ...row,
    permissions: JSON.parse(row.permissions_json) as RolePermissions,
  };
}

interface AuthedRequest extends Request {
  cmsUser?: UserRecord;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const verified = token ? verifyAuthToken(token) : null;
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = getUserById(verified.uid);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or inactive user' });
  }
  req.cmsUser = user;
  next();
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers['x-csrf-token'];
  if (typeof token !== 'string' || !verifyCsrfToken(token)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh session.' });
  }
  next();
}

function hasPermission(user: UserRecord, moduleSlug: string, action: 'view' | 'create' | 'edit' | 'publish' | 'delete'): boolean {
  const { modules, actions } = user.permissions;
  if (!actions.includes(action)) return false;
  if (modules.includes('*')) return true;
  return modules.includes(moduleSlug);
}

function logActivity(user: UserRecord, action: string, moduleName: string, entityId: number | null, details: string) {
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, role_name, action, module, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.full_name, user.role_name_en, action, moduleName, entityId, details);
}

function saveRevision(entityType: 'content' | 'event', entityId: number, snapshot: unknown, changedBy: string, note: string) {
  db.prepare(`
    INSERT INTO content_revisions (entity_type, entity_id, snapshot_json, changed_by, change_note)
    VALUES (?, ?, ?, ?, ?)
  `).run(entityType, entityId, JSON.stringify(snapshot), changedBy, note);
}

// Strict Multer File Upload Config
const ALLOWED_MIME_EXT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ALLOWED_MIME_EXT[file.mimetype];
    if (!allowedExts || !allowedExts.includes(ext)) {
      return cb(new Error(`Unsupported or unsafe file type (${file.mimetype} / ${ext}). Executable scripts are blocked.`));
    }
    cb(null, true);
  },
});

// ============================================================================
// HYDRATION HELPERS
// ============================================================================

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

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

app.get('/api/auth/csrf', (_req, res) => {
  res.json({ csrfToken: createCsrfToken() });
});

app.get('/api/auth/demo-users', (_req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.assigned_panchayat, u.assigned_institution,
           r.slug as role_slug, r.name_en as role_name_en, r.name_bn as role_name_bn, r.accent_color, r.description as role_description
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.is_active = 1
    ORDER BY u.id ASC
  `).all();
  res.json({ users });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, demoSwitch } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const row = db.prepare(`
    SELECT u.id, u.password_hash, u.is_active
    FROM users u
    WHERE u.username = ?
  `).get(String(username).trim()) as { id: number; password_hash: string; is_active: number } | undefined;

  if (!row || !row.is_active) {
    return res.status(401).json({ error: 'Invalid credentials or inactive account' });
  }

  if (!demoSwitch) {
    const incomingHash = hashPassword(String(password || ''));
    if (incomingHash !== row.password_hash) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
  }

  const user = getUserById(row.id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const token = signAuthToken(user.id);
  const csrfToken = createCsrfToken();
  logActivity(user, 'login', 'auth', user.id, `${user.full_name} signed in as ${user.role_name_en}`);

  res.json({ token, csrfToken, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.cmsUser, csrfToken: createCsrfToken() });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const identifier = String(req.body?.identifier || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Enter your username or email address' });
  }
  const row = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.is_active, r.name_en as role_name_en
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)) AND u.is_active = 1
  `).get(identifier, identifier) as
    | { id: number; username: string; full_name: string; email: string; is_active: number; role_name_en: string }
    | undefined;

  if (!row) {
    return res.status(404).json({ error: 'No active account found with that username or email' });
  }

  const resetCode = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 15 * 60 * 1000;
  db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(row.id);
  db.prepare('INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES (?, ?, ?)').run(
    row.id,
    resetCode,
    expiresAt
  );

  db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, role_name, action, module, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.full_name, row.role_name_en, 'forgot_password', 'auth', row.id, `Password recovery requested for ${row.username}`);

  const emailParts = row.email.split('@');
  const maskedEmail =
    emailParts.length === 2
      ? `${emailParts[0].slice(0, 2)}***@${emailParts[1]}`
      : row.email;

  res.json({
    ok: true,
    username: row.username,
    full_name: row.full_name,
    maskedEmail,
    recoveryCode: resetCode,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { identifier, resetCode, newPassword } = req.body || {};
  const idStr = String(identifier || '').trim();
  const codeStr = String(resetCode || '').trim();
  const nextPass = String(newPassword || '');

  if (!idStr || !codeStr || !nextPass) {
    return res.status(400).json({ error: 'Username/email, verification code, and new password are required' });
  }
  if (nextPass.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const row = db.prepare(`
    SELECT u.id, u.username, u.full_name, r.name_en as role_name_en
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)) AND u.is_active = 1
  `).get(idStr, idStr) as { id: number; username: string; full_name: string; role_name_en: string } | undefined;

  if (!row) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const resetRow = db.prepare(`
    SELECT id, expires_at FROM password_resets
    WHERE user_id = ? AND reset_code = ? AND used = 0
    ORDER BY id DESC LIMIT 1
  `).get(row.id, codeStr) as { id: number; expires_at: number } | undefined;

  if (!resetRow || resetRow.expires_at < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  db.prepare('UPDATE users SET password_hash = ?, visible_password = ? WHERE id = ?').run(
    hashPassword(nextPass),
    nextPass,
    row.id
  );
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, role_name, action, module, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.full_name, row.role_name_en, 'reset_password', 'auth', row.id, `${row.full_name} reset password via recovery code`);

  res.json({ ok: true, username: row.username });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const { currentPassword, newPassword } = req.body || {};
  const curr = String(currentPassword || '');
  const nextPass = String(newPassword || '');

  if (!curr || !nextPass) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (nextPass.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string } | undefined;
  if (!row || hashPassword(curr) !== row.password_hash) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE users SET password_hash = ?, visible_password = ? WHERE id = ?').run(
    hashPassword(nextPass),
    nextPass,
    user.id
  );
  logActivity(user, 'change_password', 'auth', user.id, `${user.full_name} changed own account password`);
  res.json({ ok: true });
});

app.get('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.cmsUser });
});

app.put('/api/auth/profile', requireAuth, requireCsrf, (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const b = req.body || {};
  const fullName = String(b.full_name ?? user.full_name).trim();
  const email = String(b.email ?? user.email).trim();
  if (!fullName || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid full name and email address are required' });
  }
  const phone = b.phone !== undefined ? String(b.phone).trim() : String(user.phone || '');
  const designation = b.designation !== undefined ? String(b.designation).trim() : String(user.designation || '');
  const address = b.address !== undefined ? String(b.address).trim() : String(user.address || '');
  const bio = b.bio !== undefined ? String(b.bio).trim() : String(user.bio || '');
  const assignedPanchayat =
    b.assigned_panchayat !== undefined
      ? String(b.assigned_panchayat || '').trim() || null
      : user.assigned_panchayat;
  const assignedInstitution =
    b.assigned_institution !== undefined
      ? String(b.assigned_institution || '').trim() || null
      : user.assigned_institution;

  let avatarUrl = user.avatar_url;
  if (b.avatar_url !== undefined) {
    const rawAvatar = String(b.avatar_url || '').trim();
    if (!rawAvatar) {
      avatarUrl = null;
    } else if (
      rawAvatar.startsWith('/uploads/') ||
      rawAvatar.startsWith('data:image/') ||
      isValidExternalUrl(rawAvatar)
    ) {
      avatarUrl = rawAvatar;
    } else {
      return res.status(400).json({ error: 'Invalid profile photo URL' });
    }
  }

  db.prepare(`
    UPDATE users SET
      full_name = ?,
      email = ?,
      phone = ?,
      designation = ?,
      address = ?,
      bio = ?,
      assigned_panchayat = ?,
      assigned_institution = ?,
      avatar_url = ?
    WHERE id = ?
  `).run(fullName, email, phone, designation, address, bio, assignedPanchayat, assignedInstitution, avatarUrl, user.id);

  const updated = getUserById(user.id);
  logActivity(updated || user, 'update_profile', 'auth', user.id, `${fullName} updated personal profile details`);
  res.json({ user: updated });
});

app.post('/api/auth/profile/avatar', requireAuth, requireCsrf, (req: AuthedRequest, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Profile photo upload failed' });
    }
    const file = req.file;
    if (!file || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Please select a valid image file (JPG, PNG, WEBP, or GIF)' });
    }
    const user = req.cmsUser!;
    const avatarUrl = `/uploads/${file.filename}`;
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, user.id);
    const updated = getUserById(user.id);
    logActivity(updated || user, 'update_avatar', 'auth', user.id, `${user.full_name} updated profile photo`);
    res.json({ avatar_url: avatarUrl, user: updated });
  });
});

// ============================================================================
// PUBLIC WEBSITE ENDPOINTS (Strictly Published Content Only!)
// ============================================================================

app.get('/api/public/bootstrap', (_req, res) => {
  promoteScheduledContent();

  const banners = db.prepare(`
    SELECT b.*, m.url as image_url
    FROM homepage_banners b
    LEFT JOIN media m ON m.id = b.media_id
    WHERE b.is_active = 1
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

  const sections = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM contents c WHERE c.section_slug = s.slug AND c.status = 'published' AND c.deleted_at IS NULL) as published_count
    FROM content_sections s
    WHERE s.is_active = 1
    ORDER BY s.sort_order ASC
  `).all();

  const latestNews = db.prepare(`
    SELECT c.*, m.url as cover_url, m.alt_text as cover_alt
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = 'news-announcements' AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC, c.id DESC
    LIMIT 6
  `).all().map(hydrateContentRow);

  const notices = db.prepare(`
    SELECT c.*, m.url as cover_url
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = 'notices-circulars' AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC, c.id DESC
    LIMIT 6
  `).all().map(hydrateContentRow);

  const upcomingEvents = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE e.publication_status = 'published' AND e.deleted_at IS NULL AND e.event_status IN ('Upcoming', 'Ongoing')
    ORDER BY e.is_featured DESC, e.start_datetime ASC
    LIMIT 4
  `).all().map(hydrateEventRow);

  const aboutSummary = db.prepare(`
    SELECT c.*, m.url as cover_url
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = 'about-balagarh' AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC
    LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  const photoGallery = db.prepare(`
    SELECT c.*, m.url as cover_url
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = 'photo-gallery' AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC
    LIMIT 2
  `).all().map(hydrateContentRow);

  const videoGallery = db.prepare(`
    SELECT c.*, m.url as cover_url
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = 'video-gallery' AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.is_featured DESC, c.sort_order ASC
    LIMIT 2
  `).all().map(hydrateContentRow);

  const allPublishedMedia = db.prepare(`
    SELECT * FROM media ORDER BY id DESC LIMIT 12
  `).all();

  const activePopup = db.prepare(`
    SELECT p.*, m.url as image_url
    FROM homepage_popups p
    LEFT JOIN media m ON m.id = p.media_id
    WHERE p.is_active = 1
    ORDER BY p.id DESC
    LIMIT 1
  `).get();

  res.json({
    banners,
    homepageSections,
    quickCards,
    sections,
    latestNews,
    notices,
    upcomingEvents,
    aboutSummary: aboutSummary ? hydrateContentRow(aboutSummary) : null,
    photoGallery,
    videoGallery,
    recentMedia: allPublishedMedia,
    popup: activePopup || null,
  });
});

app.get('/api/public/sections/:slug', (req, res) => {
  promoteScheduledContent();
  const { slug } = req.params;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;

  const section = db.prepare('SELECT * FROM content_sections WHERE slug = ? AND is_active = 1').get(slug);
  if (!section) return res.status(404).json({ error: 'Section not found' });

  const categories = db.prepare('SELECT * FROM content_categories WHERE section_slug = ? ORDER BY name_en ASC').all(slug);

  let whereSql = `c.section_slug = ? AND c.status = 'published' AND c.deleted_at IS NULL`;
  const params: (string | number)[] = [slug];

  if (categoryId) {
    whereSql += ' AND c.category_id = ?';
    params.push(categoryId);
  }
  if (search) {
    whereSql += ' AND (c.title_en LIKE ? OR c.title_bn LIKE ? OR c.summary_en LIKE ? OR c.summary_bn LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const total = (db.prepare(`SELECT COUNT(*) as total FROM contents c WHERE ${whereSql}`).get(...params) as { total: number }).total;
  const items = db.prepare(`
    SELECT c.*, m.url as cover_url, m.alt_text as cover_alt,
           cat.name_en as category_name_en, cat.name_bn as category_name_bn
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    LEFT JOIN content_categories cat ON cat.id = c.category_id
    WHERE ${whereSql}
    ORDER BY c.is_featured DESC, c.sort_order ASC, c.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset).map(hydrateContentRow);

  res.json({
    section,
    categories,
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

app.get('/api/public/contents/:id', (req, res) => {
  promoteScheduledContent();
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT c.*, m.url as cover_url, m.alt_text as cover_alt,
           s.name_en as section_name_en, s.name_bn as section_name_bn,
           cat.name_en as category_name_en, cat.name_bn as category_name_bn,
           u.full_name as author_name
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    LEFT JOIN content_sections s ON s.slug = c.section_slug
    LEFT JOIN content_categories cat ON cat.id = c.category_id
    LEFT JOIN users u ON u.id = c.author_id
    WHERE c.id = ? AND c.status = 'published' AND c.deleted_at IS NULL
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return res.status(404).json({ error: 'Content not found or unpublished' });

  db.prepare('UPDATE contents SET views_count = views_count + 1 WHERE id = ?').run(id);
  const related = db.prepare(`
    SELECT c.id, c.title_en, c.title_bn, c.summary_en, c.summary_bn, c.section_slug, m.url as cover_url
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.section_slug = ? AND c.id != ? AND c.status = 'published' AND c.deleted_at IS NULL
    ORDER BY c.sort_order ASC, c.id DESC
    LIMIT 4
  `).all(String(row.section_slug), id);

  res.json({ item: hydrateContentRow(row), related });
});

app.get('/api/public/events', (req, res) => {
  promoteScheduledContent();
  const status = String(req.query.status || 'all');
  let where = `e.publication_status = 'published' AND e.deleted_at IS NULL`;
  const params: string[] = [];
  if (status === 'Upcoming' || status === 'Ongoing' || status === 'Completed' || status === 'Cancelled') {
    where += ` AND e.event_status = ?`;
    params.push(status);
  }
  const events = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE ${where}
    ORDER BY e.is_featured DESC, e.start_datetime ASC
  `).all(...params).map(hydrateEventRow);

  res.json({ events });
});

app.get('/api/public/events/:id', (req, res) => {
  promoteScheduledContent();
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE e.id = ? AND e.publication_status = 'published' AND e.deleted_at IS NULL
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return res.status(404).json({ error: 'Event not found or unpublished' });
  res.json({ event: hydrateEventRow(row) });
});

app.get('/api/public/search', (req, res) => {
  promoteScheduledContent();
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ contents: [], events: [] });
  const like = `%${q}%`;

  const contents = db.prepare(`
    SELECT c.id, c.section_slug, c.title_en, c.title_bn, c.summary_en, c.summary_bn, c.created_at,
           s.name_en as section_name_en, s.name_bn as section_name_bn, m.url as cover_url
    FROM contents c
    LEFT JOIN content_sections s ON s.slug = c.section_slug
    LEFT JOIN media m ON m.id = c.cover_media_id
    WHERE c.status = 'published' AND c.deleted_at IS NULL
      AND (c.title_en LIKE ? OR c.title_bn LIKE ? OR c.summary_en LIKE ? OR c.summary_bn LIKE ? OR c.body_en LIKE ? OR c.body_bn LIKE ?)
    ORDER BY c.is_featured DESC, c.id DESC
    LIMIT 24
  `).all(like, like, like, like, like, like);

  const events = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE e.publication_status = 'published' AND e.deleted_at IS NULL
      AND (e.title_en LIKE ? OR e.title_bn LIKE ? OR e.short_desc_en LIKE ? OR e.venue LIKE ?)
    ORDER BY e.start_datetime DESC
    LIMIT 12
  `).all(like, like, like, like);

  res.json({ contents, events });
});

// ============================================================================
// ADMIN CMS API (Auth + CSRF + Module-Level RBAC Protected)
// ============================================================================

app.use('/api/admin', requireAuth, requireCsrf);

app.get('/api/admin/dashboard', (req: AuthedRequest, res) => {
  promoteScheduledContent();
  const isSuperAdmin = req.cmsUser?.role_slug === 'super_admin';
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status = 'unpublished' THEN 1 ELSE 0 END) as unpublished
    FROM contents WHERE deleted_at IS NULL
  `).get() as Record<string, number>;

  const totalEvents = (db.prepare('SELECT COUNT(*) as c FROM events WHERE deleted_at IS NULL').get() as { c: number }).c;
  const totalMedia = (db.prepare('SELECT COUNT(*) as c FROM media').get() as { c: number }).c;
  const totalUsers = isSuperAdmin
    ? (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active = 1').get() as { c: number }).c
    : 0;

  const sectionRows = db.prepare(`
    SELECT section_slug, COUNT(*) as count
    FROM contents WHERE deleted_at IS NULL
    GROUP BY section_slug
  `).all() as Array<{ section_slug: string; count: number }>;

  const sectionCounts: Record<string, number> = {};
  for (const r of sectionRows) sectionCounts[r.section_slug] = r.count;

  const recentActivities = db.prepare(`
    SELECT * FROM activity_logs ORDER BY id DESC LIMIT 12
  `).all();

  const rolesSummary = isSuperAdmin
    ? db.prepare(`
        SELECT r.slug, r.name_en, r.name_bn, r.accent_color, COUNT(u.id) as user_count
        FROM roles r
        LEFT JOIN users u ON u.role_id = r.id AND u.is_active = 1
        GROUP BY r.id
        ORDER BY r.id ASC
      `).all()
    : [];

  res.json({
    totalContents: totals.total || 0,
    publishedContents: totals.published || 0,
    draftContents: totals.draft || 0,
    scheduledContents: totals.scheduled || 0,
    unpublishedContents: totals.unpublished || 0,
    totalEvents,
    totalMedia,
    totalUsers,
    sectionCounts,
    recentActivities,
    rolesSummary,
  });
});

app.get('/api/admin/sections', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const allSections = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM contents c WHERE c.section_slug = s.slug AND c.deleted_at IS NULL) as total_count,
      (SELECT COUNT(*) FROM contents c WHERE c.section_slug = s.slug AND c.status = 'published' AND c.deleted_at IS NULL) as published_count
    FROM content_sections s
    ORDER BY s.sort_order ASC
  `).all() as Array<Record<string, unknown>>;

  const accessible = allSections.filter((s) =>
    user.permissions.modules.includes('*') || user.permissions.modules.includes(String(s.slug))
  );
  res.json({ sections: accessible, allSections });
});

app.get('/api/admin/contents', (req: AuthedRequest, res) => {
  promoteScheduledContent();
  const user = req.cmsUser!;
  const section = req.query.section ? String(req.query.section) : '';
  const status = req.query.status ? String(req.query.status) : '';
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
  const tagId = req.query.tag_id ? Number(req.query.tag_id) : null;
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  if (section && !hasPermission(user, section, 'view')) {
    return res.status(403).json({ error: `Permission denied for module: ${section}` });
  }

  let whereSql = `c.deleted_at IS NULL`;
  const params: (string | number)[] = [];

  if (!user.permissions.modules.includes('*')) {
    const allowedSections = user.permissions.modules;
    if (allowedSections.length === 0) {
      return res.json({ items: [], pagination: { page, limit, total: 0, totalPages: 1 } });
    }
    const placeholders = allowedSections.map(() => '?').join(',');
    whereSql += ` AND c.section_slug IN (${placeholders})`;
    params.push(...allowedSections);
  }

  if (section) {
    whereSql += ` AND c.section_slug = ?`;
    params.push(section);
  }
  if (status && status !== 'all') {
    whereSql += ` AND c.status = ?`;
    params.push(status);
  }
  if (categoryId) {
    whereSql += ` AND c.category_id = ?`;
    params.push(categoryId);
  }
  if (tagId) {
    whereSql += ` AND EXISTS (SELECT 1 FROM content_tag_relations ctr WHERE ctr.content_id = c.id AND ctr.tag_id = ?)`;
    params.push(tagId);
  }
  if (search) {
    whereSql += ` AND (c.title_en LIKE ? OR c.title_bn LIKE ? OR c.summary_en LIKE ? OR c.summary_bn LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const total = (db.prepare(`SELECT COUNT(*) as total FROM contents c WHERE ${whereSql}`).get(...params) as { total: number }).total;
  const rows = db.prepare(`
    SELECT c.*, m.url as cover_url, m.alt_text as cover_alt,
           s.name_en as section_name_en, s.name_bn as section_name_bn,
           cat.name_en as category_name_en, cat.name_bn as category_name_bn,
           u.full_name as author_name
    FROM contents c
    LEFT JOIN media m ON m.id = c.cover_media_id
    LEFT JOIN content_sections s ON s.slug = c.section_slug
    LEFT JOIN content_categories cat ON cat.id = c.category_id
    LEFT JOIN users u ON u.id = c.author_id
    WHERE ${whereSql}
    ORDER BY c.sort_order ASC, c.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    items: rows.map(hydrateContentRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

app.post('/api/admin/contents', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const body = req.body || {};
  const sectionSlug = String(body.section_slug || '').trim();
  const desiredStatus = String(body.status || 'draft');

  if (!sectionSlug) return res.status(400).json({ error: 'section_slug is required' });
  if (!hasPermission(user, sectionSlug, 'create')) {
    return res.status(403).json({ error: `You do not have create permission for ${sectionSlug}` });
  }
  if (desiredStatus === 'published' && !hasPermission(user, sectionSlug, 'publish')) {
    return res.status(403).json({ error: `You do not have publish permission for ${sectionSlug}` });
  }
  if (!body.title_en || !body.title_bn) {
    return res.status(400).json({ error: 'Both English and Bengali titles are required' });
  }
  if (!isValidExternalUrl(body.video_url) || !isValidExternalUrl(body.external_url) || !isValidExternalUrl(body.document_url)) {
    return res.status(400).json({ error: 'Invalid video, document, or external URL (must start with http://, https://, or /)' });
  }

  const slug = body.slug ? slugify(String(body.slug)) : slugify(String(body.title_en));
  const result = db.prepare(`
    INSERT INTO contents (
      section_slug, category_id, title_en, title_bn, slug,
      summary_en, summary_bn, body_en, body_bn,
      cover_media_id, video_url, document_url, external_url, metadata_json,
      status, scheduled_at, is_featured, sort_order, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sectionSlug,
    body.category_id || null,
    String(body.title_en).trim(),
    String(body.title_bn).trim(),
    slug,
    String(body.summary_en || ''),
    String(body.summary_bn || ''),
    String(body.body_en || ''),
    String(body.body_bn || ''),
    body.cover_media_id || null,
    body.video_url || null,
    body.document_url || null,
    body.external_url || null,
    JSON.stringify(body.metadata || {}),
    desiredStatus,
    body.scheduled_at || null,
    body.is_featured ? 1 : 0,
    Number(body.sort_order || 0),
    user.id
  );

  const contentId = Number(result.lastInsertRowid);

  if (Array.isArray(body.tag_ids)) {
    const insTag = db.prepare('INSERT OR IGNORE INTO content_tag_relations (content_id, tag_id) VALUES (?, ?)');
    for (const tid of body.tag_ids) insTag.run(contentId, Number(tid));
  }

  if (Array.isArray(body.gallery)) {
    const insMed = db.prepare('INSERT INTO content_media (content_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');
    body.gallery.forEach((g: { media_id: number; caption_en?: string; caption_bn?: string }, idx: number) => {
      insMed.run(contentId, Number(g.media_id), String(g.caption_en || ''), String(g.caption_bn || ''), idx + 1);
    });
  }

  const created = db.prepare('SELECT * FROM contents WHERE id = ?').get(contentId) as Record<string, unknown>;
  saveRevision('content', contentId, created, user.full_name, 'Initial creation');
  logActivity(user, desiredStatus === 'published' ? 'publish' : 'create', sectionSlug, contentId, `${desiredStatus === 'published' ? 'Published' : 'Created'} "${body.title_en}"`);

  res.status(201).json({ item: hydrateContentRow(created) });
});

app.put('/api/admin/contents/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM contents WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Content not found' });

  const body = req.body || {};
  const sectionSlug = String(body.section_slug || existing.section_slug);
  if (!hasPermission(user, sectionSlug, 'edit')) {
    return res.status(403).json({ error: `Permission denied to edit ${sectionSlug}` });
  }
  const desiredStatus = String(body.status || existing.status);
  if (desiredStatus !== existing.status && (desiredStatus === 'published' || desiredStatus === 'unpublished') && !hasPermission(user, sectionSlug, 'publish')) {
    return res.status(403).json({ error: `Permission denied to publish/unpublish in ${sectionSlug}` });
  }
  if (!isValidExternalUrl(body.video_url) || !isValidExternalUrl(body.external_url) || !isValidExternalUrl(body.document_url)) {
    return res.status(400).json({ error: 'Invalid external or video URL' });
  }

  saveRevision('content', id, existing, user.full_name, String(body.change_note || 'Content updated'));

  db.prepare(`
    UPDATE contents SET
      section_slug = ?, category_id = ?, title_en = ?, title_bn = ?,
      summary_en = ?, summary_bn = ?, body_en = ?, body_bn = ?,
      cover_media_id = ?, video_url = ?, document_url = ?, external_url = ?,
      metadata_json = ?, status = ?, scheduled_at = ?, is_featured = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    sectionSlug,
    body.category_id !== undefined ? (body.category_id ? Number(body.category_id) : null) : (existing.category_id as number | null),
    String(body.title_en ?? existing.title_en),
    String(body.title_bn ?? existing.title_bn),
    String(body.summary_en ?? existing.summary_en),
    String(body.summary_bn ?? existing.summary_bn),
    String(body.body_en ?? existing.body_en),
    String(body.body_bn ?? existing.body_bn),
    body.cover_media_id !== undefined ? (body.cover_media_id ? Number(body.cover_media_id) : null) : (existing.cover_media_id as number | null),
    body.video_url !== undefined ? (body.video_url ? String(body.video_url) : null) : (existing.video_url as string | null),
    body.document_url !== undefined ? (body.document_url ? String(body.document_url) : null) : (existing.document_url as string | null),
    body.external_url !== undefined ? (body.external_url ? String(body.external_url) : null) : (existing.external_url as string | null),
    body.metadata !== undefined ? JSON.stringify(body.metadata) : String(existing.metadata_json),
    desiredStatus,
    body.scheduled_at !== undefined ? (body.scheduled_at ? String(body.scheduled_at) : null) : (existing.scheduled_at as string | null),
    body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : Number(existing.is_featured),
    body.sort_order !== undefined ? Number(body.sort_order) : Number(existing.sort_order),
    id
  );

  if (Array.isArray(body.tag_ids)) {
    db.prepare('DELETE FROM content_tag_relations WHERE content_id = ?').run(id);
    const insTag = db.prepare('INSERT OR IGNORE INTO content_tag_relations (content_id, tag_id) VALUES (?, ?)');
    for (const tid of body.tag_ids) insTag.run(id, Number(tid));
  }

  if (Array.isArray(body.gallery)) {
    db.prepare('DELETE FROM content_media WHERE content_id = ?').run(id);
    const insMed = db.prepare('INSERT INTO content_media (content_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');
    body.gallery.forEach((g: { media_id: number; caption_en?: string; caption_bn?: string }, idx: number) => {
      insMed.run(id, Number(g.media_id), String(g.caption_en || ''), String(g.caption_bn || ''), idx + 1);
    });
  }

  const updated = db.prepare(`
    SELECT c.*, m.url as cover_url FROM contents c LEFT JOIN media m ON m.id = c.cover_media_id WHERE c.id = ?
  `).get(id) as Record<string, unknown>;

  logActivity(user, 'update', sectionSlug, id, `Updated "${updated.title_en}" (${desiredStatus})`);
  res.json({ item: hydrateContentRow(updated) });
});

app.patch('/api/admin/contents/:id/status', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const id = Number(req.params.id);
  const { status, scheduled_at, is_featured } = req.body || {};
  const existing = db.prepare('SELECT * FROM contents WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Content not found' });

  const sectionSlug = String(existing.section_slug);
  if (status && !hasPermission(user, sectionSlug, 'publish')) {
    return res.status(403).json({ error: `Permission denied to change publication status in ${sectionSlug}` });
  }
  if (is_featured !== undefined && !hasPermission(user, sectionSlug, 'edit')) {
    return res.status(403).json({ error: 'Edit permission required' });
  }

  db.prepare(`
    UPDATE contents SET
      status = COALESCE(?, status),
      scheduled_at = CASE WHEN ? IS NOT NULL THEN ? ELSE scheduled_at END,
      is_featured = COALESCE(?, is_featured),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status || null, scheduled_at ?? null, scheduled_at ?? null, is_featured !== undefined ? (is_featured ? 1 : 0) : null, id);

  logActivity(user, status || 'feature', sectionSlug, id, `Changed "${existing.title_en}" status=${status || existing.status}`);
  const updated = db.prepare('SELECT c.*, m.url as cover_url FROM contents c LEFT JOIN media m ON m.id = c.cover_media_id WHERE c.id = ?').get(id) as Record<string, unknown>;
  res.json({ item: hydrateContentRow(updated) });
});

app.post('/api/admin/contents/reorder', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const { orderedIds, section_slug } = req.body || {};
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
  if (section_slug && !hasPermission(user, String(section_slug), 'edit')) {
    return res.status(403).json({ error: 'Edit permission required to reorder' });
  }
  const stmt = db.prepare('UPDATE contents SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?');
  orderedIds.forEach((cid, idx) => stmt.run(idx + 1, Number(cid)));
  logActivity(user, 'reorder', String(section_slug || 'contents'), null, `Reordered ${orderedIds.length} content items`);
  res.json({ ok: true });
});

app.delete('/api/admin/contents/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM contents WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Content not found' });

  const sectionSlug = String(existing.section_slug);
  if (!hasPermission(user, sectionSlug, 'delete')) {
    return res.status(403).json({ error: `Delete permission denied for ${sectionSlug}` });
  }

  db.prepare(`UPDATE contents SET deleted_at = datetime('now'), status = 'unpublished' WHERE id = ?`).run(id);
  logActivity(user, 'delete', sectionSlug, id, `Soft-deleted "${existing.title_en}"`);
  res.json({ ok: true });
});

app.get('/api/admin/contents/:id/revisions', (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const revisions = db.prepare(`
    SELECT * FROM content_revisions WHERE entity_type = 'content' AND entity_id = ? ORDER BY id DESC LIMIT 20
  `).all(id);
  res.json({ revisions });
});

// ============================================================================
// EVENTS MANAGEMENT MODULE
// ============================================================================

app.get('/api/admin/events', (req: AuthedRequest, res) => {
  promoteScheduledContent();
  const user = req.cmsUser!;
  if (!hasPermission(user, 'events', 'view') && !hasPermission(user, 'events-programmes', 'view')) {
    return res.status(403).json({ error: 'Permission denied for Events Management' });
  }
  const status = String(req.query.status || 'all');
  const search = String(req.query.search || '').trim();
  let where = `e.deleted_at IS NULL`;
  const params: string[] = [];
  if (status !== 'all') {
    where += ` AND e.event_status = ?`;
    params.push(status);
  }
  if (search) {
    where += ` AND (e.title_en LIKE ? OR e.title_bn LIKE ? OR e.venue LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const events = db.prepare(`
    SELECT e.*, m.url as cover_url
    FROM events e
    LEFT JOIN media m ON m.id = e.cover_media_id
    WHERE ${where}
    ORDER BY e.start_datetime DESC
  `).all(...params).map(hydrateEventRow);

  res.json({ events });
});

app.post('/api/admin/events', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'events', 'create')) {
    return res.status(403).json({ error: 'Create permission required for Events' });
  }
  const b = req.body || {};
  if (!b.title_en || !b.title_bn || !b.start_datetime || !b.venue) {
    return res.status(400).json({ error: 'English & Bengali titles, start date/time, and venue are required' });
  }
  if (!isValidExternalUrl(b.video_url) || !isValidExternalUrl(b.registration_url)) {
    return res.status(400).json({ error: 'Invalid video or registration URL' });
  }
  const pubStatus = String(b.publication_status || 'draft');
  if (pubStatus === 'published' && !hasPermission(user, 'events', 'publish')) {
    return res.status(403).json({ error: 'Publish permission required to publish events' });
  }

  const result = db.prepare(`
    INSERT INTO events (
      title_en, title_bn, short_desc_en, short_desc_bn, full_desc_en, full_desc_bn,
      start_datetime, end_datetime, venue, organizer, cover_media_id, video_url,
      registration_url, contact_details, event_status, is_featured, publication_status, scheduled_at, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(b.title_en).trim(),
    String(b.title_bn).trim(),
    String(b.short_desc_en || ''),
    String(b.short_desc_bn || ''),
    String(b.full_desc_en || ''),
    String(b.full_desc_bn || ''),
    String(b.start_datetime),
    String(b.end_datetime || b.start_datetime),
    String(b.venue),
    String(b.organizer || ''),
    b.cover_media_id || null,
    b.video_url || null,
    b.registration_url || null,
    b.contact_details || null,
    String(b.event_status || 'Upcoming'),
    b.is_featured ? 1 : 0,
    pubStatus,
    b.scheduled_at || null,
    user.id
  );

  const eventId = Number(result.lastInsertRowid);
  if (Array.isArray(b.gallery)) {
    const ins = db.prepare('INSERT INTO event_media (event_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');
    b.gallery.forEach((g: { media_id: number; caption_en?: string; caption_bn?: string }, idx: number) => {
      ins.run(eventId, Number(g.media_id), String(g.caption_en || ''), String(g.caption_bn || ''), idx + 1);
    });
  }

  const created = db.prepare('SELECT e.*, m.url as cover_url FROM events e LEFT JOIN media m ON m.id = e.cover_media_id WHERE e.id = ?').get(eventId) as Record<string, unknown>;
  logActivity(user, 'create', 'events', eventId, `Created event "${b.title_en}" (${pubStatus})`);
  res.status(201).json({ event: hydrateEventRow(created) });
});

app.put('/api/admin/events/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'events', 'edit')) {
    return res.status(403).json({ error: 'Edit permission required for Events' });
  }
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  const b = req.body || {};
  if (!isValidExternalUrl(b.video_url) || !isValidExternalUrl(b.registration_url)) {
    return res.status(400).json({ error: 'Invalid video or registration URL' });
  }
  const pubStatus = String(b.publication_status || existing.publication_status);
  if (pubStatus !== existing.publication_status && !hasPermission(user, 'events', 'publish')) {
    return res.status(403).json({ error: 'Publish permission required' });
  }

  db.prepare(`
    UPDATE events SET
      title_en = ?, title_bn = ?, short_desc_en = ?, short_desc_bn = ?,
      full_desc_en = ?, full_desc_bn = ?, start_datetime = ?, end_datetime = ?,
      venue = ?, organizer = ?, cover_media_id = ?, video_url = ?,
      registration_url = ?, contact_details = ?, event_status = ?, is_featured = ?,
      publication_status = ?, scheduled_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(b.title_en ?? existing.title_en),
    String(b.title_bn ?? existing.title_bn),
    String(b.short_desc_en ?? existing.short_desc_en),
    String(b.short_desc_bn ?? existing.short_desc_bn),
    String(b.full_desc_en ?? existing.full_desc_en),
    String(b.full_desc_bn ?? existing.full_desc_bn),
    String(b.start_datetime ?? existing.start_datetime),
    String(b.end_datetime ?? existing.end_datetime),
    String(b.venue ?? existing.venue),
    String(b.organizer ?? existing.organizer),
    b.cover_media_id !== undefined ? (b.cover_media_id ? Number(b.cover_media_id) : null) : (existing.cover_media_id as number | null),
    b.video_url !== undefined ? (b.video_url ? String(b.video_url) : null) : (existing.video_url as string | null),
    b.registration_url !== undefined ? (b.registration_url ? String(b.registration_url) : null) : (existing.registration_url as string | null),
    b.contact_details !== undefined ? (b.contact_details ? String(b.contact_details) : null) : (existing.contact_details as string | null),
    String(b.event_status ?? existing.event_status),
    b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : Number(existing.is_featured),
    pubStatus,
    b.scheduled_at !== undefined ? (b.scheduled_at ? String(b.scheduled_at) : null) : (existing.scheduled_at as string | null),
    id
  );

  if (Array.isArray(b.gallery)) {
    db.prepare('DELETE FROM event_media WHERE event_id = ?').run(id);
    const ins = db.prepare('INSERT INTO event_media (event_id, media_id, caption_en, caption_bn, sort_order) VALUES (?, ?, ?, ?, ?)');
    b.gallery.forEach((g: { media_id: number; caption_en?: string; caption_bn?: string }, idx: number) => {
      ins.run(id, Number(g.media_id), String(g.caption_en || ''), String(g.caption_bn || ''), idx + 1);
    });
  }

  const updated = db.prepare('SELECT e.*, m.url as cover_url FROM events e LEFT JOIN media m ON m.id = e.cover_media_id WHERE e.id = ?').get(id) as Record<string, unknown>;
  logActivity(user, 'update', 'events', id, `Updated event "${updated.title_en}"`);
  res.json({ event: hydrateEventRow(updated) });
});

app.delete('/api/admin/events/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'events', 'delete')) {
    return res.status(403).json({ error: 'Delete permission required for Events' });
  }
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  db.prepare(`UPDATE events SET deleted_at = datetime('now'), publication_status = 'unpublished' WHERE id = ?`).run(id);
  logActivity(user, 'delete', 'events', id, `Deleted event "${existing.title_en}"`);
  res.json({ ok: true });
});

// ============================================================================
// CENTRAL MEDIA LIBRARY
// ============================================================================

app.get('/api/admin/media', (req: AuthedRequest, res) => {
  const mediaType = String(req.query.media_type || 'all');
  const folder = String(req.query.folder || 'all');
  const search = String(req.query.search || '').trim();

  let where = '1=1';
  const params: string[] = [];
  if (mediaType !== 'all') {
    where += ' AND m.media_type = ?';
    params.push(mediaType);
  }
  if (folder !== 'all') {
    where += ' AND m.folder = ?';
    params.push(folder);
  }
  if (search) {
    where += ' AND (m.filename LIKE ? OR m.original_name LIKE ? OR m.caption_en LIKE ? OR m.caption_bn LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const items = db.prepare(`
    SELECT m.*,
      (
        (SELECT COUNT(*) FROM contents c WHERE c.cover_media_id = m.id AND c.deleted_at IS NULL) +
        (SELECT COUNT(*) FROM content_media cm JOIN contents c2 ON c2.id = cm.content_id WHERE cm.media_id = m.id AND c2.deleted_at IS NULL) +
        (SELECT COUNT(*) FROM events e WHERE e.cover_media_id = m.id AND e.deleted_at IS NULL) +
        (SELECT COUNT(*) FROM event_media em JOIN events e2 ON e2.id = em.event_id WHERE em.media_id = m.id AND e2.deleted_at IS NULL) +
        (SELECT COUNT(*) FROM homepage_banners b WHERE b.media_id = m.id) +
        (SELECT COUNT(*) FROM homepage_popups p WHERE p.media_id = m.id)
      ) as usage_count
    FROM media m
    WHERE ${where}
    ORDER BY m.id DESC
  `).all(...params);

  res.json({ media: items });
});

app.post('/api/admin/media/upload', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'media', 'create')) {
    return res.status(403).json({ error: 'Upload permission denied' });
  }
  upload.array('files', 12)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'File upload rejected' });
    }
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const folder = String(req.body.folder || 'general');
    const captionEn = String(req.body.caption_en || '');
    const captionBn = String(req.body.caption_bn || '');
    const altText = String(req.body.alt_text || '');

    const ins = db.prepare(`
      INSERT INTO media (filename, original_name, url, mime_type, media_type, folder, file_size, caption_en, caption_bn, alt_text, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const created = files.map((f) => {
      const mType = f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'document';
      const url = `/uploads/${f.filename}`;
      const r = ins.run(
        f.filename,
        f.originalname,
        url,
        f.mimetype,
        mType,
        folder,
        f.size,
        captionEn || f.originalname,
        captionBn,
        altText || f.originalname,
        user.full_name
      );
      return db.prepare('SELECT *, 0 as usage_count FROM media WHERE id = ?').get(Number(r.lastInsertRowid));
    });

    logActivity(user, 'upload', 'media', null, `Uploaded ${files.length} file(s) to folder "${folder}"`);
    res.status(201).json({ uploaded: created });
  });
});

app.post('/api/admin/media/import-url', async (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'media', 'create')) {
    return res.status(403).json({ error: 'Upload permission denied' });
  }
  const { url: rawUrl, folder = 'general', caption_en = '', caption_bn = '', alt_text = '' } = req.body || {};
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Valid image or video web URL is required' });
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http:// and https:// URLs are supported' });
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return res.status(400).json({ error: 'Private or loopback network URLs are not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OurBalagarhPortal/1.0 (https://ourbalagarh.in; info@ourbalagarh.in)',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.status(400).json({ error: `Remote server returned HTTP ${resp.status}` });
    }
    const contentType = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/ogg': '.ogv',
      'video/quicktime': '.mov',
    };
    const extFromPath = path.extname(parsed.pathname).toLowerCase();
    const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogv', '.mov']);
    const ext = mimeToExt[contentType] || (allowedExts.has(extFromPath) ? extFromPath : '');

    if (!ext) {
      return res.status(400).json({ error: `Unsupported remote media type (${contentType || 'unknown'}). Use JPG, PNG, WebP, GIF, MP4, or WebM.` });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) return res.status(400).json({ error: 'Downloaded file is empty' });
    if (buf.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Remote file exceeds 25 MB limit' });
    }

    const baseName = path.basename(parsed.pathname, path.extname(parsed.pathname))
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48) || 'web-media';
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${baseName}${ext}`;
    fs.writeFileSync(path.join(uploadsRoot, filename), buf);

    const isVideo = ['.mp4', '.webm', '.ogv', '.mov'].includes(ext) || contentType.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'image';
    const mimeType = contentType || (isVideo ? 'video/mp4' : 'image/jpeg');
    const localUrl = `/uploads/${filename}`;
    const origName = decodeURIComponent(path.basename(parsed.pathname) || filename).slice(0, 120) || filename;

    const r = db.prepare(`
      INSERT INTO media (filename, original_name, url, mime_type, media_type, folder, file_size, caption_en, caption_bn, alt_text, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      filename,
      origName,
      localUrl,
      mimeType,
      mediaType,
      String(folder || 'general'),
      buf.length,
      String(caption_en || origName),
      String(caption_bn || ''),
      String(alt_text || origName),
      user.full_name
    );

    const created = db.prepare('SELECT *, 0 as usage_count FROM media WHERE id = ?').get(Number(r.lastInsertRowid));
    logActivity(user, 'upload', 'media', Number(r.lastInsertRowid), `Downloaded web ${mediaType} "${origName}" into "${folder}"`);
    res.status(201).json({ media: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to download remote file' });
  }
});

app.post('/api/admin/media/:id/replace', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'media', 'edit')) {
    return res.status(403).json({ error: 'Permission denied to replace media' });
  }
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Media record not found' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Replacement file required' });

    const mType = f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'document';
    const url = `/uploads/${f.filename}`;

    db.prepare(`
      UPDATE media SET filename = ?, original_name = ?, url = ?, mime_type = ?, media_type = ?, file_size = ?
      WHERE id = ?
    `).run(f.filename, f.originalname, url, f.mimetype, mType, f.size, id);

    logActivity(user, 'replace', 'media', id, `Replaced media #${id} with ${f.originalname}`);
    const updated = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    res.json({ media: updated });
  });
});

app.put('/api/admin/media/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'media', 'edit')) {
    return res.status(403).json({ error: 'Permission denied to edit media' });
  }
  const id = Number(req.params.id);
  const { caption_en, caption_bn, alt_text, folder } = req.body || {};
  db.prepare(`
    UPDATE media SET
      caption_en = COALESCE(?, caption_en),
      caption_bn = COALESCE(?, caption_bn),
      alt_text = COALESCE(?, alt_text),
      folder = COALESCE(?, folder)
    WHERE id = ?
  `).run(caption_en ?? null, caption_bn ?? null, alt_text ?? null, folder ?? null, id);

  logActivity(user, 'update', 'media', id, `Updated captions/metadata for media #${id}`);
  res.json({ media: db.prepare('SELECT * FROM media WHERE id = ?').get(id) });
});

app.delete('/api/admin/media/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'media', 'delete')) {
    return res.status(403).json({ error: 'Delete permission required for Media Library' });
  }
  const id = Number(req.params.id);
  const force = req.query.force === 'true';

  const contentRefs = db.prepare(`SELECT id, title_en FROM contents WHERE cover_media_id = ? AND deleted_at IS NULL`).all(id) as Array<{ id: number; title_en: string }>;
  const galleryRefs = db.prepare(`SELECT c.id, c.title_en FROM content_media cm JOIN contents c ON c.id = cm.content_id WHERE cm.media_id = ? AND c.deleted_at IS NULL`).all(id) as Array<{ id: number; title_en: string }>;
  const eventRefs = db.prepare(`SELECT id, title_en FROM events WHERE cover_media_id = ? AND deleted_at IS NULL`).all(id) as Array<{ id: number; title_en: string }>;
  const bannerRefs = db.prepare(`SELECT id, title_en FROM homepage_banners WHERE media_id = ?`).all(id) as Array<{ id: number; title_en: string }>;
  const popupRefs = db.prepare(`SELECT id, title_en FROM homepage_popups WHERE media_id = ?`).all(id) as Array<{ id: number; title_en: string }>;

  const totalRefs = contentRefs.length + galleryRefs.length + eventRefs.length + bannerRefs.length + popupRefs.length;
  if (totalRefs > 0 && !force) {
    return res.status(409).json({
      error: 'Media is actively used in published or draft sections. Confirm unlink & delete to proceed safely.',
      usage: {
        contents: contentRefs,
        galleries: galleryRefs,
        events: eventRefs,
        banners: bannerRefs,
        popups: popupRefs,
        total: totalRefs,
      },
    });
  }

  db.prepare('UPDATE contents SET cover_media_id = NULL WHERE cover_media_id = ?').run(id);
  db.prepare('DELETE FROM content_media WHERE media_id = ?').run(id);
  db.prepare('UPDATE events SET cover_media_id = NULL WHERE cover_media_id = ?').run(id);
  db.prepare('DELETE FROM event_media WHERE media_id = ?').run(id);
  db.prepare('UPDATE homepage_banners SET media_id = NULL WHERE media_id = ?').run(id);
  db.prepare('UPDATE homepage_popups SET media_id = NULL WHERE media_id = ?').run(id);
  db.prepare('DELETE FROM media WHERE id = ?').run(id);

  logActivity(user, 'delete', 'media', id, `Deleted media #${id} (force=${force})`);
  res.json({ ok: true });
});

// ============================================================================
// DYNAMIC HOMEPAGE MANAGEMENT
// ============================================================================

app.get('/api/admin/homepage', (_req: AuthedRequest, res) => {
  const banners = db.prepare(`
    SELECT b.*, m.url as image_url FROM homepage_banners b LEFT JOIN media m ON m.id = b.media_id ORDER BY b.sort_order ASC, b.id ASC
  `).all();
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC, id ASC').all().map((s: Record<string, unknown>) => ({
    ...s,
    config: JSON.parse(String(s.config_json || '{}')),
  }));
  const cards = db.prepare('SELECT * FROM homepage_quick_cards ORDER BY card_type ASC, sort_order ASC, id ASC').all();
  const popups = db.prepare(`
    SELECT p.*, m.url as image_url FROM homepage_popups p LEFT JOIN media m ON m.id = p.media_id ORDER BY p.id DESC
  `).all();
  res.json({ banners, sections, cards, popups });
});

app.post('/api/admin/homepage/banners', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'create')) return res.status(403).json({ error: 'Homepage permission required' });
  const b = req.body || {};
  if (!b.title_en || !b.title_bn) return res.status(400).json({ error: 'English and Bengali titles required' });

  const r = db.prepare(`
    INSERT INTO homepage_banners (title_en, title_bn, subtitle_en, subtitle_bn, button_text_en, button_text_bn, button_link, media_id, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.title_en, b.title_bn, b.subtitle_en || '', b.subtitle_bn || '',
    b.button_text_en || 'Explore', b.button_text_bn || 'বিস্তারিত দেখুন',
    b.button_link || '/section/about-balagarh', b.media_id || null, Number(b.sort_order || 1), b.is_active === false ? 0 : 1
  );
  logActivity(user, 'create', 'homepage', Number(r.lastInsertRowid), `Added homepage banner "${b.title_en}"`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/homepage/banners/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'edit')) return res.status(403).json({ error: 'Homepage permission required' });
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(`
    UPDATE homepage_banners SET
      title_en = COALESCE(?, title_en),
      title_bn = COALESCE(?, title_bn),
      subtitle_en = COALESCE(?, subtitle_en),
      subtitle_bn = COALESCE(?, subtitle_bn),
      button_text_en = COALESCE(?, button_text_en),
      button_text_bn = COALESCE(?, button_text_bn),
      button_link = COALESCE(?, button_link),
      media_id = COALESCE(?, media_id),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    b.title_en ?? null, b.title_bn ?? null, b.subtitle_en ?? null, b.subtitle_bn ?? null,
    b.button_text_en ?? null, b.button_text_bn ?? null, b.button_link ?? null,
    b.media_id ?? null, b.sort_order ?? null, b.is_active !== undefined ? (b.is_active ? 1 : 0) : null, id
  );
  logActivity(user, 'update', 'homepage', id, `Updated homepage banner #${id}`);
  res.json({ ok: true });
});

app.delete('/api/admin/homepage/banners/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'delete')) return res.status(403).json({ error: 'Homepage delete permission required' });
  const id = Number(req.params.id);
  db.prepare('DELETE FROM homepage_banners WHERE id = ?').run(id);
  logActivity(user, 'delete', 'homepage', id, `Deleted homepage banner #${id}`);
  res.json({ ok: true });
});

app.put('/api/admin/homepage/sections', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'edit')) return res.status(403).json({ error: 'Homepage permission required' });
  const { sections } = req.body || {};
  if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections array required' });
  const stmt = db.prepare('UPDATE homepage_sections SET is_visible = ?, sort_order = ?, title_en = ?, title_bn = ? WHERE id = ?');
  sections.forEach((s: { id: number; is_visible: number | boolean; sort_order: number; title_en: string; title_bn: string }, idx: number) => {
    stmt.run(s.is_visible ? 1 : 0, s.sort_order ?? idx + 1, s.title_en, s.title_bn, Number(s.id));
  });
  logActivity(user, 'update', 'homepage', null, 'Updated homepage section ordering & visibility');
  res.json({ ok: true });
});

app.post('/api/admin/homepage/cards', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'create')) return res.status(403).json({ error: 'Homepage permission required' });
  const c = req.body || {};
  const r = db.prepare(`
    INSERT INTO homepage_quick_cards (card_type, label_en, label_bn, value_text, target_section, url, icon, color_hex, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.card_type || 'quick_link', c.label_en, c.label_bn, c.value_text || '',
    c.target_section || '', c.url || '', c.icon || 'Link', c.color_hex || '#16A34A',
    Number(c.sort_order || 1), c.is_active === false ? 0 : 1
  );
  logActivity(user, 'create', 'homepage', Number(r.lastInsertRowid), `Added homepage card "${c.label_en}"`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/homepage/cards/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'edit')) return res.status(403).json({ error: 'Homepage permission required' });
  const id = Number(req.params.id);
  const c = req.body || {};
  db.prepare(`
    UPDATE homepage_quick_cards SET
      label_en = COALESCE(?, label_en),
      label_bn = COALESCE(?, label_bn),
      value_text = COALESCE(?, value_text),
      target_section = COALESCE(?, target_section),
      url = COALESCE(?, url),
      color_hex = COALESCE(?, color_hex),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    c.label_en ?? null, c.label_bn ?? null, c.value_text ?? null,
    c.target_section ?? null, c.url ?? null, c.color_hex ?? null,
    c.sort_order ?? null, c.is_active !== undefined ? (c.is_active ? 1 : 0) : null, id
  );
  logActivity(user, 'update', 'homepage', id, `Updated homepage quick card #${id}`);
  res.json({ ok: true });
});

app.delete('/api/admin/homepage/cards/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'delete')) return res.status(403).json({ error: 'Homepage permission required' });
  const id = Number(req.params.id);
  db.prepare('DELETE FROM homepage_quick_cards WHERE id = ?').run(id);
  logActivity(user, 'delete', 'homepage', id, `Deleted homepage quick card #${id}`);
  res.json({ ok: true });
});

app.post('/api/admin/homepage/popups', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'create')) return res.status(403).json({ error: 'Homepage permission required' });
  const p = req.body || {};
  if (!p.title_en || !p.title_bn) return res.status(400).json({ error: 'English and Bengali popup titles required' });

  const isActive = p.is_active === false || p.is_active === 0 ? 0 : 1;
  if (isActive === 1) {
    db.prepare('UPDATE homepage_popups SET is_active = 0').run();
  }

  const r = db.prepare(`
    INSERT INTO homepage_popups (
      title_en, title_bn, subtitle_en, subtitle_bn, body_en, body_bn,
      badge_en, badge_bn, button_text_en, button_text_bn, button_link,
      media_id, theme_color, show_once_per_session, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.title_en,
    p.title_bn,
    p.subtitle_en || '',
    p.subtitle_bn || '',
    p.body_en || '',
    p.body_bn || '',
    p.badge_en || 'ANNOUNCEMENT',
    p.badge_bn || 'জরুরি ঘোষণা',
    p.button_text_en || 'View Details',
    p.button_text_bn || 'বিস্তারিত দেখুন',
    p.button_link || '/section/notices-circulars',
    p.media_id || null,
    p.theme_color || 'royal',
    p.show_once_per_session ? 1 : 0,
    isActive
  );
  logActivity(user, 'create', 'homepage', Number(r.lastInsertRowid), `Created homepage popup "${p.title_en}"`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/homepage/popups/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'edit')) return res.status(403).json({ error: 'Homepage permission required' });
  const id = Number(req.params.id);
  const p = req.body || {};
  const existing = db.prepare('SELECT * FROM homepage_popups WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Popup not found' });

  const nextActive = p.is_active !== undefined ? (p.is_active ? 1 : 0) : Number(existing.is_active);
  if (nextActive === 1) {
    db.prepare('UPDATE homepage_popups SET is_active = 0 WHERE id != ?').run(id);
  }

  db.prepare(`
    UPDATE homepage_popups SET
      title_en = ?,
      title_bn = ?,
      subtitle_en = ?,
      subtitle_bn = ?,
      body_en = ?,
      body_bn = ?,
      badge_en = ?,
      badge_bn = ?,
      button_text_en = ?,
      button_text_bn = ?,
      button_link = ?,
      media_id = ?,
      theme_color = ?,
      show_once_per_session = ?,
      is_active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    (p.title_en ?? existing.title_en) as string,
    (p.title_bn ?? existing.title_bn) as string,
    (p.subtitle_en ?? existing.subtitle_en) as string,
    (p.subtitle_bn ?? existing.subtitle_bn) as string,
    (p.body_en ?? existing.body_en) as string,
    (p.body_bn ?? existing.body_bn) as string,
    (p.badge_en ?? existing.badge_en) as string,
    (p.badge_bn ?? existing.badge_bn) as string,
    (p.button_text_en ?? existing.button_text_en) as string,
    (p.button_text_bn ?? existing.button_text_bn) as string,
    (p.button_link ?? existing.button_link) as string,
    p.media_id !== undefined ? (p.media_id || null) : (existing.media_id as number | null),
    (p.theme_color ?? existing.theme_color) as string,
    p.show_once_per_session !== undefined ? (p.show_once_per_session ? 1 : 0) : Number(existing.show_once_per_session),
    nextActive,
    id
  );
  logActivity(user, 'update', 'homepage', id, `Updated homepage popup #${id}`);
  res.json({ ok: true });
});

app.delete('/api/admin/homepage/popups/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'homepage', 'delete')) return res.status(403).json({ error: 'Homepage permission required' });
  const id = Number(req.params.id);
  db.prepare('DELETE FROM homepage_popups WHERE id = ?').run(id);
  logActivity(user, 'delete', 'homepage', id, `Deleted homepage popup #${id}`);
  res.json({ ok: true });
});

// ============================================================================
// CATEGORIES & TAGS
// ============================================================================

app.get('/api/admin/taxonomy', (_req: AuthedRequest, res) => {
  const categories = db.prepare('SELECT * FROM content_categories ORDER BY section_slug ASC, name_en ASC').all();
  const tags = db.prepare('SELECT * FROM content_tags ORDER BY name_en ASC').all();
  res.json({ categories, tags });
});

app.post('/api/admin/categories', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'categories', 'create') && !user.permissions.modules.includes('*')) {
    return res.status(403).json({ error: 'Permission denied to manage categories' });
  }
  const { section_slug, name_en, name_bn } = req.body || {};
  if (!section_slug || !name_en || !name_bn) return res.status(400).json({ error: 'All category fields required' });
  const r = db.prepare('INSERT INTO content_categories (section_slug, name_en, name_bn, slug) VALUES (?, ?, ?, ?)').run(
    section_slug, name_en, name_bn, slugify(name_en)
  );
  logActivity(user, 'create', 'categories', Number(r.lastInsertRowid), `Created category "${name_en}"`);
  res.status(201).json({ category: db.prepare('SELECT * FROM content_categories WHERE id = ?').get(Number(r.lastInsertRowid)) });
});

app.delete('/api/admin/categories/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'categories', 'delete') && !user.permissions.modules.includes('*')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  db.prepare('DELETE FROM content_categories WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/tags', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'categories', 'create') && !user.permissions.modules.includes('*')) {
    return res.status(403).json({ error: 'Permission denied to manage tags' });
  }
  const { name_en, name_bn } = req.body || {};
  if (!name_en || !name_bn) return res.status(400).json({ error: 'English and Bengali tag names required' });
  const r = db.prepare('INSERT INTO content_tags (name_en, name_bn, slug) VALUES (?, ?, ?)').run(name_en, name_bn, slugify(name_en));
  logActivity(user, 'create', 'tags', Number(r.lastInsertRowid), `Created tag "${name_en}"`);
  res.status(201).json({ tag: db.prepare('SELECT * FROM content_tags WHERE id = ?').get(Number(r.lastInsertRowid)) });
});

app.delete('/api/admin/tags/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (!hasPermission(user, 'categories', 'delete') && !user.permissions.modules.includes('*')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  db.prepare('DELETE FROM content_tags WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// USERS, ROLES & ACTIVITY LOGS
// ============================================================================

app.post('/api/admin/switch-role', (req: AuthedRequest, res) => {
  const actor = req.cmsUser!;
  if (actor.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Administrator can switch between user roles' });
  }
  const targetUsername = String(req.body?.username || '').trim();
  if (!targetUsername) {
    return res.status(400).json({ error: 'Target username is required' });
  }
  const row = db.prepare('SELECT id FROM users WHERE username = ? AND is_active = 1').get(targetUsername) as
    | { id: number }
    | undefined;
  if (!row) {
    return res.status(404).json({ error: 'Target active user not found' });
  }
  const targetUser = getUserById(row.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found' });
  }
  const token = signAuthToken(targetUser.id);
  const csrfToken = createCsrfToken();
  logActivity(actor, 'switch_role', 'users', targetUser.id, `Super Admin switched workspace role to ${targetUser.role_name_en} (${targetUser.username})`);
  res.json({ token, csrfToken, user: targetUser });
});

app.get('/api/admin/users-roles', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (user.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Administrator can view all user accounts and roles' });
  }
  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all().map((r: Record<string, unknown>) => ({
    ...r,
    permissions: JSON.parse(String(r.permissions_json)),
  }));
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.assigned_panchayat, u.assigned_institution,
           u.avatar_url, u.phone, u.designation, u.bio, u.address, u.is_active, u.created_at,
           u.visible_password,
           r.slug as role_slug, r.name_en as role_name_en, r.name_bn as role_name_bn, r.accent_color
    FROM users u JOIN roles r ON r.id = u.role_id
    ORDER BY u.id ASC
  `).all();
  res.json({ roles, users });
});

app.post('/api/admin/users', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (user.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Super Administrator access required' });
  }
  const { username, full_name, email, password, role_id, assigned_panchayat, assigned_institution } = req.body || {};
  if (!username || !full_name || !email || !role_id) {
    return res.status(400).json({ error: 'username, full_name, email, and role_id are required' });
  }
  const plainPass = String(password || 'balagarh2026');
  const r = db.prepare(`
    INSERT INTO users (username, full_name, email, password_hash, visible_password, role_id, assigned_panchayat, assigned_institution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(username).trim(),
    String(full_name).trim(),
    String(email).trim(),
    hashPassword(plainPass),
    plainPass,
    Number(role_id),
    assigned_panchayat || null,
    assigned_institution || null
  );
  logActivity(user, 'create', 'users', Number(r.lastInsertRowid), `Created user "${full_name}" (${username})`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/users/:id', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (user.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Super Administrator access required' });
  }
  const id = Number(req.params.id);
  const { full_name, email, role_id, assigned_panchayat, assigned_institution, is_active } = req.body || {};
  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      role_id = COALESCE(?, role_id),
      assigned_panchayat = ?,
      assigned_institution = ?,
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(full_name ?? null, email ?? null, role_id ?? null, assigned_panchayat ?? null, assigned_institution ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, id);
  logActivity(user, 'update', 'users', id, `Updated user #${id} role/permissions`);
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/reset-password', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (user.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Administrator can reset user passwords' });
  }
  const targetId = Number(req.params.id);
  const nextPass = String(req.body?.newPassword || '').trim();
  if (nextPass.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  const target = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(targetId) as
    | { id: number; username: string; full_name: string }
    | undefined;
  if (!target) {
    return res.status(404).json({ error: 'Target user not found' });
  }
  db.prepare('UPDATE users SET password_hash = ?, visible_password = ? WHERE id = ?').run(
    hashPassword(nextPass),
    nextPass,
    targetId
  );
  logActivity(user, 'admin_reset_password', 'users', targetId, `Super Admin reset password for ${target.full_name} (${target.username})`);
  res.json({ ok: true });
});

app.put('/api/admin/roles/:id/permissions', (req: AuthedRequest, res) => {
  const user = req.cmsUser!;
  if (user.role_slug !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Administrator can modify role permission matrices' });
  }
  const id = Number(req.params.id);
  const { permissions } = req.body || {};
  if (!permissions || !Array.isArray(permissions.modules) || !Array.isArray(permissions.actions)) {
    return res.status(400).json({ error: 'Invalid permissions payload' });
  }
  db.prepare('UPDATE roles SET permissions_json = ? WHERE id = ?').run(JSON.stringify(permissions), id);
  logActivity(user, 'update', 'roles', id, `Updated module permissions for role #${id}`);
  res.json({ ok: true });
});

app.get('/api/admin/logs', (req: AuthedRequest, res) => {
  const moduleFilter = String(req.query.module || 'all');
  const limit = Math.min(200, Math.max(10, Number(req.query.limit || 60)));
  let where = '1=1';
  const params: (string | number)[] = [];
  if (moduleFilter !== 'all') {
    where += ' AND module = ?';
    params.push(moduleFilter);
  }
  const logs = db.prepare(`SELECT * FROM activity_logs WHERE ${where} ORDER BY id DESC LIMIT ?`).all(...params, limit);
  res.json({ logs });
});

