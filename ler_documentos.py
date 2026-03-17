from pypdf import PdfReader
from docx import Document
import requests
import os
import glob
import sys
import json
from datetime import datetime

# =========================================
# CONFIGURAÇÃO DE CAMINHOS E IA
# =========================================
BASE_DOCS_PATH = r"C:\Users\Sea\AppData\Local\Programs\Ollama\docs"
OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "phi3"

# =========================================
# CONFIGURAÇÃO DE MODELOS E ORIENTAÇÕES
# =========================================
ORIENTACOES_FILE = os.path.join(BASE_DOCS_PATH, "modelos_orientacoes.json")

# Configurações de Chunking
MAX_CHUNK_SIZE = 1200  # Tamanho reduzido para melhor foco do phi3
CHUNK_OVERLAP = 250    # Sobreposição para manter o contexto entre blocos

# =========================================
# FUNÇÕES DE GERENCIAMENTO DE MODELOS
# =========================================
def carregar_orientacoes_modelos():
    """Carrega as orientações dos modelos do arquivo JSON"""
    try:
        if os.path.exists(ORIENTACOES_FILE):
            with open(ORIENTACOES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            # Orientação padrão se o arquivo não existir
            return {
                "default": "Você é um Analista de Requisitos Sênior especializado em extração de dados técnicos. Sua missão é extrair apenas fatos e requisitos técnicos."
            }
    except Exception as e:
        print(f"[AVISO] Erro ao carregar orientações: {e}")
        return {"default": "Você é um Analista de Requisitos Sênior especializado em extração de dados técnicos."}

def salvar_orientacao_modelo(model_id, nome_modelo, orientacao, topicos=None):
    """Salva a orientação de um modelo no arquivo JSON"""
    try:
        orientacoes = carregar_orientacoes_modelos()
        orientacoes[model_id] = {
            "nome": nome_modelo,
            "orientacao": orientacao,
            "topicos": topicos or [],  # Lista de tópicos do modelo
            "ultima_atualizacao": str(datetime.now())
        }

        with open(ORIENTACOES_FILE, "w", encoding="utf-8") as f:
            json.dump(orientacoes, f, ensure_ascii=False, indent=2)

        print(f"✅ Orientação e tópicos do modelo '{nome_modelo}' salvos com sucesso!")
    except Exception as e:
        print(f"[ERRO] Falha ao salvar orientação do modelo: {e}")

def listar_modelos_disponiveis():
    """Lista todos os modelos disponíveis com suas orientações"""
    try:
        orientacoes = carregar_orientacoes_modelos()
        if not orientacoes or len(orientacoes) == 0:
            print("Nenhum modelo específico encontrado. Usando orientação padrão.")
            return

        print("MODELOS DISPONÍVEIS:")
        print("=" * 50)

        for model_id, info in orientacoes.items():
            if model_id != "default":
                print(f"ID: {model_id}")
                print(f"Nome: {info['nome']}")
                print(f"Orientação: {info['orientacao'][:100]}{'...' if len(info['orientacao']) > 100 else ''}")

                # Mostra tópicos se existirem
                topicos = info.get('topicos', [])
                if topicos:
                    print("Tópicos:")
                    for topico in topicos:
                        nome_topico = topico.get('nome', topico.get('name', 'Sem nome'))
                        print(f"  - {nome_topico}")

                print(f"Última atualização: {info.get('ultima_atualizacao', 'N/A')}")
                print("-" * 30)

        print("\nPara usar um modelo específico:")
        print("python ler_documentos.py <project_id> [caminho] <model_id>")

    except Exception as e:
        print(f"[ERRO] Falha ao listar modelos: {e}")

# =========================================
# FUNÇÕES DE LEITURA DE DOCUMENTOS
# =========================================
def ler_txt(caminho):
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"[AVISO] Erro ao ler TXT {caminho}: {e}")
        return ""

def ler_pdf(caminho):
    try:
        reader = PdfReader(caminho)
        texto = ""
        for pagina in reader.pages:
            texto += (pagina.extract_text() or "") + "\n"
        return texto
    except Exception as e:
        print(f"[AVISO] Erro ao ler PDF {caminho}: {e}")
        return ""

def ler_docx(caminho):
    try:
        doc = Document(caminho)
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print(f"[AVISO] Erro ao ler DOCX {caminho}: {e}")
        return ""

def ler_pasta_projeto(project_id, custom_path=None):
    pasta = custom_path if custom_path else os.path.join(BASE_DOCS_PATH, project_id)

    if not os.path.exists(pasta):
        print(f"[ERRO] Pasta não encontrada: {pasta}")
        return ""

    print(f"\n📂 Lendo base de conhecimento: {pasta}\n")

    texto_total = ""
    extensoes = ["*.pdf", "*.docx", "*.doc", "*.txt"]

    arquivos = []
    for ext in extensoes:
        arquivos.extend(glob.glob(os.path.join(pasta, ext)))

    if not arquivos:
        print("[AVISO] Nenhum arquivo compatível encontrado.")
        return ""

    for arquivo in arquivos:
        print(f" → Processando {os.path.basename(arquivo)}")
        texto_total += f"\n\n### ARQUIVO: {os.path.basename(arquivo)} ###\n\n"

        if arquivo.endswith(".pdf"):
            texto_total += ler_pdf(arquivo)
        elif arquivo.endswith((".docx", ".doc")):
            texto_total += ler_docx(arquivo)
        elif arquivo.endswith(".txt"):
            texto_total += ler_txt(arquivo)

    return texto_total.strip()

# =========================================
# FUNÇÃO DE CHUNKING COM SOBREPOSIÇÃO (OVERLAP)
# =========================================
def dividir_em_chunks(texto):
    if not texto:
        return []
    
    palavras = texto.split()
    chunks = []
    
    # Aproximadamente 4 caracteres por palavra para converter tamanho de chunk em palavras
    palavras_por_chunk = MAX_CHUNK_SIZE // 4
    palavras_sobreposicao = CHUNK_OVERLAP // 4
    
    i = 0
    while i < len(palavras):
        # Pega o bloco atual
        fim = min(i + palavras_por_chunk, len(palavras))
        chunk = " ".join(palavras[i:fim])
        chunks.append(chunk)
        
        # Avança o índice considerando a sobreposição
        if fim == len(palavras):
            break
        i += (palavras_por_chunk - palavras_sobreposicao)
        
    return chunks

# =========================================
# CHAMADA AO OLLAMA
# =========================================
def chamar_ollama(prompt, system_prompt=None):
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,  # Temperatura baixa para maior fidelidade
            "num_predict": 1000
        }
    }
    
    if system_prompt:
        payload["system"] = system_prompt

    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=60)
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception as e:
        print(f"[ERRO] Falha na comunicação com Ollama: {e}")
        return ""

# =========================================
# EXTRAÇÃO TÉCNICA POR CHUNK
# =========================================
def extrair_informacoes(chunks, modelo_id=None):
    resumos = []

    # Carrega orientações dos modelos
    orientacoes = carregar_orientacoes_modelos()

    # Comportamento base da IA como profissional de TI para desenvolvimento de software
    comportamento_base = """Você é um profissional de TI especializado em desenvolvimento de software e criação de documentos técnicos.
    Sua missão é extrair e obter insumos de documentos para alimentar a criação de documentos estruturados no contexto de desenvolvimento de sistemas.
    Você analisa textos técnicos, identifica requisitos funcionais e não funcionais, regras de negócio, arquitetura de software e especificações técnicas."""

    # Define a orientação específica do modelo
    topicos_modelo = []
    if modelo_id and modelo_id in orientacoes:
        orientacao_especifica = orientacoes[modelo_id]["orientacao"]
        modelo_nome = orientacoes[modelo_id]["nome"]
        topicos_modelo = orientacoes[modelo_id].get("topicos", [])
        print(f"🤖 Usando orientação específica do modelo: {modelo_nome}")
        print(f"📋 Orientação: {orientacao_especifica[:100]}...")
        if topicos_modelo:
            print(f"📑 Tópicos do modelo: {', '.join([t.get('nome', t.get('name', 'Sem nome')) for t in topicos_modelo])}")
    else:
        orientacao_especifica = orientacoes.get("default", "Como profissional de TI especializado em desenvolvimento de software, foque na extração de requisitos funcionais e não funcionais, regras de negócio, arquitetura de sistemas e especificações técnicas.")
        modelo_nome = "Padrão"
        print(f"🤖 Usando orientação padrão (modelo não especificado ou não encontrado)")

    # Combina comportamento base + orientação específica
    system_prompt = f"""{comportamento_base}

    ORIENTAÇÃO ESPECÍFICA PARA ESTE MODELO:
    {orientacao_especifica}

    REGRAS CRÍTICAS:
    1. Responda APENAS em Português Brasileiro.
    2. NÃO adicione opiniões ou interpretações.
    3. NÃO invente informações.
    4. Se o trecho não contiver requisitos, responda: "Nenhuma informação técnica relevante."
    """

    for i, chunk in enumerate(chunks, 1):
        print(f"🧠 Analisando bloco {i}/{len(chunks)}...")

        # Cria prompt baseado nos tópicos do modelo
        if topicos_modelo:
            prompt = f"""Analise o texto abaixo e extraia informações relevantes para os seguintes tópicos do documento:

"""
            for j, topico in enumerate(topicos_modelo, 1):
                nome_topico = topico.get('nome', topico.get('name', f'Tópico {j}'))
                prompt += f"{j}. {nome_topico}\n"

            prompt += f"""

Para cada tópico, identifique informações, conceitos ou dados do texto que sejam relevantes para aquele tópico específico.

TEXTO:
<<<
{chunk}
>>>
"""
        else:
            # Fallback para o prompt genérico
            prompt = f"""Extraia do texto abaixo:
- Regras de Negócio
- Requisitos Funcionais (o que o sistema faz)
- Requisitos Não Funcionais (qualidade, performance, segurança)
- Premissas e Restrições

TEXTO:
<<<
{chunk}
>>>
"""

        resposta = chamar_ollama(prompt, system_prompt)
        if "Nenhuma informação técnica relevante" not in resposta:
            resumos.append(resposta.strip())

    return resumos

# =========================================
# CONSOLIDAÇÃO FINAL E RESUMO DE ENTENDIMENTO
# =========================================
def consolidar_analise(extrações, project_id):
    print("\n🔎 Consolidando análise final...")

    system_prompt = "Você é um Engenheiro de Requisitos Sênior responsável por consolidar documentação de múltiplos arquivos."

    prompt_consolidacao = f"""Consolide as seguintes extrações técnicas em um único documento estruturado.
    Remova duplicatas e organize por categorias.
    
    EXTRAÇÕES:
    {chr(10).join(extrações)}
    
    SAÍDA ESTRUTURADA (Markdown):
    ## 1. Regras de Negócio
    ## 2. Requisitos Funcionais
    ## 3. Requisitos Não Funcionais
    ## 4. Premissas e Restrições
    """

    concluido = chamar_ollama(prompt_consolidacao, system_prompt)
    
    print("🎯 Gerando resumo de entendimento executivo...")
    
    prompt_resumo = f"""Baseado na análise consolidada acima, gere um resumo curto de entendimento.
    Use EXATAMENTE este formato:
    "Resumo dos documentos analisados, após analisar a documentação na base de conhecimento, entendo que a necessidade do cliente [NOME DO CLIENTE], é resolver o problema de '[PROBLEMA PRINCIPAL]' de sua loja/empresa."
    
    ANÁLISE:
    {concluido[:2000]} # Limitando contexto para o resumo
    """
    
    resumo = chamar_ollama(prompt_resumo, system_prompt)
    
    return concluido, resumo

# =========================================
# EXECUÇÃO PRINCIPAL
# =========================================
if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ['--help', '-h', 'help']:
        print("🤖 LER_DOCUMENTOS.PY - Análise Inteligente de Documentos")
        print("=" * 60)
        print("❌ Uso: python ler_documentos.py <project_id> [caminho_custom] [modelo_id]")
        print("📖 <project_id>: ID do projeto (ex: PROJETO_001)")
        print("📖 [caminho_custom]: Caminho alternativo para documentos (opcional)")
        print("📖 [modelo_id]: ID do modelo de documento para orientação específica (opcional)")
        print("\n🎯 EXEMPLOS:")
        print("python ler_documentos.py PROJETO_001")
        print("python ler_documentos.py PROJETO_001 C:\\MeusDocumentos\\Projeto")
        print("python ler_documentos.py PROJETO_001 C:\\MeusDocumentos\\Projeto contrato-juridico")
        print("\n📋 COMANDOS ESPECIAIS:")
        print("python ler_documentos.py --list    # Lista modelos disponíveis")
        sys.exit(1)

    # Comando especial para listar modelos
    if sys.argv[1] == "--list":
        listar_modelos_disponiveis()
        sys.exit(0)

    project_id = sys.argv[1]
    custom_path = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else None
    modelo_id = None

    # Verifica se há um modelo_id como terceiro parâmetro
    if len(sys.argv) > 2 and not sys.argv[2].startswith('--'):
        if len(sys.argv) > 3:
            modelo_id = sys.argv[3]
    elif len(sys.argv) > 2 and sys.argv[2].startswith('--'):
        # Se o segundo parâmetro começa com --, pode ser uma flag
        pass
    elif len(sys.argv) == 3:
        # Se só tem 3 argumentos e o terceiro não começa com --, é modelo_id
        modelo_id = sys.argv[2]

    print(f"🚀 Iniciando análise de documentos para projeto: {project_id}")
    if modelo_id:
        print(f"🎯 Usando modelo específico: {modelo_id}")
        # Verifica se o modelo existe
        orientacoes = carregar_orientacoes_modelos()
        if modelo_id not in orientacoes:
            print(f"⚠️  Aviso: Modelo '{modelo_id}' não encontrado. Usando orientação padrão.")
            print("💡 Use 'python ler_documentos.py --list' para ver modelos disponíveis.")
            modelo_id = None
    else:
        print("📝 Usando orientação padrão (nenhum modelo específico definido)")
        print("💡 Use 'python ler_documentos.py --list' para ver modelos disponíveis")

    texto_bruto = ler_pasta_projeto(project_id, custom_path)

    if not texto_bruto:
        print("❌ Nenhum texto extraído. Encerrando.")
        sys.exit(0)

    chunks = dividir_em_chunks(texto_bruto)
    extrações = extrair_informacoes(chunks, modelo_id)
    
    if not extrações:
        print("❌ Nenhuma informação técnica extraída dos documentos.")
        sys.exit(0)
        
    consolidado, resumo_executivo = consolidar_analise(extrações, project_id)

# =========================================
# SALVA ARQUIVOS DE SAÍDA E SINCRONIZA COM NUVEM
# =========================================
    pasta_saida = custom_path if custom_path else os.path.join(BASE_DOCS_PATH, project_id)
    os.makedirs(pasta_saida, exist_ok=True)
    
    arquivo_contexto = os.path.join(pasta_saida, f"CONTEXTO_{project_id}.txt")
    arquivo_resumo = os.path.join(pasta_saida, f"RESUMO_IA_{project_id}.txt")

    with open(arquivo_contexto, "w", encoding="utf-8") as f:
        f.write(f"# BASE DE CONHECIMENTO CONSOLIDADA — PROJETO {project_id}\n\n")
        f.write(consolidado)

    with open(arquivo_resumo, "w", encoding="utf-8") as f:
        f.write(resumo_executivo)

    print("\n✅ PROCESSO CONCLUÍDO COM SUCESSO")
    print(f"📄 Contexto gerado: {arquivo_contexto}")
    print(f"📝 Resumo gerado: {arquivo_resumo}")
    
    print("\n☁️  DICA: Para sincronizar com outros computadores, faça o upload")
    print(f"    do arquivo CONTEXTO_{project_id}.txt na aba 'Fonte de Dados'")
    print("    das configurações do projeto no sistema.")

