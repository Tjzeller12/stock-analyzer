import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import { AUTH_ENDPOINTS } from "../constants/api";
import logo from "../resources/alphaBotLogo.png";
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Login failed:", error.response?.data || error.message);
      } else {
        console.error("Login failed:", error);
      }
    }
    console.log("Login attempt with:", username, password);
  };

  // Login page
  return (
    <div className="flex flex-col justify-center items-center p-5 font-sans min-h-screen bg-background text-text-main relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/20 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-green-400/10 blur-[100px] -z-10 animate-pulse delay-1000"></div>
      
      <h1 className="text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-linear-to-r from-primary to-green-500 tracking-tight drop-shadow-sm">AlphaBot</h1>
      <img src={logo} alt="Stock Market Logo" className="max-h-[200px] w-auto mb-5" />

      <Card title="Login" className="w-full max-w-[400px] p-8 flex flex-col shadow-2xl border-white/20 relative z-10" variant="glass">
        <form className="flex flex-col w-full" onSubmit={(e: React.FormEvent<HTMLFormElement>) => { void handleLogin(e); }}>
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
              Login
            </button>
            <button 
              type="button" 
              onClick={() => navigate("/register")}
              className="w-full bg-transparent border border-border-main text-text-main font-semibold py-3 px-4 rounded-lg hover:bg-row-hover hover:border-text-main/30 active:scale-[0.98] transition-all duration-200"
            >
              Create an Account
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
