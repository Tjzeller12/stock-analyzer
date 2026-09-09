/**
 * RegisterPage component
 * Handles new user registration, capturing username, email, password, and investor preferences.
 */
import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import Card from "../components/common/Card";
import { AUTH_ENDPOINTS } from "../constants/api";
import logo from "../resources/alphaBotLogo.png";
// RegisterPage component for user authentication
const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");


  const navigate = useNavigate();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await axios.post<{ token: string }>(AUTH_ENDPOINTS.GOOGLE, {
          token: tokenResponse.access_token,
        });
        localStorage.setItem("token", response.data.token);
        sessionStorage.removeItem("alphabot.onboarding.dismissed");
        navigate("/onboarding");
      } catch {
        setError("Google login failed. Please try again.");
      }
    },
    onError: () => setError("Google login was cancelled or failed."),
  });

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

          {error && (
            <p className="text-red-400 text-sm text-center -mt-2 mb-2">{error}</p>
          )}
          <div className="flex flex-col gap-4 mt-2">
            <button 
              type="submit"
              className="w-full bg-linear-to-r from-primary to-[#057a37] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Create Account
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-main/50" />
              <span className="text-text-main/40 text-xs font-medium">or</span>
              <div className="flex-1 h-px bg-border-main/50" />
            </div>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 px-4 rounded-lg shadow hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-gray-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
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
