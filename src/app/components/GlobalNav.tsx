import React from 'react';
import { Button } from './ui/button';
import { 
  LogOut, 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  BookText, 
  UsersRound, 
  Menu,
  Settings2,
  Library
} from 'lucide-react';
import { type User } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

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
      'admin': 'Administrador',
      'manager': 'Gerente',
      'technical_responsible': 'Técnico Operacional',
      'operational': 'Operacional',
      'external': 'Usuário Externo'
    };
    return labels[role] || role;
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900 cursor-pointer" onClick={() => navigate('/')}>
            SEAGID
          </h1>
          <nav className="hidden md:flex items-center space-x-2">
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

            {/* Dashboard para todos os perfis */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/projects')}
              className={isActive('/projects') ? 'bg-gray-100' : ''}
            >
              <FileText className="w-4 h-4 mr-2" /> Projetos
            </Button>

            {/* Wiki - Acesso para todos os usuários logados */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/wiki')}
              className={isActive('/wiki') ? 'bg-gray-100' : ''}
            >
              <Library className="w-4 h-4 mr-2" /> Wiki
            </Button>

            {/* Admin pode gerenciar usuários */}
            {user.role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/users')}
                className={isActive('/users') ? 'bg-gray-100' : ''}
              >
                <Users className="w-4 h-4 mr-2" /> Usuários
              </Button>
            )}

            {/* Admin, Gerente ou Técnico Responsável podem gerenciar modelos de documento e grupos */}
            {(user.role === 'admin' || user.role === 'manager' || user.role === 'technical_responsible') && (
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
          </nav>
        </div>

        <div className="flex items-center">
          <div className="flex items-center mr-3 text-right">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 leading-none mb-1">
                {user.name}
              </span>
              <span className="text-xs text-gray-500 leading-none">
                ({getRoleBadge(user.role)})
              </span>
            </div>
          </div>

          <Sheet>
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 border border-gray-200 shadow-sm">
                <AvatarFallback className="bg-slate-800 text-white font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5 text-gray-600" />
                </Button>
              </SheetTrigger>
            </div>

            <SheetContent side="right" className="w-[300px] sm:w-[350px]">
              <SheetHeader className="border-b pb-4 mb-4">
                <SheetTitle className="text-xl flex items-center gap-2">
                  <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                    <Settings className="w-5 h-5" />
                  </div>
                  Opções do Sistema
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-2 flex-1">
                {user.role === 'admin' && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-12 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600" 
                    onClick={onConfigApi}
                  >
                    <Settings2 className="w-5 h-5 mr-3" />
                    Configurar API
                  </Button>
                )}
                
                {/* Adicione outras opções de menu aqui se necessário */}
              </div>

              <SheetFooter className="mt-auto border-t pt-4">
                <Button 
                  variant="destructive" 
                  className="w-full h-11 shadow-sm" 
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da Conta
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
