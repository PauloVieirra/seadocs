import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RichTextDocumentModelEditor } from '../components/RichTextDocumentModelEditor';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';

export function CreateDocumentModelPage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    // Ao montar a página de criação, garantimos que não estamos carregando um rascunho anterior acidentalmente
    // se o usuário clicou explicitamente em "Criar Novo Modelo"
    setIsDraft(true);
    setDraftSaved(false);
  }, []);

  const handleSaveModel = async (name: string, type: string, templateContent: string, isDraft: boolean, aiGuidance: string) => {
    setIsSaving(true);
    try {
      // Aqui, você pode adicionar a lógica de permissão se a página for acessível diretamente
      // por exemplo, verificando o currentUser.role antes de chamar a API
      await apiService.createDocumentModel(name, type, templateContent, false, undefined, isDraft, aiGuidance); 
      toast.success(isDraft ? 'Rascunho salvo no banco de dados!' : 'Modelo de documento salvo com sucesso!');
      navigate('/document-models'); // Navegar de volta para o painel de gerenciamento de modelos
    } catch (error: any) {
      toast.error(`Erro ao salvar modelo: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDraftStatusChange = (draft: boolean, saved: boolean) => {
    setIsDraft(draft);
    setDraftSaved(saved);
  };

  const handleCancel = () => {
    navigate('/document-models'); // Navegar de volta para o painel de gerenciamento de modelos
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 font-sans antialiased">
      <div className="w-full max-w-[1440px] bg-white rounded-lg shadow-md p-10 space-y-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-extrabold text-gray-900">Criar Novo Modelo de Documento</h1>
          <div className="flex items-center gap-2">
            {isDraft && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                Rascunho
              </Badge>
            )}
            {draftSaved && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                Salvo automaticamente
              </Badge>
            )}
          </div>
        </div>
        <p className="text-gray-600 text-lg mb-8">
          Defina o layout e o conteúdo inicial do seu novo modelo de documento usando o editor de texto rico.
          {isDraft && <span className="block text-amber-600 mt-2 text-sm">💡 Seu trabalho é salvo automaticamente como rascunho.</span>}
        </p>
        <RichTextDocumentModelEditor
          onSave={handleSaveModel}
          onCancel={handleCancel}
          isLoading={isSaving}
          onDraftStatusChange={handleDraftStatusChange}
        />
      </div>
    </div>
  );
}



