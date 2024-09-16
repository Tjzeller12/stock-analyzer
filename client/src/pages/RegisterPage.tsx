import "./RegisterPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import logo from "../resources/Stock_Market_Logo.png";

// RegisterPage component for user authentication
const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [ltInvestor, setLtInvestor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Handle form submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register attempt");
    try {
      const response = await axios.post("http://127.0.0.1:5000/auth/register", {
        username,
        password,
        email,
        longterm_investor: ltInvestor,
      });
      // Set token in local storage
      const token = response.data.token;
      localStorage.setItem("token", token);
      console.log("Token:", token);
      console.log(response.data);
      navigate("/main");
    } catch (error) {
      console.error("Regisration failed:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  };

  // Toggle long-term investor checkbox
  const handleToggle = () => {
    setLtInvestor((prevState) => !prevState);
  };

  return (
    <div className="register-container">
      <h1>Stock Market Analyzer</h1>
      <img src={logo} alt="Stock Market Logo" />
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label htmlFor="password">Password:</label>
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
        <div className="toggle-switch">
          <input
            type="checkbox"
            id="ltInvestor"
            checked={ltInvestor}
            onChange={handleToggle}
          />
          <label htmlFor="ltInvestor">
            <span className="slider"></span>
          </label>
          <span className="toggle-label">
            {ltInvestor ? "Long-Term Investor" : "Short-Term Investor"}
          </span>
        </div>

        <button type="submit">Register</button>
        <button type="button" onClick={() => navigate("/login")}>
          Goto Login Page
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
