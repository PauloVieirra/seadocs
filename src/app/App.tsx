import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ProjectEditor } from './components/ProjectEditor';
import { ProjectView } from './components/ProjectView';
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
import { Wiki } from './components/Wiki'; // Importar Wiki

type MainView = 'login' | 'dashboard' | 'editor' | 'projects' | 'users' | 'document-models' | 'groups' | 'settings' | 'admin-dashboard' | 'create-document-model';

// Wrapper components para usar os parâmetros da URL
function ProjectViewWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const handleBackToProjects = () => {
    const user = apiService.getCurrentUser();
    if (user?.role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/projects');
    }
  };

  const handleSelectDocument = (documentId: string) => {
    navigate(`/project/${projectId}/document/${documentId}`);
  };

  if (!projectId) {
    return <div>Erro: Projeto não encontrado</div>;
  }

  return <ProjectView projectId={projectId} onBack={handleBackToProjects} onSelectDocument={handleSelectDocument} />;
}

function ProjectEditorWrapper() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();

  const handleBackToProject = () => {
    navigate(`/project/${projectId}`);
  };

  if (!projectId || !documentId) {
    return <div>Erro: Projeto ou documento não encontrado</div>;
  }

  return <ProjectEditor projectId={projectId} documentId={documentId} onBack={handleBackToProject} />;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
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
    navigate('/login');
  };

  const handleProjectSelect = (projectId: string) => {
    navigate(`/project/${projectId}`);
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
            <Route path="/project/:projectId" element={<ProjectViewWrapper />} />
            <Route path="/project/:projectId/document/:documentId" element={<ProjectEditorWrapper />} />
            <Route path="/wiki" element={
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Wiki />
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
          </>
        )}
        <Route path="*" element={<div>404 - Página Não Encontrada</div>} />
      </Routes>
    </>
  );
}
