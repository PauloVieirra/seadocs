import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ProjectEditor } from './components/ProjectEditor';
import { apiService, type User } from '../services/api';
import { Toaster } from './components/ui/sonner';
import { GlobalNav } from './components/GlobalNav';
import { GroupManagementPanel } from './components/GroupManagementPanel';
import { UserManagementPanel } from './components/UserManagementPanel';
import { DocumentModelManagementPanel } from './components/DocumentModelManagementPanel';
import { CreateDocumentModelPage } from './pages/CreateDocumentModelPage';
import { DatabaseConfigDialog } from './components/DatabaseConfigDialog';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthRedirect } from './components/AuthRedirect'; // Importar AuthRedirect

type MainView = 'login' | 'dashboard' | 'editor' | 'projects' | 'users' | 'document-models' | 'groups' | 'settings' | 'admin-dashboard' | 'create-document-model';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const navigate = useNavigate(); // useNavigate está de volta aqui para ser usado nos handlers

  useEffect(() => {
    localStorage.removeItem('current_user');
    const user = apiService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    // AuthRedirect vai cuidar da navegação inicial
  }, [setCurrentUser]); 

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/projects');
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setCurrentUser(null);
    setSelectedProjectId(null);
    navigate('/login');
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    navigate(`/editor/${projectId}`);
  };

  const handleBackToDashboard = () => {
    setSelectedProjectId(null);
    if (currentUser?.role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/projects');
    }
  };

  const handleOpenConfigDialog = () => {
    setConfigDialogOpen(true);
  };

  return (
    <>
      <Toaster position="top-right" closeButton />
      <DatabaseConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />

      {currentUser && (
        <GlobalNav
          user={currentUser}
          onLogout={handleLogout}
          onConfigApi={handleOpenConfigDialog}
        />
      )}

      <Routes>
        {/* Rota raiz: usa AuthRedirect para gerenciar o redirecionamento inicial */}
        <Route path="/" element={<AuthRedirect currentUser={currentUser} />} />
        <Route path="/login" element={<LoginScreen onLoginSuccess={handleLoginSuccess} />} />
        {currentUser && (
          <>
            <Route path="/admin-dashboard" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AdminDashboard currentUser={currentUser} />
              </main>
            } />
            <Route path="/projects" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Dashboard user={currentUser} onProjectSelect={handleProjectSelect} />
              </main>
            } />
            <Route path="/users" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <UserManagementPanel currentUser={currentUser} />
              </main>
            } />
            <Route path="/document-models" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <DocumentModelManagementPanel currentUser={currentUser} />
              </main>
            } />
            <Route path="/create-document-model" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <CreateDocumentModelPage />
              </main>
            } />
            <Route path="/groups" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <GroupManagementPanel user={currentUser} />
              </main>
            } />
            <Route path="/editor/:projectId" element={<ProjectEditor projectId={selectedProjectId!} onBack={handleBackToDashboard} />} />
          </>
        )}
        <Route path="*" element={<div>404 - Página Não Encontrada</div>} />
      </Routes>
    </>
  );
}
