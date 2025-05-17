import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../resources/Stock_Market_Logo.png";
import "./Profile.css";

type PasswordField = {
  value: string;
  show: boolean;
};

const Profile: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [ltInvestor, setLtInvestor] = useState(false);
  const [newPassword, setNewPassword] = useState<PasswordField>({
    value: "",
    show: false,
  });
  const [confirmPassword, setConfirmPassword] = useState<PasswordField>({
    value: "",
    show: false,
  });
  const [resetPassword, setResetPassword] = useState(false);
  const navigate = useNavigate();

  const handlePasswordReset = async (e: React.FormEvent) => {
    const token = localStorage.getItem("token");
    e.preventDefault();
    console.log("Reset Password attempt");
    if (newPassword.value == confirmPassword.value) {
      try {
        await axios.post(
          "http://127.0.0.1:5000/profile/reset",
          {
            newPassword: newPassword.value,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (error) {
        console.error("Password Reset failed:", error);
        if (axios.isAxiosError(error)) {
          console.error("Response data:", error.response?.data);
          console.error("Response status:", error.response?.status);
        }
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    const token = localStorage.getItem("token");
    e.preventDefault();
    console.log("Save attempt");
    try {
      await axios.post(
        "http://127.0.0.1:5000/profile/save",
        {
          username,
          longterm_investor: ltInvestor,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error("Save failed:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  };

  const fetchUserInfo = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/profile/info",
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setUsername(response.data.username);
      setEmail(response.data.email);
      setLtInvestor(response.data.longterm_investor);
    } catch (error) {
      console.error("Fetching user info failed", error);
    }
  };

  const toggleState = (
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setter((prevState) => !prevState);
  };

  const togglePasswordVisibility = (
    setter: React.Dispatch<React.SetStateAction<PasswordField>>
  ) => {
    setter((prev) => ({ ...prev, show: !prev.show }));
  };

  const handleToggleLtInvestor = () => toggleState(setLtInvestor);

  const handleToggleNewPassword = () =>
    togglePasswordVisibility(setNewPassword);
  const handleToggleConfirmPassword = () =>
    togglePasswordVisibility(setConfirmPassword);
  const handleToggleResetPassword = () => toggleState(setResetPassword);
  const handleLogoClick = () => {
    navigate("/main");
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);
  return (
    <div className="profile-container">
      <header className="profile-header">
        <h1>Stock Analyzer Dashboard</h1>
        <img
          src={logo}
          alt="Stock Market Logo"
          onClick={handleLogoClick}
          style={{ cursor: "pointer" }}
        />
      </header>
      <h2>Profile</h2>
      <div className="blank-space">
        <div className="form-container">
          <form onSubmit={handleSave}>
            <div className="form-row">
              <label>Username: </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Email: </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly
                className="non-editable"
              />
            </div>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="ltInvestor"
                checked={ltInvestor}
                onChange={handleToggleLtInvestor}
              />
              <label htmlFor="ltInvestor">
                <span className="slider"></span>
              </label>
              <span className="toggle-label">
                {ltInvestor ? "Long-Term Investor" : "Short-Term Investor"}
              </span>
            </div>
            {resetPassword && (
              <>
                <div className="reset-password-container">
                  <div className="form-row">
                    <label>New Password:</label>
                    <input
                      type={newPassword.show ? "text" : "password"}
                      id="password"
                      value={newPassword.value}
                      onChange={(e) =>
                        setNewPassword((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                    />
                    <button type="button" onClick={handleToggleNewPassword}>
                      {newPassword.show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="form-row">
                    <label>Confirm Password:</label>
                    <input
                      type={confirmPassword.show ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword.value}
                      onChange={(e) =>
                        setConfirmPassword((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                    />
                    <button type="button" onClick={handleToggleConfirmPassword}>
                      {confirmPassword.show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button type="button" onClick={handlePasswordReset}>
                    Submit New Password
                  </button>
                </div>
              </>
            )}
            <span
              className="link"
              onClick={handleToggleResetPassword}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && handleToggleResetPassword()
              }
            >
              {resetPassword ? "Cancel Reset Password" : "Reset Password"}
            </span>
            <button type="button" onClick={handleSave}>
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
