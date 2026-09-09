import {
    Navigate,
    Route,
    BrowserRouter as Router,
    Routes,
} from "react-router-dom";
import DiscoveryPage from "./DiscoveryPage";
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
      <div className="text-center bg-background text-text-main min-h-screen">
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/onboarding" 
            element={
              <PrivateRoute>
                <OnboardingPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/main" 
            element={
              <PrivateRoute>
                <MainPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/discovery" 
            element={
              <PrivateRoute>
                <DiscoveryPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/stock/:symbol" 
            element={
              <PrivateRoute>
                <StockPage />
              </PrivateRoute>
            } 
          />
          
          <Route path="/" element={<Navigate replace to="/login" />} />
        </Routes>
      </div>
    </Router>
    </GoogleOAuthProvider>
  );
}
export default App;
