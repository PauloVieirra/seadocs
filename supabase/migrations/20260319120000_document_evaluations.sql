-- Tabela de avaliações de documentos (feedback do criador para refinar a IA)
CREATE TABLE IF NOT EXISTS public.document_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('good', 'bad')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id)
);

COMMENT ON TABLE public.document_evaluations IS 'Avaliações do criador sobre documentos gerados pela IA. Usadas para refinar o RAG e melhorar gerações futuras.';
COMMENT ON COLUMN public.document_evaluations.rating IS 'good = documento ficou bom; bad = não ficou bom';
COMMENT ON COLUMN public.document_evaluations.comment IS 'Feedback opcional do criador (ex: o que melhorou ou o que faltou)';

-- RLS: apenas o criador do documento pode inserir/atualizar a avaliação
ALTER TABLE public.document_evaluations ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário autenticado pode ver avaliações de documentos que tem acesso
CREATE POLICY "document_evaluations_select_authenticated" ON public.document_evaluations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE: apenas o criador do documento pode avaliar
CREATE POLICY "document_evaluations_insert_creator" ON public.document_evaluations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.creator_id = auth.uid()
    )
  );

CREATE POLICY "document_evaluations_update_creator" ON public.document_evaluations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.creator_id = auth.uid()
    )
  );
