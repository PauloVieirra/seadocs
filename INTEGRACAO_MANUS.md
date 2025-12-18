# Integração com Manus AI - Guia Completo

## 📖 Visão Geral

Este sistema enterprise de especificação de requisitos está totalmente integrado com a **API Manus**, permitindo análise avançada de documentos e geração inteligente de conteúdo baseado em contexto.

## 🚀 Recursos da Integração Manus

### 1. Análise Automática de Documentos
- **Upload e Processamento**: Envie documentos PDF, DOC ou DOCX que são automaticamente processados pelo Manus
- **Extração de Conteúdo**: Texto completo é extraído e indexado para consultas contextuais
- **Base de Conhecimento**: Cada projeto mantém sua própria base isolada de documentos

### 2. Geração Contextual de Requisitos
- **Compreensão de Contexto**: Manus analisa TODOS os documentos enviados antes de gerar conteúdo
- **Especificações Automáticas**: Gera automaticamente cada seção da especificação:
  - Introdução
  - Visão Geral do Sistema
  - Requisitos Funcionais (RF001, RF002...)
  - Requisitos Não Funcionais (RNF001, RNF002...)
  - Regras de Negócio (RN001, RN002...)
  - Premissas e Restrições

### 3. Chat Inteligente
- **Contextualizado**: Chat entende todo o conteúdo dos documentos processados
- **Edição Assistida**: Peça sugestões, melhorias ou expansões de qualquer seção
- **Histórico Completo**: Mantém contexto durante toda a conversa

### 4. Etapas de Processo Automáticas
- **Identificação**: Manus identifica processos descritos nos documentos
- **Estruturação**: Organiza etapas de forma lógica e sequencial
- **Formatação**: Saída padronizada e profissional

## 🔧 Configuração

### Passo 1: Obter Chave de API Manus

1. Acesse o painel Manus em sua plataforma
2. Gere uma nova chave de API
3. Copie a chave gerada (formato: `manus_xxxxx...`)

### Passo 2: Configurar no Sistema

1. Faça login no sistema
2. Clique no ícone de **Configurações** (⚙️) no dashboard
3. Vá para a aba **Inteligência Artificial**
4. Selecione **Manus AI** como provedor
5. Cole sua chave de API
6. **(Opcional)** Configure um endpoint customizado se necessário
7. Clique em **Salvar Configuração da IA**

### Passo 3: Upload de Documentos

1. Abra ou crie um projeto
2. Vá para a aba **Fontes de Dados**
3. Clique em **Upload** e selecione seus documentos
4. Aguarde o processamento (o Manus irá extrair e indexar o conteúdo)
5. Documentos processados ficam disponíveis imediatamente

## 💡 Como Usar

### Gerando Conteúdo Automaticamente

#### Opção 1: Via Botão "Gerar com IA"

1. Abra a aba **Documento** do projeto
2. Identifique a seção que deseja preencher
3. Clique no botão **Gerar com IA** (✨) na seção
4. O Manus irá:
   - Analisar TODOS os documentos enviados
   - Identificar informações relevantes para aquela seção
   - Gerar conteúdo estruturado e profissional
   - Preencher automaticamente a seção

#### Opção 2: Via Chat da IA

1. Clique no ícone do chat (💬) no canto inferior direito
2. Digite comandos como:
   - "Adicione requisitos de segurança na seção de requisitos não funcionais"
   - "Expanda a introdução com mais detalhes sobre o projeto"
   - "Revise a seção de regras de negócio e adicione mais exemplos"
3. O Manus responderá com sugestões baseadas nos documentos

### Interagindo com o Chat

O chat Manus é contextual e pode:

- **Responder Perguntas**:
  ```
  "Quais são os principais requisitos identificados nos documentos?"
  ```

- **Sugerir Melhorias**:
  ```
  "Como posso melhorar a seção de visão geral?"
  ```

- **Adicionar Conteúdo**:
  ```
  "Adicione mais requisitos funcionais baseados no documento X"
  ```

- **Explicar Decisões**:
  ```
  "Por que você gerou esses requisitos específicos?"
  ```

## 🏗️ Arquitetura da Integração

### Fluxo de Processamento de Documentos

```
1. Upload do Documento (PDF/DOC/DOCX)
   ↓
2. Envio para API Manus (/documents/process)
   ↓
3. Extração de Texto e Análise
   ↓
4. Armazenamento no Cache Local + Manus
   ↓
5. Documento disponível para consultas
```

### Fluxo de Geração de Conteúdo

```
1. Usuário solicita geração de seção
   ↓
2. Sistema busca todos os documentos processados do projeto
   ↓
3. Envia contexto completo para Manus (/chat ou /generate)
   ↓
4. Manus analisa documentos + prompt específico da seção
   ↓
5. Resposta formatada é inserida no documento
   ↓
6. Log de auditoria registra a ação
```

### Endpoints Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/validate` | GET | Valida chave de API |
| `/documents/process` | POST | Processa e indexa documento |
| `/documents` | GET | Lista documentos do projeto |
| `/chat` | POST | Chat contextual |

## 🔒 Segurança e Isolamento

### Isolamento por Projeto
- Cada projeto mantém seus próprios documentos
- Manus NÃO compartilha dados entre projetos diferentes
- Compliance com LGPD garantido

### Armazenamento de Chaves
- Chaves de API armazenadas localmente no navegador
- Nunca expostas em logs ou console
- Ambiente de demonstração usa `localStorage`

### Auditoria Completa
Todas as ações com Manus são registradas:
- `file_uploaded`: Documento enviado
- `file_processed_manus`: Documento processado com sucesso
- `file_processing_error`: Erro no processamento
- `ai_generation_manus`: Conteúdo gerado pelo Manus
- `ai_chat`: Interação via chat

## ⚡ Boas Práticas

### Documentos
1. **Use documentos claros e estruturados** para melhores resultados
2. **Envie documentos relevantes** - evite arquivos desnecessários
3. **Tamanho máximo**: 10 MB por arquivo
4. **Formatos suportados**: PDF, DOC, DOCX

### Prompts no Chat
1. **Seja específico**: "Adicione 3 requisitos de performance" em vez de "Melhorar documento"
2. **Referencie seções**: "Na seção de requisitos funcionais, adicione..."
3. **Forneça contexto**: "Baseado no documento X, gere..."

### Geração de Conteúdo
1. **Revise sempre**: IA é assistente, não substitui análise humana
2. **Itere**: Use "Gerar com IA" múltiplas vezes para refinar
3. **Combine**: Use geração automática + edição manual para melhores resultados

## 🐛 Troubleshooting

### Erro: "Chave de API inválida"
**Solução**: Verifique se:
- Copiou a chave completamente
- Chave não expirou
- Tem permissões corretas no painel Manus

### Erro: "Nenhum documento foi processado ainda"
**Solução**:
- Aguarde o processamento completo
- Verifique se o documento tem conteúdo extraível
- Para PDFs escaneados, use OCR antes do upload

### Erro: "Limite de requisições excedido"
**Solução**:
- Aguarde alguns minutos
- Verifique seu plano Manus
- Reduza frequência de chamadas

### Documento não processando
**Possíveis causas**:
1. Arquivo muito grande (> 10 MB)
2. Formato não suportado
3. PDF protegido por senha
4. Conexão internet instável

**Solução**: Verifique o log de auditoria para detalhes do erro

## 📊 Métricas e Monitoramento

O sistema registra:
- ✅ Total de documentos processados
- ✅ Tempo de processamento
- ✅ Taxa de sucesso/erro
- ✅ Uso de tokens (via auditoria)

## 🆚 Comparação com Outros Provedores

| Recurso | Manus | OpenAI | Anthropic |
|---------|-------|--------|-----------|
| Processamento de Documentos | ✅ Nativo | ❌ Manual | ❌ Manual |
| Contexto Persistente | ✅ Sim | ⚠️ Limitado | ⚠️ Limitado |
| Base de Conhecimento | ✅ Por Projeto | ❌ Não | ❌ Não |
| Isolamento de Dados | ✅ Total | ⚠️ Parcial | ⚠️ Parcial |
| Etapas de Processo | ✅ Automático | ⚠️ Manual | ⚠️ Manual |

## 🔮 Recursos Futuros

- [ ] OCR automático para documentos escaneados
- [ ] Versionamento de documentos
- [ ] Comparação entre versões
- [ ] Export para Word/PDF com IA
- [ ] Sugestões proativas de melhorias
- [ ] Integração com ferramentas de gestão de projetos

## 📞 Suporte

Para questões sobre a integração Manus:
1. Verifique este documento primeiro
2. Consulte a auditoria do projeto para logs detalhados
3. Entre em contato com suporte técnico Manus
4. Reporte bugs via sistema de tickets

---

## 💻 Para Desenvolvedores

### Estrutura do Código

```
/src/services/
  ├── manus-api.ts      # Serviço principal da API Manus
  └── api.ts            # Integração com serviço principal

/src/app/components/
  ├── DatabaseConfigDialog.tsx  # Interface de configuração
  ├── DataSourcesPanel.tsx      # Upload de documentos
  ├── DocumentEditor.tsx        # Geração de conteúdo
  └── AIChat.tsx                # Chat contextual
```

### Customização

Para customizar comportamento do Manus, edite `/src/services/manus-api.ts`:

```typescript
// Alterar temperatura padrão
const DEFAULT_TEMPERATURE = 0.7;

// Alterar max tokens
const DEFAULT_MAX_TOKENS = 2000;

// Customizar endpoint
const DEFAULT_ENDPOINT = 'https://api.manus.ai/v1';
```

### Adicionando Novos Providers

1. Adicione tipo em `AIConfig` em `/src/services/api.ts`
2. Implemente lógica em `callAIAPI()`
3. Adicione opção em `DatabaseConfigDialog.tsx`
4. Documente aqui

---

**Versão**: 1.0.0  
**Última Atualização**: Dezembro 2025  
**Compatibilidade**: Manus API v1.0+
