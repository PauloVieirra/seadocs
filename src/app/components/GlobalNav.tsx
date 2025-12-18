import React from 'react';
import { Button } from './ui/button';
import { LogOut, LayoutDashboard, Users, FileText, Settings, BookText, Settings2, UsersRound, Settings as SettingsIcon } from 'lucide-react';
import { apiService, type User } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

interface GlobalNavProps {
  user: User;
  onLogout: () => void;
  onConfigApi: () => void;
}

export function GlobalNav({
  user,
  onLogout,
  onConfigApi,
}: GlobalNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getRoleBadge = (role: User['role']) => {
    const labels: Record<User['role'], string> = {
      'manager': 'Gerente',
      'admin': 'Administrador',
      'director': 'Diretor',
      'technical_responsible': 'Responsável Técnico',
      'operational': 'Operacional',
    };
    return labels[role];
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">SEAGID</h1>
          <nav className="flex items-center space-x-2">
            {/* Admin Dashboard para o perfil admin */}
            {user.role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin-dashboard')}
                className={isActive('/admin-dashboard') ? 'bg-gray-100' : ''}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Dashboard
              </Button>
            )}

            {/* Dashboard normal para outros perfis */}
            {user.role !== 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/projects')}
                className={isActive('/projects') ? 'bg-gray-100' : ''}
              >
                <FileText className="w-4 h-4 mr-2" /> Projetos
              </Button>
            )}

            {/* Admin pode gerenciar usuários, modelos de documento e grupos */}
            {user.role === 'admin' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/users')}
                  className={isActive('/users') ? 'bg-gray-100' : ''}
                >
                  <Users className="w-4 h-4 mr-2" /> Usuários
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/document-models')}
                  className={isActive('/document-models') ? 'bg-gray-100' : ''}
                >
                  <BookText className="w-4 h-4 mr-2" /> Modelos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/groups')}
                  className={isActive('/groups') ? 'bg-gray-100' : ''}
                >
                  <UsersRound className="w-4 h-4 mr-2" /> Grupos
                </Button>
              </>
            )}

            {/* Gerente pode gerenciar modelos de documento e grupos */}
            {user.role === 'manager' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/document-models')}
                  className={isActive('/document-models') ? 'bg-gray-100' : ''}
                >
                  <BookText className="w-4 h-4 mr-2" /> Modelos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/groups')}
                  className={isActive('/groups') ? 'bg-gray-100' : ''}
                >
                  <UsersRound className="w-4 h-4 mr-2" /> Grupos
                </Button>
              </>
            )}

            {/* Responsável Técnico pode gerenciar grupos (se houver permissão) */}
            {user.role === 'technical_responsible' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/groups')}
                className={isActive('/groups') ? 'bg-gray-100' : ''}
              >
                <UsersRound className="w-4 h-4 mr-2" /> Grupos
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            {user.name} ({getRoleBadge(user.role)})
          </div>
          {user.role === 'admin' && ( /* Apenas admin tem permissão para configurar API/Banco de Dados */
            <Button variant="outline" size="sm" onClick={onConfigApi}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar API
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
