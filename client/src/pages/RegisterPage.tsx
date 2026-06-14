/**
 * RegisterPage component
 * Handles new user registration, capturing username, email, password, and investor preferences.
 */
import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import { AUTH_ENDPOINTS } from "../constants/api";
import logo from "../resources/alphaBotLogo.png";
// RegisterPage component for user authentication
const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Handle form submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register attempt");
    try {
      const response = await axios.post<{ token: string }>(AUTH_ENDPOINTS.REGISTER, {
        username,
        password,
        email,
        longterm_investor: false,
      });
      // Set token in local storage
      const token = response.data.token;
      localStorage.setItem("token", token);
      // New users go through onboarding first (skippable). Clear any stale
      // dismissal so the flow is presented for this fresh account.
      sessionStorage.removeItem("alphabot.onboarding.dismissed");
      navigate("/onboarding");
    } catch (error: unknown) {
      console.error("Registration failed:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  };

  return (
    <div className="flex flex-col justify-center items-center p-5 font-sans min-h-screen bg-background text-text-main relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/20 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-400/10 blur-[100px] -z-10 animate-pulse delay-1000"></div>

      <h1 className="text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight drop-shadow-sm">AlphaBot</h1>
      <img src={logo} alt="Stock Market Logo" className="max-h-[200px] w-auto mb-5" />

      <Card title="Register" className="w-full max-w-[400px] p-8 flex flex-col shadow-2xl border-white/20 relative z-10" variant="glass">
        <form className="flex flex-col w-full" onSubmit={(e: React.FormEvent<HTMLFormElement>) => { void handleRegister(e); }}>
          <label htmlFor="email" className="text-sm font-semibold mb-2">Email</label>
          <input
            className="w-full box-border p-3 text-base border border-border-main rounded-lg mb-5 bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
            type="email"
            id="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />

          <label htmlFor="username" className="text-sm font-semibold mb-2">Username</label>
          <input
            className="w-full box-border p-3 text-base border border-border-main rounded-lg mb-5 bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
            type="text"
            id="username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />
          <label htmlFor="password" className="text-sm font-semibold mb-2">Password</label>
          <div className="flex items-center w-full mb-8 relative">
            <input
              className="w-full p-3 text-base border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            />
            <button
              className="absolute right-3 text-sm font-medium text-text-main/70 hover:text-primary transition-colors cursor-pointer"
              type="button"
              onMouseDown={() => setShowPassword(true)}
              onMouseUp={() => setShowPassword(false)}
              onMouseLeave={() => setShowPassword(false)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <button 
              type="submit"
              className="w-full bg-linear-to-r from-primary to-[#057a37] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Create Account
            </button>
            <button 
              type="button" 
              onClick={() => navigate("/login")}
              className="w-full bg-transparent border border-border-main text-text-main font-semibold py-3 px-4 rounded-lg hover:bg-row-hover hover:border-text-main/30 active:scale-[0.98] transition-all duration-200"
            >
              Back to Login
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default RegisterPage;
