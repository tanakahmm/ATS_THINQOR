// src/components/DmDashboard.jsx

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchDashboardStats, fetchRecentRequirements } from "../auth/authSlice";

export default function DmDashboard() {
  const dispatch = useDispatch();
  const { user, dashboardStats, recentRequirements } = useSelector((state) => state.auth || {});
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // Redirect if unauthorized
  useEffect(() => {
    if (!user || user?.role !== "DELIVERY_MANAGER") navigate("/");
  }, [user, navigate]);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        dispatch(fetchDashboardStats()),
        dispatch(fetchRecentRequirements())
      ]);
      setLoading(false);
    };

    load();
  }, [dispatch]);

  const stats = dashboardStats || {};
  const recentReqs = recentRequirements || [];

  const actions = [
    {
      label: "Create Requirement",
      desc: "Add a new job requirement",
      icon: "plus",
      onClick: () => navigate("/create-requirement"),
    },
    {
      label: "Search Candidates",
      desc: "Find matching profiles",
      icon: "search",
      onClick: () => navigate("/candidates"), // ensure this route exists
    },
    {
      label: "Allocate Requirement",
      desc: "Assign to recruiters",
      icon: "assign",
      onClick: () => navigate("/requirements"),
    },
    {
      label: "Generate Report",
      desc: "Export analytics",
      icon: "report",
      onClick: () => navigate("/reports"),
    },
  ];

  const accentMap = {
    purple: "text-purple-600",
    green: "text-green-600",
    pink: "text-pink-600",
    yellow: "text-yellow-700",
  };

  const statCards = [
    {
      title: "Total Requirements",
      value: stats?.total ?? "-",
      color: "#f4efff",
      accent: "purple",
      subtitle: "Updated Today",
    },
    {
      title: "Open Requirements",
      value: stats?.open ?? "-",
      color: "#eaffef",
      accent: "green",

    },
    {
      title: "Closed Requirements",
      value: stats?.closed ?? "-",
      color: "#fff3f8",
      accent: "pink",

    },
    {
      title: "Assigned to Recruiters",
      value: stats?.assigned ?? "-",
      color: "#fff6e8",
      accent: "yellow",
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between mb-8">
        <div>
          <p className="text-indigo-500 text-sm">Good Afternoon</p>
          <h1 className="text-4xl font-extrabold text-indigo-700 mt-1">
            Hiring Manager Dashboard
          </h1>
          <p className="text-gray-500 mt-2">
            Track requirements and manage operations efficiently.
          </p>
        </div>

      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map((s, idx) => (
          <StatCard
            key={idx}
            title={s.title}
            value={s.value}
            color={s.color}
            subtitle={s.subtitle}
            accentClass={accentMap[s.accent] || "text-gray-800"}
          />
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">⚡ Quick Actions</h3>
            <div className="text-sm text-gray-500">Shortcuts</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:bg-gray-50 shadow-sm"
              >
                <div className="w-12 h-12 bg-indigo-50 text-indigo-700 flex items-center justify-center rounded-lg">
                  <Icon name={a.icon} className="w-5 h-5" />
                </div>

                <div className="text-left">
                  <div className="font-semibold text-gray-800">{a.label}</div>
                  <div className="text-sm text-gray-500">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>


      </div>

      {/* Recent Requirements */}
      <div className="bg-white p-6 rounded-2xl shadow mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📄</span> Recent Requirements
          </h3>

          <button className="text-indigo-600 text-sm">View All</button>
        </div>

        {loading ? (
          <>
            <div className="h-14 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="h-14 bg-gray-100 rounded-lg animate-pulse mt-3"></div>
          </>
        ) : recentReqs.length === 0 ? (
          <p className="text-gray-500">No recent requirements found.</p>
        ) : (
          <div className="space-y-3">
            {recentReqs.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
              >
                {/* Left */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <rect x="4" y="3" width="16" height="18" rx="2"></rect>
                      <line x1="8" y1="7" x2="16" y2="7"></line>
                      <line x1="8" y1="11" x2="16" y2="11"></line>
                    </svg>
                  </div>

                  <span className="font-medium text-gray-800">{r.title}</span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${r.status === "Open"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                      }`}
                  >
                    {r.status}
                  </span>

                  <span className="text-gray-500 text-sm">
                    {new Date(r.date).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- REUSABLE STAT CARD -------------------- */
function StatCard({ title, value, color = "#fff", subtitle, accentClass }) {
  return (
    <div
      className="p-6 rounded-2xl shadow-lg overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color} 0%, #fff 60%)` }}
    >
      <p className="text-gray-600">{title}</p>
      <h3 className={`text-4xl font-bold ${accentClass} mt-3`}>{value}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

/* -------------------- ICON COMPONENT -------------------- */
const Icon = ({ name, className }) => {
  if (name === "plus")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  if (name === "search")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="11" cy="11" r="6" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    );

  if (name === "assign")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
      </svg>
    );

  if (name === "report")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M9 12h6M9 16h6M5 7h14" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
      </svg>
    );

  return <svg className={className} />;
};
