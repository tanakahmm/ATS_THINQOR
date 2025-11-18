// src/components/Interviews.jsx
import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Video,
  FileText,
  CircleDot,
} from "lucide-react";

/* ============================================================
    IT + NON-IT STAGE TEMPLATES
============================================================ */
const stageTemplates = {
  IT: [
    "Screening",
    "HR Round",
    "Technical Round 1",
    "Technical Round 2",
    "Manager Round",
    "Offer Discussion",
  ],
  "Non-IT": [
    "Application Received",
    "HR Screening",
    "Aptitude Test",
    "Background Verification",
    "Final Manager Round",
    "Offer Released",
  ],
};

/* ============================================================
    InterviewTracker - shows progress based on category & stage
============================================================ */
function InterviewTracker({ category = "Non-IT", currentStage = "" }) {
  const stages = stageTemplates[category] || stageTemplates["Non-IT"];
  const currentIndex = Math.max(0, stages.indexOf(currentStage));

  const getStatus = (idx) => {
    if (idx < currentIndex) return "completed";
    if (idx === currentIndex) return "current";
    return "pending";
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow mt-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Interview Progress ({category})
      </h3>

      <div className="flex flex-wrap items-center gap-4">
        {stages.map((stage, idx) => {
          const status = getStatus(idx);
          return (
            <div key={stage} className="flex items-center gap-2">
              {/* icon */}
              {status === "completed" && (
                <CheckCircle className="text-green-600 w-5 h-5" />
              )}
              {status === "current" && (
                <CircleDot className="text-blue-600 w-5 h-5 animate-pulse" />
              )}
              {status === "pending" && (
                <Clock className="text-gray-400 w-5 h-5" />
              )}

              {/* label */}
              <span
                className={`text-sm font-medium ${
                  status === "completed"
                    ? "text-green-700"
                    : status === "current"
                    ? "text-blue-700"
                    : "text-gray-500"
                }`}
              >
                {stage}
              </span>

              {/* connector */}
              {idx < stages.length - 1 && (
                <div className="w-8 h-1 bg-gray-200 rounded" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
    ScheduleInterviewForm - modal popup used to add interviews
    All fields included: candidate, role, category, stage,
    date, time, duration, mode, location/link/phone, interviewer,
    notes, status
============================================================ */
function ScheduleInterviewForm({ onClose, onSubmit, defaultCategory = "" }) {
  const [formData, setFormData] = useState({
    candidate: "",
    role: "",
    category: defaultCategory || "",
    stage: "",
    date: "",
    time: "",
    duration: "",
    mode: "",
    location: "",
    interviewer: "",
    notes: "",
    status: "Scheduled",
  });

  // Keep stage options dynamic based on selected category
  const availableStages =
    (formData.category && stageTemplates[formData.category]) ||
    stageTemplates["Non-IT"];

  const handleChange = (e) => {
    const { name, value } = e.target;
    // if category changes, reset stage
    if (name === "category") {
      setFormData({ ...formData, [name]: value, stage: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // basic validation: candidate, role, category, stage, date, time, duration, mode, interviewer
    if (
      !formData.candidate ||
      !formData.role ||
      !formData.category ||
      !formData.stage ||
      !formData.date ||
      !formData.time ||
      !formData.duration ||
      !formData.mode ||
      !formData.interviewer
    ) {
      alert("Please fill required fields");
      return;
    }

    onSubmit(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg overflow-auto max-h-[90vh]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Schedule Interview</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* candidate & role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Candidate Name *
                </label>
                <input
                  name="candidate"
                  value={formData.candidate}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Job Role *
                </label>
                <input
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                  placeholder="e.g. Customer Support Executive"
                />
              </div>
            </div>

            {/* category & stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Requirement Type *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                >
                  <option value="">Select Type</option>
                  <option value="IT">IT</option>
                  <option value="Non-IT">Non-IT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Interview Stage *
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                >
                  <option value="">Select Stage</option>
                  {availableStages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* date/time/duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Time *
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  min="1"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                  placeholder="30"
                />
              </div>
            </div>

            {/* mode + conditional location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mode *
                </label>
                <select
                  name="mode"
                  value={formData.mode}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                >
                  <option value="">Select Mode</option>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Telephonic">Telephonic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {formData.mode === "Online"
                    ? "Meeting Link"
                    : formData.mode === "Offline"
                    ? "Office Location"
                    : formData.mode === "Telephonic"
                    ? "Contact Number"
                    : "Location / Link"}
                </label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded mt-1"
                  placeholder={
                    formData.mode === "Online"
                      ? "Zoom / Google Meet link"
                      : formData.mode === "Offline"
                      ? "Office address"
                      : formData.mode === "Telephonic"
                      ? "Phone number"
                      : "Provide meeting details"
                  }
                />
              </div>
            </div>

            {/* interviewer + notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Interviewer *
              </label>
              <input
                name="interviewer"
                value={formData.interviewer}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded mt-1"
                placeholder="Interviewer name(s)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded mt-1"
                rows="3"
                placeholder="Any extra instructions or notes"
              />
            </div>

            {/* buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Save Interview
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
    InterviewCard (single item)
============================================================ */
function InterviewCard({ interview, editingId, setEditingId, updateStage }) {
  return (
    <div className="bg-white shadow rounded-xl p-5 border hover:shadow-md transition my-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-3">
            {interview.name}
            <span className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
              {interview.status}
            </span>
          </h3>

          <p className="text-gray-600">{interview.role}</p>

          <div className="mt-3 flex gap-6 text-gray-700">
            <div className="flex items-center gap-2">
              <Calendar size={16} /> {interview.date}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} /> {interview.time} ({interview.duration})
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-gray-600">
            <Users size={16} /> {interview.interviewers}
          </div>

          <div className="mt-3">
            <span className="text-sm text-gray-600">Stage:</span>
            <span className="text-blue-700 ml-2 font-medium">{interview.stage}</span>

            {editingId === interview.id ? (
              <select
                value={interview.stage}
                onChange={(e) => {
                  updateStage(interview.id, e.target.value);
                  setEditingId(null);
                }}
                className="border ml-3 px-2 py-1 rounded"
                autoFocus
              >
                {(stageTemplates[interview.category] || stageTemplates["Non-IT"]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            ) : (
              <button
                onClick={() => setEditingId(interview.id)}
                className="ml-3 text-sm text-gray-600 hover:underline"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
            <FileText size={16} /> View Details
          </button>

          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            <Video size={16} /> Join
          </button>
        </div>
      </div>

      {/* tracker */}
      <InterviewTracker category={interview.category} currentStage={interview.stage} />
    </div>
  );
}

/* ============================================================
    Main Interviews component (merged full functionality)
============================================================ */
export default function InterviewsPage() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  // filters
  const [filterCategory, setFilterCategory] = useState("All"); // All / IT / Non-IT
  const [statusTab, setStatusTab] = useState("All"); // All / Scheduled / In Progress / Completed

  // modal visibility
  const [showForm, setShowForm] = useState(false);

  // interview list
  const [interviews, setInterviews] = useState([
    {
      id: 1,
      name: "Sarah Johnson",
      role: "Senior Frontend Developer",
      category: "IT",
      date: "2025-01-15",
      time: "10:00 AM",
      duration: "60min",
      status: "Scheduled",
      interviewers: "John Smith, Emily Davis",
      stage: "Technical Round 1",
      mode: "Online",
      location: "https://meet.example.com/abc",
      notes: "",
    },
    {
      id: 2,
      name: "Rohit Sharma",
      role: "Customer Support Executive",
      category: "Non-IT",
      date: "2025-01-18",
      time: "11:00 AM",
      duration: "45min",
      status: "In Progress",
      interviewers: "Priya Menon",
      stage: "HR Screening",
      mode: "Offline",
      location: "Office - 3rd Floor, Building B",
      notes: "",
    },
  ]);

  // add interview handler (called from modal)
  const addInterview = (data) => {
    const newInterview = {
      id: Date.now(),
      name: data.candidate,
      role: data.role,
      category: data.category,
      date: data.date,
      time: data.time,
      // 🐛 FIX 1: Added missing backticks for template literal
      duration: `${data.duration}min`, 
      status: data.status || "Scheduled",
      interviewers: data.interviewer,
      stage: data.stage,
      mode: data.mode,
      location: data.location,
      notes: data.notes,
    };
    setInterviews((prev) => [newInterview, ...prev]);
  };

  // update stage inline
  const updateStage = (id, stage) => {
    setInterviews((prev) => prev.map((it) => (it.id === id ? { ...it, stage } : it)));
  };

  // stats
  const total = interviews.length;
  const upcoming = interviews.filter((i) => i.status === "Scheduled").length;
  const inProgress = interviews.filter((i) => i.status === "In Progress").length;
  const completed = interviews.filter((i) => i.status === "Completed").length;

  // filter helpers
  const passesCategory = (item) =>
    filterCategory === "All" ? true : item.category === filterCategory;

  const passesStatus = (item) => (statusTab === "All" ? true : item.status === statusTab);

  const filtered = interviews
    .filter(passesCategory)
    .filter(passesStatus)
    // 🐛 FIX 2: Added missing backticks for template literal used in search
    .filter((i) =>
      `${i.name} ${i.role} ${i.stage}`.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interview Management</h1>
          <p className="text-gray-500">Track and manage all interviews</p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          + Schedule Interview
        </button>
      </div>

      {/* modal */}
      {showForm && (
        <ScheduleInterviewForm
          onClose={() => setShowForm(false)}
          onSubmit={addInterview}
        />
      )}

      {/* stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Calendar size={22} />} label="Total Interviews" value={total} />
        <StatCard icon={<Clock size={22} />} label="Upcoming" value={upcoming} />
        <StatCard icon={<Users size={22} />} label="In Progress" value={inProgress} />
        <StatCard icon={<CheckCircle size={22} />} label="Completed" value={completed} />
      </div>

      {/* search + requirement type */}
      <div className="flex gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search candidate, role or stage..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded-lg px-4 py-2 shadow-sm min-w-[220px]"
        />

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border px-4 py-2 rounded-lg shadow-sm"
        >
          <option value="All">All Requirement Types</option>
          <option value="IT">IT</option>
          <option value="Non-IT">Non-IT</option>
        </select>
      </div>

      {/* status tabs */}
      <div className="flex gap-3 border-b pb-2 mt-3 flex-wrap">
        {["All", "Scheduled", "In Progress", "Completed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-4 py-2 rounded-lg ${
              statusTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* interview list */}
      <div>
        {filtered.length === 0 ? (
          <div className="text-gray-500 py-10 text-center">No interviews found</div>
        ) : (
          filtered.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              editingId={editingId}
              setEditingId={setEditingId}
              updateStage={updateStage}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* Small stat card component */
function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
      <div className="text-blue-600">{icon}</div>
      <div>
        <p className="text-xl font-semibold">{value}</p>
        <p className="text-gray-500 text-sm">{label}</p>
      </div>
    </div>
  );
}