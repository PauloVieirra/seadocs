-- Atualiza modelos existentes com instruções de continuidade de documento
-- Cada seção é parte de um único documento; a IA não deve repetir introduções/visão geral em seções posteriores.
-- Aplica-se aos templates "Requisitos de Design" e "Requisitos de Sistema".

DO $$
DECLARE
  v_instruction text := ' Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada.';
  v_html text;
BEGIN
  -- ── Requisitos de Design ────────────────────────────────────────────────────
  UPDATE public.templates
  SET
    ai_guidance = COALESCE(ai_guidance, '') || E'\n\n' ||
      'IMPORTANTE: Cada seção é parte de um único documento. Não repita introduções, objetivos ou visão geral em seções posteriores.',
    sections = jsonb_build_object(
      'html',
      replace(
        replace(
          replace(
            sections->>'html',
            'data-field-help="O que está incluído e o que não está incluído no projeto."',
            'data-field-help="O que está incluído e o que não está incluído no projeto.' || v_instruction || '"'
          ),
          'data-field-help="Explicação: Épico → Feature → História → Requisito. Bullets: Épico (EP), Feature (FT), HU, RNF."',
          'data-field-help="Explicação: Épico → Feature → História → Requisito. Bullets: Épico (EP), Feature (FT), HU, RNF.' || v_instruction || '"'
        ),
        'data-field-help="Épico → Feature → HU → RF → RNF. Formato: EP01, FT01, HU001 (Como... quero... para...), RF-01 em negrito, RNF-01. NÃO use listas genéricas como Proposta de Fases."',
        'data-field-help="Épico → Feature → HU → RF → RNF. Formato: EP01, FT01, HU001 (Como... quero... para...), RF-01 em negrito, RNF-01. NÃO use listas genéricas como Proposta de Fases.' || v_instruction || '"'
      )
    )
  WHERE nome = 'Requisitos de Design' AND global = true;

  -- ── Requisitos de Sistema ───────────────────────────────────────────────────
  UPDATE public.templates
  SET
    ai_guidance = COALESCE(ai_guidance, '') || E'\n\n' ||
      'IMPORTANTE: Cada seção é parte de um único documento. Não repita introduções, objetivos ou visão geral em seções posteriores.',
    sections = jsonb_build_object(
      'html',
      replace(
        replace(
          replace(
            replace(
              replace(
                sections->>'html',
                'data-field-help="O que está incluído no projeto e o que está explicitamente fora do escopo."',
                'data-field-help="O que está incluído no projeto e o que está explicitamente fora do escopo.' || v_instruction || '"'
              ),
              'data-field-help="Épico: gerado pela IA com base na base de conhecimento do projeto"',
              'data-field-help="Épico: gerado pela IA com base na base de conhecimento do projeto.' || v_instruction || '"'
            ),
            'data-field-help="Feature: gerado pela IA com base na base de conhecimento do projeto"',
            'data-field-help="Feature: gerado pela IA com base na base de conhecimento do projeto.' || v_instruction || '"'
          ),
          'data-field-help="História de Usuário: gerado pela IA com base na base de conhecimento do projeto"',
          'data-field-help="História de Usuário: gerado pela IA com base na base de conhecimento do projeto.' || v_instruction || '"'
        ),
        'data-field-help="Requisito Funcional: gerado pela IA com base na base de conhecimento do projeto"',
        'data-field-help="Requisito Funcional: gerado pela IA com base na base de conhecimento do projeto.' || v_instruction || '"'
      )
    )
  WHERE nome = 'Requisitos de Sistema' AND global = true;

END $$;
