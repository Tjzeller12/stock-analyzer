import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface PrivateRouteProps {
  children: JSX.Element;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  // The protected layout stays mounted, so recheck the session on navigation.
  useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    // If no token exists, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // If token exists, render the protected component
  return children;
};

export default PrivateRoute;
