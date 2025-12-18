import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { fetchCandidates, fetchRequirements } from "../auth/authSlice";

export default function CandidateList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Use Redux state
  const { candidates, requirements, loading, error } = useSelector((state) => state.auth);

  const [selectedReq, setSelectedReq] = useState("");
  // Local error state can be removed if relying on Redux error, or kept for specific UI handling
  // const [error, setError] = useState(""); 

  useEffect(() => {
    dispatch(fetchCandidates());
    dispatch(fetchRequirements());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // loadCandidates removed
  // loadRequirements removed

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

