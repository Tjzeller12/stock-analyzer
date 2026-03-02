import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import { AUTH_ENDPOINTS } from "../constants/api";
import "../main.css";
import logo from "../resources/alphaBotLogo.png";
import "./LoginPage.css";

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
      const response = await axios.post<{ token: string }>(AUTH_ENDPOINTS.LOGIN, {
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
      <h1>AlphaBot</h1>
      <img src={logo} alt="Stock Market Logo" />

      <Card title="Login" className="form-container" variant="glass">
        <form className="user-form" onSubmit={(e) => { void handleLogin(e); }}>
          <label htmlFor="username">Username:</label>
          <input
            className="input-field"
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label htmlFor="username">Password:</label>
          <div className="password-container">
            <input
              className="input-field"
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
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit">Login</button>
          <button type="button" onClick={() => navigate("/register")}>
            Goto Register Page
          </button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
