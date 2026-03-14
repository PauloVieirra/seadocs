import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/api';
import { parseSignCallbackState } from '../../services/govbr-api';
import { toast } from 'sonner';

/**
 * Página de callback após assinatura no Gov.br.
 * A URL de redirect do Gov.br deve apontar para /govbr-callback
 *
 * Query params esperados: state (contém documentId e projectId)
 * O fluxo completo de verificação do code exigiria backend (client_secret).
 * Esta página marca o documento como assinado quando o usuário retorna.
 */
export function GovBrCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Assinatura cancelada ou erro no Gov.br.');
      setStatus('error');
      setTimeout(() => navigate('/projects'), 2000);
      return;
    }

    const parsed = state ? parseSignCallbackState(state) : null;
    const documentId = parsed?.documentId;

    if (!documentId) {
      toast.error('Callback inválido. Documento não identificado.');
      setStatus('error');
      setTimeout(() => navigate('/projects'), 2000);
      return;
    }

    (async () => {
      try {
        const doc = await apiService.signDocument(documentId);
        toast.success('Documento assinado com sucesso!');
        setStatus('success');
        navigate(`/project/${doc.projectId}/document/${doc.id}`, { replace: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao marcar documento como assinado.');
        setStatus('error');
        setTimeout(() => navigate('/projects'), 2000);
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Processando assinatura...</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-green-600 font-medium">Redirecionando para o documento...</p>
        )}
        {status === 'error' && (
          <p className="text-red-600 font-medium">Ocorreu um erro. Redirecionando...</p>
        )}
      </div>
    </div>
  );
}
