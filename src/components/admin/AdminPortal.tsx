import React, { useEffect, useState } from 'react';
import {
  Activity, Bell, Building2, CalendarDays, Crown, ExternalLink, FileText,
  GraduationCap, HeartPulse, Home, Image as ImageIcon, LayoutDashboard, LayoutTemplate,
  LogOut, Megaphone, Menu, Newspaper, Plus, Shield, ShieldCheck, Tag, UploadCloud, Users, X,
} from 'lucide-react';
import type { ContentSection, DashboardStats, Language, UserRecord } from '../../types/cms';
import { apiFetch, loginDemoRole } from '../../lib/api';
import { DynamicIcon } from '../DynamicIcon';
import { ContentManagerView } from './ContentManagerView';
import { EventsManagerView } from './EventsManagerView';
import { HomepageManagerView } from './HomepageManagerView';
import { MediaLibraryView } from './MediaLibraryView';
import { ActivityLogsView, TaxonomyManagerView, UsersRolesView } from './UsersRolesTaxonomyView';

type AdminTab =
  | { type: 'dashboard' }
  | { type: 'contents'; sectionSlug?: string }
  | { type: 'events' }
  | { type: 'media' }
  | { type: 'homepage' }
  | { type: 'taxonomy' }
  | { type: 'users' }
  | { type: 'logs' };

interface AdminPortalProps {
  user: UserRecord;
  setUser: (u: UserRecord) => void;
  lang: Language;
  setLang: (l: Language) => void;
  onViewPublicSite: () => void;
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  setUser,
  lang,
  setLang,
  onViewPublicSite,
  onLogout,
}) => {
  const [tab, setTab] = useState<AdminTab>({ type: 'dashboard' });
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [demoUsers, setDemoUsers] = useState<Array<{ username: string; role_name_en: string; accent_color: string }>>([]);

  const canAccess = (mod: string) =>
    user.permissions.modules.includes('*') || user.permissions.modules.includes(mod);

  const loadDashboardData = () => {
    apiFetch<{ sections: ContentSection[] }>('/api/admin/sections')
      .then((res) => setSections(res.sections))
      .catch(() => {});

    apiFetch<DashboardStats>('/api/admin/dashboard')
      .then((res) => setStats(res))
      .catch(() => {});
  };

  useEffect(() => {
    loadDashboardData();
    apiFetch<{ users: Array<{ username: string; role_name_en: string; accent_color: string }> }>('/api/auth/demo-users')
      .then((res) => setDemoUsers(res.users))
      .catch(() => {});
  }, [user.id, tab.type]);

  const switchRole = async (username: string) => {
    const nextUser = await loginDemoRole(username);
    setUser(nextUser);
    setTab({ type: 'dashboard' });
  };

  const kpiCards = [
    {
      label_en: 'Total Contents',
      label_bn: 'মোট কনটেন্ট',
      val: stats?.totalContents ?? 0,
      gradient: 'from-violet-600 to-purple-700',
      icon: FileText,
      action: () => setTab({ type: 'contents' }),
      allowed: true,
    },
    {
      label_en: 'Gram Panchayats',
      label_bn: 'গ্রাম পঞ্চায়েত',
      val: stats?.sectionCounts['gram-panchayats'] ?? 0,
      gradient: 'from-emerald-500 to-green-700',
      icon: Building2,
      action: () => setTab({ type: 'contents', sectionSlug: 'gram-panchayats' }),
      allowed: canAccess('gram-panchayats'),
    },
    {
      label_en: 'Villages',
      label_bn: 'গ্রাম সমূহ',
      val: stats?.sectionCounts['villages'] ?? 0,
      gradient: 'from-sky-500 to-blue-700',
      icon: Home,
      action: () => setTab({ type: 'contents', sectionSlug: 'villages' }),
      allowed: canAccess('villages'),
    },
    {
      label_en: 'Schools & Colleges',
      label_bn: 'স্কুল ও কলেজ',
      val: (stats?.sectionCounts['schools'] ?? 0) + (stats?.sectionCounts['colleges'] ?? 0),
      gradient: 'from-amber-500 to-orange-600',
      icon: GraduationCap,
      action: () => setTab({ type: 'contents', sectionSlug: 'schools' }),
      allowed: canAccess('schools') || canAccess('colleges'),
    },
    {
      label_en: 'Hospitals & Health',
      label_bn: 'হাসপাতাল ও স্বাস্থ্য',
      val: stats?.sectionCounts['hospitals'] ?? 0,
      gradient: 'from-rose-500 to-red-700',
      icon: HeartPulse,
      action: () => setTab({ type: 'contents', sectionSlug: 'hospitals' }),
      allowed: canAccess('hospitals'),
    },
    {
      label_en: 'Police Stations',
      label_bn: 'পুলিশ স্টেশন',
      val: stats?.sectionCounts['police-stations'] ?? 0,
      gradient: 'from-indigo-600 to-blue-800',
      icon: Shield,
      action: () => setTab({ type: 'contents', sectionSlug: 'police-stations' }),
      allowed: canAccess('police-stations'),
    },
    {
      label_en: 'Events & Programmes',
      label_bn: 'অনুষ্ঠান ও ইভেন্ট',
      val: stats?.totalEvents ?? 0,
      gradient: 'from-pink-600 to-rose-700',
      icon: CalendarDays,
      action: () => setTab({ type: 'events' }),
      allowed: canAccess('events') || canAccess('events-programmes'),
    },
    {
      label_en: 'Media Library',
      label_bn: 'মিডিয়া ফাইল',
      val: stats?.totalMedia ?? 0,
      gradient: 'from-teal-500 to-emerald-700',
      icon: ImageIcon,
      action: () => setTab({ type: 'media' }),
      allowed: canAccess('media'),
    },
  ];

  const pubTotal = Math.max(1, stats?.totalContents || 1);
  const statusRows = [
    { label: 'Published', count: stats?.publishedContents ?? 0, color: 'bg-emerald-500' },
    { label: 'Draft', count: stats?.draftContents ?? 0, color: 'bg-amber-500' },
    { label: 'Scheduled', count: stats?.scheduledContents ?? 0, color: 'bg-blue-500' },
    { label: 'Unpublished', count: stats?.unpublishedContents ?? 0, color: 'bg-rose-500' },
  ];

  return (
    <div className="min-h-screen flex bg-[#eef3f9] text-slate-900">
      {/* Left Gradient Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-[#081A3E] via-[#0E295E] to-[#13387A] text-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400 shrink-0">
              <img src="/uploads/guptipara_terracotta_temple.jpg" alt="Our Balagarh" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight">Our Balagarh</div>
              <div className="text-[11px] text-amber-300 font-medium">আমাদের বলাগড় · CMS</div>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          <button
            type="button"
            onClick={() => { setTab({ type: 'dashboard' }); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
              tab.type === 'dashboard' ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'ড্যাশবোর্ড / Dashboard' : 'Dashboard Overview'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab({ type: 'contents' }); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
              tab.type === 'contents' && !tab.sectionSlug ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'সকল কনটেন্ট / All Content' : 'All Content Modules'}</span>
          </button>

          {canAccess('homepage') && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'homepage' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'homepage' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <LayoutTemplate className="w-4 h-4 shrink-0" />
              <span>{lang === 'bn' ? 'হোমপেজ ম্যানেজমেন্ট' : 'Homepage Management'}</span>
            </button>
          )}

          {canAccess('media') && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'media' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'media' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>{lang === 'bn' ? 'মিডিয়া লাইব্রেরি' : 'Media Library'}</span>
            </button>
          )}

          {(canAccess('events') || canAccess('events-programmes')) && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'events' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'events' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{lang === 'bn' ? 'ইভেন্টস ম্যানেজমেন্ট' : 'Events Management'}</span>
            </button>
          )}

          {(canAccess('categories') || user.permissions.modules.includes('*')) && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'taxonomy' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'taxonomy' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Tag className="w-4 h-4 shrink-0" />
              <span>Categories & Tags</span>
            </button>
          )}

          {user.permissions.modules.includes('*') && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'users' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'users' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Users & Role Permissions</span>
            </button>
          )}

          {(canAccess('logs') || user.permissions.modules.includes('*')) && (
            <button
              type="button"
              onClick={() => { setTab({ type: 'logs' }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-colors ${
                tab.type === 'logs' ? 'bg-blue-600 text-white shadow' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Activity Logs</span>
            </button>
          )}

          {/* Authorised Section Shortcuts */}
          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="px-3 pb-1.5 text-[11px] font-bold text-sky-300">
              Authorised Sections ({sections.length})
            </div>
            <div className="space-y-0.5">
              {sections.map((sec) => {
                const active = tab.type === 'contents' && tab.sectionSlug === sec.slug;
                return (
                  <button
                    key={sec.slug}
                    type="button"
                    onClick={() => { setTab({ type: 'contents', sectionSlug: sec.slug }); setSidebarOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                      active ? 'bg-white/20 text-amber-300 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <DynamicIcon name={sec.icon} className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span className="truncate">{lang === 'bn' ? sec.name_bn : sec.name_en}</span>
                    </span>
                    <span className="text-[10px] opacity-75 tabular-nums">{sec.total_count ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onViewPublicSite}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Public Website</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Scenic Balagarh Top Header Bar */}
        <header className="relative bg-gradient-to-r from-[#0B2C52] via-[#134E7A] to-[#0E7490] text-white px-4 sm:px-6 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg bg-white/10">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <div className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                  <span>{user.role_name_en} Dashboard</span>
                  <span className="text-xs font-medium text-amber-300 hidden sm:inline">· {user.role_name_bn}</span>
                </div>
                <div className="text-xs text-sky-100">
                  {user.assigned_panchayat || user.assigned_institution || 'Balagarh Block, Hooghly District, West Bengal'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Role Quick-Switch Dropdown */}
              <select
                value={user.username}
                onChange={(e) => switchRole(e.target.value)}
                title="Switch Role to test Module-Level RBAC"
                className="px-2.5 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold focus:outline-none"
              >
                {demoUsers.map((du) => (
                  <option key={du.username} value={du.username} className="text-slate-900">
                    Role: {du.role_name_en}
                  </option>
                ))}
              </select>

              {/* Language Switcher */}
              <div className="inline-flex bg-white/15 p-0.5 rounded-lg border border-white/20">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 rounded text-xs font-bold ${lang === 'en' ? 'bg-white text-slate-900' : 'text-white'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('bn')}
                  className={`px-2.5 py-1 rounded text-xs font-bold ${lang === 'bn' ? 'bg-emerald-500 text-white' : 'text-white'}`}
                >
                  বাংলা
                </button>
              </div>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors relative"
                  aria-label="Recent Activity"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {stats?.recentActivities.length || 0}
                  </span>
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center justify-between">
                      <span>Recent CMS Activity</span>
                      <button type="button" onClick={() => setNotifOpen(false)}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {(stats?.recentActivities || []).slice(0, 6).map((act) => (
                        <div key={act.id} className="px-4 py-2.5 text-xs">
                          <div className="font-semibold text-slate-900">{act.details}</div>
                          <div className="text-slate-500 mt-0.5">{act.user_name} · {act.created_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onViewPublicSite}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Public Site</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="p-4 sm:p-6 flex-1 space-y-6 max-w-[1440px] w-full mx-auto">
          {tab.type === 'dashboard' && (
            <>
              {/* Welcome Banner */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-md"
                    style={{ backgroundColor: user.accent_color }}
                  >
                    {user.role_slug === 'super_admin' ? <Crown className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      Welcome, {user.full_name}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                      Signed in as <strong>{user.role_name_en}</strong> · Access to{' '}
                      {user.permissions.modules.includes('*') ? 'all 24 CMS modules' : `${sections.length} authorised modules`} ({user.permissions.actions.join(', ')}).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.permissions.actions.includes('create') && (
                    <button
                      type="button"
                      onClick={() => setTab({ type: 'contents' })}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Manage Content</span>
                    </button>
                  )}
                  {canAccess('homepage') && (
                    <button
                      type="button"
                      onClick={() => setTab({ type: 'homepage' })}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      <span>Manage Homepage</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Colorful Gradient KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {kpiCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.label_en}
                      type="button"
                      disabled={!card.allowed}
                      onClick={card.action}
                      className={`text-left rounded-2xl p-4 text-white bg-gradient-to-br ${card.gradient} shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 ${
                        !card.allowed ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <div>
                        <div className="text-2xl sm:text-3xl font-extrabold tabular-nums">{card.val}</div>
                        <div className="text-xs font-bold mt-1">{card.label_en}</div>
                        <div className="text-[11px] opacity-85">{card.label_bn}</div>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Charts, Recent Activities & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Content Publication Status */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-slate-900">Content Publication Status</h3>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">{stats?.totalContents || 0} Total</span>
                  </div>
                  <div className="space-y-3">
                    {statusRows.map((row) => {
                      const pct = Math.round((row.count / pubTotal) * 100);
                      return (
                        <div key={row.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-700">{row.label}</span>
                            <span className="text-slate-900 tabular-nums">{row.count} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Activities */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-slate-900">Recent Activities</h3>
                    {(canAccess('logs') || user.permissions.modules.includes('*')) && (
                      <button type="button" onClick={() => setTab({ type: 'logs' })} className="text-xs font-bold text-blue-600 hover:underline">
                        View All
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(stats?.recentActivities || []).slice(0, 5).map((act) => (
                      <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                        <div className="font-bold text-slate-900">{act.details}</div>
                        <div className="text-slate-500 mt-0.5">
                          by {act.user_name} ({act.role_name}) · {act.created_at}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="text-base font-extrabold text-slate-900">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {user.permissions.actions.includes('create') && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'contents' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Add Content</span>
                      </button>
                    )}
                    {canAccess('media') && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'media' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <UploadCloud className="w-5 h-5" />
                        <span>Upload Media</span>
                      </button>
                    )}
                    {(canAccess('events') || canAccess('events-programmes')) && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'events' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <CalendarDays className="w-5 h-5" />
                        <span>Add Event</span>
                      </button>
                    )}
                    {canAccess('notices-circulars') && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'contents', sectionSlug: 'notices-circulars' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <Megaphone className="w-5 h-5" />
                        <span>Notices</span>
                      </button>
                    )}
                    {canAccess('news-announcements') && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'contents', sectionSlug: 'news-announcements' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <Newspaper className="w-5 h-5" />
                        <span>News Desk</span>
                      </button>
                    )}
                    {user.permissions.modules.includes('*') && (
                      <button
                        type="button"
                        onClick={() => setTab({ type: 'users' })}
                        className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 text-white text-xs font-bold flex flex-col items-center gap-1.5 shadow-sm"
                      >
                        <Users className="w-5 h-5" />
                        <span>Manage Roles</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Authorised Modules Directory Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  Your Authorised Website Sections ({sections.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {sections.map((sec) => (
                    <button
                      key={sec.slug}
                      type="button"
                      onClick={() => setTab({ type: 'contents', sectionSlug: sec.slug })}
                      className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0B4A6F] flex items-center justify-center">
                          <DynamicIcon name={sec.icon} className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 tabular-nums">{sec.published_count}/{sec.total_count}</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{sec.name_en}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{sec.name_bn}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab.type === 'contents' && (
            <ContentManagerView
              user={user}
              lang={lang}
              initialSection={tab.sectionSlug || ''}
              sections={sections}
            />
          )}

          {tab.type === 'events' && <EventsManagerView user={user} lang={lang} />}

          {tab.type === 'media' && (
            <MediaLibraryView
              lang={lang}
              canUpload={user.permissions.actions.includes('create')}
              canEdit={user.permissions.actions.includes('edit')}
              canDelete={user.permissions.actions.includes('delete')}
            />
          )}

          {tab.type === 'homepage' && <HomepageManagerView lang={lang} />}

          {tab.type === 'taxonomy' && <TaxonomyManagerView sections={sections} />}

          {tab.type === 'users' && <UsersRolesView currentUser={user} />}

          {tab.type === 'logs' && <ActivityLogsView />}
        </main>
      </div>
    </div>
  );
};
