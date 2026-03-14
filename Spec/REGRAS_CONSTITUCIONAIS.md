# Regras Constitucionais do SEADOCS

**Arquivo único de referência.** Todas as regras imutáveis do sistema estão aqui. O `.cursorrules`, o RAG service e a documentação derivam deste arquivo.

---

## Regras de desenvolvimento (R1–R5)

**R1.** Nunca mudar, editar, apagar ou modificar partes do código ou funcionalidades que não foram solicitadas. Alterações devem ser limitadas estritamente ao escopo da solicitação do usuário.

**R2. Spec obrigatório no modelo:** Todo modelo de documento DEVE ter um documento Spec relacionado durante a criação do modelo. O campo `spec_path` (caminho do Spec na pasta `Spec/` ou no bucket) é obrigatório.

**R3. Validação antes da geração:** Antes de iniciar a criação do documento, a IA DEVE validar o documento Spec associado ao modelo. Se o Spec não existir ou estiver inválido, a geração NÃO pode prosseguir.

**R4. Rigor nas diretrizes Spec:** O Spec contém APENAS regras de estrutura e formatação (ex.: hierarquia EP→FT→HU, numeração, uso de tabelas). A IA deve seguir essas regras de forma, mas NUNCA copiar ou incluir texto do Spec no documento. O conteúdo do documento vem EXCLUSIVAMENTE da base de conhecimento do projeto.

**R5. Não replicar conversas da base:** O documento gerado NÃO pode replicar, citar ou transcrever trechos de conversas extraídas da base de conhecimento. A IA deve INTERPRETAR o conteúdo das conversas e criar texto que represente o que precisa ser feito — sempre em linguagem formal e estruturada, nunca copiando diálogos ou mensagens literais.

---

## Regras para geração de documentos (IA)

### Proibição de transcrição e citações literais

- **É estritamente proibido** que documentos gerados contenham transcrições, citações diretas ou trechos literais extraídos dos documentos da base de conhecimento.
- A IA **DEVE** sintetizar, interpretar e redigir o conteúdo com suas próprias palavras.
- Isso se aplica a: PDFs, DOCX, TXT, transcrições de reuniões, **conversas/chats**, apresentações, etc.
- O documento final deve ser **autoral e original**, refletindo o entendimento consolidado do projeto.

### Proibição de raciocínio da IA e planos de ação

- **É estritamente proibido** que o documento contenha raciocínio, explicação de processo ou plano de ação da IA.
- O documento deve conter **apenas o conteúdo final** esperado — nunca os bastidores de como a IA chegou até ele.
- Proibido: "Vou estruturar...", "Analisando os dados...", "Passo 1:...", etc.

### Proibição de nomes de pessoas

- **É estritamente proibido** inserir nomes de pessoas físicas no conteúdo gerado.
- Use papéis genéricos: `[Responsável]`, `[Gestor do Projeto]`, `[Equipe Técnica]`, etc.
- Campos de assinatura devem permanecer em branco para preenchimento manual.

---

## Regras para prompt LLM

*Seção extraída pelo RAG service para injetar no prompt. Formato compacto.*

```
REGRAS OBRIGATÓRIAS (violação invalida o documento):
1. NÃO transcreva, cite ou reproduza trechos literais dos documentos da base. Sintetize.
2. NÃO replique partes de conversas extraídas da base (chats, mensagens, diálogos). INTERPRETE a conversa e crie texto formal que represente o que precisa ser feito — nunca copie diálogos literais.
3. NÃO inclua raciocínio, explicações de processo ou planos de ação da IA no texto gerado. Proibido: frases como 'Vou estruturar...', 'Analisando os dados...', 'Passo 1:...'.
4. NÃO mencione nomes de pessoas físicas (autores, participantes, responsáveis, stakeholders). Use papéis genéricos: [Responsável], [Gestor do Projeto], [Equipe Técnica].
5. O documento deve conter APENAS o conteúdo final esperado para a seção.
6. O Spec é APENAS regras de estrutura/formato. NUNCA copie, cite ou inclua texto do Spec no documento. O conteúdo vem SOMENTE dos dados do projeto (base de conhecimento).
```

---

## Fluxo de geração

1. Usuário solicita criação do documento
2. IA identifica o modelo do documento (ex.: Memorando, Requisitos)
3. IA lê o spec_path do modelo → ex.: Spec/Spac_Memorando.md
4. IA valida: o Spec existe? Está legível?
5. Se NÃO → interromper e informar o usuário
6. Se SIM → carregar o conteúdo do Spec
7. Para cada seção: aplicar regras do Spec, gerar conteúdo baseado na base de conhecimento
8. Entregar documento conforme estrutura do Spec

---

## Documentos Spec disponíveis

| Arquivo | Tipo de documento |
|---------|-------------------|
| `Spec/Spac_Requisitos_Design.md` | Requisitos de Design (Épico → Feature → História → RF → RNF) |
| `Spec/Spec_Requisitos_Sistema.md` | Requisitos de Sistema (Título · Projeto · Histórico · Introdução · Visão Geral · Escopo · Organização · EP → FT → HU → RF) |

*(Adicione novos Specs conforme forem criados.)*
