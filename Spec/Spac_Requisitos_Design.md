# AI SPEC — Geração de Documento de Requisitos

## 1. Natureza deste arquivo (REGRA CRÍTICA)

Este arquivo é um **arquivo de configuração da IA (SPEC)**.

Ele contém **regras de geração**, não conteúdo do documento final.

Portanto:

O conteúdo deste arquivo **NUNCA deve aparecer no documento gerado**.

É proibido:

- copiar textos deste SPEC
- reutilizar descrições deste SPEC
- repetir títulos deste SPEC
- incluir exemplos deste SPEC
- citar este SPEC

O documento final deve conter **apenas informações derivadas dos dados do projeto**.

---

# 2. Proibição absoluta de vazamento do SPEC

Durante a geração do documento final a IA **não pode incluir nenhum conteúdo deste arquivo**.

Isso inclui qualquer texto semelhante a:

- "Este documento define regras"
- "Objetivo do documento"
- "Este SPEC é genérico"
- "A IA deve extrair informações"

Se qualquer conteúdo deste SPEC aparecer no documento final, a geração está incorreta.

---

# 3. Fontes permitidas para gerar o documento

O documento final deve ser criado **exclusivamente a partir de dados do projeto**, como:

- documentos de requisitos
- base de dados do projeto
- transcrições de reuniões
- atas
- descrições funcionais
- textos fornecidos pelo usuário
- arquivos anexados

A IA **não pode usar**:

- o conteúdo deste SPEC
- exemplos genéricos
- conhecimento externo
- suposições
- funcionalidades não mencionadas

---

# 4. Estrutura inicial obrigatória do documento

O documento final deve começar com **quatro seções iniciais**.

Essas seções aparecem **apenas uma vez no início do documento**.

Estrutura obrigatória:

Título do Documento

Projeto

Visão Geral

Escopo

Exemplo estrutural:

[Título do Documento]

Projeto  
[Nome do projeto]

Visão Geral  
[Descrição geral do sistema]

Escopo  
[Definição do escopo]

---

# 5. Documento único

O documento gerado deve ser **um documento único e contínuo**.

A IA **não pode reiniciar o documento** durante a geração.

É proibido repetir:

- título
- projeto
- visão geral
- escopo
- introduções

Essas informações devem aparecer **apenas uma vez**.

---

# 6. Hierarquia obrigatória de requisitos

Após as seções iniciais, o documento deve seguir **exatamente esta estrutura**:

Épico  
└── Feature  
    └── História de Usuário  
        └── Requisitos Funcionais  

---

# 7. Épicos (EP)

Épicos representam **partes modulares de um sistema**.

Um sistema pode possuir **vários épicos**.

Cada épico representa um **grande módulo funcional**.

Exemplos de épicos:

- Login
- Gestão de Usuários
- Processos
- Documentos
- Arquivamento
- Notificações

Formato obrigatório:

EP01 — Nome do Épico

Regras:

- um documento pode possuir vários épicos
- um épico pode possuir várias features
- um épico representa um módulo do sistema

---

# 8. Features (FT)

Features representam **funcionalidades específicas dentro de um épico**.

Cada Feature deve pertencer a **um único épico**.

Formato obrigatório:

FT01 — Nome da Feature

Exemplos:

EP01 — Login

FT01 — Cadastro de API de autenticação  
FT02 — Armazenamento de usuário em banco de dados  
FT03 — Validação de credenciais  

Regras:

- um épico pode ter várias features
- toda feature deve possuir histórias de usuário

---

# 9. Histórias de Usuário (HU)

Cada Feature deve conter **uma ou mais histórias de usuário**.

Formato obrigatório:

HU001 – Nome da História

Como [tipo de usuário],  
quero [ação],  
para que [benefício].

Regras:

- deve existir um usuário
- deve existir uma ação
- deve existir um objetivo

---

# 10. Requisitos Funcionais (RF)

Cada História de Usuário deve possuir **um ou mais requisitos funcionais**.

Formato obrigatório:

RF-01 – O sistema deve ...  
RF-02 – O sistema deve ...  
RF-03 – O sistema deve ...  

Regras:

Requisitos devem ser:

- claros
- objetivos
- testáveis
- verificáveis

Nunca usar:

- talvez
- geralmente
- normalmente
- possivelmente

---

# 11. Regras de consistência estrutural

As seguintes regras são obrigatórias:

- um documento pode ter vários épicos
- cada épico pode possuir várias features
- cada feature deve possuir histórias de usuário
- cada história deve possuir requisitos funcionais

Proibições:

- Feature sem épico
- HU sem feature
- RF sem HU

---

# 12. Regras de numeração

Numeração de épicos:

EP01  
EP02  
EP03  

Numeração de features (reinicia dentro do épico):

FT01  
FT02  
FT03  

Numeração de histórias (reinicia dentro da feature):

HU001  
HU002  
HU003  

Numeração de requisitos (reinicia dentro da HU):

RF-01  
RF-02  
RF-03  

Regras:

- nunca repetir número
- manter sequência
- reiniciar contagem dentro da hierarquia

---

# 13. Regras anti-alucinação

A IA não pode:

- inventar funcionalidades
- criar módulos inexistentes
- criar fluxos não descritos
- criar telas não mencionadas
- completar requisitos por conhecimento próprio

Se uma informação não estiver nos insumos, ela **não deve ser criada**.

---

# 14. Regras de interpretação

Mapeamento obrigatório:

| Texto encontrado | Converter para |
|------------------|----------------|
| módulo | Épico |
| grande funcionalidade | Épico |
| funcionalidade | Feature |
| tela | Feature ou HU |
| ação do usuário | História de Usuário |
| regra do sistema | Requisito Funcional |

Frases que indicam requisitos:

- deve permitir
- o sistema deve
- obrigatório
- não pode
- permitido
- restrito

---

# 15. Reescrita obrigatória

Conteúdos encontrados nos insumos devem ser:

- interpretados
- estruturados
- reescritos

É proibido:

- copiar textos literais
- incluir transcrições
- incluir atas completas
- incluir narrativas de reunião

Todo conteúdo deve ser convertido para a estrutura:

Épico → Feature → História de Usuário → Requisitos Funcionais

---

# 16. Pipeline obrigatório da IA

A IA deve executar o seguinte processo:

1. Ler todos os insumos do projeto  
2. Identificar módulos do sistema  
3. Criar épicos  
4. Criar features dentro dos épicos  
5. Criar histórias de usuário dentro das features  
6. Criar requisitos funcionais  
7. Validar consistência estrutural  
8. Gerar documento final  

---

# 17. Template do documento final

O documento gerado deve seguir o formato abaixo.

[TÍTULO DO DOCUMENTO]

Projeto  
[Nome do projeto]

Visão Geral  
[Descrição do sistema]

Escopo  
[Definição do escopo]

EP01 — Nome do Épico

FT01 — Nome da Feature

HU001 – Nome da História

Como [usuário],  
quero [ação],  
para que [benefício].

RF-01 – O sistema deve ...  
RF-02 – O sistema deve ...

HU002 – Nome da História

Como [usuário],  
quero [ação],  
para que [benefício].

RF-01 – O sistema deve ...

FT02 — Nome da Feature

HU001 – Nome da História

Como [usuário],  
quero [ação],  
para que [benefício].

RF-01 – O sistema deve ...

EP02 — Nome do Épico

FT01 — Nome da Feature

HU001 – Nome da História

Como [usuário],  
quero [ação],  
para que [benefício].

RF-01 – O sistema deve ...

---

# 18. Regra final de saída

A saída da IA deve conter **somente o documento final**.

Nunca incluir:

- comentários da IA
- explicações
- instruções
- texto deste SPEC
- regras deste arquivo

Se qualquer conteúdo deste SPEC aparecer no resultado, a geração está incorreta.
