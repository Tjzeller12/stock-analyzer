import axios from 'axios';
import { useContext } from "react";
import { useNavigate } from 'react-router-dom';
import { AUTH_ENDPOINTS } from '../../constants/api';
import logo from "../../resources/alphaBotLogo.png";
import { ThemeContext } from "../../ThemeContext";
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

    const buttonClass = "px-4 py-1.5 text-sm bg-btn-bg text-white font-semibold my-[6px] mx-[4px] border border-white/10 rounded-md cursor-pointer hover:shadow-lg hover:shadow-btn-bg/30 hover:-translate-y-0.5 active:scale-95 transition-all duration-300";

    return (
        <header className="flex justify-between items-center w-full min-h-[60px] bg-primary text-white font-bold px-[20px] py-[6px] box-border shadow-md">
            <div className="flex items-center gap-[12px] flex-1">
                <img
                    className="max-h-[40px] w-auto cursor-pointer hover:scale-105 transition-transform duration-300 ease-in-out"
                    src={logo}
                    alt="AlphaBot Logo"
                    onClick={handleLogoClick}
                />
                <h1 className="text-white text-xl font-extrabold m-0 whitespace-nowrap tracking-tight drop-shadow-sm">{props.title}</h1>
            </div>
            
            <div className="flex items-center gap-[15px] flex-wrap justify-end mr-[15px]">
                <UsageBadge />
                {[{ label: "Profile", path: "/profile" }].map((button) => (
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
                        className={`absolute cursor-pointer inset-0 transition-colors duration-300 rounded-full shadow-inner border border-white/10 ${theme === 'dark' ? 'bg-btn-bg' : 'bg-[#3b3b3b]'}`}
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
