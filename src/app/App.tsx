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
import { AIConfigDialog } from './components/AIConfigDialog';
import { updateAIConfig } from '../services/rag-api';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthRedirect } from './components/AuthRedirect';
import { Wiki } from './components/Wiki';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GovBrCallbackPage } from './pages/GovBrCallbackPage';
import { GenerationStatusBar } from './components/GenerationStatusBar';
import { AIManagementPage } from './pages/AIManagementPage';

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
  const [authLoaded, setAuthLoaded] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiService.loadCurrentUserFromStorage().then((user) => {
    if (user) {
      setCurrentUser(user);
      if (user.forcePasswordChange) {
        setChangePasswordOpen(true);
      } else if (user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/projects');
      }
    }
      setAuthLoaded(true);
    });
  }, []);

  // Sincroniza config de IA com o RAG ao carregar (admin com config salva)
  useEffect(() => {
    if (!authLoaded || !currentUser || currentUser.role !== 'admin') return;
    apiService.getAIConfiguracao().then((config) => {
      if (config?.provider === 'groq') {
        updateAIConfig({ provider: 'groq' }).catch(() => {});
      } else if (config?.provider === 'ollama') {
        updateAIConfig({ provider: 'ollama', ollamaMode: config.ollamaMode ?? 'local' }).catch(() => {});
      }
    });
  }, [authLoaded, currentUser]); 

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.forcePasswordChange) {
      setChangePasswordOpen(true);
    } else {
      if (user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/projects');
      }
    }
  };

  const handlePasswordChanged = () => {
    setChangePasswordOpen(false);
    const user = apiService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/projects');
      }
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
      <GenerationStatusBar />
      <AIConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
      <ChangePasswordDialog
        user={currentUser}
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        onPasswordChanged={handlePasswordChanged}
        forceChange={currentUser?.forcePasswordChange}
      />

      {currentUser && (
        <GlobalNav
          user={currentUser}
          onLogout={handleLogout}
          onConfigApi={handleOpenConfigDialog}
        />
      )}

      <Routes>
        <Route path="/" element={<AuthRedirect currentUser={currentUser} authLoaded={authLoaded} />} />
        <Route path="/login" element={<LoginScreen onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/admin-dashboard" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <AdminDashboard currentUser={currentUser!} />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Dashboard user={currentUser!} onProjectSelect={handleProjectSelect} />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/project/:projectId" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <ProjectViewWrapper />
          </ProtectedRoute>
        } />
        <Route path="/project/:projectId/document/:documentId" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <ProjectEditorWrapper />
          </ProtectedRoute>
        } />
        <Route path="/govbr-callback" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <GovBrCallbackPage />
          </ProtectedRoute>
        } />
        <Route path="/wiki" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Wiki />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <UserManagementPanel currentUser={currentUser!} />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/document-models" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <DocumentModelManagementPanel currentUser={currentUser!} />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/create-document-model" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <CreateDocumentModelPage />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/groups" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <GroupManagementPanel user={currentUser!} />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/ai-management" element={
          <ProtectedRoute currentUser={currentUser} authLoaded={authLoaded}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <AIManagementPage />
            </main>
          </ProtectedRoute>
        } />
        <Route path="*" element={
          authLoaded ? (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-500">404 - Página Não Encontrada</div>
          ) : (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
          )
        } />
      </Routes>
    </>
  );
}
