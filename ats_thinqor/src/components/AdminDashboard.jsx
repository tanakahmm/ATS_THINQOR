import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUsers, createUser, clearMessages } from "../auth/authSlice";
import { useNavigate } from "react-router-dom";

import {
  Users,
  UserCheck,
  Shield,
  Briefcase,
  Plus,
  FileBarChart,
} from "lucide-react";

/* Small Components */
const KPICard = ({ title, value, icon: Icon, gradient }) => (
  <div
    className={`rounded-2xl shadow p-6 text-white ${gradient} flex items-center justify-between`}
  >
    <div>
      <p className="text-sm opacity-80">{title}</p>
      <h2 className="text-3xl font-bold">{value}</h2>
    </div>
    <Icon className="w-10 h-10 opacity-80" />
  </div>
);

/* MAIN COMPONENT */
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
  const [userSearch, setUserSearch] = useState("");

  const navigate = useNavigate();

  /* Fetch Users */
  useEffect(() => {
    dispatch(getUsers());
  }, [dispatch]);

  /* Clear Toast Messages */
  useEffect(() => {
    if (error || successMessage) {
      const t = setTimeout(() => dispatch(clearMessages()), 3000);
      return () => clearTimeout(t);
    }
  }, [error, successMessage, dispatch]);

  /* Dynamic Stats */
  const stats = useMemo(() => {
    const total = usersList?.length || 0;
    const active = usersList?.filter((u) => u.status === "ACTIVE").length || 0;
    const admins = usersList?.filter((u) => u.role === "ADMIN").length || 0;
    const recruiters =
      usersList?.filter((u) => u.role === "RECRUITER").length || 0;

    return { total, active, admins, recruiters };
  }, [usersList]);

  /* Role Distribution Data */
  const roleData = [
    { name: "Admin", key: "ADMIN", color: "#A78BFA" },
    { name: "Delivery Manager", key: "DELIVERY_MANAGER", color: "#FBBF24" },
    { name: "Team Lead", key: "TEAM_LEAD", color: "#6366F1" },
    { name: "Recruiter", key: "RECRUITER", color: "#34D399" },
    { name: "Client", key: "CLIENT", color: "#6B7280" },
  ];

  const donutSegments = useMemo(() => {
    const total = usersList?.length || 0;
    let cumulativePercent = 0;

    return roleData.map((r) => {
      const count = usersList?.filter((u) => u.role === r.key).length || 0;
      const percent = total > 0 ? count / total : 0;

      const start = cumulativePercent * 283; // circumference
      const end = percent * 283;

      cumulativePercent += percent;

      return {
        ...r,
        strokeDasharray: `${end} ${283 - end}`,
        strokeDashoffset: -start,
        count,
        percent,
      };
    });
  }, [usersList]);

  /* Recent Users */
  const recentUsers = useMemo(() => (usersList || []).slice(0, 5), [usersList]);

  /* Filtered Users by Search */
  const filteredUsers = useMemo(() => {
    if (!userSearch) return recentUsers;
    return recentUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.phone && u.phone.includes(userSearch))
    );
  }, [recentUsers, userSearch]);

  /* Create User Handler */
  const handleCreate = (e) => {
    e.preventDefault();
    dispatch(createUser(form)).then((res) => {
      if (res.meta.requestStatus === "fulfilled") {
        setOpenCreate(false);
        setForm({
          name: "",
          email: "",
          phone: "",
          role: "RECRUITER",
          password: "",
        });
        dispatch(getUsers());
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b py-6 px-8 flex items-center justify-between">
        <div className="pl-32">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
            Admin Dashboard
          </h1>
          <p className="text-gray-500">Monitor your team and performance metrics.</p>
        </div>

        <div className="flex gap-4">
          <button
            className="border px-6 py-3 rounded-xl flex items-center gap-2"
            onClick={() => navigate("/reports")}
          >
            <FileBarChart className="w-5 h-5" />
            Reports
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create User
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Toasts */}
        {error && <div className="bg-red-200 p-3 rounded-xl mb-3">{error}</div>}
        {successMessage && (
          <div className="bg-green-200 p-3 rounded-xl mb-3">{successMessage}</div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KPICard title="Total Users" value={stats.total} icon={Users} gradient="bg-indigo-500" />
          <KPICard title="Active Users" value={stats.active} icon={UserCheck} gradient="bg-emerald-500" />
          <KPICard title="Admins" value={stats.admins} icon={Shield} gradient="bg-purple-500" />
          <KPICard title="Recruiters" value={stats.recruiters} icon={Briefcase} gradient="bg-blue-500" />
        </div>

        {/* Donut Role Distribution */}
        <div className="bg-white rounded-2xl shadow p-6 mb-10">
          <h2 className="text-xl font-semibold mb-6">Role Distribution</h2>
          <div className="flex items-center gap-10">
            {/* Donut Chart */}
            <div className="relative w-48 h-48">
              <svg width="100%" height="100%" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="45" stroke="#eee" strokeWidth="14" fill="none" />
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="60"
                    cy="60"
                    r="45"
                    stroke={seg.color}
                    strokeWidth="14"
                    fill="none"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-gray-500 text-sm">Total Users</p>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-4">
              {donutSegments.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }}></span>
                    <div>
                      <p className="font-semibold">{seg.name}</p>
                      <p className="text-gray-500 text-xs">{seg.count} users ({(seg.percent * 100).toFixed(1)}%)</p>
                    </div>
                  </div>
                  <span className="font-bold">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-2xl shadow p-6 mb-10">
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Recent Users</h2>
              <p className="text-gray-500 text-sm">Latest registered team members</p>
            </div>

            <div className="flex items-center border rounded-xl px-4 bg-gray-50">
              <input
                type="text"
                placeholder="Search users..."
                className="p-2 outline-none bg-transparent"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm border-b">
                  <th className="p-3">User</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center p-4 text-gray-500">Loading...</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-3 flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                          style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
                        >
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold capitalize">{u.name}</p>
                          <p className="text-gray-500 text-sm">{u.email}</p>
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">{u.phone}</td>
                      <td className="p-3">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            u.role === "DELIVERY_MANAGER"
                              ? "bg-yellow-100 text-yellow-700"
                              : u.role === "RECRUITER"
                              ? "bg-emerald-100 text-emerald-700"
                              : u.role === "ADMIN"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-semibold ${
                            u.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-3 py-1 text-xs rounded-full font-semibold">
                          {u.created_at}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {openCreate && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">Create User</h3>

            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <input
                className="border p-2 rounded-lg col-span-2"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                className="border p-2 rounded-lg col-span-2"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                className="border p-2 rounded-lg"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <select
                className="border p-2 rounded-lg"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ADMIN">Admin</option>
                <option value="DELIVERY_MANAGER">Delivery Manager</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="CLIENT">Client</option>
              </select>
              <input
                className="border p-2 rounded-lg col-span-2"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl">
                {loading ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="border px-4 py-2 rounded-xl"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
