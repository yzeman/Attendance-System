import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user'));

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If adminOnly route and user is not admin, redirect to student dashboard
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/student" />;
  }

  // If student tries to access admin route, redirect to student dashboard
  if (!adminOnly && user.role === 'admin') {
    return <Navigate to="/admin" />;
  }

  // All checks passed, render the children
  return children;
};

export default ProtectedRoute;
