/**
 * Profile component
 * Allows users to view and update their profile settings, including password resets.
 */
import axios from "axios";
import { useEffect, useState } from "react";
import Card from "../components/common/Card";
import Header from "../components/common/Header";
import InvestorProfileSection from "../components/onboarding/InvestorProfileSection";
import { PROFILE_ENDPOINTS } from "../constants/api";
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    const token = localStorage.getItem("token");
    e.preventDefault();
    console.log("Reset Password attempt");
    if (newPassword.value === confirmPassword.value) {
      try {
        await axios.post(
          PROFILE_ENDPOINTS.RESET_PASSWORD,
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
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error("Password string response:", error.response?.data);
        } else {
          console.error("Password local Reset failed:", error);
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
        PROFILE_ENDPOINTS.SAVE,
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Profile Save status response:", error.response?.data);
      } else {
        console.error("Save local failed:", error);
      }
    }
  };

  const fetchUserInfo = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post<{username: string, email: string, longterm_investor: boolean}>(
        PROFILE_ENDPOINTS.INFO,
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
         console.error("Fetching Profile Error:", error.response?.data)
      } else {
          console.error("Fetching profile locally failed", error);
      }
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


  const handleToggleNewPassword = () =>
    togglePasswordVisibility(setNewPassword);
  const handleToggleConfirmPassword = () =>
    togglePasswordVisibility(setConfirmPassword);
  const handleToggleResetPassword = () => toggleState(setResetPassword);

  useEffect(() => {
    // eslint-disable-next-line
    void fetchUserInfo();
  }, []);

  return (
    <div className="flex flex-col p-0 font-sans bg-background text-white min-h-screen w-full">
      <Header title="AlphaBot Profile Settings" />
      <div className="flex flex-col items-center pt-[20px] flex-1 w-full pb-10 px-5">
        <div className="flex flex-col lg:flex-row items-start justify-center gap-6 w-full max-w-[1200px] mx-auto">
          <div className="w-full lg:flex-1 min-w-[320px] max-w-[600px]">
            <InvestorProfileSection />
          </div>
          <Card
            title="Profile"
            variant="glass"
            className="w-full lg:flex-1 min-w-[320px] max-w-[600px] flex flex-col items-center justify-center"
          >
          <form className="flex flex-col items-center w-full mx-auto" onSubmit={(e: React.FormEvent<HTMLFormElement>) => { void handleSave(e); }}>
            <div className="flex items-center mb-[15px] w-full">
              <label className="flex-none w-[100px] text-left mr-[10px] font-semibold text-sm">Username: </label>
              <input
                type="text"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className="w-full box-border p-3 text-base border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
              />
            </div>
            <div className="flex items-center mb-[20px] w-full">
              <label className="flex-none w-[100px] text-left mr-[10px] font-semibold text-sm">Email: </label>
              <input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                readOnly
                className="w-full box-border p-3 text-base border border-border-main/50 rounded-lg bg-non-editable text-text-main/70 cursor-not-allowed shadow-inner"
              />
            </div>
            
            {resetPassword && (
              <>
                <Card className="bg-password-bg dark:bg-[#1a1a1a] p-[15px] rounded-xl w-full border border-border-main/20">
                  <div className="flex items-center mb-[15px] relative">
                    <label className="flex-none w-[120px] text-left mr-[10px] font-semibold text-sm">New Password:</label>
                    <input
                      className="w-full p-3 text-base border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner pl-3 pr-12"
                      type={newPassword.show ? "text" : "password"}
                      id="password"
                      value={newPassword.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewPassword((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                    />
                    <button 
                      type="button" 
                      onClick={handleToggleNewPassword}
                      className="absolute right-3 text-sm font-medium text-text-main/70 hover:text-primary transition-colors cursor-pointer"
                    >
                      {newPassword.show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="flex items-center mb-[20px] relative">
                    <label className="flex-none w-[120px] text-left mr-[10px] font-semibold text-sm">Confirm Password:</label>
                    <input
                      className="w-full p-3 text-base border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner pl-3 pr-12"
                      type={confirmPassword.show ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setConfirmPassword((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                    />
                    <button 
                      type="button" 
                      onClick={handleToggleConfirmPassword}
                      className="absolute right-3 text-sm font-medium text-text-main/70 hover:text-primary transition-colors cursor-pointer"
                    >
                      {confirmPassword.show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => { void handlePasswordReset(e as unknown as React.FormEvent); }}
                    className="w-full bg-linear-to-r from-primary to-[#057a37] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    Submit New Password
                  </button>
                </Card>
              </>
            )}
            
            <div className="flex flex-col gap-4 mt-8 w-full">
              <button 
                type="button" 
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => { void handleSave(e as unknown as React.FormEvent); }}
                className="w-full bg-linear-to-r from-primary to-[#057a37] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Save Profile
              </button>
              <button
                type="button"
                className="w-full bg-transparent border border-border-main text-text-main font-semibold py-3 px-4 rounded-lg hover:bg-row-hover hover:border-text-main/30 active:scale-[0.98] transition-all duration-200"
                onClick={handleToggleResetPassword}
              >
                {resetPassword ? "Cancel Reset Password" : "Reset Password"}
              </button>
            </div>
          </form>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
