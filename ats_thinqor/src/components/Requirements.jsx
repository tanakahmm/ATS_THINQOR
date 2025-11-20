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
  const [selectedReq, setSelectedReq] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState("");

  const [assignedList, setAssignedList] = useState([]);

  // -----------------------------------
  // INITIAL LOAD
  // -----------------------------------
  useEffect(() => {
    dispatch(fetchRequirements());
    dispatch(fetchClients());
    loadRecruiters();
  }, [dispatch]);

  useEffect(() => {
    if (requirements.length > 0) fetchAssignedRecruiters(requirements);
    else setAssignedList([]);
  }, [requirements]);

  // -----------------------------------
  // LOAD RECRUITERS
  // -----------------------------------
  const loadRecruiters = async () => {
    try {
      const res = await fetch("http://localhost:5000/get-recruiters");
      const data = await res.json();
      setRecruiters(data);
    } catch (err) {
      console.error("Recruiter load error:", err);
    }
  };

  // -----------------------------------
  // LOAD ASSIGNED RECRUITERS
  // -----------------------------------
  const fetchAssignedRecruiters = async (reqList) => {
    try {
      const all = await Promise.all(
        reqList.map(async (req) => {
          const res = await fetch(`http://localhost:5000/requirements/${req.id}/allocations`
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

  // -----------------------------------
  // ASSIGN RECRUITER SAVE
  // -----------------------------------
  const handleAssignConfirm = async () => {
    if (!selectedReq || !selectedRecruiter) return;

    try {
      const res = await fetch("http://localhost:5000/assign-requirement", {
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
          status: "Assigned",
        },
      ]);

      setShowAssignModal(false);
      setSelectedRecruiter("");
      setSelectedReq(null);

      alert("Recruiter assigned successfully!");

      refreshAllData();
    } catch (err) {
      console.error("Assign error:", err);
      alert("Server error");
    }
  };

  // -----------------------------------
  // DELETE REQUIREMENT INSTANTLY
  // -----------------------------------
  const handleDelete = async (req) => {
    if (!window.confirm(`Delete ${req.title}?`)) return;

    try {
      const res = await fetch(`http://localhost:5000/delete-requirement/${req.id}`,
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

      alert("Requirement deleted!");

      refreshAllData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Server error");
    }
  };

  const refreshAllData = useCallback(async () => {
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
  }, [dispatch, requirements]);

  const filteredRequirements = selectedClient
    ? requirements.filter((r) => r.client_id === Number(selectedClient))
    : requirements;

  // -----------------------------------
  // RETURN UI
  // -----------------------------------
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Requirements</h2>
        {canCreate && (
          <button
            onClick={() => navigate("/create-requirement")}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            + New Requirement
          </button>
        )}
      </div>

      {/* FILTER */}
      <div className="mb-4">
        <select
          className="border px-4 py-2 rounded"
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

      {/* LOADING */}
      {loading && <p>Loading...</p>}

      {/* REQUIREMENTS TABLE */}
      {!loading && filteredRequirements.length > 0 && (
        <div className="bg-white shadow rounded overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Experience</th>
                <th className="p-2 text-left">Skills</th>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Created By</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRequirements.map((req) => (
                <tr key={req.id} className="border-t">
                  <td className="p-2">{req.title}</td>
                  <td className="p-2">{req.location}</td>
                  <td className="p-2">{req.experience_required} yrs</td>
                  <td className="p-2">{req.skills_required}</td>
                  <td className="p-2">
                    {clients.find((c) => c.id === req.client_id)?.name || "--"}
                  </td>
                  <td className="p-2">{req.created_by}</td>

                  <td className="p-2 text-center">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                      {req.status}
                    </span>
                  </td>

                  <td className="p-2 text-center">
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs mr-2"
                      onClick={() => {
                        setSelectedReq(req);
                        setShowAssignModal(true);
                      }}
                    >
                      Assign
                    </button>

                    <button
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs"
                      onClick={() => handleDelete(req)}
                    >
                      Delete
                    </button>
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

      {/* ASSIGNED TABLE */}
      <AssignedRecruitersTable assignedList={assignedList} />
    </div>
  );
}

/* ASSIGN MODAL */
function AssignModal({
  recruiters,
  selectedRecruiter,
  setSelectedRecruiter,
  selectedReq,
  setShowAssignModal,
  handleAssignConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
      <div className="bg-white p-6 w-96 rounded shadow">
        <h2 className="text-lg font-bold mb-4">
          Assign Recruiter for {selectedReq.title}
        </h2>

        <select
          className="border px-3 py-2 w-full mb-4 rounded"
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
            className="px-4 py-2 border rounded"
            onClick={() => setShowAssignModal(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded"
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

/* ASSIGNED RECRUITERS TABLE */
function AssignedRecruitersTable({ assignedList }) {
  return (
    <div className="mt-8 bg-white p-4 rounded shadow">
      <h3 className="text-xl font-bold mb-3">Assigned Recruiters</h3>

      <table className="min-w-full text-sm border">
        <thead className="bg-gray-100">
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
                <td className="border p-2">{item.recruiter}</td>
                <td className="border p-2">{item.requirementTitle}</td>
                <td className="border p-2">{item.assignedDate}</td>
                <td className="border p-2">{item.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}