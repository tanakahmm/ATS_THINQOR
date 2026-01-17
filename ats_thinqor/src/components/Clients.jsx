import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchClients,
  createClient,
  updateClient,
  deleteClient,
  clearMessages,
} from "../auth/authSlice";
import { toPascalCase } from "../utils/stringUtils";

export default function Clients() {
  const dispatch = useDispatch();
  const { clients = [], loading, successMessage, error } = useSelector(
    (state) => state.auth
  );

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    location: "",
  });

  const [editForm, setEditForm] = useState(null);

  // FILTER LIST
  const filtered = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // FETCH
  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  // CLEAR ALERTS
  useEffect(() => {
    if (successMessage || error) {
      setTimeout(() => dispatch(clearMessages()), 3000);
    }
  }, [successMessage, error, dispatch]);

  // CREATE CLIENT - FIXED (always send address + location)
  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      address: form.location, // backend stores in address
    };

    dispatch(createClient(payload)).then((res) => {
      if (res.meta.requestStatus === "fulfilled") {
        setForm({
          name: "",
          contact_person: "",
          email: "",
          phone: "",
          location: "",
        });
        dispatch(fetchClients());
      }
    });
  };

  // EDIT - FIXED
  const handleEdit = (client) => {
    const loc = client.location || client.address || "";

    setEditForm({ ...client, location: loc });

    setForm({
      name: client.name,
      contact_person: client.contact_person,
      email: client.email,
      phone: client.phone,
      location: loc,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // UPDATE CLIENT - FIXED
  const handleUpdate = (e) => {
    e.preventDefault();

    const updatedData = {
      ...editForm,
      name: form.name,
      contact_person: form.contact_person,
      email: form.email,
      phone: form.phone,

      // always send both keys
      location: form.location,
      address: form.location,
    };

    dispatch(updateClient({ id: editForm.id, clientData: updatedData })).then(
      (res) => {
        if (res.meta?.requestStatus === "fulfilled") {
          setEditForm(null);
          setForm({
            name: "",
            contact_person: "",
            email: "",
            phone: "",
            location: "",
          });
          dispatch(fetchClients());
        }
      }
    );
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;

    dispatch(deleteClient(id)).then(() => dispatch(fetchClients()));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">

      {/* User Management Card */}
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
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-700 mt-1 text-sm">
            Manage clients efficiently.
          </p>
        </div>
      </div>


      {/* Messages */}
      <div className="space-y-2 mb-4">
        {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded">
            {successMessage}
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-xl font-semibold">
          {editForm ? "Edit Client" : "Add New Client"}
        </h3>

        <form
          id="client-form"
          onSubmit={editForm ? handleUpdate : handleSubmit}
          className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium">Client Name</label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: toPascalCase(e.target.value) })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Contact Person</label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-3"
              value={form.contact_person}
              onChange={(e) =>
                setForm({ ...form, contact_person: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-4 py-3"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-3"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium">Location</label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-3"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          {/* Add Client Button */}
          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : editForm
                  ? "Update Client"
                  : "Add Client"}
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search clients..."
          className="flex-1 border rounded-lg px-4 py-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Clients List</h3>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b text-gray-600">
              <th className="py-3 px-2">Client</th>
              <th className="py-3 px-2">Contact</th>
              <th className="py-3 px-2">Email</th>
              <th className="py-3 px-2">Phone</th>
              <th className="py-3 px-2">Location</th>
              <th className="py-3 px-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="py-4 px-2 font-medium">{c.name}</td>
                <td className="py-4 px-2">{c.contact_person || "-"}</td>
                <td className="py-4 px-2">{c.email}</td>
                <td className="py-4 px-2">{c.phone || "-"}</td>

                {/* FIXED DISPLAY */}
                <td className="py-4 px-2">{c.location || c.address || "-"}</td>

                <td className="py-4 px-2 text-center">
                  <button
                    onClick={() => handleEdit(c)}
                    className="bg-indigo-600 text-white px-3 py-1 rounded-lg mr-2 hover:bg-indigo-700"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-gray-500">
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}