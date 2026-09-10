'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'administrator' | 'dept_head' | 'publisher' | 'airline_manager' | 'viewer';
  airline: string | null;
  is_active: boolean;
  created_at: string;
}

interface Airline {
  id: string;
  iata_code: string;
  name: string;
  country: string;
  contact_email: string | null;
  lcaa_notify: boolean;
  is_active: boolean;
}

const ROLES = ['administrator', 'dept_head', 'publisher', 'airline_manager', 'viewer'] as const;
type Role = typeof ROLES[number];

const roleConfig: Record<Role, { label: string; color: string; bg: string; permissions: string[] }> = {
  administrator: {
    label: 'Administrator',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    permissions: ['Manage users', 'Publish notices', 'View all data', 'Export reports', 'System settings', 'Audit access'],
  },
  dept_head: {
    label: 'Dept. Head',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    permissions: ['Approve notices', 'View department data', 'Export reports', 'Manage team'],
  },
  publisher: {
    label: 'Publisher',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    permissions: ['Create notices', 'Publish notices', 'View own notices', 'Send safety flash'],
  },
  airline_manager: {
    label: 'Airline Mgr',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    permissions: ['View airline notices', 'Acknowledge notices', 'View airline reports'],
  },
  viewer: {
    label: 'Viewer',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.12)',
    permissions: ['View published notices', 'Acknowledge notices'],
  },
};

type FilterRole = Role | 'all';
type FilterStatus = 'all' | 'active' | 'inactive';

const emptyAirlineForm = { iata_code: '', name: '', country: '', contact_email: '', lcaa_notify: false };

export default function UserAccessManagementContent() {
  const { profile: currentProfile } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<Role>('viewer');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'airlines'>('users');

  // Add Airline modal state
  const [addAirlineOpen, setAddAirlineOpen] = useState(false);
  const [airlineForm, setAirlineForm] = useState(emptyAirlineForm);
  const [airlineSaving, setAirlineSaving] = useState(false);
  const [airlineMsg, setAirlineMsg] = useState('');

  const isAdmin = currentProfile?.role === 'administrator';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUsers(data as UserProfile[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchAirlines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('airlines')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data) {
        setAirlines(data as Airline[]);
      }
    } catch {
      // silent
    }
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
    fetchAirlines();
  }, [fetchUsers, fetchAirlines]);

  const filtered = users.filter((u) => {
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active);
    const matchSearch =
      !searchQuery ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.airline || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchStatus && matchSearch;
  });

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditActive(user.is_active);
    setSaveMsg('');
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: editRole, is_active: editActive, updated_at: new Date().toISOString() })
        .eq('id', editingUser.id);
      if (!error) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? { ...u, role: editRole, is_active: editActive } : u))
        );
        setSaveMsg('Changes saved successfully.');
        setTimeout(() => { setEditingUser(null); setSaveMsg(''); }, 1200);
      } else {
        setSaveMsg('Failed to save. Please try again.');
      }
    } catch {
      setSaveMsg('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: UserProfile) => {
    if (!isAdmin) return;
    const newActive = !user.is_active;
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: newActive } : u)));
    }
  };

  const saveAirline = async () => {
    if (!airlineForm.iata_code.trim() || !airlineForm.name.trim()) {
      setAirlineMsg('IATA code and airline name are required.');
      return;
    }
    setAirlineSaving(true);
    setAirlineMsg('');
    try {
      const { error } = await supabase.from('airlines').insert({
        iata_code: airlineForm.iata_code.toUpperCase().trim(),
        name: airlineForm.name.trim(),
        country: airlineForm.country.trim(),
        contact_email: airlineForm.contact_email.trim() || null,
        lcaa_notify: airlineForm.lcaa_notify,
        is_active: true,
      });
      if (!error) {
        setAirlineMsg('Airline added successfully.');
        await fetchAirlines();
        setTimeout(() => { setAddAirlineOpen(false); setAirlineForm(emptyAirlineForm); setAirlineMsg(''); }, 1200);
      } else {
        setAirlineMsg(error.message ?? 'Failed to add airline.');
      }
    } catch {
      setAirlineMsg('Failed to add airline. Please try again.');
    } finally {
      setAirlineSaving(false);
    }
  };

  const toggleAirlineActive = async (airline: Airline) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('airlines')
      .update({ is_active: !airline.is_active, updated_at: new Date().toISOString() })
      .eq('id', airline.id);
    if (!error) {
      setAirlines((prev) => prev.map((a) => (a.id === airline.id ? { ...a, is_active: !airline.is_active } : a)));
    }
  };

  const roleCounts = ROLES.reduce<Record<Role, number>>((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {} as Record<Role, number>);

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="space-y-6 fade-in">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: 'UsersIcon', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Active Users', value: activeCount, icon: 'CheckCircleIcon', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
          { label: 'Inactive Users', value: inactiveCount, icon: 'XCircleIcon', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Airlines', value: airlines.length, icon: 'BuildingOfficeIcon', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
        ].map((kpi, i) => (
          <div key={`kpi-${i}`} className="card-surface p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.bg }}>
                <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={20} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold font-tabular" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--muted)' }}>
        {(['users', 'roles', 'airlines'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
            style={{
              background: activeTab === tab ? 'var(--card)' : 'transparent',
              color: activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'users' ? 'User Directory' : tab === 'roles' ? 'Role Permissions' : 'Airlines'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="card-surface overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative flex-1 min-w-[200px]">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              <input
                type="text"
                placeholder="Search by name, email, or airline…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as FilterRole)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="all">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleConfig[r].label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button onClick={fetchUsers} className="btn-ghost p-2 rounded-lg" title="Refresh">
              <Icon name="ArrowPathIcon" size={16} />
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="ArrowPathIcon" size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="UsersIcon" size={32} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No users match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                    {['User', 'Role', 'Airline', 'Status', 'Joined', 'Actions'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const rc = roleConfig[user.role];
                    const initials = user.full_name
                      ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                      : user.email.slice(0, 2).toUpperCase();
                    return (
                      <tr key={user.id} className="hover:bg-muted/40 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--primary)' }}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{user.full_name || '—'}</p>
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: rc.bg, color: rc.color }}>
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{user.airline || '—'}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{
                              background: user.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                              color: user.is_active ? '#22C55E' : '#6B7280',
                            }}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <>
                                <button onClick={() => openEdit(user)} className="btn-ghost p-1.5 rounded-lg" title="Edit role & access">
                                  <Icon name="PencilSquareIcon" size={15} />
                                </button>
                                <button
                                  onClick={() => toggleActive(user)}
                                  className="btn-ghost p-1.5 rounded-lg"
                                  title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                >
                                  <Icon name={user.is_active ? 'LockClosedIcon' : 'LockOpenIcon'} size={15} style={{ color: user.is_active ? '#EF4444' : '#22C55E' }} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Showing {filtered.length} of {users.length} users
            </p>
            {!isAdmin && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="LockClosedIcon" size={12} className="inline mr-1" />
                Administrator access required to modify users
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ROLES.map((role) => {
            const rc = roleConfig[role];
            return (
              <div key={role} className="card-surface p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: rc.bg }}>
                      <Icon name="ShieldCheckIcon" size={20} style={{ color: rc.color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{rc.label}</h3>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{roleCounts[role]} user{roleCounts[role] !== 1 ? 's' : ''} assigned</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: rc.bg, color: rc.color }}>
                    {role}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>Permissions</p>
                  {rc.permissions.map((perm) => (
                    <div key={perm} className="flex items-center gap-2">
                      <Icon name="CheckCircleIcon" size={14} style={{ color: rc.color, flexShrink: 0 }} />
                      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'airlines' && (
        <div className="card-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Registered Airlines</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{airlines.filter(a => a.is_active).length} active airlines in the system</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setAddAirlineOpen(true); setAirlineForm(emptyAirlineForm); setAirlineMsg(''); }}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Icon name="PlusIcon" size={16} />
                Add New Airline
              </button>
            )}
          </div>

          {airlines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="BuildingOfficeIcon" size={32} style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No airlines registered yet.</p>
              {isAdmin && (
                <button onClick={() => setAddAirlineOpen(true)} className="btn-primary text-sm">
                  Add First Airline
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                    {['Airline', 'IATA', 'Country', 'Contact Email', 'LCAA Notify', 'Status', 'Actions'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.03em' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {airlines.map((airline) => (
                    <tr key={airline.id} className="hover:bg-muted/40 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{airline.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--primary)' }}>
                          {airline.iata_code}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{airline.country || '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{airline.contact_email || '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: airline.lcaa_notify ? 'rgba(59,130,246,0.12)' : 'rgba(107,114,128,0.12)',
                            color: airline.lcaa_notify ? '#3B82F6' : '#6B7280',
                          }}
                        >
                          {airline.lcaa_notify ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: airline.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                            color: airline.is_active ? '#22C55E' : '#6B7280',
                          }}
                        >
                          {airline.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {isAdmin && (
                          <button
                            onClick={() => toggleAirlineActive(airline)}
                            className="btn-ghost p-1.5 rounded-lg"
                            title={airline.is_active ? 'Deactivate airline' : 'Activate airline'}
                          >
                            <Icon name={airline.is_active ? 'LockClosedIcon' : 'LockOpenIcon'} size={15} style={{ color: airline.is_active ? '#EF4444' : '#22C55E' }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl border shadow-2xl fade-in" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Edit User Access</h2>
              <button className="btn-ghost p-1.5 rounded-lg" onClick={() => setEditingUser(null)}>
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--muted)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--primary)' }}>
                  {editingUser.full_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??'}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{editingUser.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{editingUser.email}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--muted-foreground)' }}>Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleConfig[r].label}</option>
                  ))}
                </select>
                {editRole && (
                  <div className="mt-2 p-3 rounded-lg" style={{ background: roleConfig[editRole].bg }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: roleConfig[editRole].color }}>Permissions for {roleConfig[editRole].label}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {roleConfig[editRole].permissions.map((p) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: roleConfig[editRole].color }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--muted)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Account Status</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Inactive users cannot log in</p>
                </div>
                <button
                  onClick={() => setEditActive(!editActive)}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200"
                  style={{ background: editActive ? 'var(--primary)' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                    style={{ background: '#fff', transform: editActive ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              {saveMsg && (
                <p className="text-xs text-center font-medium" style={{ color: saveMsg.includes('success') ? '#22C55E' : '#EF4444' }}>
                  {saveMsg}
                </p>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button className="flex-1 btn-ghost py-2 rounded-lg text-sm font-semibold" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button
                className="flex-1 btn-primary py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Airline Modal */}
      {addAirlineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl border shadow-2xl fade-in" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Add New Airline</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Register a new airline in the MEAG system</p>
              </div>
              <button className="btn-ghost p-1.5 rounded-lg" onClick={() => setAddAirlineOpen(false)}>
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    IATA Code <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="e.g. MS"
                    value={airlineForm.iata_code}
                    onChange={(e) => setAirlineForm((f) => ({ ...f, iata_code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border font-mono uppercase"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Airline Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EgyptAir"
                    value={airlineForm.name}
                    onChange={(e) => setAirlineForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Country</label>
                <input
                  type="text"
                  placeholder="e.g. Egypt"
                  value={airlineForm.country}
                  onChange={(e) => setAirlineForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Contact Email</label>
                <input
                  type="email"
                  placeholder="e.g. ops@airline.com"
                  value={airlineForm.contact_email}
                  onChange={(e) => setAirlineForm((f) => ({ ...f, contact_email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--muted)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>LCAA Notifications</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Notify Lebanese Civil Aviation Authority for this airline</p>
                </div>
                <button
                  onClick={() => setAirlineForm((f) => ({ ...f, lcaa_notify: !f.lcaa_notify }))}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{ background: airlineForm.lcaa_notify ? '#3B82F6' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                    style={{ background: '#fff', transform: airlineForm.lcaa_notify ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              {airlineMsg && (
                <p className="text-xs text-center font-medium" style={{ color: airlineMsg.includes('success') ? '#22C55E' : '#EF4444' }}>
                  {airlineMsg}
                </p>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button className="flex-1 btn-ghost py-2 rounded-lg text-sm font-semibold" onClick={() => setAddAirlineOpen(false)}>
                Cancel
              </button>
              <button
                className="flex-1 btn-primary py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                onClick={saveAirline}
                disabled={airlineSaving}
              >
                {airlineSaving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                Add Airline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
