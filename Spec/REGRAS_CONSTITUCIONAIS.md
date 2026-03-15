# Regras Constitucionais do SEADOCS

**Arquivo único de referência.** Todas as regras imutáveis do sistema estão aqui. O `.cursorrules`, o RAG service e a documentação derivam deste arquivo.

---

## Regras de desenvolvimento (R1–R5)

**R1.** Nunca mudar, editar, apagar ou modificar partes do código ou funcionalidades que não foram solicitadas. Alterações devem ser limitadas estritamente ao escopo da solicitação do usuário.

**R2. Spec obrigatório no modelo:** Todo modelo de documento DEVE ter um documento Spec relacionado durante a criação do modelo. O campo `spec_path` (caminho do Spec na pasta `Spec/` ou no bucket) é obrigatório.

**R3. Validação antes da geração:** Antes de iniciar a criação do documento, a IA DEVE validar o documento Spec associado ao modelo. Se o Spec não existir ou estiver inválido, a geração NÃO pode prosseguir.

**R4. Rigor nas diretrizes Spec:** O Spec contém APENAS regras de estrutura e formatação (ex.: hierarquia EP→FT→HU, numeração, uso de tabelas). A IA deve seguir essas regras de forma, mas NUNCA copiar ou incluir texto do Spec no documento. O conteúdo do documento vem EXCLUSIVAMENTE da base de conhecimento do projeto.

**R5. Não replicar conversas da base:** O documento gerado NÃO pode replicar, citar ou transcrever trechos de conversas extraídas da base de conhecimento. A IA deve INTERPRETAR o conteúdo das conversas e criar texto que represente o que precisa ser feito — sempre em linguagem formal e estruturada, nunca copiando diálogos ou mensagens literais.

**R6. Chat — proibição de inventar respostas:** Quando a pergunta do usuário está fora do escopo do projeto ou não existe informação sobre o assunto na base de conhecimento, a IA **NÃO PODE** tentar gerar resposta. É **estritamente proibido** sugerir criação de documentos, recomendar botões, inventar procedimentos ou dar alternativas. A IA deve responder **apenas** que não há informações sobre isso no projeto, de forma breve e objetiva.

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
7. NÃO pule para a próxima sessão deixando texto incompleto. Se precisar mudar de sessão, remova o texto incompleto e complete na sessão adequada (ou crie sessão complementar). Pode encurtar uma sessão e criar outra para o restante — não há limite de sessões.
8. Ao finalizar o documento, executar revisão obrigatória. Status na tela: "Revisando documento, procurando erros, ajustando sessão X".
```

# REGRAS INSTITUCIONAIS DE GERAÇÃO DE DOCUMENTOS

Estas regras definem como a IA deve organizar e gerar o conteúdo de um documento.
O objetivo é garantir que o documento final seja consistente, estruturado e sem repetições.
Todas as regras abaixo são obrigatórias.

---

# 1. Estrutura do Documento

1. Um documento é composto por um conjunto de seções ou blocos de conteúdo.

2. Cada seção representa uma parte única do documento.

3. O documento deve ser contínuo e organizado, sem reinício de estrutura no meio do texto.

4. Uma seção deve ser completamente finalizada antes que a próxima seção seja iniciada.

É proibido iniciar uma nova seção sem concluir completamente a seção atual.

---

# 2. Proibição de Repetição de Seções

É estritamente proibido repetir seções estruturais do documento.

As seguintes seções devem aparecer apenas UMA VEZ no documento:

- Introdução
- Visão Geral
- Sobre o Sistema
- Escopo

Essas seções devem existir apenas no início do documento.

Elas nunca devem reaparecer posteriormente.

---

# 3. Proibição de Repetição de Conteúdo

É proibido repetir qualquer trecho de texto já escrito anteriormente no documento.

A IA deve garantir que:

- não existam parágrafos duplicados
- não existam frases repetidas
- não existam blocos de texto idênticos

Cada informação deve aparecer apenas uma vez no documento.

---

# 4. Proibição de Blocos de Conteúdo Duplicados

É proibido gerar dois blocos de conteúdo com o mesmo título e o mesmo texto.

Exemplo proibido:

Introdução  
Esse documento apresenta os requisitos do sistema.

Introdução  
Esse documento apresenta os requisitos do sistema.

Isso nunca pode ocorrer.

---

# 5. Integridade do Conteúdo

Nenhuma seção pode terminar com conteúdo incompleto.

É proibido finalizar uma seção com:

- frases incompletas
- palavras cortadas
- sentenças interrompidas
- trechos de código ou HTML incompletos

Exemplo proibido: 
<h2> O sistema deve funci ```
Toda frase e todo bloco devem estar completos.

6. Proibição de Estrutura Quebrada

O documento não pode conter:

blocos de texto interrompidos

estrutura quebrada

seções abertas e não finalizadas

conteúdo incompleto no final de uma seção

Cada seção deve ser clara, completa e bem formada.

7. Continuidade do Documento

O documento deve ser gerado como um fluxo único e contínuo.

É proibido:

reiniciar o documento no meio do conteúdo

recriar a estrutura inicial novamente

gerar múltiplos documentos dentro do mesmo arquivo

Exemplo proibido:

Documento de Requisitos
... conteúdo ...

Documento de Requisitos
... novo conteúdo ...

Isso não pode ocorrer.

8. Regra de Validação

Antes de finalizar o documento, a IA deve validar:

se não existem seções repetidas
se não existem blocos duplicados
se todas as seções foram finalizadas
se não existem frases incompletas
se não existem estruturas quebradas
Se qualquer uma dessas regras for violada, o documento deve ser corrigido antes da saída final.

---

# 9. Integridade entre Sessões/Blocos

Se a IA pular para a próxima sessão deixando texto incompleto na sessão atual, esse texto incompleto DEVE ser removido e a IA DEVE garantir que na próxima sessão escreva o texto completo.

Não existem limites de sessões que possam ser criadas. A IA pode:
- diminuir o texto em uma sessão para não deixá-lo incompleto; e
- criar uma sessão complementar que receberá o texto completo.

É proibido:
- iniciar uma nova sessão sem concluir completamente a sessão atual;
- deixar frases, parágrafos ou blocos cortados ao mudar de sessão;
- reiniciar o mesmo conteúdo na próxima sessão (duplicação).

Se houver texto incompleto ao mudar de sessão, a IA deve removê-lo da sessão anterior e escrever o conteúdo completo na sessão adequada (atual ou complementar).

---

# 10. Revisão Final Obrigatória

A regra de auto-verificação DEVE ser executada sempre que o documento for finalizado.

Durante a revisão, o status exibido na tela deve ser: **"Revisando documento, procurando erros, ajustando sessão X"**, onde X é o número ou identificador da seção em revisão.

A revisão deve percorrer todas as seções, validar as regras (repetição, incompletude, estrutura quebrada) e corrigir qualquer erro antes de considerar o documento concluído.

---

## Fluxo de geração

1. Usuário solicita criação do documento
2. IA identifica o modelo do documento (ex.: Memorando, Requisitos)
3. IA lê o spec_path do modelo → ex.: Spec/Spac_Memorando.md
4. IA valida: o Spec existe? Está legível?
5. Se NÃO → interromper e informar o usuário
6. Se SIM → carregar o conteúdo do Spec
7. Para cada seção: gerar conteúdo baseado na base de conhecimento (regra 9: nunca pular sessão com texto incompleto)
8. **Revisão final obrigatória**: status na tela "Revisando documento, procurando erros, ajustando sessão X"
9. Entregar documento conforme estrutura do Spec

---

## Documentos Spec disponíveis

| Arquivo | Tipo de documento |
|---------|-------------------|
| `Spec/Spac_Requisitos_Design.md` | Requisitos de Design (Épico → Feature → História → RF → RNF) |
| `Spec/Spec_Requisitos_Sistema.md` | Requisitos de Sistema (Título · Projeto · Histórico · Introdução · Visão Geral · Escopo · Organização · EP → FT → HU → RF) |
| `Spec/Spec_Especificacao_Requisitos.md` | Especificação de Requisitos (modelo protegido, alinhado ao fluxo da IA) |

---

## Regra de Auto-verificação

A revisão final é obrigatória sempre que o documento for finalizado. Durante a revisão, o status na tela deve ser: **"Revisando documento, procurando erros, ajustando sessão X"**.

Antes de entregar o documento final, a IA deve verificar:

1. Se existe repetição de seções
2. Se existe repetição de parágrafos
3. Se existe reinício de documento
4. Se existem frases incompletas
5. Se não há texto incompleto ao mudar de sessão (regra 9)

Caso qualquer erro seja encontrado, o documento deve ser corrigido antes da saída final.
