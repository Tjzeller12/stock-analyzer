import {
    Navigate,
    Route,
    BrowserRouter as Router,
    Routes,
} from "react-router-dom";
import DiscoveryPage, { DiscoverySession } from "./DiscoveryPage";
import { GoogleOAuthProvider } from "@react-oauth/google";
import LoginPage from "./LoginPage";
import MainPage from "./MainPage";
import OnboardingPage from "./OnboardingPage";
import ProfilePage from "./Profile";
import RegisterPage from "./RegisterPage";
import StockPage from "./StockPage";

import PrivateRoute from "../components/PrivateRoute";
import { ROUTER_FUTURE } from "../constants/router";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// App.tsx is the main component that renders the entire application.
function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <Router future={ROUTER_FUTURE}>
      <div className="text-center text-text-main min-h-screen">
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<PrivateRoute><DiscoverySession /></PrivateRoute>}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/main" element={<MainPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/stock/:symbol" element={<StockPage />} />
          </Route>
          
          <Route path="/" element={<Navigate replace to="/login" />} />
        </Routes>
      </div>
    </Router>
    </GoogleOAuthProvider>
  );
}
export default App;
