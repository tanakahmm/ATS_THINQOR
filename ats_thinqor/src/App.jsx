import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useDispatch } from "react-redux";
import { verifySession } from "./auth/authSlice";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import Login from "./components/Login";
import Signup from "./components/Signup";
import AdminDashboard from "./components/AdminDashboard";
import Logout from "./components/Logout";
import CreateRequirements from "./components/CreateRequirements";
import DmDashboard from "./components/DmDashboard";
import Requirements from "./components/Requirements";
import Clients from "./components/Clients";
import CandidateApplicationUI from "./components/Candidates";
import FloatingAiChat from "./components/FloatingAiChat";
import Users from "./components/users";
import RecruiterDashboard from "./components/RecruiterDashboard";
import InterviewsPage from "./components/InterviewsPage";
import CandidateList from "./components/CandidateList";
import CandidateTracking from "./components/CandidateTracking";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import TlDashboard from "./components/TLDashboard";
import Avatar3D from "./components/Avatar3D";
import ChatPage from "./components/chatpage";
export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(verifySession());
  }, [dispatch]);

  return (
    <>
      {/* 🌐 Always visible Header for everyone */}
      <Header />

      {/* 🔀 Page routing */}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes (Require Login) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/logout" element={<Logout />} />

          {/* Dashboard Routes - strictly checking roles is good practice */}
          <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/dm-dashboard" element={<ProtectedRoute allowedRoles={['DELIVERY_MANAGER']}><DmDashboard /></ProtectedRoute>} />
          <Route path="/tl-dashboard" element={<ProtectedRoute allowedRoles={['TEAM_LEAD']}><TlDashboard /></ProtectedRoute>} />
          <Route path="/recruiter-dashboard" element={<ProtectedRoute allowedRoles={['RECRUITER']}><RecruiterDashboard /></ProtectedRoute>} />

          {/* Common / Shared Routes */}
          <Route path="/create-requirement" element={<CreateRequirements />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/candidates" element={<CandidateApplicationUI />} />

          {/* Admin Only */}
          <Route path="/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />

          {/* Others */}
          <Route path="/interviews" element={<InterviewsPage />} />
          <Route path="/candidate-tracking" element={<CandidateList />} />
          <Route path="/candidate-tracking/:candidateId/:requirementId" element={<CandidateTracking />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/offers" element={<div className="p-10 text-center text-gray-500">Offers Page Coming Soon</div>} />
        </Route>
      </Routes>

      {/* 🤖 AI Chat - Floating button on all pages (only visible when logged in) */}
      <FloatingAiChat />
    </>
  );
}
