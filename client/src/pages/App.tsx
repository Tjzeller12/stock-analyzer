import {
    Navigate,
    Route,
    BrowserRouter as Router,
    Routes,
} from "react-router-dom";
import LoginPage from "./LoginPage";
import MainPage from "./MainPage";
import ProfilePage from "./Profile";
import RegisterPage from "./RegisterPage";
import StockPage from "./StockPage";

import PrivateRoute from "../components/PrivateRoute";

// App.tsx is the main component that renders the entire application.
function App() {
  return (
    <Router>
      <div className="text-center bg-background text-text-main min-h-screen">
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
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
  );
}
export default App;
