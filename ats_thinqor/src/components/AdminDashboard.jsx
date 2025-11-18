import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUsers, createUser, clearMessages } from "../auth/authSlice";

/* ---------------------- Small UI Components ---------------------- */

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function QuickAction({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
    >
      {label}
    </button>
  );
}

function RolePill({ role }) {
  const map = {
    ADMIN: "bg-purple-100 text-purple-800",
    DELIVERY_MANAGER: "bg-amber-100 text-amber-800",
    TEAM_LEAD: "bg-blue-100 text-blue-800",
    RECRUITER: "bg-emerald-100 text-emerald-800",
    CLIENT: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
        map[role] || "bg-gray-100 text-gray-700"
      }`}
    >
      {role}
    </span>
  );
}

/* ---------------------- MAIN COMPONENT ---------------------- */

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const { usersList, loading, error, successMessage } = useSelector(
    (s) => s.auth
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "RECRUITER",
    password: "",
  });

  /* ---------------- Fetch users on mount ---------------- */
  useEffect(() => {
    dispatch(getUsers());
  }, [dispatch]);

  /* ---------------- Auto clear messages ---------------- */
  useEffect(() => {
    if (error || successMessage) {
      const t = setTimeout(() => dispatch(clearMessages()), 2500);
      return () => clearTimeout(t);
    }
  }, [error, successMessage, dispatch]);

  /* ---------------- Stats ---------------- */
  const stats = useMemo(() => {
    const total = usersList?.length || 0;
    const active = usersList?.filter((u) => u.status === "ACTIVE").length || 0;
    const byRole = (role) =>
      usersList?.filter((u) => u.role === role).length || 0;

    return {
      total,
      active,
      admins: byRole("ADMIN"),
      recruiters: byRole("RECRUITER"),
    };
  }, [usersList]);

  /* ---------------- Top 5 users ---------------- */
  const top5 = useMemo(() => (usersList || []).slice(0, 5), [usersList]);

  /* ---------------- Create User Handler ---------------- */
  const handleCreate = (e) => {
    e.preventDefault();
    dispatch(createUser(form)).then((res) => {
      if (res.meta.requestStatus === "fulfilled") {
        setForm({
          name: "",
          email: "",
          phone: "",
          role: "RECRUITER",
          password: "",
        });
        setOpenCreate(false);
        dispatch(getUsers());
      }
    });
  };

  /* ---------------- ROLE DISTRIBUTION DATA ---------------- */
  const roles = [
    { key: "ADMIN", label: "Admin", color: "bg-purple-500" },
    { key: "DELIVERY_MANAGER", label: "Delivery Manager", color: "bg-amber-500" },
    { key: "TEAM_LEAD", label: "Team Lead", color: "bg-blue-500" },
    { key: "RECRUITER", label: "Recruiter", color: "bg-emerald-500" },
    { key: "CLIENT", label: "Client", color: "bg-gray-500" },
  ];

  const totalUsers = usersList?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---------------- Header ---------------- */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>

          <div className="flex gap-3">
            <QuickAction label="Create User" onClick={() => setOpenCreate(true)} />
            <a
              href="/reports"
              className="bg-white border px-4 py-2 rounded-xl hover:bg-gray-100 transition"
            >
              Reports
            </a>
          </div>
        </div>
      </header>

      {/* ---------------- Content ---------------- */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Toasts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        )}

        {/* KPI CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={stats.total} />
          <StatCard title="Active Users" value={stats.active} />
          <StatCard title="Admins" value={stats.admins} />
          <StatCard title="Recruiters" value={stats.recruiters} />
        </section>

        {/* ---------------- ROLE DISTRIBUTION BAR ---------------- */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-2">Role Distribution</h2>

          <div className="w-full h-3 bg-gray-100 rounded-xl overflow-hidden flex">
            {roles.map((r) => {
              const count =
                usersList?.filter((u) => u.role === r.key).length || 0;
              const percent = (count / totalUsers) * 100;

              return (
                <div
                  key={r.key}
                  // 🐛 FIX 1: Added missing backticks for template literal
                  className={`${r.color} h-3`}
                  style={{
                    // 🐛 FIX 2: Added missing backticks for template literal
                    width: percent > 0 ? `${percent}%` : "0%",
                  }}
                  // 🐛 FIX 3: Added missing backticks for template literal
                  title={`${r.label}: ${count}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
            {roles.map((r) => (
              <span key={r.key}>
                <span
                  // 🐛 FIX 4: Added missing backticks for template literal
                  className={`inline-block w-3 h-3 ${r.color} mr-1 rounded-sm`}
                />
                {r.label}
              </span>
            ))}
          </div>
        </section>

        {/* ---------------- USERS TABLE ---------------- */}
        <section className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Users</h2>
            <a href="/users" className="text-indigo-600 text-sm hover:underline">
              View all
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-xl">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Phone
                  </th>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-sm text-gray-600">
                    Created
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      className="px-4 py-5 text-sm text-gray-500"
                      colSpan={6}
                    >
                      Loading…
                    </td>
                  </tr>
                ) : top5.length ? (
                  top5.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{u.name}</td>
                      <td className="px-4 py-2 text-sm">{u.email}</td>
                      <td className="px-4 py-2 text-sm">{u.phone || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        <RolePill role={u.role} />
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-4 py-5 text-sm text-gray-500"
                      colSpan={6}
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ---------------- Create User Modal ---------------- */}
      {openCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create User</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setOpenCreate(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
                className="border border-gray-300 rounded-lg px-3 py-2"
              />

              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                required
                className="border border-gray-300 rounded-lg px-3 py-2"
              />

              <input
                type="text"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2"
              />

              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="ADMIN">Admin</option>
                <option value="DELIVERY_MANAGER">Delivery Manager</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="CLIENT">Client</option>
              </select>

              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
                className="border border-gray-300 rounded-lg px-3 py-2 sm:col-span-2"
              />

              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                >
                  {loading ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenCreate(false)}
                  className="bg-white border px-4 py-2 rounded-xl hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}