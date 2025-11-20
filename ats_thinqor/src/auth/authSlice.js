// src/features/auth/authSlice.jsx
// This slice manages authentication, users, requirements, clients, and candidates
// All API calls should go through Redux thunks defined here, not direct fetch/axios calls
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "http://127.0.0.1:5000";

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
      localStorage.setItem("user", JSON.stringify(response.data.user));
      return response.data.user;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Login failed. Please try again."
      );
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
      const response = await axios.get(`${API_URL}/get-users`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch users."
      );
    }
  }
);

// ------------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------------
export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
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


// --------------------------------------------------------
// DELETE REQUIREMENT
// --------------------------------------------------------
export const deleteRequirement = createAsyncThunk(
  "auth/deleteRequirement",
  async (reqId, { rejectWithValue }) => {
    try {
      const res = await fetch(`http://localhost:5000/delete-requirement/${reqId}`,
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
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/get-candidates`);
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
  async (candidateData, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      Object.entries(candidateData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });
      
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
  async ({ id, ...userData }, { rejectWithValue }) => {
    try {
      const res = await axios.put(`${API_URL}/update-user/${id}`, userData, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to update user");
    }
  }
);

// DELETE USER
export const deleteUser = createAsyncThunk(
  "auth/deleteUser",
  async (id, { rejectWithValue }) => {
    try {
      const res = await axios.delete(`${API_URL}/delete-user/${id}`);
      return { id, message: res.data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete user");
    }
  }
);


// ------------------------------------------------------------------
// INITIAL STATE
// ------------------------------------------------------------------
const initialState = {
  user: JSON.parse(localStorage.getItem("user")) || null,
  usersList: [], // For admin getUsers
  requirements: [],
  clients: [],
  candidates: [], // For candidates list
  loading: false,
  error: null,
  successMessage: null,
  recruiters: [],
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
    });
  },
});

export const { clearMessages } = authSlice.actions;
export default authSlice.reducer;
