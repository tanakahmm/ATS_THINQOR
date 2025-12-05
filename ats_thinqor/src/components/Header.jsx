import React, { useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../auth/authSlice";

const baseClasses = "px-3 py-2 rounded-lg text-sm font-medium transition";
const activeClasses = "bg-indigo-600 text-white";
const idleClasses = "text-gray-700 hover:bg-gray-100 hover:text-gray-900";

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useSelector((s) => s.auth || {});

  // --------------------------
  // FIXED ROLE NORMALIZATION
  // --------------------------
  const role = (() => {
    if (!user) return "PUBLIC";
    switch (user?.role?.toUpperCase()) {
      case "ADMIN":
        return "ADMIN";
      case "DM":
      case "DELIVERY_MANAGER":
        return "DM";
      case "TL":
      case "TEAM_LEAD":
        return "TL";
      case "RECRUITER":
        return "RECRUITER";
      default:
        return "PUBLIC";
    }
  })();

  const activeTab = location.state?.activeTab;
  const isAuthPage = location.pathname === "/" || location.pathname === "/signup";

  const MENUS = {
    ADMIN: [
      { key: "dashboard", to: "/admin-dashboard", label: "Dashboard" },
      { key: "users", to: "/users", label: "Users" },
      { key: "clients", to: "/clients", label: "Clients" },
      { key: "requirements", to: "/requirements", label: "Requisitions" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      { key: "interviews", to: "/interviews", label: "Interviews" },
      { key: "offers", to: "/offers", label: "Offers" },
      { key: "reports", to: "/reports", label: "Reports" },
      { key: "settings", to: "/settings", label: "Settings" },
      { key: "create-requirement", to: "/create-requirement", label: "Create Requirement" },
    ],
    DM: [
      { key: "dashboard", to: "/dm-dashboard", label: "Dashboard" },
      { key: "clients", to: "/clients", label: "Clients" },
      { key: "requirements", to: "/requirements", label: "Requisitions" },
      { key: "create-requirement", to: "/create-requirement", label: "Create Requirement" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      { key: "interviews", to: "/interviews", label: "Interviews" },
      { key: "reports", to: "/reports", label: "Reports" },
    ],
    TL: [
      { key: "dashboard", to: "/tl-dashboard", label: "Dashboard" },
      { key: "clients", to: "/clients", label: "Clients" },
      { key: "requirements", to: "/requirements", label: "Requisitions" },
      { key: "candidates", to: "/candidates", label: "Candidates" },
      { key: "interviews", to: "/interviews", label: "Interviews" },
      { key: "reports", to: "/reports", label: "Reports" },
    ],
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

  if (isAuthPage) {
    return (
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl text-white flex items-center justify-center font-bold">T</div>
            <span className="text-lg font-bold text-gray-900">ThinqHire ATS</span>
          </div>
          <div className="flex gap-4">
            <NavLink to="/" className={({ isActive }) => `${baseClasses} ${isActive ? activeClasses : idleClasses}`}>Login</NavLink>
            <NavLink to="/signup" className={({ isActive }) => `${baseClasses} ${isActive ? activeClasses : idleClasses}`}>Register</NavLink>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (!user) return;
              navigate(
                role === "RECRUITER"
                  ? "/recruiter-dashboard"
                  : role === "DM"
                  ? "/dm-dashboard"
                  : role === "TL"
                  ? "/tl-dashboard"
                  : "/admin-dashboard"
              );
            }}
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">T</div>
            <span className="text-lg font-bold text-gray-900">ThinqHire ATS</span>
          </div>

          {/* Menu */}
          <div className="hidden md:flex items-center gap-2">
            {menuItems.map((item) => {
              const isActive = activeTab === item.key || location.pathname === item.to;
              return (
                <NavLink key={item.to} to={item.to} state={{ activeTab: item.key }} className={`${baseClasses} ${isActive ? activeClasses : idleClasses}`}>
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {/* Logout */}
          {user && (
            <button onClick={handleLogout} className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600 transition">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
