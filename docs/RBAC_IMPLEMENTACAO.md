# Implementação RBAC + ABAC - SEADOCS

## Resumo

Sistema de controle de acesso baseado em papéis (RBAC) com extensão para permissões granulares (ABAC), hierarquia organizacional e permissões por projeto.

## Estrutura Criada

### 1. Migração SQL (`supabase/migrations/20260228_rbac_permissions.sql`)

- **permissions**: Permissões efetivas por usuário (uma linha por `user_id`), com colunas booleanas para cada capacidade
- **permission_definitions**: Catálogo de permissões granulares (CREATE_PROJECT, EDIT_PROJECT, USE_AI, etc.)
- **role_permissions**: Mapeamento papel → permissão granular
- **user_permissions**: Permissões granulares por usuário (overrides temporários com `expires_at`)
- **user_hierarchy**: Hierarquia supervisor-subordinado
- **project_members**: Permissões por projeto (VIEW, EDIT, ADMIN)

### 2. Papéis e Permissões Padrão

| Papel | Permissões |
|-------|------------|
| **ADMINISTRADOR** | Acesso total, gerenciar usuários, alterar papéis, configurar sistema |
| **DIRETOR** | Visualizar todos os projetos e documentos, download. Sem edição, sem IA |
| **GERENTE** | Criar/editar/excluir projetos, usar IA, gerenciar grupos e templates. Não pode promover a admin |
| **TÉCNICO RESPONSÁVEL** | Definido pelo Gerente. Pode criar/editar projetos, usar IA, gerenciar operacionais |
| **OPERACIONAL** | Permissões liberadas pelo Técnico. Visualizar e editar se permitido |

### 3. Serviços TypeScript

- **`src/services/permissions.ts`**: Serviço de permissões com `can()`, `canAssignRole()`, `getUserPermissions()`, `canInProject()`
- **`src/hooks/usePermissions.ts`**: Hook React para verificação síncrona de permissões na UI

### 4. Validação na API

O `api.ts` valida permissões antes de:
- `updateUser` / `deleteUser` → `gerenciar_usuarios`, `canAssignRole`
- `createProject` / `updateProject` / `deleteProject` → `criar_projetos`, `editar_projetos`, `excluir_projetos`
- `createDocument` / `updateDocument` / `deleteDocument` → `criar_documentos`, `editar_documentos`, `excluir_documentos`
- `createGroup` / `updateGroup` / `deleteGroup` → `gerenciar_grupos`
- `createDocumentModel` / `updateDocumentModel` / `deleteDocumentModel` → `criar_templates`, `editar_templates`, `excluir_templates`

### 5. Novos Métodos na API

- `addProjectMember(projectId, userId, permissionLevel)`
- `removeProjectMember(projectId, userId)`
- `getProjectMembers(projectId)`
- `addSupervisorSubordinate(supervisorId, subordinateId)`
- `removeSupervisorSubordinate(supervisorId, subordinateId)`
- `grantUserPermission(userId, permissionCode, expiresAt?, grantedBy?)`
- `revokeUserPermission(userId, permissionCode)`

### 6. Triggers e Auditoria

- Trigger `sync_user_permissions_from_role`: Sincroniza `permissions` quando `users.role` é alterado
- Triggers de audit em `permissions`, `user_permissions`, `user_hierarchy` → registram em `audit_logs`

### 7. RLS (Row Level Security)

- `permissions`: SELECT apenas própria linha
- `user_permissions`: SELECT apenas próprias permissões
- `user_hierarchy`: SELECT onde é supervisor ou subordinado
- `project_members`: SELECT onde é membro ou criador do projeto

## Como Aplicar

1. Execute a migração no Supabase:
   ```bash
   supabase db push
   ```
   ou aplique manualmente o SQL em `supabase/migrations/20260228_rbac_permissions.sql`.

2. **Importante**: A tabela `public.users` deve existir com coluna `id` (uuid) e `role`. As FKs referenciam `public.users(id)`.

3. Se o projeto usar `auth.users` em vez de `public.users`, ajuste as FKs na migração para `auth.users(id)`.

## Uso no Frontend

```tsx
import { usePermissions } from '../../hooks/usePermissions';

function MeuComponente({ user }) {
  const perms = usePermissions(user);

  return (
    <>
      {perms.canCreateProjects() && <Button>Criar Projeto</Button>}
      {perms.canManageUsers() && <Link to="/users">Usuários</Link>}
      {perms.canConfigureSystem() && <Button>Configurar API</Button>}
    </>
  );
}
```

## Regras de Segurança

1. Usuário não pode alterar o próprio papel
2. Usuário não pode promover outro acima do próprio nível (`canAssignRole`)
3. Operacional nunca pode receber permissão de gerenciar usuários
4. Permissões temporárias expiram automaticamente (`expires_at`)
5. Toda alteração de permissão é registrada em `audit_logs`
