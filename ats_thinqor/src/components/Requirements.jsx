import React, { useEffect, useState } from "react";
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

  // Recruiters dropdown
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState("");

  // Assigned recruiter data (flattened for table)
  const [assignedList, setAssignedList] = useState([]);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reqToDelete, setReqToDelete] = useState(null);

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchRequirements());
    dispatch(fetchClients());
    loadRecruiters();
  }, [dispatch]);

  // Whenever requirements list updates, load assigned recruiters from backend
  useEffect(() => {
    if (requirements && requirements.length > 0) {
      fetchAssignedRecruiters(requirements);
    } else {
      setAssignedList([]);
    }
  }, [requirements]);

  // Fetch recruiters from Flask
  const loadRecruiters = async () => {
    try {
      const res = await fetch("http://localhost:5000/get-recruiters");
      const data = await res.json();
      setRecruiters(data);
    } catch (err) {
      console.error("Error fetching recruiters:", err);
    }
  };

  // Fetch assignments for requirements
  const fetchAssignedRecruiters = async (reqList) => {
    try {
      const assignmentPromises = reqList.map(async (req) => {
        try {
          const res = await fetch(
            `http://localhost:5000/requirements/${req.id}/allocations`
          );
          if (!res.ok) {
            throw new Error(`Failed to load allocations for ${req.id}`);
          }
          const data = await res.json();
          return data.map((item) => ({
            id: item.id,
            requirementId: req.id,
            requirementTitle: req.title,
            recruiter: item.recruiter_name || `Recruiter #${item.recruiter_id}`,
            assignedDate: item.created_at
              ? new Date(item.created_at).toLocaleString()
              : "-",
            status: item.status || "Assigned",
          }));
        } catch (error) {
          console.error(error.message);
          return [];
        }
      });

      const allocationResults = await Promise.all(assignmentPromises);
      const flatList = allocationResults.flat();
      setAssignedList(flatList);
    } catch (error) {
      console.error("Error loading assigned recruiters:", error);
    }
  };

  const canCreate = ["ADMIN", "DELIVERY_MANAGER"].includes(user?.role);
  const canAssign = ["ADMIN", "DELIVERY_MANAGER"].includes(user?.role);

  // Filtered requirements
  const filteredRequirements = selectedClient
    ? requirements.filter((r) => r.client_id === Number(selectedClient))
    : requirements;

  // Assign modal click
  const handleAssignClick = (req) => {
    setSelectedReq(req);
    setShowAssignModal(true);
  };

  // Save assignment
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

      if (res.ok) {
        alert("Recruiter assigned successfully!");

        const recruiterName =
          recruiters.find((r) => r.id === parseInt(selectedRecruiter))?.name ||
          "Unknown";

        const newEntry = {
          id: data.allocation_id,
          requirementId: selectedReq.id,
          requirementTitle: selectedReq.title,
          recruiter: recruiterName,
          assignedDate: new Date().toLocaleString(),
          status: "Assigned",
        };

        setAssignedList((prev) => [...prev, newEntry]);
        setShowAssignModal(false);
        setSelectedRecruiter("");
        setSelectedReq(null);

        // Refresh allocations from backend to ensure persistence
        fetchAssignedRecruiters(requirements);
      } else {
        alert("Error: " + (data.error || "Something went wrong"));
      }
    } catch (err) {
      console.error("Error assigning recruiter:", err);
      alert("Server error. Try again later.");
    }
  };

  // On delete click
  const handleDeleteClick = (req) => {
    setReqToDelete(req);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch(`http://localhost:5000/delete-requirement/${reqToDelete.id}`,
        {
          method: "DELETE",
        }
      );
  
      const data = await res.json();
  
      if (res.ok) {
        alert("Requirement deleted successfully!");
  
        dispatch({
          type: "auth/setRequirements",
          payload: requirements.filter((item) => item.id !== reqToDelete.id),
        });
  
        setShowDeleteModal(false);
        setReqToDelete(null);
      } else {
        alert(data.error || "Failed to delete requirement");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Server error. Try again later.");
    }
  };
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Requirements</h2>

        {canCreate && (
          <button
            onClick={() => navigate("/create-requirement")}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            + New Requirement
          </button>
        )}
      </div>

      {/* Client Filter */}
      <div className="flex gap-4 mb-4">
        <select
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center text-gray-500 py-10">
          ⏳ Loading requirements...
        </div>
      )}

      {/* Empty */}
      {!loading && filteredRequirements?.length === 0 && (
        <div className="text-center text-gray-600 py-10">
          ⚠ No requirements found.
        </div>
      )}

      {/* Table */}
      {!loading && filteredRequirements?.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-left">Experience</th>
                <th className="px-4 py-2 text-left">Skills</th>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-left">Created By</th>
                <th className="px-4 py-2 text-center">Status</th>
                {canAssign && (
                  <th className="px-4 py-2 text-center">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredRequirements.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{req.title}</td>
                  <td className="px-4 py-2">{req.location}</td>
                  <td className="px-4 py-2">{req.experience_required} yrs</td>
                  <td className="px-4 py-2">{req.skills_required}</td>
                  <td className="px-4 py-2">
                    {clients?.find((c) => c.id === req.client_id)?.name || "--"}
                  </td>
                  <td className="px-4 py-2">{req.created_by}</td>

                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700">
                      {req.status || "OPEN"}
                    </span>
                  </td>

                  {canAssign && (
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleAssignClick(req)}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs"
                        >
                          Assign
                        </button>

                        <button
                          onClick={() => handleDeleteClick(req)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedReq && (
        <AssignModal
          recruiters={recruiters}
          selectedRecruiter={selectedRecruiter}
          setSelectedRecruiter={setSelectedRecruiter}
          selectedReq={selectedReq}
          setShowAssignModal={setShowAssignModal}
          handleAssignConfirm={handleAssignConfirm}
        />
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && reqToDelete && (
        <DeleteModal
          reqToDelete={reqToDelete}
          setShowDeleteModal={setShowDeleteModal}
          handleDeleteConfirm={handleDeleteConfirm}
        />
      )}

      {/* Assigned Recruiters Table */}
      <AssignedRecruitersTable assignedList={assignedList} />
    </div>
  );
}

/* ------------------------------
   ASSIGN MODAL
------------------------------ */
function AssignModal({
  recruiters,
  selectedRecruiter,
  setSelectedRecruiter,
  selectedReq,
  setShowAssignModal,
  handleAssignConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-4">
          Assign Recruiter for{" "}
          <span className="text-indigo-600">{selectedReq.title}</span>
        </h3>

        <label className="block text-sm mb-2">Select Recruiter</label>

        <select
          className="w-full border border-gray-300 px-3 py-2 rounded mb-4"
          value={selectedRecruiter}
          onChange={(e) => setSelectedRecruiter(e.target.value)}
        >
          <option value="">Select recruiter</option>
          {recruiters.length > 0 ? (
            recruiters.map((rec) => (
              <option key={rec.id} value={rec.id}>
                {rec.name}
              </option>
            ))
          ) : (
            <option disabled>No recruiters found</option>
          )}
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

/* ------------------------------
   DELETE CONFIRMATION MODAL
------------------------------ */
function DeleteModal({
  reqToDelete,
  setShowDeleteModal,
  handleDeleteConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-2 text-red-600">
          Delete Requirement?
        </h3>

        <p className="text-sm mb-4">
          Are you sure you want to delete{" "}
          <strong>{reqToDelete.title}</strong>?
        </p>

        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 border rounded"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={handleDeleteConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------
   ASSIGNED RECRUITERS TABLE
------------------------------ */
function AssignedRecruitersTable({ assignedList }) {
  return (
    <div className="p-4 mt-8 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-3">Assigned Recruiters</h2>

      <table className="min-w-full border border-gray-300 rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">S.NO</th>
            <th className="border p-2">Recruiter Name</th>
            <th className="border p-2">Requirement</th>
            <th className="border p-2">Assigned Date</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>

        <tbody>
          {assignedList.length === 0 ? (
            <tr>
              <td colSpan="5" className="p-3 text-center text-gray-500">
                No recruiters assigned yet.
              </td>
            </tr>
          ) : (
            assignedList.map((item, index) => (
              <tr key={item.id}>
                <td className="border p-2">{index + 1}</td>
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
