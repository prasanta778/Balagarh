export type PublicationStatus = 'published' | 'draft' | 'scheduled' | 'unpublished';
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
export type MediaType = 'image' | 'video' | 'document';
export type Language = 'bn' | 'en';

export interface RolePermissions {
  modules: string[]; // ['*'] or section slugs + 'events' | 'media' | 'homepage' | 'users' | 'categories' | 'logs'
  actions: ('view' | 'create' | 'edit' | 'publish' | 'delete')[];
}

export interface RoleRecord {
  id: number;
  slug: string;
  name_en: string;
  name_bn: string;
  description: string;
  accent_color: string;
  permissions: RolePermissions;
}

export interface UserRecord {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name_en: string;
  role_name_bn: string;
  accent_color: string;
  permissions: RolePermissions;
  assigned_panchayat: string | null;
  assigned_institution: string | null;
  avatar_url: string | null;
  phone?: string | null;
  designation?: string | null;
  bio?: string | null;
  address?: string | null;
  is_active: number;
  created_at: string;
  visible_password?: string;
}

export interface ContentSection {
  id: number;
  slug: string;
  name_en: string;
  name_bn: string;
  group_name: string;
  description_en: string;
  description_bn: string;
  icon: string;
  sort_order: number;
  is_active: number;
  published_count?: number;
  total_count?: number;
}

export interface ContentCategory {
  id: number;
  section_slug: string;
  name_en: string;
  name_bn: string;
  slug: string;
}

export interface ContentTag {
  id: number;
  name_en: string;
  name_bn: string;
  slug: string;
}

export interface MediaRecord {
  id: number;
  filename: string;
  original_name: string;
  url: string;
  mime_type: string;
  media_type: MediaType;
  folder: string;
  file_size: number;
  caption_en: string;
  caption_bn: string;
  alt_text: string;
  uploaded_by: string;
  created_at: string;
  usage_count?: number;
}

export interface ContentMediaAttachment {
  id?: number;
  media_id: number;
  url: string;
  filename: string;
  media_type: MediaType;
  caption_en: string;
  caption_bn: string;
  alt_text: string;
  sort_order: number;
}

export interface ContentItem {
  id: number;
  section_slug: string;
  section_name_en?: string;
  section_name_bn?: string;
  category_id: number | null;
  category_name_en?: string | null;
  category_name_bn?: string | null;
  title_en: string;
  title_bn: string;
  slug: string;
  summary_en: string;
  summary_bn: string;
  body_en: string;
  body_bn: string;
  cover_media_id: number | null;
  cover_url?: string | null;
  cover_alt?: string | null;
  video_url: string | null;
  document_url: string | null;
  external_url: string | null;
  metadata: Record<string, string>;
  status: PublicationStatus;
  scheduled_at: string | null;
  is_featured: number;
  sort_order: number;
  views_count: number;
  author_id: number | null;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
  tags?: ContentTag[];
  gallery?: ContentMediaAttachment[];
}

export interface EventItem {
  id: number;
  title_en: string;
  title_bn: string;
  short_desc_en: string;
  short_desc_bn: string;
  full_desc_en: string;
  full_desc_bn: string;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  organizer: string;
  cover_media_id: number | null;
  cover_url?: string | null;
  video_url: string | null;
  registration_url: string | null;
  contact_details: string | null;
  event_status: EventStatus;
  is_featured: number;
  publication_status: PublicationStatus;
  scheduled_at?: string | null;
  author_id: number | null;
  created_at: string;
  updated_at: string;
  gallery?: ContentMediaAttachment[];
}

export interface HomepageBanner {
  id: number;
  title_en: string;
  title_bn: string;
  subtitle_en: string;
  subtitle_bn: string;
  button_text_en: string;
  button_text_bn: string;
  button_link: string;
  media_id: number | null;
  image_url?: string | null;
  sort_order: number;
  is_active: number;
}

export interface HomepagePopup {
  id: number;
  title_en: string;
  title_bn: string;
  subtitle_en: string;
  subtitle_bn: string;
  body_en: string;
  body_bn: string;
  badge_en: string;
  badge_bn: string;
  button_text_en: string;
  button_text_bn: string;
  button_link: string;
  media_id: number | null;
  image_url?: string | null;
  theme_color: 'royal' | 'crimson' | 'emerald' | 'amber' | 'violet';
  show_once_per_session: number;
  is_active: number;
  updated_at?: string;
}

export interface HomepageSectionConfig {
  id: number;
  section_key: string;
  title_en: string;
  title_bn: string;
  is_visible: number;
  sort_order: number;
  config: Record<string, unknown>;
}

export interface HomepageQuickCard {
  id: number;
  card_type: 'shortcut' | 'glance' | 'quick_link' | 'scheme' | 'contact';
  label_en: string;
  label_bn: string;
  value_text: string;
  target_section: string;
  url: string;
  icon: string;
  color_hex: string;
  sort_order: number;
  is_active: number;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string;
  role_name: string;
  action: string;
  module: string;
  entity_id: number | null;
  details: string;
  created_at: string;
}

export interface ContentRevision {
  id: number;
  entity_type: 'content' | 'event';
  entity_id: number;
  snapshot_json: string;
  changed_by: string;
  change_note: string;
  created_at: string;
}

export interface DashboardStats {
  totalContents: number;
  publishedContents: number;
  draftContents: number;
  scheduledContents: number;
  unpublishedContents: number;
  totalEvents: number;
  totalMedia: number;
  totalUsers: number;
  sectionCounts: Record<string, number>;
  recentActivities: ActivityLog[];
  rolesSummary: Array<{
    slug: string;
    name_en: string;
    name_bn: string;
    user_count: number;
    accent_color: string;
  }>;
}
