import axios from 'axios';
import { useContext } from "react";
import { useNavigate } from 'react-router-dom';
import { AUTH_ENDPOINTS } from '../../constants/api';
import logo from "../../resources/alphaBotLogo.png";
import { ThemeContext } from "../../ThemeContext";
import "./Header.css";
interface HeaderProps {
    title: string;
}

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

    return (
        <header className="main-header">
            <div className="header-left">
                <img
                    src={logo}
                    alt="Stock Market Logo"
                    onClick={handleLogoClick}
                    style={{ cursor: "pointer" }}
                />
                <h1>{props.title}</h1>
            </div>
            
            <div className="header-right">
                {[{ label: "Profile", path: "/profile" }].map((button) => (
                    <button
                        key={button.path}
                        className="nav-button"
                        onClick={() => handleNavButtonClick(button.path)}
                    >
                        {button.label}
                    </button>
                ))}
                <button className="nav-button" onClick={() => handleLogout()}>
                    Logout
                </button>
                <div className="toggle-switch">
                    <input
                        type="checkbox"
                        id="theme"
                        checked={theme === "dark"}
                        onChange={toggleTheme}
                    />
                    <label htmlFor="theme">
                        <span className="slider"></span>
                    </label>
                </div>

            </div>
        </header>
    )
}

export default Header;
