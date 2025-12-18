import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type User } from '../../services/api';

interface AuthRedirectProps {
  currentUser: User | null;
}

export function AuthRedirect({ currentUser }: AuthRedirectProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        navigate('/admin-dashboard', { replace: true });
      } else {
        navigate('/projects', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  return null;
}

