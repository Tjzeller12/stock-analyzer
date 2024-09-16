import "./LoginPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../resources/Stock_Market_Logo.png";
import axios from "axios";

// LoginPage component for user authentication
const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Handle form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://127.0.0.1:5000/auth/login", {
        username,
        password,
      });
      // Set token in local storage
      const token = response.data.token;
      localStorage.setItem("token", token);
      console.log("Token:", token);
      console.log(response.data);
      navigate("/main");
    } catch (error) {
      console.error("Login failed:", error);
    }
    console.log("Login attempt with:", username, password);
  };

  // Login page
  return (
    <div className="login-container">
      <h1>Stock Market Analyzer</h1>
      <img src={logo} alt="Stock Market Logo" />
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label htmlFor="username">Password:</label>
        <div className="password-container">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onMouseDown={() => setShowPassword(true)}
            onMouseUp={() => setShowPassword(false)}
            onMouseLeave={() => setShowPassword(false)}
          >
            {showPassword ? "Hide Password" : "Show Password"}
          </button>
        </div>
        <button type="submit">Login</button>
        <button type="button" onClick={() => navigate("/register")}>
          Goto Register Page
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
