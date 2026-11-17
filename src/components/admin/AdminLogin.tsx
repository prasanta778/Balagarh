import React, { useEffect, useState } from 'react';
import { ArrowLeft, Crown, Lock, Shield, UserCheck, Eye, Building2, HeartPulse, GraduationCap, Newspaper, CalendarDays, Image as ImageIcon } from 'lucide-react';
import type { Language, UserRecord } from '../../types/cms';
import { apiFetch, loginDemoRole, loginWithPassword } from '../../lib/api';

interface DemoUserSummary {
  id: number;
  username: string;
  full_name: string;
  email: string;
  assigned_panchayat: string | null;
  assigned_institution: string | null;
  role_slug: string;
  role_name_en: string;
  role_name_bn: string;
  accent_color: string;
  role_description: string;
}

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  super_admin: Crown,
  admin: Shield,
  panchayat_editor: Building2,
  police_editor: Shield,
  hospital_editor: HeartPulse,
  school_editor: GraduationCap,
  news_editor: Newspaper,
  event_editor: CalendarDays,
  gallery_editor: ImageIcon,
  viewer: Eye,
};

export const AdminLogin: React.FC<{
  lang: Language;
  onLoginSuccess: (user: UserRecord) => void;
  onBackToSite: () => void;
}> = ({ lang, onLoginSuccess, onBackToSite }) => {
  const [demoUsers, setDemoUsers] = useState<DemoUserSummary[]>([]);
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('balagarh2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ users: DemoUserSummary[] }>('/api/auth/demo-users')
      .then((res) => setDemoUsers(res.users))
      .catch(() => {});
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await loginWithPassword(username, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRole = async (uname: string) => {
    setLoading(true);
    setError('');
    try {
      const user = await loginDemoRole(uname);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2540] via-[#0B4A6F] to-[#0F766E] py-8 px-4 flex items-center justify-center">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Branded Login Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="relative h-44 bg-slate-900">
            <img
              src="/src/assets/images/balagarh_hero_heritage_1794933203220.jpg"
              alt="Our Balagarh Admin Portal"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent p-5 flex flex-col justify-end text-white">
              <div className="text-xl font-extrabold">আমাদের বলাগড় · Our Balagarh</div>
              <div className="text-xs text-sky-200 mt-0.5">
                {lang === 'bn' ? 'ডাইনামিক কনটেন্ট ম্যানেজমেন্ট সিস্টেম (CMS)' : 'Dynamic Content Management System (CMS)'}
              </div>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <Lock className="w-5 h-5 text-[#0B4A6F]" />
                <span>{lang === 'bn' ? 'অ্যাডমিন লগইন' : 'Admin Portal Login'}</span>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">Default demo password: <code className="font-mono">balagarh2026</code></p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#0B4A6F] to-[#1D4ED8] hover:opacity-95 text-white font-bold text-sm transition-opacity shadow-md"
              >
                {loading ? 'Signing in...' : (lang === 'bn' ? 'প্রবেশ করুন / Sign In' : 'Sign In to CMS')}
              </button>
            </form>

            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0B4A6F] pt-3 border-t border-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'পাবলিক ওয়েবসাইটে ফিরে যান' : 'Return to Public Website'}</span>
            </button>
          </div>
        </div>

        {/* Right: Role-Based Access Switcher (Matching Attachments 3 & 5) */}
        <div className="lg:col-span-7 bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-violet-700" />
                <span>{lang === 'bn' ? 'ভূমিকা ভিত্তিক প্রবেশ / Role-Based Access' : 'Select Role for Module-Level Access'}</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Click any role card to inspect its exact module-level permissions and dashboard workspace.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {demoUsers.map((u) => {
              const Icon = ROLE_ICON[u.role_slug] || Shield;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRole(u.username)}
                  className="text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all flex items-start gap-3 group"
                >
                  <div
                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: u.accent_color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-[#0B4A6F] truncate">
                      {u.role_name_en}
                    </div>
                    <div className="text-xs font-medium text-slate-600 truncate">
                      {u.role_name_bn}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {u.full_name}
                      {u.assigned_panchayat ? ` · ${u.assigned_panchayat}` : ''}
                      {u.assigned_institution ? ` · ${u.assigned_institution}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
