# Spec — Documento de Requisitos de Sistema

Este documento define as diretrizes obrigatórias para a geração de um **Documento de Requisitos de Sistema**, estruturado em Épicos, Features, Histórias de Usuário e Requisitos Funcionais.

---

## Estrutura Obrigatória do Documento

O documento deve ser gerado na seguinte ordem de seções:

1. **Título do Documento** — nome do documento de requisitos
2. **Projeto** — nome do sistema ou projeto
3. **Histórico de Versões** — tabela com colunas: Versão | Tipo do Documento | Data | Autor
4. **Introdução** — apresentação do documento, objetivo e público-alvo
5. **Visão Geral do Sistema** — descrição geral do sistema, contexto e finalidade
6. **Escopo do Projeto** — o que está incluído e o que está fora do escopo
7. **Organização dos Requisitos** — explicação da hierarquia EP → FT → HU → RF
8. **Estrutura de Requisitos** — conteúdo principal, gerado dinamicamente com base no RAG

---

## Seção 8 — Regras da Estrutura de Requisitos

### Hierarquia obrigatória

```
EP01 — Nome do Épico
  FT01 — Nome da Feature
    HU001 — Nome da História de Usuário
      RF01 — Requisito Funcional
      RF02 — Requisito Funcional
```

### Formato de cada nível

**Épico (EP)**
- Identificador: `EP01`, `EP02`, `EP03`...
- Título curto e objetivo
- Parágrafo de descrição do objetivo geral (2 a 4 frases)

**Feature (FT)**
- Identificador: `FT01`, `FT02`... (numeração contínua no documento)
- Título descritivo da funcionalidade
- Parágrafo de descrição da funcionalidade (1 a 3 frases)

**História de Usuário (HU)**
- Identificador: `HU001`, `HU002`... (numeração contínua no documento)
- Formato obrigatório: `Como [perfil de usuário], quero [ação], para [objetivo/benefício].`

**Requisito Funcional (RF)**
- Identificador: `RF01`, `RF02`... (numeração por história)
- Frase assertiva, curta, no infinitivo: `Permitir que o usuário...`, `Validar...`, `Exibir...`
- Mínimo 2 RFs por HU

---

## Regras de Geração

- Manter numeração sequencial consistente ao longo de todo o documento
- Cada Épico deve ter no mínimo 1 Feature
- Cada Feature deve ter no mínimo 1 História de Usuário
- Cada HU deve ter no mínimo 2 Requisitos Funcionais
- Não incluir Requisitos Não Funcionais (RNF) neste modelo — há modelo específico para isso
- O conteúdo deve ser baseado exclusivamente na base de conhecimento do projeto
- Não inventar funcionalidades que não estejam evidenciadas nas fontes

---

## Anti-alucinação

- Não gerar épicos, features ou histórias genéricas sem evidência nas fontes
- Se não houver informação suficiente para uma seção, indicar: `[A definir — aguarda informações do projeto]`
- Não completar histórias de usuário com suposições não fundamentadas
