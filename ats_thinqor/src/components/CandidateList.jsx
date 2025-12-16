import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5001";

export default function CandidateList() {
  const [candidates, setCandidates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selectedReq, setSelectedReq] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    loadCandidates();
    loadRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCandidates = async () => {
    try {
      let url = `${API_BASE}/get-candidates`;

      if (user && user.role) {
        const params = new URLSearchParams();
        params.set("user_role", user.role);
        if (user.id) {
          params.set("user_id", user.id);
        }
        url = `${url}?${params.toString()}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading candidates:", err);
      setError("Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const res = await fetch(`${API_BASE}/get-requirements`);
      const data = await res.json();
      setRequirements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading requirements:", err);
    }
  };

  const navigateToTracking = (candidateId) => {
    if (!selectedReq) {
      alert("Select a requirement first!");
      return;
    }
    navigate(`/candidate-tracking/${candidateId}/${selectedReq}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-4">Candidates List</h1>

        <div className="bg-gray-900/60 border border-purple-500/30 rounded-xl p-4">
          <label className="text-gray-300 text-sm">Select Requirement</label>
          <select
            value={selectedReq}
            onChange={(e) => setSelectedReq(e.target.value)}
            className="w-full mt-2 bg-gray-800 border border-purple-500/30 text-white p-2 rounded-lg"
          >
            <option value="">-- Choose Requirement --</option>
            {requirements.map((req) => (
              <option key={req.id} value={req.id}>
                {req.title} — {req.location}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <table className="w-full text-left bg-gray-900/70 border border-purple-500/30 rounded-xl">
          <thead>
            <tr className="text-purple-300 border-b border-purple-500/20">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-400">
                  Loading candidates...
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-400">
                  No candidates found.
                </td>
              </tr>
            ) : (
              candidates.map((cand) => (
                <tr key={cand.id} className="border-b border-gray-800">
                  <td className="p-3 text-white">{cand.name}</td>
                  <td className="p-3 text-gray-300">{cand.email}</td>
                  <td className="p-3 text-gray-300">{cand.phone || "--"}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => navigateToTracking(cand.id)}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Track Progress
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

