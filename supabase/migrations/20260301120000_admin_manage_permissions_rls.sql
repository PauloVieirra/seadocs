-- Permite que usuários com gerenciar_usuarios leiam e atualizem permissões de qualquer usuário
-- Necessário para o modal de gerenciamento de permissões no painel de usuários

-- Usuários com gerenciar_usuarios ou acesso_total podem ler permissões de qualquer usuário
CREATE POLICY "managers_read_any_permissions" ON public.permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.permissions p
      WHERE p.user_id = auth.uid()
      AND (p.gerenciar_usuarios = true OR p.acesso_total = true)
    )
  );

-- Usuários com gerenciar_usuarios ou acesso_total podem inserir/atualizar permissões
CREATE POLICY "managers_write_permissions" ON public.permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.permissions p
      WHERE p.user_id = auth.uid()
      AND (p.gerenciar_usuarios = true OR p.acesso_total = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permissions p
      WHERE p.user_id = auth.uid()
      AND (p.gerenciar_usuarios = true OR p.acesso_total = true)
    )
  );
