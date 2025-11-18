import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../auth/authSlice";

// --- CSS CLASSES ---
const baseClasses = "px-3 py-2 rounded-lg text-sm font-medium transition";
const activeClasses = "bg-indigo-600 text-white";
const idleClasses = "text-gray-700 hover:bg-gray-100 hover:text-gray-900";

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((s) => s.auth);
  const role = user?.role || "PUBLIC";

  // 👇 READ ACTIVE TAB (used when recruiter clicks Create Candidate)
  // This state is set on the NavLink in the main body
  const activeTab = location.state?.activeTab;

  // Hide navbar on login/signup
  const isAuthPage = location.pathname === "/" || location.pathname === "/signup";

  // -------------------------------
  // MENU CONFIG BY ROLE
  // -------------------------------
  const MENUS = {
    ADMIN: [
      { key: "dashboard", to: "/admin-dashboard", label: "Dashboard" },
      { key: "users", to: "/users", label: "Users" },
      { key: "clients", to: "/clients", label: "Clients" },
      { key: "requirements", to: "/requirements", label: "Requirements" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      
      { key: "interviews", to: "/interviews", label: "Interviews" },
      { key: "offers", to: "/offers", label: "Offers" },
      { key: "reports", to: "/reports", label: "Reports" },
      { key: "settings", to: "/settings", label: "Settings" },
      { key: "create-requirement", to: "/create-requirement", label: "Create Requirement" },
    ],

    DELIVERY_MANAGER: [
      { key: "dashboard", to: "/dm-dashboard", label: "Dashboard" },
      { key: "requirements", to: "/requirements", label: "Requirements" },
      { key: "create-requirement", to: "/create-requirement", label: "Create Requirement" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      
      { key: "interviews", to: "/interviews", label: "Interviews" },
      { key: "reports", to: "/reports", label: "Reports" },
    ],

    // 👇 Recruiter Menu
    RECRUITER: [
      { key: "dashboard", to: "/recruiter-dashboard", label: "Dashboard" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      { key: "interviews", to: "/interviews", label: "Interviews" },
    ],
  };

  const menuItems = MENUS[role] || [];

  const handleLogout = () => {
    dispatch(logoutUser()).then(() => navigate("/"));
  };

  // -----------------------------------
  // AUTH PAGE HEADER (Login + Register)
  // -----------------------------------
  if (isAuthPage) {
    return (
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl text-white flex items-center justify-center font-bold">
              T
            </div>
            <span className="text-lg font-bold text-gray-900">Thinqor ATS</span>
          </div>

          <div className="flex gap-4 absolute left-1/2 -translate-x-1/2">
            {/* 🐛 CORRECTION: Corrected string interpolation for NavLink className */}
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : idleClasses}`
              }
            >
              Login
            </NavLink>

            <NavLink
              to="/signup"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : idleClasses}`
              }
            >
              Register
            </NavLink>
          </div>
        </div>
      </nav>
    );
  }

  // -----------------------------------
  // MAIN NAVBAR AFTER LOGIN
  // -----------------------------------
  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Brand Logo (always dashboard by role) */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() =>
              navigate(
                role === "RECRUITER"
                  ? "/recruiter-dashboard"
                  : role === "DELIVERY_MANAGER"
                  ? "/dm-dashboard"
                  : "/admin-dashboard"
              )
            }
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              T
            </div>
            <span className="text-lg font-bold text-gray-900">Thinqor ATS</span>
          </div>

          {/* MENU ITEMS */}
          <div className="hidden md:flex items-center gap-2">
            {menuItems.map((item) => {
              // ⭐ Highlight tab if:
              // 1. React Router says active
              // 2. OR activeTab is set from location.state (e.g., when navigating back)
              const isActive =
                activeTab === item.key || location.pathname === item.to;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  // Keep active even after refresh/navigation from another page if state is passed
                  // Note: This state only persists during navigation, not on page reload.
                  state={{ activeTab: item.key }} 
                  className={`${baseClasses} ${
                    isActive ? activeClasses : idleClasses
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {/* LOGOUT BUTTON */}
          {user && (
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600 transition"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}