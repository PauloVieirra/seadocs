import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Importar useNavigate
import { apiService, type DocumentModel, type User } from '../../services/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox'; // Removed Textarea as it's not needed for new model creation
import { Plus, FileText, Edit, Trash2 } from 'lucide-react'; // Added Edit and Trash2 icons
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
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null); // For delete confirmation

  useEffect(() => {
    loadDocumentModels();

    // Inscrever para mudanças em tempo real (Supabase ou Mock local)
    const subscription = apiService.subscribeToDocumentModels(() => {
      loadDocumentModels();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadDocumentModels = async () => {
    setLoading(true);
    try {
      const models = await apiService.getDocumentModels();
      const localDrafts = apiService.getLocalModelDrafts();
      
      // Combinar modelos salvos no banco com rascunhos locais
      // Evitar duplicidade se um rascunho local for de um modelo que já existe no banco
      const filteredLocalDrafts = localDrafts.filter(ld => {
        const idFromKey = ld.id.replace('model_draft_', '');
        return !models.some(m => m.id === idFromKey);
      });

      setDocumentModels([...filteredLocalDrafts, ...models]);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEditDocumentModel = async (name: string, type: string, templateContent: string, isDraft: boolean, aiGuidance: string) => {
    setIsSavingModel(true);
    try {
      if (!selectedModelForEdit) return;
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'technical_responsible') {
        toast.error('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem editar modelos.');
        return;
      }

      if (selectedModelForEdit.isLocalDraft) {
        // Se era um rascunho local, agora vamos criar ele oficialmente no banco (como rascunho ou publicado)
        await apiService.createDocumentModel(name, type, templateContent, false, undefined, isDraft, aiGuidance);
        // Limpar o rascunho local após salvar no banco
        localStorage.removeItem(selectedModelForEdit.id);
      } else {
        // Modelo já existente no banco
        const updatedModel: DocumentModel = { ...selectedModelForEdit, name, type, templateContent, isDraft, aiGuidance };
        await apiService.updateDocumentModel(updatedModel);
      }

      toast.success(isDraft ? 'Rascunho salvo no banco de dados!' : 'Modelo de documento salvo com sucesso!');
      setEditDialogOpen(false);
      loadDocumentModels();
    } catch (error: any) {
      toast.error(`Erro ao atualizar modelo: ${error.message}`);
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleEditModelClick = (model: DocumentModel) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'technical_responsible') {
      toast.error('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem editar modelos.');
      return;
    }
    
    // Se for um rascunho local, preparamos o editor com os dados dele
    setSelectedModelForEdit(model);
    setEditDialogOpen(true);
  };

  const handleDeleteModel = async (model: DocumentModel) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'technical_responsible') {
      toast.error('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem excluir modelos.');
      return;
    }

    console.log('[DocumentModelPanel] Iniciando exclusão do modelo:', model.id);
    setDeletingModelId(model.id);
    try {
      if (model.isLocalDraft) {
        // Se for um rascunho local, removemos diretamente do localStorage
        localStorage.removeItem(model.id);
        toast.success('Rascunho local excluído com sucesso!');
      } else {
        // Se for um modelo do banco, chamamos a API
        const success = await apiService.deleteDocumentModel(model.id);
        
        if (success) {
          // Também tenta limpar qualquer rascunho local que possa existir para este ID
          localStorage.removeItem(`model_draft_${model.id}`);
          toast.success('Modelo excluído com sucesso!');
        } else {
          toast.error('Não foi possível encontrar o modelo para excluir.');
        }
      }
      
      await loadDocumentModels(); // Recarregar a lista para refletir a exclusão
    } catch (error: any) {
      console.error('[DocumentModelPanel] Erro ao excluir modelo:', error);
      toast.error(error.message || 'Erro ao excluir modelo');
    } finally {
      setDeletingModelId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gerenciamento de Modelos de Documento</h3>
        {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') ? (
          <Button onClick={() => {
            localStorage.removeItem('model_draft_new'); // Sempre limpa rascunho 'novo' ao clicar em criar novo
            navigate('/create-document-model');
          }}>
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
            {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
              <p className="text-sm text-gray-600 mb-4">
                Comece criando seu primeiro modelo.
              </p>
            )}
            {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
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
              onClick={(e) => {
                // Só abre o editor se não clicou em um botão
                if (!(e.target as HTMLElement).closest('button')) {
                  handleEditModelClick(model);
                }
              }} // Adiciona o handler de clique ao card
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{model.name}</CardTitle>
                    {model.isLocalDraft && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Rascunho Local (Não Salvo)
                      </Badge>
                    )}
                    {model.isDraft && !model.isLocalDraft && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                        Rascunho
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{model.type}</CardDescription>
                </div>
                {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditModelClick(model);
                      }}
                      title="Editar modelo"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir modelo"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deletingModelId === model.id}
                        >
                          {deletingModelId === model.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o modelo "{model.name}"?
                            Esta ação não pode ser desfeita e removerá o modelo permanentemente {model.isLocalDraft ? 'do seu navegador' : 'do banco de dados'}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deletingModelId === model.id}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteModel(model)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deletingModelId === model.id}
                          >
                            {deletingModelId === model.id ? 'Excluindo...' : 'Excluir permanentemente'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen} >
        <DialogContent className=' fixed inset-0
      w-screen h-screen
      min-w-full
      rounded-none
      p-0
      flex flex-col
      gap-0
      overflow-hidden
      bg-white
      translate-x-0
      translate-y-0'>
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

