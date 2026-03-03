import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type User } from '../../services/api';

interface AuthRedirectProps {
  currentUser: User | null;
  authLoaded?: boolean;
}

export function AuthRedirect({ currentUser, authLoaded = true }: AuthRedirectProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoaded) return;
    if (currentUser) {
      if (currentUser.role === 'admin') {
        navigate('/admin-dashboard', { replace: true });
      } else {
        navigate('/projects', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [currentUser, authLoaded, navigate]);

  if (!authLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return null;
}

