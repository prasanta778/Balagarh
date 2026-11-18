import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Crown, Lock, Shield, UserCheck, Eye, EyeOff, Building2, HeartPulse,
  GraduationCap, Newspaper, CalendarDays, Image as ImageIcon, KeyRound, CheckCircle2, X,
} from 'lucide-react';
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
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState<{ username: string; full_name: string; maskedEmail: string; recoveryCode: string } | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ users: DemoUserSummary[] }>('/api/auth/demo-users')
      .then((res) => {
        setDemoUsers(res.users);
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load role accounts.');
      });
  }, [lang]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
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
    setNotice('');
    try {
      const user = await loginDemoRole(uname);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotOpen(true);
    setForgotStep('request');
    setForgotIdentifier(username || '');
    setRecoveryInfo(null);
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await apiFetch<{
        ok: boolean;
        username: string;
        full_name: string;
        maskedEmail: string;
        recoveryCode: string;
      }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      setRecoveryInfo(res);
      setResetCode(res.recoveryCode);
      setForgotStep('reset');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Unable to process recovery request');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (newPassword.length < 6) {
      setForgotError(lang === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError(lang === 'bn' ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; username: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          identifier: recoveryInfo?.username || forgotIdentifier,
          resetCode,
          newPassword,
        }),
      });
      setUsername(res.username);
      setPassword(newPassword);
      setForgotOpen(false);
      setNotice(
        lang === 'bn'
          ? `"${res.username}" অ্যাকাউন্টের পাসওয়ার্ড সফলভাবে রিসেট হয়েছে। এখন সাইন ইন করুন।`
          : `Password reset successfully for "${res.username}". You can now sign in.`
      );
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2540] via-[#0B4A6F] to-[#0F766E] py-4 px-3 sm:py-8 sm:px-4 flex items-center justify-center">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left: Branded Login Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="relative h-36 sm:h-44 bg-slate-900">
            <img
              src="/uploads/guptipara_terracotta_temple.jpg"
              alt="Our Balagarh Admin Portal"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent p-4 sm:p-5 flex flex-col justify-end text-white">
              <div className="text-lg sm:text-xl font-extrabold">আমাদের বলাগড় · Our Balagarh</div>
              <div className="text-xs text-sky-200 mt-0.5">
                {lang === 'bn' ? 'ডাইনামিক কনটেন্ট ম্যানেজমেন্ট সিস্টেম (CMS)' : 'Dynamic Content Management System (CMS)'}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base sm:text-lg">
                <Lock className="w-5 h-5 text-[#0B4A6F]" />
                <span>{lang === 'bn' ? 'অ্যাডমিন লগইন' : 'Admin Portal Login'}</span>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              {notice && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{notice}</span>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Default demo password: <code className="font-mono">balagarh2026</code>
                </p>
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

        {/* Right: Role-Based Access Switcher */}
        <div className="lg:col-span-7 bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-violet-700 shrink-0" />
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

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#0B4A6F] to-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <KeyRound className="w-5 h-5 text-amber-300" />
                <span>{lang === 'bn' ? 'পাসওয়ার্ড পুনরুদ্ধার' : 'Recover / Reset Password'}</span>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {forgotError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {forgotError}
                </div>
              )}

              {forgotStep === 'request' ? (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {lang === 'bn'
                      ? 'আপনার ইউজারনেম বা রেজিস্টার্ড ইমেল লিখুন। পাসওয়ার্ড রিসেট করার জন্য ৬-সংখ্যার যাচাইকরণ কোড তৈরি হবে।'
                      : 'Enter your CMS username or registered email address to generate a 6-digit password reset code.'}
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. superadmin or admin@ourbalagarh.in"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                    >
                      {forgotLoading ? 'Generating...' : 'Get Verification Code'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-3.5">
                  {recoveryInfo && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                      <div className="font-bold text-slate-900">
                        Account: {recoveryInfo.full_name} ({recoveryInfo.username})
                      </div>
                      <div className="text-slate-600">
                        Recovery dispatched for <span className="font-mono">{recoveryInfo.maskedEmail}</span>
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-amber-900 font-semibold">Verification Code:</span>
                        <code className="px-2.5 py-0.5 rounded bg-amber-200 text-slate-950 font-mono font-extrabold tracking-widest">
                          {recoveryInfo.recoveryCode}
                        </code>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>

                  <div className="flex justify-between items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep('request')}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900"
                    >
                      ← Back
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForgotOpen(false)}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        {forgotLoading ? 'Saving...' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
