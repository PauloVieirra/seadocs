/**
 * Hook para verificação de permissões no frontend
 */

import { useMemo } from 'react';
import { permissionsService, type PermissionAction } from '../services/permissions';
import type { User } from '../services/api';

export function usePermissions(user: User | null) {
  return useMemo(
    () => ({
      can: (action: PermissionAction) => permissionsService.canSync(user, action),
      canAssignRole: (targetRole: User['role']) =>
        user ? permissionsService.canAssignRole(user, targetRole) : false,
      canConfigureSystem: () => user?.role === 'admin',
      canManageUsers: () => permissionsService.canSync(user, 'gerenciar_usuarios'),
      canManageGroups: () => permissionsService.canSync(user, 'gerenciar_grupos'),
      canManageTemplates: () =>
        permissionsService.canSync(user, 'criar_templates') ||
        permissionsService.canSync(user, 'editar_templates'),
      canCreateProjects: () => permissionsService.canSync(user, 'criar_projetos'),
      canEditProjects: () => permissionsService.canSync(user, 'editar_projetos'),
      canCreateDocuments: () => permissionsService.canSync(user, 'criar_documentos'),
      canDeleteProjects: () => permissionsService.canSync(user, 'excluir_projetos'),
      canViewAllProjects: () => permissionsService.canSync(user, 'visualizar_todos_projetos'),
      canUseAI: () => permissionsService.canSync(user, 'alimentar_ia'),
      isAdmin: () => user?.role === 'admin',
      isDirector: () => user?.role === 'director',
      isManager: () => user?.role === 'manager',
      isTechnicalResponsible: () => user?.role === 'technical_responsible',
      isOperational: () => user?.role === 'operational',
    }),
    [user]
  );
}
