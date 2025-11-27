import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { createRequirement, fetchClients } from "../auth/authSlice";

export default function CreateRequirements() {
  const dispatch = useDispatch();
  const [jdText, setJdText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const { user, clients } = useSelector((state) => state.auth);

  // Removed ectc_range
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    location: "",
    skills_required: "",
    experience_required: "",
    ctc_range: "",
  });

  async function handleAutoFill() {
    if (!jdText.trim()) {
      alert("Please enter a job description first");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("http://127.0.0.1:5000/api/ai/jd-to-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_text: jdText })
      });

      const data = await res.json();

      if (data.error) {
        setAiError(data.error);
        alert(`AI Error: ${data.error}`);
        return;
      }

      if (data.suggested_requirement) {
        setAutoData(data.suggested_requirement);

        // Removed ectc mapping
        setForm(prev => ({
          ...prev,
          title: data.suggested_requirement.title || prev.title,
          location: data.suggested_requirement.location || prev.location,
          skills_required: data.suggested_requirement.skills_required || prev.skills_required,
          experience_required: data.suggested_requirement.experience_required || prev.experience_required,
          ctc_range: data.suggested_requirement.ctc_range || prev.ctc_range,
          description: data.suggested_requirement.description || prev.description,
        }));

        alert("✅ Form auto-filled from job description!");
      }
    } catch (error) {
      setAiError(error.message);
      alert(`Error: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  const canCreate = ["ADMIN", "DELIVERY_MANAGER"].includes(user?.role);

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  if (!canCreate) {
    return (
      <div className="flex justify-center mt-20 text-red-600 font-semibold">
        ❌ You are not allowed to create requirements
      </div>
    );
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Removed ectc from payload
    const payload = { ...form, created_by: user?.role || "" };
    
    dispatch(createRequirement(payload))
      .unwrap()
      .then(() => {
        alert("✅ Requirement Created Successfully!");
        setForm({
          client_id: "",
          title: "",
          description: "",
          location: "",
          skills_required: "",
          experience_required: "",
          ctc_range: "",
        });
      })
      .catch(() => alert("❌ Error creating requirement"));
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6">
        Create New Requirement
      </h2>

      {/* AI Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <label className="block text-sm font-medium mb-2">
          📝 Paste Job Description (AI will auto-fill form)
        </label>
        <div className="flex gap-2">
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the complete job description..."
            className="flex-1 border p-3 rounded h-32 resize-none"
          />
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={aiLoading || !jdText.trim()}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
          >
            {aiLoading ? "⏳ Processing..." : "✨ AI Fill"}
          </button>
        </div>
        {aiError && (
          <p className="text-red-600 text-sm mt-2">⚠️ {aiError}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">

        {/* Client Dropdown */}
        <select
          name="client_id"
          value={form.client_id}
          onChange={handleChange}
          className="border p-2 rounded col-span-2"
          required
        >
          <option value="">Select Client</option>
          {clients?.length > 0 &&
            clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        <input name="title" placeholder="Job Title" value={form.title} onChange={handleChange} className="border p-2 rounded" required />
        <input name="location" placeholder="Location" value={form.location} onChange={handleChange} className="border p-2 rounded" required />

        <input name="experience_required" placeholder="Experience (years)" value={form.experience_required} onChange={handleChange} className="border p-2 rounded" />
        <input name="skills_required" placeholder="Skills (comma separated)" value={form.skills_required} onChange={handleChange} className="border p-2 rounded" />

        <input name="ctc_range" placeholder="CTC Range" value={form.ctc_range} onChange={handleChange} className="border p-2 rounded"/>

        <button className="bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 col-span-2">
          Create Requirement
        </button>
      </form>
    </div>
  );
}
