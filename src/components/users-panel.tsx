"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AdminUser } from "@/lib/types";
import { DEMO_USERS, DEMO_METRICS } from "@/lib/demo-data";
import { StatCard } from "@/components/ui/stat-card";
import { UsersIcon, EyeIcon, PencilIcon, TrashIcon, RefreshIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function UsersPanel() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");
  
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "delete" | null>(null);
  
  // Form state
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState(0);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setIsDemo(false);

    try {
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || data.success === false || !data.data?.users) {
        // Fallback to demo data per plan
        setUsers(DEMO_USERS);
        setIsDemo(true);
      } else {
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
  }, [load]);

  const visibleUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.number?.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === "all" ? true : 
                        filterRole === "admin" ? u.isAdmin : !u.isAdmin;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  const chartData = useMemo(() => {
    return users
      .slice()
      .sort((a, b) => (b.totalPrints || 0) - (a.totalPrints || 0))
      .slice(0, 5)
      .map(u => ({ name: u.name || u.number, prints: u.totalPrints || 0 }));
  }, [users]);

  const openModal = (user: AdminUser, mode: "view" | "edit" | "delete") => {
    setSelectedUser(user);
    setModalMode(mode);
    setEditName(user.name || "");
    setEditBalance(user.balance || 0);
    setEditIsAdmin(user.isAdmin || false);
    setActionError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !token) return;
    setBusy(true);
    setActionError(null);
    
    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName, balance: editBalance, isAdmin: editIsAdmin }),
      });
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Backend endpoint missing or failed. Showing real error.");
      } else {
        closeModal();
        load();
      }
    } catch (err) {
      setActionError("Network error calling PATCH /api/users/:id");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser || !token) return;
    setBusy(true);
    setActionError(null);
    
    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Backend endpoint missing or failed. Showing real error.");
      } else {
        closeModal();
        load();
      }
    } catch (err) {
      setActionError("Network error calling DELETE /api/users/:id");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={isDemo ? DEMO_METRICS.totalUsers : users.length} icon={<UsersIcon />} accentColor="accent" isDemo={isDemo} />
        <StatCard label="Total Prints" value={isDemo ? DEMO_METRICS.totalPrints : users.reduce((acc, u) => acc + (u.totalPrints || 0), 0)} accentColor="print-request" isDemo={isDemo} />
        <StatCard label="Avg Prints / User" value={isDemo ? DEMO_METRICS.avgPrintsPerUser : "0"} accentColor="credit-wallet" isDemo={isDemo} />
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

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 flex-wrap flex-1">
          <input 
            type="text" 
            placeholder="Search by name or number..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm w-full md:w-64"
          />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as any)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm"
          >
            <option value="all">All Roles</option>
            <option value="user">Regular Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <button 
          onClick={() => void load()} 
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-muted/50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Prints</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : visibleUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No users found.</td></tr>
              ) : (
                visibleUsers.map(user => (
                  <tr key={user._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                    <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                    <td className="px-4 py-3 text-muted">{user.number}</td>
                    <td className="px-4 py-3">{user.balance} PKR</td>
                    <td className="px-4 py-3 text-muted">{user.totalPrints || 0}</td>
                    <td className="px-4 py-3">
                      {user.isAdmin ? (
                        <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-xs font-medium">Admin</span>
                      ) : (
                        <span className="bg-surface-muted text-muted px-2 py-0.5 rounded text-xs">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(user, "view")} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                        <button onClick={() => openModal(user, "edit")} className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => openModal(user, "delete")} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Balance</label>
              <input type="number" value={editBalance} onChange={e => setEditBalance(Number(e.target.value))} className="w-full border border-border rounded-lg px-3 py-2" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="isAdmin" checked={editIsAdmin} onChange={e => setEditIsAdmin(e.target.checked)} className="rounded" />
              <label htmlFor="isAdmin" className="text-sm">Admin Access</label>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={closeModal} title="Delete User">
        {selectedUser && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to delete the user <strong>{selectedUser.name || selectedUser.number}</strong>?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={handleDeleteSubmit} disabled={busy} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
