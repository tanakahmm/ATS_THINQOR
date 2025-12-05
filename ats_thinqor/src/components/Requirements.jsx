import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchRequirements, fetchClients } from "../auth/authSlice";
import { useNavigate } from "react-router-dom";

export default function Requirements() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user, requirements, clients, loading } = useSelector(
    (state) => state.auth
  );

  const [selectedClient, setSelectedClient] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecruiter, setSelectedRecruiter] = useState("");
  const [selectedReq, setSelectedReq] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [recruiters, setRecruiters] = useState([]);
  const [assignedList, setAssignedList] = useState([]);

  // --- Edit Modal ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    dispatch(fetchRequirements());
    dispatch(fetchClients());
    loadRecruiters();
  }, [dispatch]);

  useEffect(() => {
    if (requirements.length > 0) fetchAssignedRecruiters(requirements);
    else setAssignedList([]);
  }, [requirements]);

  const loadRecruiters = async () => {
    try {
      const res = await fetch("http://localhost:5001/get-recruiters");
      const data = await res.json();
      setRecruiters(data);
    } catch (err) {
      console.error("Recruiter load error:", err);
    }
  };

  const fetchAssignedRecruiters = async (reqList) => {
    try {
      const all = await Promise.all(
        reqList.map(async (req) => {
          const res = await fetch(
            `http://localhost:5001/requirements/${req.id}/allocations`
          );

          if (!res.ok) return [];

          const data = await res.json();

          return data.map((item) => ({
            id: item.id,
            requirementId: req.id,
            requirementTitle: req.title,
            recruiter: item.recruiter_name,
            assignedDate: item.created_at
              ? new Date(item.created_at).toLocaleString()
              : "-",
            status: item.status || "Assigned",
          }));
        })
      );

      setAssignedList(all.flat());
    } catch (error) {
      console.error("Assigned recruiters error:", error);
    }
  };

  const canCreate = ["ADMIN", "DELIVERY_MANAGER"].includes(user?.role);
  const canAssign = ["ADMIN", "DELIVERY_MANAGER"].includes(user?.role);

  const handleAssignConfirm = async () => {
    if (!selectedReq || !selectedRecruiter) return;

    try {
      const res = await fetch("http://localhost:5001/assign-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_id: selectedReq.id,
          recruiter_id: parseInt(selectedRecruiter),
          assigned_by: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to assign recruiter");
        return;
      }

      const recruiterName =
        recruiters.find((r) => r.id === parseInt(selectedRecruiter))?.name ||
        "Unknown";

      setAssignedList((prev) => [
        ...prev,
        {
          id: data.allocation_id,
          requirementId: selectedReq.id,
          requirementTitle: selectedReq.title,
          recruiter: recruiterName,
          assignedDate: new Date().toLocaleString(),
          status: "ASSIGNED",
        },
      ]);

      setShowAssignModal(false);
      setSelectedRecruiter("");
      setSelectedReq(null);
      refreshAllData();
    } catch (err) {
      console.error("Assign error:", err);
      alert("Server error");
    }
  };

  const handleDelete = async (req) => {
    if (!window.confirm(`Delete ${req.title}?`)) return;

    try {
      const res = await fetch(
        `http://localhost:5001/delete-requirement/${req.id}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete");
        return;
      }

      dispatch({
        type: "auth/setRequirements",
        payload: requirements.filter((r) => r.id !== req.id),
      });

      setAssignedList((prev) =>
        prev.filter((item) => item.requirementId !== req.id)
      );

      refreshAllData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Server error");
    }
  };

  const refreshAllData = useCallback(
    async () => {
      try {
        const action = await dispatch(fetchRequirements());
        if (fetchRequirements.fulfilled.match(action)) {
          await fetchAssignedRecruiters(action.payload || []);
        } else if (requirements?.length) {
          await fetchAssignedRecruiters(requirements);
        } else {
          setAssignedList([]);
        }
      } catch (error) {
        console.error("Refresh error:", error);
      }
    },
    [dispatch, requirements]
  );

  // --- Update Requirement ---
  const handleUpdateRequirement = async () => {
    try {
      const res = await fetch(
        `http://localhost:5001/update-requirement/${editForm.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update");
        return;
      }

      alert("Requirement updated successfully!");
      setShowEditModal(false);
      refreshAllData();
    } catch (err) {
      console.error("Update error:", err);
      alert("Server error");
    }
  };

  const filteredRequirements = requirements
    .filter((r) =>
      selectedClient ? r.client_id === Number(selectedClient) : true
    )
    .filter((r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div>
        <div className="bg-blue-100 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-3xl font-bold text-black">Requisition</h2>
          <p className="text-gray-500 mt-2">
            Manage and track all your recruitment Requisition
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => navigate("/create-requirement")}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 mb-4"
          >
            + New Requisition
          </button>
        )}
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex gap-4 items-center mb-4 bg-white p-4 rounded-lg shadow-sm">
        <input
          type="text"
          placeholder="Search requirements by title, skills, location..."
          className="border px-4 py-2 rounded-lg shadow-sm flex-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border px-4 py-2 rounded-lg shadow-sm"
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* REQUIREMENTS TABLE */}
      {!loading && filteredRequirements.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-gray-700">
              <tr>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Location</th>
                <th className="p-3 text-left">Experience</th>
                <th className="p-3 text-left">Skills</th>
                <th className="p-3 text-left">CTC</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Created By</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequirements.map((req) => (
                <tr
                  key={req.id}
                  className="border-t hover:bg-gray-50 transition"
                >
                  <td className="p-3 font-medium text-blue-500">
                    {req.title}
                  </td>
                  <td className="p-3">{req.location}</td>
                  <td className="p-3">{req.experience_required} yrs</td>
                  <td className="p-3 flex gap-1 flex-wrap">
                    {req.skills_required.split(",").map((skill, i) => (
                      <span
                        key={i}
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </td>
                  <td className="p-3">{req.ctc_range || "--"}</td>
                  <td className="p-3">
                    {clients.find((c) => c.id === req.client_id)?.name ||
                      "--"}
                  </td>
                  <td className="p-3">{req.created_by || "--"}</td>
                  <td className="p-3">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs">
                      {req.status}
                    </span>
                  </td>

                  {/* ACTIONS */}
                  <td className="p-3 text-center flex gap-2 justify-center">
                    {/* ASSIGN */}
                    {canAssign && (
                      <button
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs"
                        onClick={() => {
                          setSelectedReq(req);
                          setShowAssignModal(true);
                        }}
                      >
                        Assign
                      </button>
                    )}

                    {/* EDIT */}
                    {canCreate && (
                      <button
                        className="bg-yellow-500 text-white px-3 py-1 rounded text-xs"
                        onClick={() => {
                          setEditForm(req);
                          setShowEditModal(true);
                        }}
                      >
                        Edit
                      </button>
                    )}

                    {/* DELETE */}
                    {canCreate && (
                      <button
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs"
                        onClick={() => handleDelete(req)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && (
        <AssignModal
          recruiters={recruiters}
          selectedRecruiter={selectedRecruiter}
          setSelectedRecruiter={setSelectedRecruiter}
          selectedReq={selectedReq}
          setShowAssignModal={setShowAssignModal}
          handleAssignConfirm={handleAssignConfirm}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && editForm && (
        <EditModal
          editForm={editForm}
          setEditForm={setEditForm}
          setShowEditModal={setShowEditModal}
          handleUpdateRequirement={handleUpdateRequirement}
        />
      )}

      {/* ASSIGNED LIST */}
      <AssignedRecruitersTable assignedList={assignedList} />
    </div>
  );
}

// --- Assign Modal ---
function AssignModal({
  recruiters,
  selectedRecruiter,
  setSelectedRecruiter,
  selectedReq,
  setShowAssignModal,
  handleAssignConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white p-6 w-96 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">
          Assign Recruiter for {selectedReq.title}
        </h2>

        <select
          className="border px-3 py-2 w-full mb-4 rounded-lg"
          value={selectedRecruiter}
          onChange={(e) => setSelectedRecruiter(e.target.value)}
        >
          <option value="">Select Recruiter</option>
          {recruiters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 border rounded-lg"
            onClick={() => setShowAssignModal(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
            onClick={handleAssignConfirm}
            disabled={!selectedRecruiter}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Edit Modal ---
function EditModal({ editForm, setEditForm, setShowEditModal, handleUpdateRequirement }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white p-6 w-[500px] rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-blue-600">
          Edit Requirement
        </h2>

        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="Title"
          value={editForm.title}
          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
        />
        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="Location"
          value={editForm.location}
          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
        />
        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="Experience (yrs)"
          value={editForm.experience_required}
          onChange={(e) =>
            setEditForm({ ...editForm, experience_required: e.target.value })
          }
        />
        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="Skills comma separated"
          value={editForm.skills_required}
          onChange={(e) =>
            setEditForm({ ...editForm, skills_required: e.target.value })
          }
        />
        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="CTC Range"
          value={editForm.ctc_range || ""}
          onChange={(e) => setEditForm({ ...editForm, ctc_range: e.target.value })}
        />
        <select
          className="border p-2 w-full mb-3 rounded"
          value={editForm.status}
          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
        >
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
          <option value="ON HOLD">ON HOLD</option>
        </select>

        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 border rounded"
            onClick={() => setShowEditModal(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleUpdateRequirement}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  ); 
}

// --- Assigned Recruiters Table ---
function AssignedRecruitersTable({ assignedList }) {
  return (
    <div className="mt-8 bg-white p-4 rounded-lg shadow">
      <h3 className="text-xl font-bold mb-3 text-blue-500">
        Assigned Recruiters
      </h3>

      <table className="min-w-full text-sm border">
        <thead className="bg-blue-50 text-gray-700">
          <tr>
            <th className="border p-2">S.NO</th>
            <th className="border p-2">Recruiter</th>
            <th className="border p-2">Requirement</th>
            <th className="border p-2">Assigned Date</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {assignedList.length === 0 ? (
            <tr>
              <td className="p-3 text-center text-gray-500" colSpan="5">
                No assignments yet
              </td>
            </tr>
          ) : (
            assignedList.map((item, i) => (
              <tr key={item.id}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2 text-blue-500">{item.recruiter}</td>
                <td className="border p-2">{item.requirementTitle}</td>
                <td className="border p-2">{item.assignedDate}</td>
                <td className="border p-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                    {item.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
