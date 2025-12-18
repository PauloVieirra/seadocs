# Documentação de Permissões por Perfil de Usuário

Este documento detalha as permissões e funcionalidades acessíveis a cada perfil de usuário dentro do sistema SEAGID.

## Perfis de Usuário

*   **Administrador (Admin)**
*   **Diretor**
*   **Gerente**
*   **Responsável Técnico**
*   **Operacional**

## Matriz de Permissões

| Funcionalidade                     | Administrador | Diretor | Gerente | Responsável Técnico | Operacional |
| :--------------------------------- | :-----------: | :-----: | :-----: | :-----------------: | :---------: |
| **Configurar API/Banco de Dados**  |       ✅      |    ❌   |    ❌   |         ❌          |      ❌     |
| **Gerenciar Usuários** (CRUD)      |       ✅      |    ❌   |    ✅   |         ✅          |      ❌     |
| **Gerenciar Grupos** (CRUD)        |       ✅      |    ❌   |    ✅   |         ✅          |      ❌     |
| **Gerenciar Modelos de Documento** |       ✅      |    ❌   |    ✅   |         ❌          |      ❌     |
| **Gerenciar Projetos** (CRUD)      |       ✅      |    ❌   |    ✅   |         ✅          |      ❌     |
| **Criar Documentos**               |       ✅      |    ❌   |    ✅   |         ✅          |      ✅     |
| **Editar Documentos**              |       ✅      |    ❌   |    ✅   |         ✅          |      ✅     |
| **Compartilhar Documentos**        |       ✅      |    ❌   |    ✅   |         ✅          |      ✅     |
| **Gerar Conteúdo com IA**          |       ✅      |    ❌   |    ✅   |         ✅          |      ✅     |
| **Visualizar Documentos**          |       ✅      |    ✅   |    ✅   |         ✅          |      ✅     |
| **Acessar Logs de Auditoria**      |       ✅      |    ✅   |    ✅   |         ✅          |      ❌     |
| **Acessar Histórico de Versões**   |       ✅      |    ✅   |    ✅   |         ✅          |      ❌     |
| **Upload de Arquivos de Referência**|       ✅      |    ❌   |    ✅   |         ✅          |      ✅     |

---

**Observações:**

*   **CRUD**: Create, Read, Update, Delete (Criar, Ler, Atualizar, Excluir).
*   **Visibilidade de Projetos/Grupos/Documentos**: A visibilidade pode ser limitada à responsabilidade ou associação do usuário, mesmo que a permissão geral esteja marcada.
*   **Criação de Usuários**: Apenas Administradores, Gerentes e Responsáveis Técnicos podem criar novas contas de usuário através do painel de gerenciamento.
*   **Login**: Todos os perfis podem realizar o login. A criação de novas contas não é permitida diretamente na tela de login.



