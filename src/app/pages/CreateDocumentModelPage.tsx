import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RichTextDocumentModelEditor } from '../components/RichTextDocumentModelEditor';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

export function CreateDocumentModelPage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveModel = async (name: string, type: string, templateContent: string) => {
    setIsSaving(true);
    try {
      // Aqui, você pode adicionar a lógica de permissão se a página for acessível diretamente
      // por exemplo, verificando o currentUser.role antes de chamar a API
      await apiService.createDocumentModel(name, type, templateContent, false); // isGlobal set to false for now
      toast.success('Modelo de documento criado com sucesso!');
      navigate('/document-models'); // Navegar de volta para o painel de gerenciamento de modelos
    } catch (error: any) {
      toast.error(`Erro ao criar modelo: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/document-models'); // Navegar de volta para o painel de gerenciamento de modelos
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 font-sans antialiased">
      <div className="w-full max-w-[1440px] bg-white rounded-lg shadow-md p-10 space-y-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Criar Novo Modelo de Documento</h1>
        <p className="text-gray-600 text-lg mb-8">
          Defina o layout e o conteúdo inicial do seu novo modelo de documento usando o editor de texto rico.
        </p>
        <RichTextDocumentModelEditor
          onSave={handleSaveModel}
          onCancel={handleCancel}
          isLoading={isSaving}
        />
      </div>
    </div>
  );
}



