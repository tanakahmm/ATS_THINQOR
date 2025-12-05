import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { createRequirement, fetchClients, autoFillRequirement } from "../auth/authSlice";

export default function CreateRequirements() {
  const dispatch = useDispatch();
  const [jdText, setJdText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const { user, clients } = useSelector((state) => state.auth);

  // Requirement form
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    location: "",
    skills_required: "",
    experience_required: "",
    ctc_range: "",
    no_of_rounds: 1,
  });

  const [stageNames, setStageNames] = useState(["Round 1"]);

  async function handleAutoFill() {
    if (!jdText.trim()) {
      alert("Please enter a job description first");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const resultAction = await dispatch(autoFillRequirement(jdText));

      if (autoFillRequirement.fulfilled.match(resultAction)) {
        const data = resultAction.payload;
        if (data.suggested_requirement) {
          setForm(prev => ({
            ...prev,
            title: data.suggested_requirement.title || prev.title,
            location: data.suggested_requirement.location || prev.location,
            skills_required: data.suggested_requirement.skills_required || prev.skills_required,
            experience_required: data.suggested_requirement.experience_required || prev.experience_required,
            ctc_range: data.suggested_requirement.ctc_range || prev.ctc_range,
            description: data.suggested_requirement.description || prev.description,
          }));
          alert("AI Auto-fill complete!");
        }
      } else {
        setAiError(resultAction.payload || "AI Auto-fill failed");
        alert("AI Error: " + (resultAction.payload || "Unknown error"));
      }
    } catch (err) {
      setAiError(err.message);
      alert("Error: " + err.message);
    } finally {
      setAiLoading(false);
    }
  }

  // Only admin and DM can create requirements
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

  // ---------------- FORM HANDLERS ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Update stage names array when no_of_rounds changes
    if (name === "no_of_rounds") {
      const rounds = parseInt(value) || 1;
      const newStageNames = [];
      for (let i = 0; i < rounds; i++) {
        newStageNames.push(stageNames[i] || `Round ${i + 1}`);
      }
      setStageNames(newStageNames);
    }
  };

  const handleStageNameChange = (index, value) => {
    const updated = [...stageNames];
    updated[index] = value;
    setStageNames(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Include stage names in payload
    const payload = {
      ...form,
      created_by: user?.role || "",
      stage_names: stageNames
    };

    dispatch(createRequirement(payload))
      .unwrap()
      .then(() => {
        alert("Requirement Created Successfully!");

        setForm({
          client_id: "",
          title: "",
          description: "",
          location: "",
          skills_required: "",
          experience_required: "",
          ctc_range: "",
          no_of_rounds: 1,
        });
        setStageNames(["Round 1"]);
      })
      .catch(() => alert("Error creating requirement"));
  };

  // ---------------- UI ----------------
  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6">
        Create New Requirement
      </h2>

      {/* AI Autofill */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <label className="block text-sm font-medium mb-2">
          📝 Paste Job Description (AI Auto-fill)
        </label>

        <div className="flex gap-2">
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the job description..."
            className="flex-1 border p-3 rounded h-32 resize-none"
          />

          <button
            type="button"
            onClick={handleAutoFill}
            disabled={aiLoading}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            {aiLoading ? "⏳ Processing..." : "✨ AI Fill"}
          </button>
        </div>

        {aiError && <p className="text-red-600 mt-2">{aiError}</p>}
      </div>

      {/* FORM */}
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
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input name="title" placeholder="Job Title" className="border p-2 rounded"
          value={form.title} onChange={handleChange} required />

        <input name="location" placeholder="Location" className="border p-2 rounded"
          value={form.location} onChange={handleChange} required />

        <input name="experience_required" placeholder="Experience (years)" className="border p-2 rounded"
          value={form.experience_required} onChange={handleChange} />

        <textarea
          name="description"
          placeholder="Job Description (Optional)"
          value={form.description}
          onChange={handleChange}
          className="border p-2 rounded col-span-2 h-24"
        />

        <input name="skills_required" placeholder="Skills (comma separated)" value={form.skills_required} onChange={handleChange} className="border p-2 rounded" />

        <input name="ctc_range" placeholder="CTC Range" value={form.ctc_range} onChange={handleChange} className="border p-2 rounded" />

        <input
          name="no_of_rounds"
          type="number"
          min="1"
          max="10"
          placeholder="Number of Rounds (Default: 1)"
          value={form.no_of_rounds || ""}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        {/* Stage Names Section */}
        {parseInt(form.no_of_rounds) > 0 && (
          <div className="col-span-2 border-2 border-dashed border-indigo-300 rounded-lg p-4 bg-indigo-50">
            <h3 className="text-sm font-semibold text-indigo-700 mb-3">
              📋 Define Stage Names for Tracking
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stageNames.map((stageName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 w-16">
                    Stage {index + 1}:
                  </span>
                  <input
                    type="text"
                    value={stageName}
                    onChange={(e) => handleStageNameChange(index, e.target.value)}
                    placeholder={`e.g., Technical Round, HR Round`}
                    className="flex-1 border p-2 rounded text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 These stage names will be used for candidate tracking
            </p>
          </div>
        )}

        <button className="bg-indigo-600 text-white py-2 rounded-lg col-span-2 hover:bg-indigo-700">
          Create Requirement
        </button>
      </form>
    </div>
  );
}