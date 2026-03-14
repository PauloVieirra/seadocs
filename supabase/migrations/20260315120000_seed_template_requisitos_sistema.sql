-- Template "Requisitos de Sistema"
-- Estrutura: Título · Projeto · Histórico de Versões · Introdução · Visão Geral ·
--            Escopo · Organização dos Requisitos · Estrutura de Requisitos (EP → FT → HU → RF)
-- Só insere se não existir modelo global com mesmo nome.

DO $$
DECLARE
  v_html text :=
    -- ── Cabeçalho ────────────────────────────────────────────────────────────
    '<h1 style="text-align:center;font-weight:700">Documento de Requisitos de Sistema</h1>'
    '<p><br></p>'

    -- ── 1. Título do Documento ───────────────────────────────────────────────
    '<h2>1. Título do Documento</h2>'
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-titulo" data-field-title="1. Título do Documento"'
    ' data-field-help="Nome completo do documento de requisitos. Ex: Requisitos de Sistema — Portal de Gestão Documental."'
    ' data-topic-id="">'
    '<div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">1. Título do Documento</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Nome completo do documento de requisitos.</div></div>'
    '<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
    '</div>'
    '<p><br></p>'

    -- ── 2. Projeto ───────────────────────────────────────────────────────────
    '<h2>2. Projeto</h2>'
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-projeto" data-field-title="2. Projeto"'
    ' data-field-help="Nome do sistema ou projeto a ser especificado. Ex: GED 2.0, Portal do Cidadão."'
    ' data-topic-id="">'
    '<div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">2. Projeto</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Nome do sistema ou projeto a ser especificado.</div></div>'
    '<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
    '</div>'
    '<p><br></p>'

    -- ── 3. Histórico de Versões ──────────────────────────────────────────────
    '<h2>3. Histórico de Versões</h2>'
    '<table style="border-collapse:collapse;width:100%;margin:12px 0">'
    '<tbody>'
    '<tr>'
    '<th style="border:1px solid #ccc;padding:6px 10px;background:#f3f4f6;font-weight:600">Versão</th>'
    '<th style="border:1px solid #ccc;padding:6px 10px;background:#f3f4f6;font-weight:600">Tipo do Documento</th>'
    '<th style="border:1px solid #ccc;padding:6px 10px;background:#f3f4f6;font-weight:600">Data</th>'
    '<th style="border:1px solid #ccc;padding:6px 10px;background:#f3f4f6;font-weight:600">Autor</th>'
    '</tr>'
    '<tr>'
    '<td style="border:1px solid #ccc;padding:6px 10px"></td>'
    '<td style="border:1px solid #ccc;padding:6px 10px"></td>'
    '<td style="border:1px solid #ccc;padding:6px 10px"></td>'
    '<td style="border:1px solid #ccc;padding:6px 10px"></td>'
    '</tr>'
    '</tbody>'
    '</table>'
    '<p><br></p>'

    -- ── 4. Introdução ────────────────────────────────────────────────────────
    '<h2>4. Introdução</h2>'
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-introducao" data-field-title="4. Introdução"'
    ' data-field-help="Apresentação do documento: objetivo, público-alvo e como o documento está organizado."'
    ' data-topic-id="">'
    '<div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">4. Introdução</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Apresentação do documento: objetivo, público-alvo e organização.</div></div>'
    '<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
    '</div>'
    '<p><br></p>'

    -- ── 5. Visão Geral do Sistema ────────────────────────────────────────────
    '<h2>5. Visão Geral do Sistema</h2>'
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-visao" data-field-title="5. Visão Geral do Sistema"'
    ' data-field-help="Descrição geral do sistema: o que é, para quem se destina, qual problema resolve e qual o contexto de uso."'
    ' data-topic-id="">'
    '<div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">5. Visão Geral do Sistema</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">O que é o sistema, para quem e qual problema resolve.</div></div>'
    '<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
    '</div>'
    '<p><br></p>'

    -- ── 6. Escopo do Projeto ─────────────────────────────────────────────────
    '<h2>6. Escopo do Projeto</h2>'
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-escopo" data-field-title="6. Escopo do Projeto"'
    ' data-field-help="O que está incluído no projeto e o que está explicitamente fora do escopo. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."'
    ' data-topic-id="">'
    '<div class="sgid-metadata-field__header"><div class="sgid-metadata-field__title">6. Escopo do Projeto</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">O que está incluído e o que está fora do escopo.</div></div>'
    '<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
    '</div>'
    '<p><br></p>'

    -- ── 7. Organização dos Requisitos ────────────────────────────────────────
    '<h2>7. Organização dos Requisitos</h2>'
    '<p>Estrutura utilizada para organizar os requisitos:</p>'
    '<ul>'
    '<li><strong>Épico (EP)</strong> — grande objetivo ou área funcional do sistema</li>'
    '<li><strong>Feature (FT)</strong> — funcionalidade ou módulo do sistema</li>'
    '<li><strong>História de Usuário (HU)</strong> — necessidade do usuário</li>'
    '<li><strong>Requisito Funcional (RF)</strong> — regra ou comportamento específico do sistema</li>'
    '</ul>'
    '<p><br></p>'

    -- ── 8. Estrutura de Requisitos ───────────────────────────────────────────
    '<h2>8. Estrutura de Requisitos</h2>'
    '<p><br></p>'

    -- Épico (repetível)
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-epico" data-field-title="Épico (EP)"'
    ' data-field-help="Épico: gerado pela IA com base na base de conhecimento do projeto. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."'
    ' data-topic-id="" data-repeatable="true"'
    ' data-planning-instruction="Liste todos os épicos/grandes objetivos funcionais do sistema identificados na documentação do projeto">'
    '<div class="sgid-metadata-field__header">'
    '<div class="sgid-metadata-field__title">Épico (EP)'
    '<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600">REPETÍVEL</span>'
    '</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Épico: gerado pela IA com base na base de conhecimento do projeto</div>'
    '</div>'
    '<div class="sgid-metadata-field__textarea">Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.</div>'
    '</div>'
    '<p><br></p>'

    -- Feature (repetível)
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-feature" data-field-title="Feature (FT)"'
    ' data-field-help="Feature: gerado pela IA com base na base de conhecimento do projeto. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."'
    ' data-topic-id="" data-repeatable="true"'
    ' data-planning-instruction="Liste todas as features/funcionalidades do sistema identificadas na documentação do projeto">'
    '<div class="sgid-metadata-field__header">'
    '<div class="sgid-metadata-field__title">Feature (FT)'
    '<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600">REPETÍVEL</span>'
    '</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Feature: gerado pela IA com base na base de conhecimento do projeto</div>'
    '</div>'
    '<div class="sgid-metadata-field__textarea">Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.</div>'
    '</div>'
    '<p><br></p>'

    -- História de Usuário (repetível)
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-hu" data-field-title="História de Usuário (HU)"'
    ' data-field-help="História de Usuário: gerado pela IA com base na base de conhecimento do projeto. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."'
    ' data-topic-id="" data-repeatable="true"'
    ' data-planning-instruction="Liste todas as histórias de usuário identificadas na documentação do projeto">'
    '<div class="sgid-metadata-field__header">'
    '<div class="sgid-metadata-field__title">História de Usuário (HU)'
    '<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600">REPETÍVEL</span>'
    '</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">História de Usuário: gerado pela IA com base na base de conhecimento do projeto</div>'
    '</div>'
    '<div class="sgid-metadata-field__textarea">Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.</div>'
    '</div>'
    '<p><br></p>'

    -- Requisito Funcional (repetível)
    '<div class="sgid-metadata-field" contenteditable="false"'
    ' data-field-id="sec-rf" data-field-title="Requisito Funcional (RF)"'
    ' data-field-help="Requisito Funcional: gerado pela IA com base na base de conhecimento do projeto. Apenas conteúdo desta seção. Não repita introdução ou visão geral já apresentada."'
    ' data-topic-id="" data-repeatable="true"'
    ' data-planning-instruction="Liste todos os requisitos funcionais identificados na documentação do projeto">'
    '<div class="sgid-metadata-field__header">'
    '<div class="sgid-metadata-field__title">Requisito Funcional (RF)'
    '<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600">REPETÍVEL</span>'
    '</div>'
    '<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">Requisito Funcional: gerado pela IA com base na base de conhecimento do projeto</div>'
    '</div>'
    '<div class="sgid-metadata-field__textarea">Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.</div>'
    '</div>'
    '<p><br></p>';

BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.templates
    WHERE nome = 'Requisitos de Sistema' AND global = true
  ) THEN
    INSERT INTO public.templates (nome, tipo_documento, sections, global, project_id, file_url, ai_guidance, spec_path)
    VALUES (
      'Requisitos de Sistema',
      'Requisitos',
      jsonb_build_object('html', v_html),
      true,
      NULL,
      '',
      'Documento de requisitos estruturado em: Épico (EP) → Feature (FT) → História de Usuário (HU) → Requisito Funcional (RF). '
      'A seção 7 explica a hierarquia. A seção 8 é gerada dinamicamente pela IA: '
      'identifica os épicos do projeto, desdobra em features, cria as histórias no formato '
      '"Como [perfil], quero [ação], para [objetivo]" e lista os RFs de cada história. '
      'Numeração sequencial: EP01, FT01, HU001, RF01. Siga rigorosamente o Spec associado. '
      'IMPORTANTE: Cada seção é parte de um único documento. Não repita introduções, objetivos ou visão geral em seções posteriores.',
      'Spec/Spec_Requisitos_Sistema.md'
    );
  END IF;
END $$;
