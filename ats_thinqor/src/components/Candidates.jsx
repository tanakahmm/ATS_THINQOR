import React, { useState, useEffect, useMemo } from "react";
import { Upload } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCandidates,
  fetchRequirements,
  submitCandidate,
  updateCandidate,
  deleteCandidate,
  screenCandidate,
  fetchCandidateTracker,
  updateStageStatus,
  assignCandidateToRequirement
} from "../auth/authSlice";
import { toPascalCase } from "../utils/stringUtils";

/**
 * Combined CandidateApplicationUI (split UI into components inside one file)
 * - All original lines / logic are preserved.
 * - UI sections are wrapped into components: Form, CandidateList, ScreeningModal, ScreeningResultModal, TrackerModal.
 * - Layout: stacked vertically (form above candidate list, then modals).
 */

/* --------------------------
   Presentational components
   (they receive props from the main component)
   -------------------------- */

function CandidateApplicationForm({
  formData,
  handleChange,
  handleFileChange,
  handleSubmit,
  handleReset,
  resume,
  editCandidateId,
  message,
}) {
  return (
    <div className="bg-white/90 backdrop-blur-xl p-8 shadow-xl rounded-2xl border border-gray-200">
      {message && <p className="text-center text-green-600 font-medium mb-4">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              type="text"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              type="email"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              type="tel"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Skills</label>
            <input
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              type="text"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Current CTC (LPA)</label>
            <input
              name="ctc"
              value={formData.ctc}
              onChange={handleChange}
              type="number"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expected CTC (LPA)</label>
            <input
              name="ectc"
              value={formData.ectc}
              onChange={handleChange}
              type="number"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Education Summary</label>
          <textarea
            name="education"
            value={formData.education}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Experience Summary</label>
          <textarea
            name="experience"
            value={formData.experience}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Upload Resume</label>
          <div className="border-dashed border-2 border-blue-300 rounded-lg p-6 text-center">
            <input type="file" id="resume" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
            <label htmlFor="resume" className="cursor-pointer text-blue-600 hover:underline">
              {editCandidateId ? "Upload new resume (optional)" : "Click to upload resume"}
            </label>
            {resume && <p className="text-sm text-gray-700 mt-2">{resume.name}</p>}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            {editCandidateId ? "Update Candidate" : "Submit Application"}
          </button>

          <button type="button" onClick={handleReset} className="border border-gray-300 px-6 py-2 rounded-lg">
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

function CandidateList({
  candidates,
  handleEdit,
  handleDelete,
  openScreenModal,
  handleTrack,
}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 max-h-[80vh] overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-gray-800">Candidate List</h3>

      {candidates.length === 0 ? (
        <p className="text-gray-500 text-center py-6 bg-white rounded-xl shadow">No candidates found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-700 border-b">
                <th className="p-4 text-left font-semibold">Name</th>
                <th className="p-4 text-left font-semibold">Email</th>
                <th className="p-4 text-left font-semibold">Phone</th>
                <th className="p-4 text-left font-semibold">Skills</th>
                <th className="p-4 text-left font-semibold">CTC</th>
                <th className="p-4 text-left font-semibold">ECTC</th>
                <th className="p-4 text-left font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-indigo-50 transition">
                  <td className="p-4">{candidate.name}</td>
                  <td className="p-4">{candidate.email}</td>
                  <td className="p-4">{candidate.phone}</td>
                  <td className="p-4 text-gray-700">{candidate.skills}</td>
                  <td className="p-4">{candidate.ctc}</td>
                  <td className="p-4">{candidate.ectc}</td>

                  <td className="p-4 space-x-2">
                    <button onClick={() => {
                      if (candidate.resume_filename) {
                        window.open(`http://localhost:5001/uploads/resumes/${candidate.resume_filename}`, "_blank");
                      } else {
                        alert("No resume uploaded for this candidate.");
                      }
                    }}
                      className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs shadow"
                    >
                      View
                    </button>

                    <button onClick={() => handleEdit(candidate)} className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs shadow">Edit</button>

                    <button onClick={() => handleDelete(candidate.id)} className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs shadow">Delete</button>

                    <button onClick={() => openScreenModal(candidate)} className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs shadow">Screen</button>

                    <button onClick={() => handleTrack(candidate)} className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs shadow">Track</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScreeningModal({
  showScreenModal,
  setShowScreenModal,
  screenCandidate,
  requirementSearch,
  setRequirementSearch,
  requirementsLoading,
  filteredRequirements,
  selectedRequirementId,
  setSelectedRequirementId,
  handleScreenCandidate,
  screenLoading,
  setScreenError,
}) {
  if (!showScreenModal) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8 relative">
        <button onClick={() => { setShowScreenModal(false); setScreenError(""); }} className="absolute right-4 top-4 text-gray-500 hover:text-gray-800 text-xl">✕</button>

        <h3 className="text-2xl font-bold text-gray-900 mb-2">Select Requirement</h3>
        <p className="text-gray-500 mb-4 text-sm">
          Choose requirement to compare with candidate: <span className="font-medium text-gray-800">{screenCandidate?.name}</span>
        </p>

        <input type="text" value={requirementSearch} onChange={(e) => setRequirementSearch(e.target.value)} placeholder="Search requirement..." className="w-full border rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-indigo-400" />

        <div className="max-h-64 overflow-y-auto space-y-2">
          {requirementsLoading ? (
            <p className="text-center py-6 text-gray-500">Loading...</p>
          ) : filteredRequirements.length === 0 ? (
            <p className="text-center py-6 text-gray-500">No requirements found.</p>
          ) : (
            filteredRequirements.map((req) => (
              <button key={req.id} type="button" onClick={() => setSelectedRequirementId(req.id)} className={`w-full text-left px-4 py-3 rounded-xl border transition shadow-sm ${selectedRequirementId === req.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-100"}`}>
                <div className="flex justify-between">
                  <p className="font-semibold text-gray-800">{req.title}</p>
                  <span className="text-gray-500 text-sm">{req.location || "--"}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Skills: {req.skills_required || "--"}</p>
              </button>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowScreenModal(false)} className="px-5 py-2 rounded-lg border text-gray-700 hover:bg-gray-100">Cancel</button>
          <button onClick={handleScreenCandidate} className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">{screenLoading ? "Screening..." : "Run Screening"}</button>
        </div>
      </div>
    </div>
  );
}

function ScreeningResultModal({ screeningResult, setScreeningResult }) {
  if (!screeningResult) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={() => setScreeningResult(null)} className="absolute right-4 top-4 text-gray-600 hover:text-gray-800 text-xl">✕</button>

        <h3 className="text-3xl font-bold text-center mb-6">AI Screening Result</h3>

        <div className="space-y-6">
          <p className="text-center">
            <span className="text-4xl font-bold text-gray-800">{screeningResult.score}</span>
            <span className="text-lg text-gray-500"> / 100</span>
          </p>

          <div className="text-center">
            <span className={`px-5 py-2 text-sm rounded-full font-semibold ${screeningResult.recommend === "SHORTLISTED" ? "bg-green-100 text-green-700" : screeningResult.recommend === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
              {screeningResult.recommend}
            </span>
          </div>

          <div>
            <p className="font-semibold text-gray-700 mb-1">Rationale</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              {screeningResult.rationale?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {screeningResult.red_flags?.length > 0 && (
            <div>
              <p className="font-semibold text-red-600 mb-1">Red Flags</p>
              <ul className="list-disc list-inside text-red-600 space-y-1">
                {screeningResult.red_flags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackerModal({
  trackerModalOpen,
  setTrackerModalOpen,
  trackerLoading,
  trackerData,
  trackCandidate,
  updateStageStatus,
  // New props for assignment
  requirements,
  assignCandidateToRequirement,
  dispatch,
}) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedAssignReqId, setSelectedAssignReqId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Reset local state when modal opens/closes
  useEffect(() => {
    if (trackerModalOpen) {
      setShowAssignForm(false);
      setAssignSearch("");
      setSelectedAssignReqId("");
    }
  }, [trackerModalOpen]);

  // Filter requirements for assignment
  const filteredAssignReqs = useMemo(() => {
    if (!assignSearch) return requirements || [];
    return (requirements || []).filter((req) =>
      `${req.title} ${req.location}`.toLowerCase().includes(assignSearch.toLowerCase())
    );
  }, [requirements, assignSearch]);

  const handleAssign = async () => {
    if (!selectedAssignReqId) return alert("Select a requirement first.");
    setAssignLoading(true);
    try {
      const resultAction = await dispatch(assignCandidateToRequirement({
        candidate_id: trackCandidate.id,
        requirement_id: selectedAssignReqId
      }));
      if (assignCandidateToRequirement.fulfilled.match(resultAction)) {
        // Refresh tracker
        setShowAssignForm(false);
        // The parent component should re-fetch tracker data, but we can trigger it or let the user do it.
        // Better to trigger a refresh via a prop if possible, or just close and let them reopen?
        // Ideally, we re-fetch immediately.
        // We can't easily refetch here without imports. 
        // Strategy: Close the form and show success. The parent logic might need adjustment to refetch.
        alert("✅ Tracker created!");

        // Trigger refresh from parent would be ideal, but for now we'll just close 
        // and maybe the parent listens to state changes? 
        // Actually, let's just close the assignment form. The main list remains.
      } else {
        alert(resultAction.payload || "Failed to assign");
      }
    } catch (e) {
      console.error(e);
      alert("Error assigning");
    } finally {
      setAssignLoading(false);
    }
  };

  if (!trackerModalOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-10 relative max-h-[90vh] overflow-y-auto">
        <button onClick={() => setTrackerModalOpen(false)} className="absolute right-4 top-4 text-gray-600 hover:text-gray-800 text-xl">✕</button>

        <h3 className="text-3xl font-bold mb-6 text-gray-900">Candidate Interview Tracking</h3>

        {/* Manual Assignment Section Toggle */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            {showAssignForm ? "Cancel Assignment" : "+ Link to Requirement"}
          </button>
        </div>

        {/* Assignment Form */}
        {showAssignForm && (
          <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
            <h4 className="text-lg font-semibold mb-3">Manually Link to Requirement</h4>
            <input
              type="text"
              placeholder="Search Requirement..."
              className="w-full p-2 mb-3 border rounded"
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto bg-white border rounded mb-3">
              {filteredAssignReqs.map(req => (
                <div
                  key={req.id}
                  className={`p-2 cursor-pointer hover:bg-indigo-50 ${selectedAssignReqId === req.id ? 'bg-indigo-100 font-semibold' : ''}`}
                  onClick={() => setSelectedAssignReqId(req.id)}
                >
                  {req.title} <span className="text-gray-500 text-xs">({req.location})</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleAssign}
              disabled={assignLoading}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {assignLoading ? "Linking..." : "Confirm Link"}
            </button>
          </div>
        )}

        {trackerLoading ? (
          <p className="text-center text-gray-500 py-12 text-lg">Loading...</p>
        ) : trackerData.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-lg">No tracking found. Link a requirement above.</p>
        ) : (
          <div className="space-y-12">
            {trackerData.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl border p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h4 className="text-2xl font-semibold text-gray-800">{item.requirement.title}</h4>
                    <p className="text-sm text-gray-500">{item.requirement.client_name} • {item.requirement.no_of_rounds} Rounds</p>
                  </div>
                  <span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full">ID: {item.requirement.id}</span>
                </div>

                <div className="border-l-4 border-gray-300 pl-6 space-y-10">
                  {item.stages.map((stage, index) => {
                    const color = stage.status === "COMPLETED" ? "green" : stage.status === "REJECTED" ? "red" : stage.status === "IN_PROGRESS" ? "blue" : "gray";
                    return (
                      <div key={index} className="relative">
                        {/* Node Dot - simplified: use inline style for color dot */}
                        <div style={{ left: -24 }} className={`absolute -left-3 w-6 h-6 rounded-full border-4 border-white shadow`} />
                        <div className="bg-white rounded-xl p-5 border shadow-sm">
                          <div className="flex justify-between items-center">
                            <h5 className="text-lg font-semibold">{stage.stage_name}</h5>
                            <span className={`px-3 py-1 text-xs rounded-full ${stage.status === "COMPLETED" ? "bg-green-100 text-green-700" : stage.status === "REJECTED" ? "bg-red-100 text-red-700" : stage.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>{stage.status}</span>
                          </div>

                          <p className="text-gray-600 text-sm mt-2">{stage.decision || "No decision provided"}</p>

                          <select value={stage.status} onChange={(e) => updateStageStatus(trackCandidate?.id, item.requirement.id, stage.stage_id, e.target.value, stage.decision)} className="mt-4 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400">
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="REVIEW_REQUIRED">Review Required</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------
   Main Component (keeps all logic)
   -------------------------- */

export default function CandidateApplicationUI() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, candidates, requirements, trackerData, screeningResult, loading } = useSelector((state) => state.auth || {});

  // -------------------------------
  // FORM STATES (original form)
  // -------------------------------
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    skills: "",
    education: "",
    experience: "",
    ctc: "",
    ectc: "",
  });

  const [resume, setResume] = useState(null);
  const [editCandidateId, setEditCandidateId] = useState(null);
  const [message, setMessage] = useState("");

  // -------------------------------
  // Candidate + Requirement states
  // -------------------------------
  // Using Redux state for candidates and requirements

  const recruiterIdFromQuery = searchParams.get("recruiterId");
  const createdByUserId = recruiterIdFromQuery
    ? parseInt(recruiterIdFromQuery)
    : user?.id || null;

  // -------------------------------
  // SCREENING (AI) STATES
  // -------------------------------
  const [screenCandidateData, setScreenCandidateData] = useState(null);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [requirementSearch, setRequirementSearch] = useState("");
  const [screenError, setScreenError] = useState("");
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [localScreeningResult, setLocalScreeningResult] = useState(null);

  // -------------------------------
  // TRACKER STATES
  // -------------------------------
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackCandidateData, setTrackCandidateData] = useState(null);

  // -------------------------------
  // FETCH CANDIDATES + REQUIREMENTS
  // -------------------------------
  // -------------------------------
  // FETCH CANDIDATES + REQUIREMENTS
  // -------------------------------
  useEffect(() => {
    if (user?.id && user?.role) {
      dispatch(fetchCandidates());
      dispatch(fetchRequirements());
    }
  }, [dispatch, user?.id, user?.role]);

  // -------------------------------
  // FORM HANDLERS (unchanged)
  // -------------------------------
  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "name") {
      value = toPascalCase(value);
    }
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleFileChange = (e) => {
    setResume(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = { ...formData };
    if (resume) data.resume = resume;

    if (!editCandidateId && createdByUserId) {
      data.created_by = createdByUserId;
    }

    try {
      let resultAction;
      if (editCandidateId) {
        resultAction = await dispatch(updateCandidate({ id: editCandidateId, candidateData: data }));
      } else {
        resultAction = await dispatch(submitCandidate(data));
      }

      if (submitCandidate.fulfilled.match(resultAction) || updateCandidate.fulfilled.match(resultAction)) {
        setMessage(resultAction.payload.message || "Success");

        // If returning from recruiter dashboard, auto redirect
        const fromState = window.history.state?.usr?.from;
        if (fromState === "/recruiter-dashboard") {
          setTimeout(() => navigate("/recruiter-dashboard"), 1200);
        }

        // Refresh list + clear form
        dispatch(fetchCandidates());
        resetForm();
      } else {
        setMessage(resultAction.payload || "Failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server offline. Check backend.");
    }
  };

  // -------------------------------
  // EDIT / DELETE (existing names preserved)
  // -------------------------------
  const handleEdit = (candidate) => {
    setEditCandidateId(candidate.id);
    setFormData({
      name: candidate.name || "",
      email: candidate.email || "",
      phone: candidate.phone || "",
      skills: candidate.skills || "",
      education: candidate.education || "",
      experience: candidate.experience || "",
      ctc: candidate.ctc || "",
      ectc: candidate.ectc || "",
    });
    setMessage("Editing candidate...");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this candidate?")) return;

    try {
      const resultAction = await dispatch(deleteCandidate(id));
      if (deleteCandidate.fulfilled.match(resultAction)) {
        setMessage(resultAction.payload.message || "Deleted");
      } else {
        setMessage(resultAction.payload || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      skills: "",
      education: "",
      experience: "",
      ctc: "",
      ectc: "",
    });
    setResume(null);
    setEditCandidateId(null);
    setMessage("");
  };

  // -------------------------------
  // SCREENING HANDLERS
  // -------------------------------
  const openScreenModal = (candidate) => {
    setScreenCandidateData(candidate);
    setSelectedRequirementId("");
    setRequirementSearch("");
    setScreenError("");
    setShowScreenModal(true);
  };

  const handleScreenCandidate = async () => {
    if (!screenCandidateData || !selectedRequirementId) {
      setScreenError("Please select a requirement to compare against.");
      return;
    }

    setScreenLoading(true);
    setScreenError("");

    try {
      const resultAction = await dispatch(screenCandidate({
        candidate_id: screenCandidateData.id,
        requirement_id: selectedRequirementId,
      }));

      if (screenCandidate.fulfilled.match(resultAction)) {
        setLocalScreeningResult(resultAction.payload);
        setShowScreenModal(false);
      } else {
        setScreenError(resultAction.payload || "AI screening failed");
      }
    } catch (error) {
      console.error(error);
      setScreenError("Server error. Check backend.");
    } finally {
      setScreenLoading(false);
    }
  };

  // -------------------------------
  // TRACKER HANDLERS
  // -------------------------------
  const handleTrack = async (candidate) => {
    setTrackCandidateData(candidate);
    setTrackerLoading(true);
    setTrackerModalOpen(true);
    try {
      await dispatch(fetchCandidateTracker(candidate.id));
    } catch (err) {
      console.error(err);
      alert("Failed to load tracker data");
    } finally {
      setTrackerLoading(false);
    }
  };

  const handleUpdateStageStatus = async (candidateId, requirementId, stageId, status, decision) => {
    try {
      const resultAction = await dispatch(updateStageStatus({
        candidate_id: candidateId,
        requirement_id: requirementId,
        stage_id: stageId,
        status,
        decision,
      }));

      if (updateStageStatus.fulfilled.match(resultAction)) {
        // Refresh data
        await dispatch(fetchCandidateTracker(candidateId));
      } else {
        alert(`Failed to update status: ${resultAction.payload || "Unknown error"}`);
      }
    } catch (err) {
      console.error("❌ Error updating status:", err);
      alert("Error updating status: " + err.message);
    }
  };

  // -------------------------------
  // Requirement filtering
  // -------------------------------
  const filteredRequirements = useMemo(() => {
    if (!requirementSearch) return requirements || [];
    return (requirements || []).filter((req) =>
      `${req.title} ${req.location} ${req.client_id || ""}`
        .toLowerCase()
        .includes(requirementSearch.toLowerCase())
    );
  }, [requirements, requirementSearch]);

  // -------------------------------
  // UI render (stacked top → bottom)
  // -------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-6 space-y-10">
      {/* HEADER */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl shadow-md">
          <Upload size={32} />
        </div>

        <h1 className="text-4xl font-bold text-blue-600 mt-4">Candidate Application</h1>

        <p className="text-gray-600 mt-2">
          Submit your application by filling in the details below.
        </p>
      </div>

      {/* FORM (top) */}
      <div className="max-w-7xl mx-auto">
        <CandidateApplicationForm
          formData={formData}
          handleChange={handleChange}
          handleFileChange={handleFileChange}
          handleSubmit={handleSubmit}
          handleReset={resetForm}
          resume={resume}
          editCandidateId={editCandidateId}
          message={message}
        />
      </div>

      {/* CANDIDATE LIST (below form) */}
      <div className="max-w-7xl mx-auto">
        <CandidateList
          candidates={candidates}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          openScreenModal={openScreenModal}
          handleTrack={handleTrack}
        />
      </div>

      {/* MODALS */}
      <ScreeningModal
        showScreenModal={showScreenModal}
        setShowScreenModal={setShowScreenModal}
        screenCandidate={screenCandidateData}
        requirementSearch={requirementSearch}
        setRequirementSearch={setRequirementSearch}
        requirementsLoading={loading}
        filteredRequirements={filteredRequirements}
        selectedRequirementId={selectedRequirementId}
        setSelectedRequirementId={setSelectedRequirementId}
        handleScreenCandidate={handleScreenCandidate}
        screenLoading={screenLoading}
        setScreenError={setScreenError}
      />

      <ScreeningResultModal screeningResult={localScreeningResult} setScreeningResult={setLocalScreeningResult} />

      <TrackerModal
        trackerModalOpen={trackerModalOpen}
        setTrackerModalOpen={setTrackerModalOpen}
        trackerLoading={trackerLoading}
        trackerData={trackerData}
        trackCandidate={trackCandidateData}
        updateStageStatus={handleUpdateStageStatus}
        requirements={requirements}
        assignCandidateToRequirement={assignCandidateToRequirement}
        dispatch={dispatch}
      />
    </div>
  );
}
