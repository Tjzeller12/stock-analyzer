import React from "react";
import axios from "axios";
import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import RegisterPage from "./RegisterPage";
import LoginPage from "./LoginPage";
import MainPage from "./MainPage";
import "./App.css";

function App() {
  const testAPI = async () => {
    console.log("Sending GET request to /api/test");
    try {
      const response = await axios.get("/api/test");
      console.log("API test response:", response.data);
    } catch (error) {
      console.error("API test error:", error);
    }
  };

  useEffect(() => {
    testAPI();
  }, []);
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/" element={<Navigate replace to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;
