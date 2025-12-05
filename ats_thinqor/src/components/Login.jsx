import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, logoutUser, clearMessages } from "../auth/authSlice";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, error, successMessage } = useSelector((state) => state.auth);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  // Redirect when user logs in
  useEffect(() => {
    if (user) {
      // Navigate based on role (optional)
      if (user.role === "ADMIN") navigate("/admin-dashboard");
      else if (user.role === "DELIVERY_MANAGER") navigate("/dm-dashboard");
      else if (user.role === "TEAM_LEAD") navigate("/tl-dashboard");
      else navigate("/recruiter-dashboard");
    }
  }, [user, navigate]);

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => dispatch(clearMessages()), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(form));
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6">
          ATS Login
        </h2>

        {/* Error Message */}
        {error && (
          <p className="text-red-500 bg-red-100 border border-red-400 px-3 py-2 rounded text-center mb-4">
            {error}
          </p>
        )}

        {/* Success Message */}
        {successMessage && (
          <p className="text-green-600 bg-green-100 border border-green-400 px-3 py-2 rounded text-center mb-4">
            {successMessage}
          </p>
        )}

        {!user ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-600 text-sm mb-2">Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-600 text-sm mb-2">Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Don’t have an account?{" "}
              <span
                onClick={() => navigate("/signup")}
                className="text-indigo-600 cursor-pointer hover:underline"
              >
                Sign Up
              </span>
            </p>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-gray-700 mb-3">
              Logged in as <b>{user.name}</b> ({user.role})
            </p>
            <button
              onClick={() => dispatch(logoutUser())}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
