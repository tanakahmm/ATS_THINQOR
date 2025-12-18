import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchUserDetails } from "../auth/authSlice";

export default function RecruiterDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // We use the global 'user' for ID, but fetch detailed info into 'userDetails'
  const { user, userDetails } = useSelector((state) => state.auth);

  const [requirements, setRequirements] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // ---------------------------
  // ROLE-BASED PROTECTION
  // ---------------------------
  useEffect(() => {
    if (!user) return navigate("/");
    const role = (user.role || "").toLowerCase();

    if (role !== "recruiter") navigate("/");
  }, [user, navigate]);

  // ---------------------------
  // FETCH DATA
  // ---------------------------
  useEffect(() => {
    if (user?.id) {
      loadUserSummary();
    }
  }, [user, dispatch]);

  const handleCreateCandidate = () => {
    const searchParams = new URLSearchParams({ recruiterId: user?.id || "" });
    navigate(`/candidates?${searchParams.toString()}`, {
      state: { from: "/recruiter-dashboard" },
    });
  };

  const loadUserSummary = async () => {
    if (!user?.id) return;
    try {
      setLoadingSummary(true);
      setSummaryError("");
      await dispatch(fetchUserDetails(user.id)).unwrap();
    } catch (err) {
      console.error("Summary load error:", err);
      setSummaryError(err.message || "Unable to load details.");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Sync redux details to local state for compatibility
  useEffect(() => {
    if (userDetails) {
      if (Array.isArray(userDetails.assigned_requirements)) {
        setRequirements(userDetails.assigned_requirements);
      } else {
        setRequirements([]);
      }

      if (Array.isArray(userDetails.created_candidates)) {
        setCandidates(userDetails.created_candidates);
      } else {
        setCandidates([]);
      }
    }
  }, [userDetails]);

  const summary = userDetails; // Use redux state directly for summary

  const candidateColumns = useMemo(
    () => [
      { key: "name", label: "Candidate" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "skills", label: "Skills" },
      { key: "experience", label: "Experience" },
    ],
    []
  );

  const assignmentCount =
    summary?.assigned_requirement_count ?? requirements.length;
  const candidateCount =
    summary?.created_candidate_count ?? candidates.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-3xl font-bold text-indigo-700">
          Recruiter Dashboard
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={loadUserSummary}
            className="px-4 py-2 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-50 transition"
          >
            Refresh Assignments
          </button>
          <button
            onClick={handleCreateCandidate}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            + Create Candidate
          </button>
        </div>
      </div>

      {summaryError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {summaryError}
        </div>
      )}

      {summary?.user && (
        <div className="bg-white p-5 rounded-lg shadow mb-6">
          <h3 className="text-xl font-bold text-gray-700 mb-4">My Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProfileField label="Name" value={summary.user.name} />
            <ProfileField label="Email" value={summary.user.email} />
            <ProfileField label="Phone" value={summary.user.phone} />
            <ProfileField
              label="Role"
              value={summary.user.role?.replace("_", " ")}
            />
            <ProfileField label="Status" value={summary.user.status} />
            <ProfileField
              label="Joined"
              value={
                summary.user.created_at
                  ? new Date(summary.user.created_at).toLocaleString()
                  : "--"
              }
            />
          </div>
        </div>
      )}

      {/* STATS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Assigned Requirements" value={assignmentCount} />
        <StatCard label="Candidates Added" value={candidateCount} />
        <StatCard label="Interviews Today" value={3} />
        <StatCard label="Offers Released" value={1} />
      </div>

      {/* -------------------------------------------------------
          ASSIGNED REQUIREMENTS TABLE
      ------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-lg shadow mb-8">
        <h3 className="text-xl font-bold mb-4 text-gray-700">
          Assigned Requirements
        </h3>

        {loadingSummary ? (
          <p className="text-gray-500">Loading assignments...</p>
        ) : requirements.length === 0 ? (
          <p className="text-gray-500">No requirements assigned yet.</p>
        ) : (
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Title</th>
                <th className="p-2 border">Client</th>
                <th className="p-2 border">Experience</th>
                <th className="p-2 border">Skills</th>
                <th className="p-2 border">Assigned Date</th>
                <th className="p-2 border">Assigned By</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>

            <tbody>
              {requirements.map((req) => (
                <tr key={req.allocation_id} className="hover:bg-gray-50">
                  <td className="p-2 border">{req.title}</td>
                  <td className="p-2 border">{req.client_name || "--"}</td>
                  <td className="p-2 border">
                    {req.experience_required
                      ? `${req.experience_required} yrs`
                      : "--"}
                  </td>
                  <td className="p-2 border">{req.skills_required || "--"}</td>

                  {/* Assigned Date */}
                  <td className="p-2 border">
                    {req.assigned_date
                      ? new Date(req.assigned_date).toLocaleString()
                      : "--"}
                  </td>

                  {/* Assigned By */}
                  <td className="p-2 border">{req.assigned_by || "--"}</td>

                  {/* Status */}
                  <td className="p-2 border">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {req.status || req.requirement_status || "ASSIGNED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* -------------------------------------------------------
          CANDIDATES TABLE
      ------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4 text-gray-700">
          Your Candidates
        </h3>

        {loadingSummary ? (
          <p className="text-gray-500">Loading candidates...</p>
        ) : candidates.length === 0 ? (
          <p className="text-gray-500">No candidates added yet.</p>
        ) : (
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                {candidateColumns.map((col) => (
                  <th key={col.key} className="p-2 border">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{c.name}</td>
                  <td className="p-2 border">{c.email}</td>
                  <td className="p-2 border">{c.phone || "--"}</td>
                  <td className="p-2 border">{c.skills || "--"}</td>
                  <td className="p-2 border">{c.experience || "--"} yrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------- STAT CARD COMPONENT ---------------- */

function StatCard({ label, value }) {
  return (
    <div className="bg-white shadow p-5 rounded-lg text-center">
      <p className="text-gray-500 text-sm">{label}</p>
      <h3 className="text-3xl font-bold text-indigo-600 mt-1">{value}</h3>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-900">{value || "--"}</p>
    </div>
  );
}