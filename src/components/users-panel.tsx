"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AdminUser, Admin, ListAdminsResponse } from "@/lib/types";
import { DEMO_USERS, DEMO_METRICS } from "@/lib/demo-data";
import { StatCard } from "@/components/ui/stat-card";
import { UsersIcon, EyeIcon, PencilIcon, TrashIcon, RefreshIcon, ShieldIcon, CrownIcon, PlusIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface UserStats {
  users: number;
  admins: number;
  owners: number;
  appUsers: number;
}

export function UsersPanel() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"users" | "admins">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: "", number: "" });
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserBusy, setCreateUserBusy] = useState(false);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "appoint" | "dismiss" | null>(null);

  // Form state
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [appointUserId, setAppointUserId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    name: true,
    number: true,
    balance: true,
    prints: true,
    status: true,
    enabled: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);

    try {
      const response = await fetch("/api/stats/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("Users stats:", data);

      if (data.success === true && data.data) {
        setUserStats(data.data.stats);
      } else {
        console.warn("Failed to fetch user stats:", data);
        setUserStats({
          users: DEMO_METRICS.totalUsers,
          admins: 1,
          owners: 1,
          appUsers: DEMO_METRICS.totalUsers - 2,
        });
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      setUserStats({
        users: DEMO_METRICS.totalUsers,
        admins: 1,
        owners: 1,
        appUsers: DEMO_METRICS.totalUsers - 2,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setIsDemo(false);

    try {
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false || !data.data?.users) {
        setUsers(DEMO_USERS);
        setIsDemo(true);
      } else {
        console.log(data.data);
        setUsers(data.data.users);
      }
    } catch {
      setUsers(DEMO_USERS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterRole]);

  const visibleUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) ||
                          u.number?.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === "all" ? true :
                        filterRole === "admin" ? u.isAdmin : !u.isAdmin;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  const totalPages = Math.ceil(visibleUsers.length / pageSize) || 1;
  const paginatedData = visibleUsers.slice((page - 1) * pageSize, page * pageSize);

  const chartData = useMemo(() => {
    return users
      .slice()
      .sort((a, b) => (b.totalPrints || 0) - (a.totalPrints || 0))
      .slice(0, 5)
      .map(u => ({ name: u.name || u.number, prints: u.totalPrints || 0 }));
  }, [users]);

  const openModal = (user: AdminUser, mode: "view" | "edit") => {
    setSelectedUser(user);
    setModalMode(mode);
    setEditName(user.name || "");
    setEditNumber(user.number || "");
    setActionError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateUserForm({ name: "", number: "" });
    setCreateUserError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreateUserBusy(true);
    setCreateUserError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createUserForm.name,
          number: createUserForm.number,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false) {
        setCreateUserError(data.message || data.error || "Failed to create user");
      } else {
        closeCreateModal();
        void load();
        void loadStats();
      }
    } catch (err) {
      setCreateUserError("Network error creating user");
    } finally {
      setCreateUserBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !token) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName, number: editNumber }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false) {
        setActionError(data.error || data.message || "Failed to update user");
      } else {
        closeModal();
        void load();
        void loadStats();
      }
    } catch (err) {
      setActionError("Network error calling PUT /api/users/:id");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleDisable = async (user: AdminUser) => {
    if (!token) return;
    setBusy(true);
    setActionError(null);

    try {
      const newDisabledState = !user.isDisabled;
      console.log(`Toggling user ${user._id} disable status to:`, newDisabledState);

      const response = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDisabled: newDisabledState }),
      });

      console.log("Toggle response status:", response.status);
      const data = await response.json();
      console.log("Toggle response data:", data);

      if (!response.ok) {
        setActionError(data.error || data.message || `Failed to update user status (HTTP ${response.status})`);
        return;
      }

      if (data.success === false) {
        setActionError(data.error || data.message || "Failed to update user status");
        return;
      }

      void load();
      void loadStats();
    } catch (err) {
      console.error("Error toggling user status:", err);
      setActionError(`Error: ${err instanceof Error ? err.message : "Unknown error updating user status"}`);
    } finally {
      setBusy(false);
    }
  };

  const loadAdmins = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admins", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ListAdminsResponse = await response.json();
      console.log("Admins data:", data);

      if (data.success === false || !data.data?.admins) {
        setAdmins([]);
        setError("Failed to load admins");
      } else {
        setAdmins(data.data.admins);
      }
    } catch (err) {
      setError("Network error loading admins");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleAppointAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !appointUserId) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user: appointUserId }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to appoint admin");
      } else {
        setModalMode(null);
        setAppointUserId("");
        void loadAdmins();
        void loadStats();
      }
    } catch (err) {
      setActionError("Network error appointing admin");
    } finally {
      setBusy(false);
    }
  };

  const handleDismissAdmin = async () => {
    if (!selectedAdmin || !token) return;
    setBusy(true);
    setActionError(null);

    try {
      const adminIdObj = selectedAdmin._id as any;
      const adminId = adminIdObj?._id || adminIdObj?.$oid || adminIdObj;

      const response = await fetch(`/api/admins/${adminId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to dismiss admin");
      } else {
        setModalMode(null);
        setSelectedAdmin(null);
        void loadAdmins();
        void loadStats();
      }
    } catch (err) {
      setActionError("Network error dismissing admin");
    } finally {
      setBusy(false);
    }
  };

  // Conditionally load based on tab
  useEffect(() => {
    if (tab === "admins") {
      void loadAdmins();
    }
  }, [tab, loadAdmins]);

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            tab === "users"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setTab("admins")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            tab === "admins"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Admins
        </button>
      </div>

      {/* Top right actions */}
      <div className="flex justify-end items-center gap-2 -mt-16 sm:-mt-20 relative z-10 mb-4">
        {tab === "users" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create User
          </button>
        )}
        {tab === "admins" && (
          <button
            onClick={() => setModalMode("appoint")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Appoint Admin
          </button>
        )}
        <button
          onClick={() => tab === "users" ? void load() : void loadAdmins()}
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      {tab === "users" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={statsLoading ? "—" : userStats?.users || 0} icon={<UsersIcon />} accentColor="accent" isDemo={isDemo} />
            <StatCard label="Admins" value={statsLoading ? "—" : userStats?.admins || 0} icon={<ShieldIcon />} accentColor="print-request" isDemo={isDemo} />
            <StatCard label="Owners" value={statsLoading ? "—" : userStats?.owners || 0} icon={<CrownIcon />} accentColor="credit-wallet" isDemo={isDemo} />
            <StatCard label="App Users" value={statsLoading ? "—" : userStats?.appUsers || 0} icon={<UsersIcon />} accentColor="accent" isDemo={isDemo} />
          </div>

          <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-sm font-medium text-muted mb-4">Top Users by Prints</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                  <Bar dataKey="prints" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === "admins" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          <StatCard label="Total Admins" value={loading ? "—" : admins.length} icon={<ShieldIcon />} accentColor="accent" />
        </div>
      )}

      {tab === "users" && (
        <>
          {actionError && (
            <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
              {actionError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-border rounded-lg px-4 py-2 bg-surface text-sm w-full md:w-64 shadow-sm"
          />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as any)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm shadow-sm"
          >
            <option value="all">All Roles</option>
            <option value="user">Regular Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* Columns Dropdown */}
        <div className="relative">
          <button
            onClick={() => setColsMenuOpen(!colsMenuOpen)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm flex items-center gap-2"
          >
            Columns
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {colsMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-lg z-20 p-2">
              {Object.entries(cols).map(([key, isVisible]) => (
                <label key={key} className="flex items-center gap-2 p-2 hover:bg-surface-muted rounded cursor-pointer text-sm capitalize">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => setCols(prev => ({ ...prev, [key]: !prev[key as keyof typeof cols] }))}
                    className="rounded"
                  />
                  {key}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-muted/50 text-muted">
              <tr>
                {cols.name && <th className="px-4 py-3 font-medium">Name</th>}
                {cols.number && <th className="px-4 py-3 font-medium">Number</th>}
                {cols.balance && <th className="px-4 py-3 font-medium">Balance</th>}
                {cols.prints && <th className="px-4 py-3 font-medium">Prints</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Role</th>}
                {cols.enabled && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No users found.</td></tr>
              ) : (
                paginatedData.map(user => (
                  <tr key={user._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors" onClick={() => openModal(user, "view")}>
                    {cols.name && <td className="px-4 py-3 font-medium">{user.name || "—"}</td>}
                    {cols.number && <td className="px-4 py-3 text-muted">{user.number}</td>}
                    {cols.balance && <td className="px-4 py-3">{user.balance} PKR</td>}
                    {cols.prints && <td className="px-4 py-3 text-muted">{user.totalPrints || 0}</td>}
                    {cols.status && (
                      <td className="px-4 py-3">
                        {user.isAdmin ? (
                          <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-xs font-medium">Admin</span>
                        ) : (
                          <span className="bg-surface-muted text-muted px-2 py-0.5 rounded text-xs">User</span>
                        )}
                      </td>
                    )}
                    {cols.enabled && (
                      <td className="px-4 py-3">
                        {user.isDisabled ? (
                          <span className="bg-danger-soft text-danger px-2 py-0.5 rounded text-xs font-medium">Disabled</span>
                        ) : (
                          <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-xs font-medium">Enabled</span>
                        )}
                      </td>
                    )}
                    {cols.actions && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); openModal(user, "view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); openModal(user, "edit"); }} className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleToggleDisable(user); }}
                            disabled={busy}
                            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                              user.isDisabled
                                ? "bg-accent-soft text-accent hover:bg-accent hover:text-white"
                                : "bg-warning-soft text-warning hover:bg-warning hover:text-white"
                            } disabled:opacity-50`}
                            title={user.isDisabled ? "Enable user" : "Disable user"}
                          >
                            {user.isDisabled ? "Enable" : "Disable"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!loading && paginatedData.length > 0 && (
          <div className="border-t border-border bg-surface px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted">
              Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, visibleUsers.length)}</span> of <span className="font-medium">{visibleUsers.length}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border border-border bg-surface text-sm hover:bg-surface-muted transition disabled:opacity-50"
              >
                Previous
              </button>
              <div className="px-3 py-1 text-sm font-medium">Page {page} of {totalPages}</div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md border border-border bg-surface text-sm hover:bg-surface-muted transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalMode === "view"} onClose={closeModal} title="User Details">
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">Name</p>
                <p className="font-medium">{selectedUser.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Number</p>
                <p className="font-medium">{selectedUser.number}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Balance</p>
                <p className="font-medium">{selectedUser.balance} PKR</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Role</p>
                <p className="font-medium">{selectedUser.isAdmin ? "Admin" : "Regular User"}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Joined</p>
                <p className="font-medium">{selectedUser.joinedAt ? new Date(selectedUser.joinedAt).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "edit"} onClose={closeModal} title="Edit User">
        {selectedUser && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
                placeholder="User name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="text"
                value={editNumber}
                onChange={e => setEditNumber(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
                placeholder="923235400291"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>


      <Modal isOpen={showCreateModal} onClose={closeCreateModal} title="Create User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          {createUserError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{createUserError}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={createUserForm.name}
              onChange={e => setCreateUserForm({ ...createUserForm, name: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
              placeholder="User name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="text"
              value={createUserForm.number}
              onChange={e => setCreateUserForm({ ...createUserForm, number: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
              placeholder="923235400291"
              required
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={closeCreateModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
            <button type="submit" disabled={createUserBusy} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Create User</button>
          </div>
        </form>
      </Modal>
        </>
      )}

      {/* Admins Tab */}
      {tab === "admins" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Appointed At</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Loading admins…</td></tr>
                  ) : admins.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No admins yet.</td></tr>
                  ) : (
                    <>
                      {admins.map((admin, idx) => {
                        const adminIdObj = admin._id as any;
                        const adminId = adminIdObj?._id || adminIdObj?.$oid || String(idx);
                        const userName = adminIdObj?.name || "—";
                        const userNumber = adminIdObj?.number || "—";
                        return (
                        <tr key={adminId} className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors">
                          <td className="px-4 py-3 font-medium">{userName}</td>
                          <td className="px-4 py-3 text-muted">{userNumber}</td>
                          <td className="px-4 py-3 text-muted">{admin.appointedAt ? new Date(admin.appointedAt).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAdmin(admin);
                                  setModalMode("dismiss");
                                }}
                                disabled={busy}
                                className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-1 text-xs font-medium text-danger hover:bg-danger hover:text-white transition disabled:opacity-60"
                              >
                                Dismiss
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Appoint Admin Modal */}
          <Modal isOpen={modalMode === "appoint"} onClose={() => { setModalMode(null); setAppointUserId(""); setActionError(null); }} title="Appoint Admin">
            <form onSubmit={handleAppointAdmin} className="space-y-4">
              {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}

              <div>
                <label className="block text-sm font-medium mb-1">Select User</label>
                <select
                  value={appointUserId}
                  onChange={e => setAppointUserId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
                  required
                >
                  <option value="">Choose a user...</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name || user.number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => { setModalMode(null); setAppointUserId(""); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
                <button type="submit" disabled={busy || !appointUserId} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Appoint Admin</button>
              </div>
            </form>
          </Modal>

          {/* Dismiss Admin Modal */}
          <Modal isOpen={modalMode === "dismiss"} onClose={() => { setModalMode(null); setSelectedAdmin(null); setActionError(null); }} title="Dismiss Admin">
            {selectedAdmin && (
              <div className="space-y-4">
                {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
                <p className="text-sm">Are you sure you want to dismiss <strong>{(selectedAdmin._id as any)?.name || (selectedAdmin._id as any)?.number || "this admin"}</strong> as an admin?</p>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => { setModalMode(null); setSelectedAdmin(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
                  <button type="button" onClick={handleDismissAdmin} disabled={busy} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Dismiss</button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}

    </div>
  );
}
