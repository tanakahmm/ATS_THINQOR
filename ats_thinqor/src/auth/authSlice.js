// This slice manages authentication, users, requirements, clients, and candidates
// All API calls should go through Redux thunks defined here, not direct fetch/axios calls
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "http://localhost:5001";


// ------------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------------
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("LOGIN SUCCESS", response.data);
      const user = response.data.user;

      // Store user AND token
      localStorage.setItem("user", JSON.stringify(user));
      // Ideally store token separately or part of user object (it is in user object now)

      return user;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Login failed. Please try again."
      );
    }
  }
);

// ------------------------------------------------------------------
// VERIFY SESSION (New)
// ------------------------------------------------------------------
export const verifySession = createAsyncThunk(
  "auth/verifySession",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      let user = state.auth.user;

      // If not in state, check local storage
      if (!user) {
        try {
          user = JSON.parse(localStorage.getItem("user"));
        } catch (e) { }
      }

      if (!user || !user.token) {
        return rejectWithValue("No local session found");
      }

      const response = await axios.post(`${API_URL}/verify-session`, { token: user.token });

      // Update local storage with fresh user data if needed
      localStorage.setItem("user", JSON.stringify(response.data.user));
      return response.data.user;

    } catch (error) {
      // If verification fails, clear local session
      localStorage.removeItem("user");
      return rejectWithValue("Session invalid/expired");
    }
  }
);

// ------------------------------------------------------------------
// SIGNUP (User self-registers if added by admin)
// ------------------------------------------------------------------
export const signupUser = createAsyncThunk(
  "auth/signupUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/signup`, userData, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Signup failed. Please try again."
      );
    }
  }
);

// ------------------------------------------------------------------
// CREATE USER (Admin adds user manually)
// ------------------------------------------------------------------
export const createUser = createAsyncThunk(
  "auth/createUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/create-user`, userData, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error creating user."
      );
    }
  }
);

// ------------------------------------------------------------------
// GET USERS (Admin view all users)
// ------------------------------------------------------------------
export const getUsers = createAsyncThunk(
  "auth/getUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/users-list`); // Updated endpoint
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch users."
      );
    }
  }
);

// ------------------------------------------------------------------
// GET ROLES
// ------------------------------------------------------------------
export const fetchRoles = createAsyncThunk(
  "auth/fetchRoles",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/roles`);
      return response.data.roles || response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch roles."
      );
    }
  }
);

// ------------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------------
export const logoutUser = createAsyncThunk("auth/logoutUser", async (_, { getState }) => {
  const state = getState();
  const user = state.auth.user;

  if (user && user.token) {
    try {
      await axios.post(`${API_URL}/logout`, { token: user.token });
    } catch (e) {
      console.warn("Logout backend call failed", e);
    }
  }

  localStorage.removeItem("user");
  return null;
});

// ------------------------------------------------------------------
// CREATE REQUIREMENT
// ------------------------------------------------------------------
export const createRequirement = createAsyncThunk(
  "requirements/createRequirement",
  async (data, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/requirements`, data);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to create requirement"
      );
    }
  }
);

// ------------------------------------------------------------------
// FETCH ALL REQUIREMENTS
// ------------------------------------------------------------------
export const fetchRequirements = createAsyncThunk(
  "requirements/fetchRequirements",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/get-requirements`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to fetch requirements"
      );
    }
  }
);

// ------------------------------------------------------------------
// ASSIGN REQUIREMENT TO RECRUITER
// ------------------------------------------------------------------
export const assignRequirement = createAsyncThunk(
  "requirements/assignRequirement",
  async (data, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/assign-requirement`, data);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Requirement assignment failed"
      );
    }
  }
);


// ------------------------------------------------------------------
// UPDATE REQUIREMENT
// ------------------------------------------------------------------
export const updateRequirement = createAsyncThunk(
  "requirements/updateRequirement",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await axios.put(`${API_URL}/update-requirement/${id}`, data, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to update requirement"
      );
    }
  }
);

// --------------------------------------------------------
// DELETE REQUIREMENT
// --------------------------------------------------------
export const deleteRequirement = createAsyncThunk(
  "auth/deleteRequirement",
  async (reqId, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_URL}/delete-requirement/${reqId}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        return rejectWithValue(data.error || "Delete failed");
      }

      return reqId; // return ID to remove from state
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ------------------------------------------------------------------
// CREATE CLIENT (Admin only)
// ------------------------------------------------------------------
export const createClient = createAsyncThunk(
  "clients/createClient",
  async (clientData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/create-client`, clientData, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create client"
      );
    }
  }
);


// ------------------------------------------------------------------
// FETCH CLIENTS
// ------------------------------------------------------------------
export const fetchClients = createAsyncThunk(
  "clients/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/clients`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch clients"
      );
    }
  }
);

export const updateClient = createAsyncThunk(
  "clients/updateClient",
  async ({ id, clientData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/update-client/${id}`, clientData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to update client");
    }
  }
);

export const deleteClient = createAsyncThunk(
  "clients/deleteClient",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_URL}/delete-client/${id}`);
      return { id, message: response.data.message };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete client");
    }
  }
);


// fetchrecruiters
export const fetchRecruiters = createAsyncThunk(
  "auth/fetchRecruiters",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/get-recruiters`);
      return res.data;
    } catch (err) {
      return rejectWithValue("Failed to fetch recruiters");
    }
  }
);



// ------------------------------------------------------------------
// FETCH CANDIDATES
// ------------------------------------------------------------------
export const fetchCandidates = createAsyncThunk(
  "candidates/fetchCandidates",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const user = state.auth?.user;

      let url = `${API_URL}/get-candidates`;
      if (user && user.role) {
        const params = new URLSearchParams();
        params.set("user_role", user.role);
        if (user.id) {
          params.set("user_id", user.id);
        }
        url = `${API_URL}/get-candidates?${params.toString()}`;
      }

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch candidates"
      );
    }
  }
);

// ------------------------------------------------------------------
// SUBMIT CANDIDATE (Create new candidate)
// ------------------------------------------------------------------
export const submitCandidate = createAsyncThunk(
  "candidates/submitCandidate",
  async (candidateData, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const user = state.auth?.user;

      const formData = new FormData();
      Object.entries(candidateData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      // Ensure created_by is set to the logged-in user's id
      if (user && user.id) {
        formData.append("created_by", user.id);
      }

      const response = await axios.post(`${API_URL}/submit-candidate`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to submit candidate"
      );
    }
  }
);

// ------------------------------------------------------------------
// UPDATE CANDIDATE
// ------------------------------------------------------------------
export const updateCandidate = createAsyncThunk(
  "candidates/updateCandidate",
  async ({ id, candidateData }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      Object.entries(candidateData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      const response = await axios.put(`${API_URL}/update-candidate/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update candidate"
      );
    }
  }
);

// ------------------------------------------------------------------
// DELETE CANDIDATE
// ------------------------------------------------------------------
export const deleteCandidate = createAsyncThunk(
  "candidates/deleteCandidate",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${API_URL}/delete-candidate/${id}`);
      return { id, message: response.data.message };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete candidate"
      );
    }
  }
);

// -------------------- USERS CRUD --------------------
// FETCH ALL USERS
export const fetchUsers = createAsyncThunk(
  "auth/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/get-users`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch users");
    }
  }
);

// ADD USER
export const addUser = createAsyncThunk(
  "auth/addUser",
  async (userData, { rejectWithValue }) => {
    try {
      // Backend endpoint available is create-user
      const res = await axios.post(`${API_URL}/create-user`, userData, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to add user");
    }
  }
);

// UPDATE USER
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async ({ id, ...userData }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const token = state.auth.user?.token;

      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await axios.put(`${API_URL}/update-user/${id}`, userData, { headers });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to update user");
    }
  }
);

// DELETE USER
export const deleteUser = createAsyncThunk(
  "auth/deleteUser",
  async (arg, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const token = state.auth.user?.token;

      // Arg might be id or object, just extract id
      const id = typeof arg === "object" ? arg.id : arg;

      const config = {};
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await axios.delete(`${API_URL}/delete-user/${id}`, config);
      return { id, message: res.data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete user");
    }
  }
);

// ------------------------------------------------------------------
// REPORTS
// ------------------------------------------------------------------
export const fetchReportClients = createAsyncThunk(
  "reports/fetchClients",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/api/reports/clients`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch report clients");
    }
  }
);

export const fetchReportRequirements = createAsyncThunk(
  "reports/fetchRequirements",
  async (clientId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/api/reports/client/${clientId}/requirements`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch report requirements");
    }
  }
);

export const fetchReportStats = createAsyncThunk(
  "reports/fetchStats",
  async (reqId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/api/reports/requirement/${reqId}/stats`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch report stats");
    }
  }
);

// ------------------------------------------------------------------
// AI CHAT
// ------------------------------------------------------------------
export const sendAiMessage = createAsyncThunk(
  "ai/sendMessage",
  async ({ message, user }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/api/ai/chat`, { message, user }, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data.answer || "No response";
    } catch (error) {
      return rejectWithValue(error.response?.data?.answer || error.message || "Request failed");
    }
  }
);

// ------------------------------------------------------------------
// AI AUTO FILL REQUIREMENT
// ------------------------------------------------------------------
export const autoFillRequirement = createAsyncThunk(
  "ai/autoFillRequirement",
  async (jdText, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/api/ai/jd-to-requirement`, { jd_text: jdText }, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "AI Auto-fill failed");
    }
  }
);

// ------------------------------------------------------------------
// SCREEN CANDIDATE
// ------------------------------------------------------------------
export const screenCandidate = createAsyncThunk(
  "ai/screenCandidate",
  async ({ candidate_id, requirement_id }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/api/screen-candidate`, { candidate_id, requirement_id }, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data.result || res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Screening failed");
    }
  }
);

// ------------------------------------------------------------------
// CANDIDATE TRACKER
// ------------------------------------------------------------------
export const fetchCandidateTracker = createAsyncThunk(
  "candidates/fetchTracker",
  async (candidateId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/api/candidate-tracker/${candidateId}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch tracker");
    }
  }
);

export const updateStageStatus = createAsyncThunk(
  "candidates/updateStageStatus",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/api/update-stage-status`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to update stage status");
    }
  }
);

export const assignCandidateToRequirement = createAsyncThunk(
  "candidates/assignCandidateToRequirement",
  async ({ candidate_id, requirement_id }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_URL}/api/assign-candidate`, { candidate_id, requirement_id }, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to assign candidate");
    }
  }
);

// ------------------------------------------------------------------
// FETCH ALLOCATIONS
// ------------------------------------------------------------------
export const fetchAllocations = createAsyncThunk(
  "requirements/fetchAllocations",
  async (reqList, { rejectWithValue }) => {
    try {
      const all = await Promise.all(
        reqList.map(async (req) => {
          const res = await fetch(`${API_URL}/requirements/${req.id}/allocations`);
          if (!res.ok) return [];
          const data = await res.json();
          return data.map((item) => ({
            id: item.id,
            requirementId: req.id,
            requirementTitle: req.title,
            recruiter: item.recruiter_name,
            assignedDate: item.created_at ? new Date(item.created_at).toLocaleString() : "-",
            status: item.status || "Assigned",
          }));
        })
      );
      return all.flat();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ------------------------------------------------------------------
// FETCH CANDIDATE PROGRESS (INTERVIEWS)
// ------------------------------------------------------------------
export const fetchCandidateProgress = createAsyncThunk(
  "candidates/fetchProgress",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/api/candidate_progress`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch progress");
    }
  }
);

export const fetchCandidateProgressDetails = createAsyncThunk(
  "candidates/fetchProgressDetails",
  async ({ candidateId, requirementId }, { rejectWithValue }) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/candidate-progress/${candidateId}/${requirementId}`
      );
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch details");
    }
  }
);

// ------------------------------------------------------------------
// DASHBOARD STATS & USER DETAILS
// ------------------------------------------------------------------
export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/dashboard-stats`);
      const s = res.data?.stats || res.data?.data || {};
      return {
        total: s.totalRequirements ?? 0,
        open: s.openRequirements ?? 0,
        closed: s.closedRequirements ?? 0,
        assigned: s.assignedRequirements ?? 0,
        urgent: s.urgent ?? 0,
        closedGrowthPercent: s.closedGrowthPercent ?? 0,
        pendingReview: s.pendingReview ?? 0,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch stats");
    }
  }
);

export const fetchRecentRequirements = createAsyncThunk(
  "dashboard/fetchRecentRequirements",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/recent-requirements`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch recent requirements");
    }
  }
);

export const fetchUserDetails = createAsyncThunk(
  "users/fetchUserDetails",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_URL}/users/${userId}/details`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch user details");
    }
  }
);


// ------------------------------------------------------------------
// INITIAL STATE
// ------------------------------------------------------------------
const initialState = {
  user: JSON.parse(localStorage.getItem("user")) || null,
  isVerifying: true, // New flag for initial session check
  usersList: [], // For admin getUsers
  requirements: [],
  clients: [],
  roles: [], // roles
  dashboardStats: {}, // dashboard
  recentRequirements: [], // dashboard
  userDetails: null, // recruiter dashboard
  candidates: [], // For candidates list
  loading: false,
  error: null,
  successMessage: null,
  recruiters: [],
  allocations: [],
  interviews: [],
  reportClients: [],
  reportRequirements: [],
  reportStats: null,
  aiMessages: [],
  trackerData: [],
  screeningResult: null,
};

// ------------------------------------------------------------------
// SLICE
// ------------------------------------------------------------------
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // LOGIN
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.successMessage = "Login successful!";
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // SIGNUP
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // CREATE USER (ADMIN)
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // GET USERS (ADMIN)
      .addCase(getUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.usersList = action.payload;
      })
      .addCase(getUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // VERIFY SESSION
      .addCase(verifySession.pending, (state) => {
        state.isVerifying = true;
        state.loading = true; // Optional: keep loading true if you want spinner
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.isVerifying = false;
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(verifySession.rejected, (state, action) => {
        state.isVerifying = false;
        state.loading = false;
        state.user = null;
      })


      // LOGOUT
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.successMessage = "Logged out successfully!";
      })
      // CREATE CLIENT
      .addCase(createClient.pending, (s) => { s.loading = true; })
      .addCase(createClient.fulfilled, (s, a) => {
        s.loading = false;
        s.successMessage = "Client created successfully!";
      })
      .addCase(createClient.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // FETCH CLIENTS
      .addCase(fetchClients.pending, (s) => { s.loading = true; })
      .addCase(fetchClients.fulfilled, (s, a) => {
        s.loading = false;
        s.clients = a.payload;
      })
      .addCase(fetchClients.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })
      .addCase(updateClient.pending, (s) => { s.loading = true; })
      .addCase(updateClient.fulfilled, (s, a) => { s.loading = false; s.clients = s.clients.map(c => c.id === a.payload.id ? a.payload : c); s.successMessage = "Client updated!"; })
      .addCase(updateClient.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      .addCase(deleteClient.pending, (s) => { s.loading = true; })
      .addCase(deleteClient.fulfilled, (s, a) => { s.loading = false; s.clients = s.clients.filter(c => c.id !== a.payload.id); s.successMessage = a.payload.message || "Client deleted!"; })
      .addCase(deleteClient.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
      .addCase(createRequirement.pending, (s) => { s.loading = true; })
      .addCase(createRequirement.fulfilled, (s) => { s.loading = false; s.successMessage = "Requirement created"; })
      .addCase(createRequirement.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      .addCase(fetchRequirements.pending, (s) => { s.loading = true; })
      .addCase(fetchRequirements.fulfilled, (s, a) => { s.loading = false; s.requirements = a.payload; })
      .addCase(fetchRequirements.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      .addCase(assignRequirement.pending, (s) => { s.loading = true; })
      .addCase(assignRequirement.fulfilled, (s) => { s.loading = false; s.successMessage = "Requirement assigned"; })
      .addCase(assignRequirement.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      // ---------- USERS LIST ----------
      .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUsers.fulfilled, (state, action) => { state.loading = false; state.usersList = action.payload; })
      .addCase(fetchUsers.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // ADD USER
      .addCase(addUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(addUser.fulfilled, (state, action) => { state.loading = false; state.successMessage = action.payload.message; })
      .addCase(addUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // UPDATE USER
      .addCase(updateUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
        state.usersList = state.usersList.map(u =>
          u.id === action.payload.id ? { ...u, ...action.payload } : u
        );
      })
      .addCase(updateUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // DELETE USER
      .addCase(deleteUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.usersList = state.usersList.filter(u => u.id !== action.payload.id);
        state.successMessage = action.payload.message;
      })
      .addCase(deleteUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      // FETCH CANDIDATES
      .addCase(fetchCandidates.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchCandidates.fulfilled, (s, a) => {
        s.loading = false;
        s.candidates = a.payload;
      })
      .addCase(fetchCandidates.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // SUBMIT CANDIDATE
      .addCase(submitCandidate.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(submitCandidate.fulfilled, (s, a) => {
        s.loading = false;
        s.successMessage = a.payload.message || "Candidate submitted successfully!";
      })
      .addCase(submitCandidate.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      .addCase(deleteRequirement.fulfilled, (state, action) => {
        state.requirements = state.requirements.filter(
          (req) => req.id !== action.payload
        );
      })
      .addCase(deleteRequirement.rejected, (state, action) => {
        state.error = action.payload || "Failed to delete requirement";
      })

      // UPDATE CANDIDATE
      .addCase(updateCandidate.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(updateCandidate.fulfilled, (s, a) => {
        s.loading = false;
        s.successMessage = a.payload.message || "Candidate updated successfully!";
      })
      .addCase(updateCandidate.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })
      .addCase(fetchRecruiters.fulfilled, (state, action) => {
        state.recruiters = action.payload;
      })
      .addCase(fetchRecruiters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.roles = action.payload;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.dashboardStats = action.payload;
      })
      .addCase(fetchRecentRequirements.fulfilled, (state, action) => {
        state.recentRequirements = action.payload;
      })
      .addCase(fetchUserDetails.fulfilled, (state, action) => {
        state.userDetails = action.payload;
      })
      // DELETE CANDIDATE
      .addCase(deleteCandidate.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(deleteCandidate.fulfilled, (s, a) => {
        s.loading = false;
        s.candidates = s.candidates.filter(c => c.id !== a.payload.id);
        s.successMessage = a.payload.message || "Candidate deleted successfully!";
      })
      .addCase(deleteCandidate.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // FETCH ALLOCATIONS
      .addCase(fetchAllocations.pending, (s) => { s.loading = true; })
      .addCase(fetchAllocations.fulfilled, (s, a) => {
        s.loading = false;
        s.allocations = a.payload;
      })
      .addCase(fetchAllocations.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // FETCH CANDIDATE PROGRESS
      .addCase(fetchCandidateProgress.pending, (s) => { s.loading = true; })
      .addCase(fetchCandidateProgress.fulfilled, (s, a) => {
        s.loading = false;
        s.interviews = a.payload;
      })
      .addCase(fetchCandidateProgress.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // REPORTS
      .addCase(fetchReportClients.pending, (s) => { s.loading = true; })
      .addCase(fetchReportClients.fulfilled, (s, a) => {
        s.loading = false;
        s.reportClients = a.payload;
      })
      .addCase(fetchReportClients.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      .addCase(fetchReportRequirements.pending, (s) => { s.loading = true; })
      .addCase(fetchReportRequirements.fulfilled, (s, a) => {
        s.loading = false;
        s.reportRequirements = a.payload;
      })
      .addCase(fetchReportRequirements.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      .addCase(fetchReportStats.pending, (s) => { s.loading = true; })
      .addCase(fetchReportStats.fulfilled, (s, a) => {
        s.loading = false;
        s.reportStats = a.payload;
      })
      .addCase(fetchReportStats.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // AI CHAT
      .addCase(sendAiMessage.pending, (s) => { s.loading = true; })
      .addCase(sendAiMessage.fulfilled, (s, a) => {
        s.loading = false;
        // Messages are handled in component state usually, but we can store them here if needed
        // For now, we just handle success/loading
      })
      .addCase(sendAiMessage.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // AUTO FILL
      .addCase(autoFillRequirement.pending, (s) => { s.loading = true; })
      .addCase(autoFillRequirement.fulfilled, (s) => { s.loading = false; })
      .addCase(autoFillRequirement.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      // SCREEN CANDIDATE
      .addCase(screenCandidate.pending, (s) => { s.loading = true; })
      .addCase(screenCandidate.fulfilled, (s, a) => {
        s.loading = false;
        s.screeningResult = a.payload;
      })
      .addCase(screenCandidate.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      // TRACKER
      .addCase(fetchCandidateTracker.pending, (s) => { s.loading = true; })
      .addCase(fetchCandidateTracker.fulfilled, (s, a) => {
        s.loading = false;
        s.trackerData = Array.isArray(a.payload) ? a.payload : [a.payload];
      })
      .addCase(fetchCandidateTracker.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })

      .addCase(updateStageStatus.pending, (s) => { s.loading = true; })
      .addCase(updateStageStatus.fulfilled, (s) => { s.loading = false; s.successMessage = "Stage updated"; })
      .addCase(updateStageStatus.rejected, (s, a) => { s.loading = false; s.error = a.payload; });
  },
});

export const { clearMessages } = authSlice.actions;
export default authSlice.reducer;
