import React, { useEffect, useRef, useState } from 'react';
import {
  Building2, Camera, CheckCircle2, KeyRound, Mail, MapPin, Phone,
  Save, ShieldCheck, Trash2, User, Briefcase,
} from 'lucide-react';
import type { Language, UserRecord } from '../../types/cms';
import { apiFetch } from '../../lib/api';

interface ProfileViewProps {
  user: UserRecord;
  lang: Language;
  onUserUpdated: (updated: UserRecord) => void;
  onOpenChangePassword: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  lang,
  onUserUpdated,
  onOpenChangePassword,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [assignedPanchayat, setAssignedPanchayat] = useState(user.assigned_panchayat || '');
  const [assignedInstitution, setAssignedInstitution] = useState(user.assigned_institution || '');
  const [address, setAddress] = useState(user.address || '');
  const [bio, setBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFullName(user.full_name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setDesignation(user.designation || '');
    setAssignedPanchayat(user.assigned_panchayat || '');
    setAssignedInstitution(user.assigned_institution || '');
    setAddress(user.address || '');
    setBio(user.bio || '');
  }, [user]);

  const initials = (user.full_name || user.username || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await apiFetch<{ avatar_url: string; user: UserRecord }>('/api/auth/profile/avatar', {
        method: 'POST',
        body: fd,
      });
      if (res.user) {
        onUserUpdated(res.user);
      } else {
        onUserUpdated({ ...user, avatar_url: res.avatar_url });
      }
      setFeedback({
        type: 'ok',
        text: lang === 'bn' ? 'প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে।' : 'Profile photo updated successfully.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload profile photo',
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setFeedback(null);
    setUploadingPhoto(true);
    try {
      const res = await apiFetch<{ user: UserRecord }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim() || user.full_name,
          email: email.trim() || user.email,
          avatar_url: '',
        }),
      });
      if (res.user) onUserUpdated(res.user);
      setFeedback({
        type: 'ok',
        text: lang === 'bn' ? 'প্রোফাইল ছবি সরানো হয়েছে।' : 'Profile photo removed.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to remove photo',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ user: UserRecord }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          assigned_panchayat: assignedPanchayat.trim() || null,
          assigned_institution: assignedInstitution.trim() || null,
          address: address.trim(),
          bio: bio.trim(),
        }),
      });
      if (res.user) onUserUpdated(res.user);
      setFeedback({
        type: 'ok',
        text: lang === 'bn' ? 'আপনার প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।' : 'Your profile details have been updated.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save profile',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>{lang === 'bn' ? 'আমার প্রোফাইল / My Profile' : 'My Account Profile'}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {lang === 'bn'
              ? 'আপনার নাম, প্রোফাইল ছবি, যোগাযোগের নম্বর এবং অন্যান্য তথ্য দেখুন ও পরিবর্তন করুন।'
              : 'View your account details and update your profile photo, name, contact information, and bio.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenChangePassword}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <KeyRound className="w-4 h-4 text-amber-300" />
          <span>{lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Profile Overview & Avatar Upload */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-[#0B2C52] via-[#134E7A] to-[#0E7490]" />
          <div className="px-5 pb-6 -mt-12 flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-white text-2xl font-extrabold"
                style={{ backgroundColor: user.accent_color || '#1D4ED8' }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white shadow flex items-center justify-center"
                title={lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Upload profile photo'}
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <h3 className="mt-3 text-lg font-extrabold text-slate-900">{user.full_name}</h3>
            <div className="text-xs font-mono text-slate-500">@{user.username}</div>
            {user.designation && (
              <div className="text-xs font-semibold text-blue-700 mt-1">{user.designation}</div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-xs"
                style={{ backgroundColor: user.accent_color || '#2563EB' }}
              >
                {user.role_name_en}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2 w-full">
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingPhoto ? 'Uploading...' : (lang === 'bn' ? 'প্রোফাইল ছবি আপলোড' : 'Upload Photo')}</span>
              </button>
              {user.avatar_url && (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={handleRemovePhoto}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 w-full text-left space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              {(user.assigned_panchayat || user.assigned_institution) && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Building2 className="w-4 h-4 text-violet-600 shrink-0" />
                  <span>{user.assigned_panchayat || user.assigned_institution}</span>
                </div>
              )}
              {user.address && (
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{user.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {user.permissions.modules.includes('*')
                    ? 'Full Super Admin Access'
                    : `${user.permissions.modules.length} authorised modules (${user.permissions.actions.join(', ')})`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Edit Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {lang === 'bn' ? 'প্রোফাইল তথ্য সম্পাদনা করুন' : 'Edit Profile Information'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Username and Role are managed by your Super Administrator.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98300 XXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Designation / Department Title</span>
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Block Informatics Officer"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Gram Panchayat / Block Unit</label>
              <input
                type="text"
                value={assignedPanchayat}
                onChange={(e) => setAssignedPanchayat(e.target.value)}
                placeholder="e.g. Balagarh Gram Panchayat"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Institution / Office</label>
              <input
                type="text"
                value={assignedInstitution}
                onChange={(e) => setAssignedInstitution(e.target.value)}
                placeholder="e.g. Balagarh High School / BPHC"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office / Residential Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Jirat, Balagarh Block, Hooghly – 712501"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Short Bio / Responsibilities</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your responsibilities or bio for the Balagarh CMS team..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Account ID: <span className="font-mono font-semibold text-slate-700">@{user.username}</span> · Joined {user.created_at?.slice(0, 10) || '2026'}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B4A6F] to-[#1D4ED8] hover:opacity-95 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : (lang === 'bn' ? 'প্রোফাইল সংরক্ষণ করুন' : 'Save Profile Changes')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
