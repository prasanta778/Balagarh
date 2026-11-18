import React, { useEffect, useState } from 'react';
import {
  Activity, Check, Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw, Search, Shield,
  Tag, Trash2, UserPlus, X,
} from 'lucide-react';
import type { ActivityLog, ContentCategory, ContentSection, ContentTag, RoleRecord, UserRecord } from '../../types/cms';
import { apiFetch } from '../../lib/api';

export const UsersRolesView: React.FC<{ currentUser: UserRecord }> = ({ currentUser }) => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetInput, setShowResetInput] = useState(true);
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role_id: 3,
    assigned_panchayat: '',
    assigned_institution: '',
  });
  const [feedback, setFeedback] = useState('');

  const isSuperAdmin = currentUser.role_slug === 'super_admin' || currentUser.permissions.modules.includes('*');

  const load = () => {
    apiFetch<{ roles: RoleRecord[]; users: UserRecord[] }>('/api/admin/users-roles')
      .then((res) => {
        setRoles(res.roles);
        setUsers(res.users);
      })
      .catch((err) => setFeedback(err.message));

    apiFetch<{ allSections: ContentSection[] }>('/api/admin/sections')
      .then((res) => setSections(res.allSections))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setNewUserOpen(false);
      setForm({ username: '', full_name: '', email: '', password: '', role_id: 3, assigned_panchayat: '', assigned_institution: '' });
      setFeedback('New user account created.');
      load();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed');
    }
  };

  const changeUserRole = async (u: UserRecord, newRoleId: number) => {
    await apiFetch(`/api/admin/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        role_id: newRoleId,
        assigned_panchayat: u.assigned_panchayat,
        assigned_institution: u.assigned_institution,
      }),
    });
    setFeedback(`Updated role for ${u.full_name}.`);
    load();
  };

  const toggleUserActive = async (u: UserRecord) => {
    const nextActive = u.is_active === 1 ? 0 : 1;
    await apiFetch(`/api/admin/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        is_active: nextActive,
        assigned_panchayat: u.assigned_panchayat,
        assigned_institution: u.assigned_institution,
      }),
    });
    setFeedback(`${u.full_name} account is now ${nextActive ? 'Active' : 'Suspended'}.`);
    load();
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await apiFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPasswordInput }),
      });
      setFeedback(`Password reset successfully for ${resetTarget.full_name} (${resetTarget.username}).`);
      setResetTarget(null);
      setResetPasswordInput('');
      load();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Password reset failed');
    }
  };

  const saveRolePermissions = async () => {
    if (!editingRole) return;
    await apiFetch(`/api/admin/roles/${editingRole.id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: editingRole.permissions }),
    });
    setFeedback(`Updated module permissions for ${editingRole.name_en}.`);
    setEditingRole(null);
    load();
  };

  const toggleRevealUser = (id: number) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPassword = (u: UserRecord) => {
    if (!u.visible_password || !navigator.clipboard) return;
    navigator.clipboard.writeText(u.visible_password).catch(() => {});
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role_name_en.toLowerCase().includes(q)
    );
  });

  const allModules = [
    ...sections.map((s) => ({ slug: s.slug, label: s.name_en })),
    { slug: 'events', label: 'Events Management' },
    { slug: 'media', label: 'Media Library' },
    { slug: 'homepage', label: 'Homepage Management' },
    { slug: 'categories', label: 'Categories & Tags' },
    { slug: 'logs', label: 'Activity Logs' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Users, Credentials &amp; Role Permissions
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {isSuperAdmin
              ? 'Super Admin Credential Vault: inspect all user accounts & passwords, reset passwords, manage active status, and assign role permissions.'
              : 'Assign Panchayat, School, Hospital, Police, News, Event, and Gallery editors with strict module-level access control.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowAllPasswords((v) => !v)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
            >
              {showAllPasswords ? <EyeOff className="w-4 h-4 text-rose-600" /> : <Eye className="w-4 h-4 text-blue-600" />}
              <span>{showAllPasswords ? 'Hide All Passwords' : 'Show All Passwords'}</span>
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setNewUserOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Editor / User</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users Table + Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-bold text-sm text-slate-900">
            Portal User Accounts ({filteredUsers.length})
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user, email or role..."
              className="text-xs bg-transparent focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">User &amp; Status</th>
                <th className="py-3 px-3">Username</th>
                {isSuperAdmin && <th className="py-3 px-3">Password</th>}
                <th className="py-3 px-3">Scope / Assigned Unit</th>
                <th className="py-3 px-3">Assigned Role</th>
                {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isRevealed = showAllPasswords || Boolean(revealedIds[u.id]);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{u.full_name}</span>
                        <button
                          type="button"
                          onClick={() => toggleUserActive(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active === 1
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                          title="Click to toggle Active / Suspended"
                        >
                          {u.is_active === 1 ? 'Active' : 'Suspended'}
                        </button>
                      </div>
                      <div className="text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800">{u.username}</td>
                    {isSuperAdmin && (
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1">
                          <span className="font-mono text-slate-900 min-w-[90px]">
                            {isRevealed ? (u.visible_password || 'balagarh2026') : '••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRevealUser(u.id)}
                            className="p-0.5 text-slate-500 hover:text-blue-700"
                            title={isRevealed ? 'Hide password' : 'Show password'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyPassword(u)}
                            className="p-0.5 text-slate-500 hover:text-emerald-700"
                            title="Copy password"
                          >
                            {copiedId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-3 text-slate-600">{u.assigned_panchayat || u.assigned_institution || 'All Block Modules'}</td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role_id}
                        onChange={(e) => changeUserRole(u, Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                      >
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name_en}</option>)}
                      </select>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTarget(u);
                            setResetPasswordInput('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset Password</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredUsers.map((u) => {
            const isRevealed = showAllPasswords || Boolean(revealedIds[u.id]);
            return (
              <div key={u.id} className="p-4 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{u.full_name}</div>
                    <div className="text-slate-500 truncate">{u.email}</div>
                    <div className="font-mono text-blue-700 font-semibold mt-0.5">@{u.username}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleUserActive(u)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      u.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {u.is_active === 1 ? 'Active' : 'Suspended'}
                  </button>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-slate-500 font-semibold">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {isRevealed ? (u.visible_password || 'balagarh2026') : '••••••••'}
                      </span>
                      <button type="button" onClick={() => toggleRevealUser(u.id)} className="p-1 text-slate-600">
                        {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={() => copyPassword(u)} className="p-1 text-slate-600">
                        {copiedId === u.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={u.role_id}
                    onChange={(e) => changeUserRole(u, Number(e.target.value))}
                    className="flex-1 px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-xs"
                  >
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name_en}</option>)}
                  </select>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget(u);
                        setResetPasswordInput('');
                      }}
                      className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset Password</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roles & Permissions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.accent_color }} />
                  {r.name_en}
                </span>
                <span className="text-xs text-slate-500 text-right">{r.name_bn}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">{r.description}</p>
              <div className="text-[11px] text-slate-500 mt-2">
                <strong>Modules:</strong> {r.permissions.modules.includes('*') ? 'All Modules (*)' : `${r.permissions.modules.length} assigned`}
              </div>
              <div className="text-[11px] text-slate-500">
                <strong>Actions:</strong> {r.permissions.actions.join(', ')}
              </div>
            </div>
            {isSuperAdmin && r.slug !== 'super_admin' && (
              <button
                type="button"
                onClick={() => setEditingRole(r)}
                className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 text-xs font-bold flex items-center justify-center gap-1"
              >
                <Shield className="w-3.5 h-3.5" /> Edit Module Permissions
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Super Admin Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleAdminResetPassword} className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2 text-slate-900">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <span>Reset User Password</span>
              </h3>
              <button type="button" onClick={() => setResetTarget(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5">
              <div className="font-bold text-slate-900">{resetTarget.full_name}</div>
              <div className="text-slate-600">
                Username: <span className="font-mono font-semibold">{resetTarget.username}</span> · {resetTarget.role_name_en}
              </div>
              <div className="text-slate-500">{resetTarget.email}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">New Password (min 6 chars)</label>
                <button
                  type="button"
                  onClick={() => setResetPasswordInput(`Balagarh@${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Strong Password
                </button>
              </div>
              <div className="relative">
                <input
                  type={showResetInput ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Enter new password for this user"
                  className="w-full pl-3.5 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowResetInput((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500"
                >
                  {showResetInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 border rounded-lg text-xs font-bold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold">
                Reset &amp; Save Password
              </button>
            </div>
          </form>
        </div>
      )}

      {newUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={createUser} className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Create New CMS User</h3>
              <button type="button" onClick={() => setNewUserOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <input required placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name_en}</option>)}
            </select>
            <input placeholder="Assigned Gram Panchayat (optional)" value={form.assigned_panchayat} onChange={(e) => setForm({ ...form, assigned_panchayat: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Assigned School / Hospital (optional)" value={form.assigned_institution} onChange={(e) => setForm({ ...form, assigned_institution: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewUserOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Create User</button>
            </div>
          </form>
        </div>
      )}

      {editingRole && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base">Module Permissions: {editingRole.name_en}</h3>
              <button type="button" onClick={() => setEditingRole(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">Allowed Actions</div>
                <div className="flex flex-wrap gap-2">
                  {(['view', 'create', 'edit', 'publish', 'delete'] as const).map((act) => {
                    const has = editingRole.permissions.actions.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setEditingRole({
                          ...editingRole,
                          permissions: {
                            ...editingRole.permissions,
                            actions: has
                              ? editingRole.permissions.actions.filter((a) => a !== act)
                              : [...editingRole.permissions.actions, act],
                          },
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border ${
                          has ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {act}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">Authorised Modules</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {allModules.map((m) => {
                    const has = editingRole.permissions.modules.includes(m.slug);
                    return (
                      <label key={m.slug} className="flex items-center gap-2 text-xs p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={() => setEditingRole({
                            ...editingRole,
                            permissions: {
                              ...editingRole.permissions,
                              modules: has
                                ? editingRole.permissions.modules.filter((x) => x !== m.slug)
                                : [...editingRole.permissions.modules, m.slug],
                            },
                          })}
                        />
                        <span className="truncate">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button type="button" onClick={() => setEditingRole(null)} className="px-4 py-2 rounded-lg border text-xs font-bold">Cancel</button>
              <button type="button" onClick={saveRolePermissions} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Save Permissions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TaxonomyManagerView: React.FC<{ sections: ContentSection[] }> = ({ sections }) => {
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [catForm, setCatForm] = useState({ section_slug: sections[0]?.slug || 'news-announcements', name_en: '', name_bn: '' });
  const [tagForm, setTagForm] = useState({ name_en: '', name_bn: '' });

  const load = () => {
    apiFetch<{ categories: ContentCategory[]; tags: ContentTag[] }>('/api/admin/taxonomy')
      .then((res) => {
        setCategories(res.categories);
        setTags(res.tags);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(catForm) });
    setCatForm({ ...catForm, name_en: '', name_bn: '' });
    load();
  };

  const addTag = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/tags', { method: 'POST', body: JSON.stringify(tagForm) });
    setTagForm({ name_en: '', name_bn: '' });
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Manage Section Categories ({categories.length})</h3>
        <form onSubmit={addCategory} className="space-y-2">
          <select value={catForm.section_slug} onChange={(e) => setCatForm({ ...catForm, section_slug: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs">
            {sections.map((s) => <option key={s.slug} value={s.slug}>{s.name_en}</option>)}
          </select>
          <div className="flex gap-2">
            <input required placeholder="Category (EN)" value={catForm.name_en} onChange={(e) => setCatForm({ ...catForm, name_en: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            <input required placeholder="Category (BN)" value={catForm.name_bn} onChange={(e) => setCatForm({ ...catForm, name_bn: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
        </form>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900">{c.name_en}</span> ({c.name_bn})
                <span className="text-slate-400 ml-2">· {c.section_slug}</span>
              </div>
              <button type="button" onClick={async () => { await apiFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' }); load(); }} className="text-red-600 hover:text-red-800">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Tag className="w-4 h-4 text-violet-600" /> Manage Content Tags ({tags.length})</h3>
        <form onSubmit={addTag} className="flex gap-2">
          <input required placeholder="Tag Name (EN)" value={tagForm.name_en} onChange={(e) => setTagForm({ ...tagForm, name_en: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs" />
          <input required placeholder="Tag Name (BN)" value={tagForm.name_bn} onChange={(e) => setTagForm({ ...tagForm, name_bn: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs" />
          <button type="submit" className="px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
        </form>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
          {tags.map((t) => (
            <div key={t.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900">{t.name_en}</span> · <span className="text-slate-600">{t.name_bn}</span>
              </div>
              <button type="button" onClick={async () => { await apiFetch(`/api/admin/tags/${t.id}`, { method: 'DELETE' }); load(); }} className="text-red-600 hover:text-red-800">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [moduleFilter, setModuleFilter] = useState('all');

  useEffect(() => {
    apiFetch<{ logs: ActivityLog[] }>(`/api/admin/logs?module=${moduleFilter}`)
      .then((res) => setLogs(res.logs))
      .catch(() => {});
  }, [moduleFilter]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>CMS Activity & Audit Logs</span>
        </div>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs">
          <option value="all">All Modules</option>
          <option value="events">Events</option>
          <option value="media">Media Library</option>
          <option value="homepage">Homepage</option>
          <option value="news-announcements">News</option>
          <option value="notices-circulars">Notices</option>
          <option value="users">Users & Roles</option>
        </select>
      </div>
      <div className="divide-y divide-slate-100">
        {logs.map((l) => (
          <div key={l.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-slate-900">{l.user_name}</span>{' '}
              <span className="text-slate-500">({l.role_name})</span> ·{' '}
              <span className="font-semibold text-blue-700 uppercase">{l.action}</span> in{' '}
              <span className="font-mono text-slate-700">{l.module}</span>
              <div className="text-slate-600 mt-0.5">{l.details}</div>
            </div>
            <div className="text-slate-400 tabular-nums shrink-0">{l.created_at}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
