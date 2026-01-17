// src/components/Users.jsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  clearMessages,
  fetchRoles
} from "../auth/authSlice";
import { toPascalCase } from "../utils/stringUtils";

/**
 * Users Management - dynamic UI
 * - Roles fetched dynamically from backend
 * - Users fetched via Redux
 */

const API_BASE = "http://localhost:5001"; // backend base URL

export default function Users() {
  const dispatch = useDispatch();
  const { usersList = [], loading, successMessage, error, user: currentUser } = useSelector(
    (state) => state.auth
  );

  // local state
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [roles, setRoles] = useState([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    status: "ACTIVE",
  });

  // fetch users on mount
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  // fetch roles dynamically from backend
  useEffect(() => {
    dispatch(fetchRoles())
      .unwrap()
      .then((data) => {
        if (Array.isArray(data)) setRoles(data);
        else if (data && Array.isArray(data.roles)) setRoles(data.roles);
        else setRoles([]);
      })
      .catch((err) => {
        console.error("Failed to load roles:", err);
        setRoles([]);
      });
  }, [dispatch]);

  // auto clear messages
  useEffect(() => {
    if (successMessage || error) {
      const t = setTimeout(() => dispatch(clearMessages()), 3000);
      return () => clearTimeout(t);
    }
  }, [successMessage, error, dispatch]);

  const safeUsers = Array.isArray(usersList) ? usersList : [];

  const filtered = safeUsers.filter((u) => {
    const q = search.trim().toLowerCase();

    // Search Filter
    const matchesSearch = !q || (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );

    // Role Filter
    const matchesRole = !filterRole || u.role === filterRole;

    // Status Filter
    const matchesStatus = !filterStatus || (u.status || "ACTIVE") === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const resetForm = () =>
    setForm({
      name: "",
      email: "",
      phone: "",
      role: "",
      password: "",
      status: "ACTIVE",
    });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.phone || !form.role) {
      return alert("Please fill all required fields: name, email, phone, role.");
    }

    // --- Validation Logic ---
    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    const phoneRegex = /^\d{10,15}$/;
    const nameRegex = /^[a-zA-Z\s\.\-]+$/;

    if (!nameRegex.test(form.name)) {
      return alert("Invalid name format. Only alphabets, spaces, dots and hyphens allowed.");
    }
    if (!emailRegex.test(form.email)) {
      return alert("Invalid email format.");
    }
    if (!phoneRegex.test(form.phone)) {
      return alert("Invalid phone number. Must be 10-15 digits only.");
    }

    // Password validation: Required if new user OR if editing and password field is not empty
    const isPasswordProvided = !!form.password;

    if (!editingUser && !form.password) {
      return alert("Password is required when creating a new user.");
    }

    if (isPasswordProvided) {
      if (form.password.length < 8) {
        return alert("Password must be at least 8 characters long.");
      }
      if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
        return alert("Password must contain at least one letter and one number.");
      }
    }

    try {
      if (editingUser) {
        const payload = {
          id: editingUser.id,
          ...form,
          requester_email: currentUser?.email // Pass requester for RBAC check
        };
        if (!payload.password) delete payload.password;

        const res = await dispatch(updateUser(payload));
        if (res.meta?.requestStatus === "fulfilled") {
          setEditingUser(null);
          resetForm();
          dispatch(fetchUsers());
        }
      } else {
        const res = await dispatch(createUser(form));
        if (res.meta?.requestStatus === "fulfilled") {
          resetForm();
          dispatch(fetchUsers());
        }
      }
    } catch (err) {
      console.error("User save error", err);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      password: "",
      status: user.status || "ACTIVE",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const res = await dispatch(deleteUser({ id, requester_email: currentUser?.email }));
    if (res.meta?.requestStatus === "fulfilled") {
      dispatch(fetchUsers());
    }
  };

  const roleToColor = (role = "") => {
    const r = role.toLowerCase();
    if (r.includes("manager")) return "bg-purple-600 text-white";
    if (r.includes("recruiter")) return "bg-green-500 text-white";
    if (r.includes("admin")) return "bg-indigo-600 text-white";
    return "bg-gray-200 text-gray-800";
  };

  const statusToBadge = (s = "") => {
    const st = s.toUpperCase();
    if (st === "ACTIVE") return "bg-emerald-400 text-emerald-900";
    if (st === "INACTIVE") return "bg-red-200 text-red-800";
    return "bg-gray-200 text-gray-800";
  };

  const initials = (name = "") => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      {/* User Management Container */}
      <div className="bg-blue-100 rounded-2xl shadow-sm p-6 mb-6 flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-200 text-blue-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {/* Custom user + gear icon */}
            <circle cx="12" cy="8" r="3" />
            <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <circle cx="18" cy="18" r="3" />
            <path d="M18 15v1M18 21v1M15 18h1M21 18h1M16.5 16.5l.7.7M19.8 19.8l.7.7M16.5 19.5l.7-.7M19.8 16.2l.7-.7" />
          </svg>
        </div>

        {/* Title + Subtitle */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-700 mt-1 text-sm">Manage team accounts and access roles efficiently</p>
        </div>
      </div>


      {/* Messages */}
      <div className="space-y-2 mb-4">
        {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
        {successMessage && <div className="p-3 bg-emerald-50 text-emerald-700 rounded">{successMessage}</div>}
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{editingUser ? "Edit User" : "Add New User"}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {editingUser ? "Update user details. Leave password blank to keep existing password." : "Create a new user. Password is required."}
            </p>
          </div>
          <div>
            <button
              type="submit"
              form="user-form"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 rounded-lg shadow hover:opacity-95"
            >
              {loading ? "Saving..." : editingUser ? "Update User" : "+ Add User"}
            </button>
          </div>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input type="text" placeholder="John Doe" className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.name} onChange={(e) => setForm({ ...form, name: toPascalCase(e.target.value) })} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input type="text" placeholder="1234567890" className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input type="email" placeholder="john@example.com" className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">User Role</label>
            <select className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
              <option value="">Select a role</option>
              {roles.length === 0 && <option value="">Loading roles...</option>}
              {roles.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{editingUser ? "New Password (optional)" : "Password *"}</label>
            <input type="password" placeholder={editingUser ? "Leave blank to keep existing password" : "Enter password"} className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select className="w-full border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
              value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-3 justify-end mt-1">
            {editingUser && (
              <button type="button" onClick={() => { setEditingUser(null); resetForm(); }}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-350">Cancel</button>
            )}
            <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              {loading ? "Saving..." : editingUser ? "Update User" : "Add User"}
            </button>
          </div>
        </form>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4">
          <input type="text" placeholder="Search users by name, email, role..." className="flex-1 border rounded-lg px-4 py-3 focus:ring-0 focus:border-indigo-300"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <button
            className={`flex items-center gap-2 border px-4 py-2 rounded-lg ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-gray-50'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Role</label>
              <select
                className="border rounded-lg px-3 py-2 text-sm focus:ring-0 focus:border-indigo-300 min-w-[200px]"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Status</label>
              <select
                className="border rounded-lg px-3 py-2 text-sm focus:ring-0 focus:border-indigo-300 min-w-[200px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => { setFilterRole(""); setFilterStatus(""); }}
                className="text-sm text-red-600 hover:text-red-700 font-medium px-2 py-2"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Users List</h3>
            <p className="text-sm text-gray-500">{filtered.length} users found</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-3 px-2">User</th>
                <th className="py-3 px-2">Email</th>
                <th className="py-3 px-2">Phone</th>
                <th className="py-3 px-2">Role</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center text-white font-medium">
                      {initials(u.name)}
                    </div>
                    <div>
                      <div className="font-medium">{u.name}</div>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-gray-600">{u.email}</td>
                  <td className="py-4 px-2 text-gray-600">{u.phone || "-"}</td>
                  <td className="py-4 px-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${roleToColor(u.role)}`}>
                      {(u.role || "-").replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusToBadge(u.status)}`}>
                      {(u.status || "UNKNOWN")}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-center">
                    {(() => {
                      const isSrini = currentUser?.email?.toLowerCase() === "srini@thinqorsolutions.com";
                      const targetIsAdmin = u.role === "ADMIN";
                      const isSelf = u.email?.toLowerCase() === currentUser?.email?.toLowerCase();

                      // Srini can edit anyone EXCEPT himself (if he appears in list).
                      // Others can edit anyone EXCEPT Admins. 
                      // And no one should delete themselves here (safety).
                      const canModify = (isSrini || !targetIsAdmin) && !isSelf;

                      if (!canModify) {
                        return (
                          <span className="text-xs text-gray-400 italic flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v1m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            Protected
                          </span>
                        );
                      }

                      return (
                        <>
                          <button
                            onClick={() => handleEdit(u)}
                            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-1 rounded-lg mr-2 hover:bg-indigo-700"
                            title="Edit User"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                            title="Delete User"
                          >
                            Delete
                          </button>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
