import axios from 'axios';
import { useContext } from "react";
import { useNavigate } from 'react-router-dom';
import { AUTH_ENDPOINTS } from '../../constants/api';
import logo from "../../resources/alphaBotLogo.png";
import { ThemeContext } from "../../ThemeContext";
import LedText, { LedDisplay } from './LedText';
import UsageBadge from './UsageBadge';
interface HeaderProps {
    title: string;
}

/**
 * Header Component
 * 
 * The main application navigation bar displayed at the top of the interface.
 * Contains the logo, dynamic title, access to the user Profile page, a global 
 * light/dark mode theme toggle switch, and handles user logout logic (clearing JWT tokens).
 */
const Header = (props: HeaderProps) => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();
    const handleLogoClick = () => {
        navigate("/main");
    }

  const handleLogout = async () => {
    try {
      const response = await axios.post(AUTH_ENDPOINTS.LOGOUT);
      console.log(response.data);
      const token = localStorage.getItem("token");
      console.log("Token:", token);
      localStorage.removeItem("token");

      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

const handleNavButtonClick = (path: string) => {
    navigate(path);
  };

    const buttonClass = "tg-btn !text-white !text-[13px] !px-4 !bg-white/10 !border-white/20";

    return (
        <header className="relative z-50 flex justify-between items-center w-full min-h-[64px] text-white font-bold px-[20px] py-[8px] box-border border-b border-white/15 bg-[linear-gradient(180deg,rgba(11,178,87,0.92),rgba(6,144,66,0.86))] backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-[12px] flex-1">
                <img
                    className="max-h-[40px] w-auto cursor-pointer hover:scale-105 transition-transform duration-300 ease-in-out"
                    src={logo}
                    alt="AlphaBot Logo"
                    onClick={handleLogoClick}
                />
                <LedDisplay layerClassName="px-3.5 py-2">
                    <h1 className="m-0 whitespace-nowrap text-[18px]">
                        <LedText>{props.title}</LedText>
                    </h1>
                </LedDisplay>
            </div>
            
            <div className="flex items-center gap-[15px] flex-wrap justify-end mr-[15px]">
                <UsageBadge />
                {[{ label: "Discovery", path: "/discovery" }, { label: "Profile", path: "/profile" }].map((button) => (
                    <button
                        key={button.path}
                        className={buttonClass}
                        onClick={() => handleNavButtonClick(button.path)}
                    >
                        {button.label}
                    </button>
                ))}
                <button className={buttonClass} onClick={() => { void handleLogout(); }}>
                    Logout
                </button>
                <div className="relative inline-block w-[60px] h-[34px] mb-0">
                    <input
                        type="checkbox"
                        id="theme"
                        checked={theme === "dark"}
                        onChange={toggleTheme}
                        className="sr-only peer"
                    />
                    <label 
                        htmlFor="theme"
                        className="absolute cursor-pointer inset-0 transition-colors duration-300 rounded-full shadow-inner border border-white/20 bg-black/35"
                    >
                        <span className={`absolute left-[4px] bottom-[3px] h-[26px] w-[26px] transition-all duration-300 transform rounded-full flex items-center justify-center text-[16px] leading-none select-none shadow-sm ${theme === 'dark' ? 'translate-x-[24px] bg-[#333333]' : 'translate-x-0 bg-[#e0e0e0]'}`}>
                            {theme === "dark" ? "🌙" : "☀️"}
                        </span>
                    </label>
                </div>

            </div>
        </header>
    )
}

export default Header;
