-- Template "Requisitos de Design" com estrutura do Spec/Spac_Requisitos_Design.md
-- Segue o padrão Regras_GED: Projeto, Histórico, Visão geral, Escopo, Organização, Requisitos (Épico → Feature → HU → RF → RNF)
-- Só insere se não existir modelo com mesmo nome global

DO $$
DECLARE
  v_html text := '<p><strong>1. Projeto</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-projeto" data-field-title="1. Projeto" data-field-help="Nome ou identificação do projeto. Ex: GED, Sistema X."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">1. Projeto</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><strong>2. Histórico de versões</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-historico" data-field-title="2. Histórico de versões" data-field-help="Tabela: Data | Versão | Descrição | Solicitante | Autor. Use tabela HTML."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">2. Histórico de versões</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><strong>3. Visão geral do sistema</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-visao" data-field-title="3. Visão geral do sistema" data-field-help="Descrição geral do sistema, objetivos e contexto."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">3. Visão geral do sistema</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><strong>4. Escopo</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-escopo" data-field-title="4. Escopo" data-field-help="O que está incluído e o que não está incluído no projeto. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">4. Escopo</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><strong>5. Organização dos requisitos</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-organizacao" data-field-title="5. Organização dos requisitos" data-field-help="Explicação: Épico → Feature → História → Requisito. Bullets: Épico (EP), Feature (FT), HU, RF, RNF. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">5. Organização dos requisitos</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><strong>6. Requisitos</strong></p><div class="sgid-metadata-field" contenteditable="false" data-field-id="sec-requisitos" data-field-title="6. Requisitos" data-field-help="Épico → Feature → HU → RF → RNF. Formato: EP01, FT01, HU001 (Como... quero... para...), RF-01 em negrito, RNF-01. NÃO use listas genéricas como Proposta de Fases. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."><div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">6. Requisitos</div></div><div class="sgid-metadata-field__textarea">Digite aqui...</div></div><p><br></p>';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.templates WHERE nome = 'Requisitos de Design' AND global = true) THEN
    INSERT INTO public.templates (nome, tipo_documento, sections, global, project_id, file_url, ai_guidance, spec_path)
    VALUES (
      'Requisitos de Design',
      'Requisitos',
      jsonb_build_object('html', v_html),
      true,
      NULL,
      '',
      'Documento de requisitos estruturado: Épico → Feature → História de Usuário → Requisito Funcional → Requisito Não Funcional. Siga rigorosamente o Spec associado. IMPORTANTE: Cada seção é parte de um único documento. Não repita introduções, objetivos ou visão geral em seções posteriores.',
      'Spec/Spac_Requisitos_Design.md'
    );
  END IF;
END $$;
