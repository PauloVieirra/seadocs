from pypdf import PdfReader
from docx import Document
import requests
import os
import glob
import sys
import json

# =========================================
# CONFIGURAÇÃO DE CAMINHOS E IA
# =========================================
BASE_DOCS_PATH = r"C:\Users\Sea\AppData\Local\Programs\Ollama\docs"
OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "phi3"

# Configurações de Chunking
MAX_CHUNK_SIZE = 1200  # Tamanho reduzido para melhor foco do phi3
CHUNK_OVERLAP = 250    # Sobreposição para manter o contexto entre blocos

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
            "temperature": 0.1,  # Temperatura baixa para maior fidelidade
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
def extrair_informacoes(chunks):
    resumos = []
    
    system_prompt = """Você é um Analista de Requisitos Sênior especializado em extração de dados técnicos.
    Sua missão é extrair apenas fatos e requisitos técnicos.
    REGRAS CRÍTICAS:
    1. Responda APENAS em Português Brasileiro.
    2. NÃO adicione opiniões ou interpretações.
    3. NÃO invente informações.
    4. Se o trecho não contiver requisitos, responda: "Nenhuma informação técnica relevante."
    """

    for i, chunk in enumerate(chunks, 1):
        print(f"🧠 Analisando bloco {i}/{len(chunks)}...")

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
    project_id = sys.argv[1] if len(sys.argv) > 1 else "PROJETO_TESTE"
    custom_path = sys.argv[2] if len(sys.argv) > 2 else None

    texto_bruto = ler_pasta_projeto(project_id, custom_path)

    if not texto_bruto:
        print("❌ Nenhum texto extraído. Encerrando.")
        sys.exit(0)

    chunks = dividir_em_chunks(texto_bruto)
    extrações = extrair_informacoes(chunks)
    
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

