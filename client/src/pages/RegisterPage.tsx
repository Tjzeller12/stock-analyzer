import "./RegisterPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../resources/Stock_Market_Logo.png";

// RegisterPage component for user authentication
const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password_verify, checkPassword] = useState("");

  const navigate = useNavigate();

  // Handle form submission
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual authentication logic
    console.log("Register attempt with:", username, password);
    navigate("/main");
  };

  return (
    <div>
      <div className="register-container">
        <h1>Stock Market Analyzer</h1>
        <img src={logo} alt="Stock Market Logo" />
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
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
          <div>
            <label htmlFor="password_verify">Re-Enter Password:</label>
            <input
              type="password"
              id="password_verify"
              value={password_verify}
              onChange={(e) => checkPassword(e.target.value)}
            />
          </div>
          <button type="submit">Register</button>
          <button type="button" onClick={() => navigate("/register")}>
            Goto Login Page
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
