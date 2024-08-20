import "./LoginPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../resources/Stock_Market_Logo.png";

// LoginPage component for user authentication
const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Handle form submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual authentication logic
    console.log("Login attempt with:", username, password);
    navigate("/main");
  };

  return (
    <div>
      <div className="login-container">
        <h1>Stock Market Analyzer</h1>
        <img src={logo} alt="Stock Market Logo" />
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <div>
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Password:</label>
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
    </div>
  );
};

export default LoginPage;