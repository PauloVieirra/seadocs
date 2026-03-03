import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { type User } from '../../services/api';

interface ProtectedRouteProps {
  currentUser: User | null;
  authLoaded: boolean;
  children: React.ReactNode;
}

export function ProtectedRoute({ currentUser, authLoaded, children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!authLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
