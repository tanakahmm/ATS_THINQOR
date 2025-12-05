import React from "react";
import { Routes, Route } from "react-router-dom";
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
export default function App() {
  return (
    <>
      {/* 🌐 Always visible Header for everyone */}
      <Header />

      {/* 🔀 Page routing */}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/dm-dashboard" element={<DmDashboard />} />
        <Route path="/create-requirement" element={<CreateRequirements />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/candidates" element={<CandidateApplicationUI />} />
        <Route path="/users" element={<Users />} />
        <Route path="/recruiter-dashboard" element={<RecruiterDashboard />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/candidate-tracking" element={<CandidateList />} />
        <Route path="/candidate-tracking/:candidateId/:requirementId" element={<CandidateTracking />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/offers" element={<div className="p-10 text-center text-gray-500">Offers Page Coming Soon</div>} />
        <Route path="/tl-dashboard" element={<TlDashboard />} />
        {/* Add other routes as needed */}
        {/* Example future routes:
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/reports" element={<Reports />} /> */}
      </Routes>

      {/* 🤖 AI Chat - Floating button on all pages (only visible when logged in) */}
      <FloatingAiChat />
    </>
  );
}
