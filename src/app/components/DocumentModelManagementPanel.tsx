import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Importar useNavigate
import { apiService, type DocumentModel, type User } from '../../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox'; // Removed Textarea as it's not needed for new model creation
import { Plus, FileText, Edit } from 'lucide-react'; // Added Edit icon
import { RichTextDocumentModelEditor } from './RichTextDocumentModelEditor'; // Import RichTextDocumentModelEditor
import { toast } from 'sonner';

interface DocumentModelManagementPanelProps {
  currentUser: User;
}

export function DocumentModelManagementPanel({ currentUser }: DocumentModelManagementPanelProps) {
  const navigate = useNavigate(); // Inicializar useNavigate
  const [documentModels, setDocumentModels] = useState<DocumentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false); // For edit dialog
  const [selectedModelForEdit, setSelectedModelForEdit] = useState<DocumentModel | null>(null); // For editing existing model
  const [isSavingModel, setIsSavingModel] = useState(false); // For saving state in editor

  useEffect(() => {
    loadDocumentModels();
  }, []);

  const loadDocumentModels = async () => {
    setLoading(true);
    const models = await apiService.getDocumentModels();
    setDocumentModels(models);
    setLoading(false);
  };


  const handleEditDocumentModel = async (name: string, type: string, templateContent: string) => {
    setIsSavingModel(true);
    try {
      if (!selectedModelForEdit) return;
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        toast.error('Permissão negada: Somente administradores ou gerentes podem editar modelos.');
        return;
      }
      const updatedModel: DocumentModel = { ...selectedModelForEdit, name, type, templateContent };
      await apiService.updateDocumentModel(updatedModel); // Usar o novo método público
      toast.success('Modelo de documento atualizado com sucesso!');
      setEditDialogOpen(false);
      loadDocumentModels();
    } catch (error: any) {
      toast.error(`Erro ao atualizar modelo: ${error.message}`);
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleEditModelClick = (model: DocumentModel) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      toast.error('Permissão negada: Somente administradores ou gerentes podem editar modelos.');
      return;
    }
    setSelectedModelForEdit(model);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gerenciamento de Modelos de Documento</h3>
        {currentUser.role === 'admin' || currentUser.role === 'manager' ? (
          <Button onClick={() => navigate('/create-document-model')}> {/* Navega para a nova rota */}
            <Plus className="mr-2 h-4 w-4" /> Criar Novo Modelo
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documentModels.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg mb-2">Nenhum modelo de documento encontrado</h3>
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <p className="text-sm text-gray-600 mb-4">
                Comece criando seu primeiro modelo.
              </p>
            )}
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <Button onClick={() => navigate('/create-document-model')}>
                <Plus className="mr-2 h-4 w-4" /> Criar primeiro modelo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentModels.map(model => (
            <Card
              key={model.id}
              className="hover:shadow-lg transition-shadow cursor-pointer" // Adiciona cursor-pointer de volta e torna o card clicável
              onClick={() => handleEditModelClick(model)} // Adiciona o handler de clique ao card
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  <CardDescription>{model.type}</CardDescription>
                </div>
                {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditModelClick(model)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                {/* Aqui você pode exibir um resumo do templateContent se desejar, ou omitir */}
                {/* <div>
                  <span>Conteúdo do Template: </span>
                  <span className="font-medium" dangerouslySetInnerHTML={{ __html: model.templateContent.substring(0, 100) + '...' }}></span>
                </div> */}
                <div>
                  <span>Disponibilidade: </span>
                  <span className="font-medium">
                    {model.isGlobal ? 'Global' : 'Apenas para este projeto'}
                  </span>
                </div>
                <div>
                  <span>Criado em: </span>
                  <span className="font-medium">{new Date(model.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogo de Edição de Modelo de Documento */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className="fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* Header fixo */}
          <div className="shrink-0 border-b border-gray-200 bg-white">
            <div className="w-full max-w-[1440px] mx-auto px-6 py-4">
              <DialogHeader className="gap-1">
                <DialogTitle>Editar Modelo de Documento</DialogTitle>
                <DialogDescription>
                  Modifique o layout e o conteúdo do modelo existente.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Conteúdo com scroll */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="w-full max-w-[1440px] mx-auto px-6 py-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                {selectedModelForEdit && (
                  <RichTextDocumentModelEditor
                    onSave={handleEditDocumentModel}
                    onCancel={() => setEditDialogOpen(false)}
                    isLoading={isSavingModel}
                    initialData={selectedModelForEdit}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

