/**
 * Serviço de integração com a API de Assinatura Eletrônica GOV.BR
 *
 * Documentação: https://manual-integracao-assinatura-eletronica.servicos.gov.br/
 * Requisitos: Login Único GOV.BR, credenciais (contato: integracaoid@economia.gov.br)
 *
 * Fluxo típico:
 * 1. Usuário clica em Assinar
 * 2. Sistema redireciona para GOV.BR (Login Único)
 * 3. Usuário assina com certificado digital
 * 4. GOV.BR redireciona de volta com token de verificação
 * 5. Sistema valida e marca documento como assinado no banco
 */

const GOVBR_BASE_URL = import.meta.env.VITE_GOVBR_API_URL || '';
const GOVBR_CLIENT_ID = import.meta.env.VITE_GOVBR_CLIENT_ID || '';
const GOVBR_REDIRECT_URI = import.meta.env.VITE_GOVBR_REDIRECT_URI || '';

export interface GovBrSignConfig {
  /** URL base da API Gov.br (ex: https://assinatura.servicos.gov.br) */
  baseUrl: string;
  /** Client ID da aplicação (obtido via integracaoid@economia.gov.br) */
  clientId: string;
  /** URI de callback após assinatura */
  redirectUri: string;
}

function getConfig(): GovBrSignConfig | null {
  if (!GOVBR_BASE_URL || !GOVBR_CLIENT_ID || !GOVBR_REDIRECT_URI) {
    return null;
  }
  return { baseUrl: GOVBR_BASE_URL, clientId: GOVBR_CLIENT_ID, redirectUri: GOVBR_REDIRECT_URI };
}

/**
 * Verifica se a integração Gov.br está configurada
 */
export function isGovBrConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Retorna a URL para iniciar o fluxo de assinatura no Gov.br.
 * Inclui documentId no state para recuperar no callback.
 *
 * Quando não configurado, retorna null (aplicação deve marcar como assinado localmente).
 */
export function getSignDocumentUrl(documentId: string): string | null {
  const config = getConfig();
  if (!config) return null;

  const state = encodeURIComponent(JSON.stringify({ documentId, ts: Date.now() }));
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid assinatura',
    state,
  });

  return `${config.baseUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Extrai o documentId do state retornado pelo Gov.br (callback)
 */
export function parseSignCallbackState(state: string): { documentId: string } | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(state));
    return parsed?.documentId ? { documentId: parsed.documentId } : null;
  } catch {
    return null;
  }
}
