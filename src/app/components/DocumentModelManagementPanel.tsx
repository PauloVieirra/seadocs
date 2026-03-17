import React, { useEffect, useState, useRef } from 'react';
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
import { Plus, FileText, Edit, Trash2, Copy, RotateCcw, Lock, Upload } from 'lucide-react';
import { RichTextDocumentModelEditor } from './RichTextDocumentModelEditor';
import { uploadSpec } from '../../services/spec-service';
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
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [duplicatingModelId, setDuplicatingModelId] = useState<string | null>(null);
  const [restoringModelId, setRestoringModelId] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [modelToRestore, setModelToRestore] = useState<DocumentModel | null>(null);
  const [isUploadingSpec, setIsUploadingSpec] = useState(false);
  const specFileInputRef = useRef<HTMLInputElement>(null);

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
      const [models, localDrafts] = await Promise.all([
        apiService.getDocumentModels(),
        apiService.getLocalModelDrafts()
      ]);
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


  const handleEditDocumentModel = async (name: string, type: string, templateContent: string, isDraft: boolean, aiGuidance: string, specPath?: string, skillPath?: string, exampleDocumentPath?: string) => {
    setIsSavingModel(true);
    try {
      if (!selectedModelForEdit) return;
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'technical_responsible') {
        toast.error('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem editar modelos.');
        return;
      }

      if (selectedModelForEdit.isLocalDraft) {
        await apiService.createDocumentModel(name, type, templateContent, false, undefined, isDraft, aiGuidance, specPath, skillPath, exampleDocumentPath);
        await apiService.deleteLocalModelDraft(selectedModelForEdit.id);
      } else {
        const updatedModel: DocumentModel = { ...selectedModelForEdit, name, type, templateContent, isDraft, aiGuidance, specPath, skillPath, exampleDocumentPath };
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

  const handleDuplicateModel = async (model: DocumentModel) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'technical_responsible') {
      toast.error('Permissão negada: Somente administradores, gerentes ou técnicos responsáveis podem duplicar modelos.');
      return;
    }
    setDuplicatingModelId(model.id);
    try {
      const newName = `${model.name} (cópia)`;
      await apiService.createDocumentModel(
        newName,
        model.type,
        model.templateContent,
        false,
        undefined,
        model.isDraft ?? false,
        model.aiGuidance ?? '',
        model.specPath,
        model.skillPath,
        model.exampleDocumentPath
      );
      toast.success('Modelo duplicado com sucesso!');
      await loadDocumentModels();
    } catch (error: any) {
      toast.error(`Erro ao duplicar modelo: ${error.message}`);
    } finally {
      setDuplicatingModelId(null);
    }
  };

  const canDeleteModel = (model: DocumentModel) =>
    !model.isProtected &&
    (model.isLocalDraft ||
      model.creatorId === currentUser.id ||
      (model.creatorId == null && currentUser.role === 'admin'));

  const canRestoreModel = (model: DocumentModel) =>
    !model.isLocalDraft && !!model.originalTemplateContent;

  const handleEnviarSpecClick = () => {
    specFileInputRef.current?.click();
  };

  const handleSpecFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.md')) {
      toast.error('Selecione um arquivo .md');
      e.target.value = '';
      return;
    }
    setIsUploadingSpec(true);
    try {
      const content = await file.text();
      const bucketPath = `Spec/${file.name}`;
      const result = await uploadSpec(bucketPath, content);
      if (result) {
        toast.success(`Spec "${file.name}" enviado com sucesso para o bucket.`);
      } else {
        toast.error('Falha ao enviar Spec. Verifique as permissões do bucket.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar Spec');
    } finally {
      setIsUploadingSpec(false);
      e.target.value = '';
    }
  };

  const handleRestoreModel = async () => {
    if (!modelToRestore) return;
    setRestoringModelId(modelToRestore.id);
    try {
      await apiService.restoreDocumentModel(modelToRestore.id);
      toast.success(`Modelo "${modelToRestore.name}" restaurado ao formato original.`);
      setRestoreConfirmOpen(false);
      setModelToRestore(null);
      loadDocumentModels();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao restaurar modelo');
    } finally {
      setRestoringModelId(null);
    }
  };

  const handleDeleteModel = async (model: DocumentModel) => {
    if (!canDeleteModel(model)) {
      toast.error('Apenas o usuário que criou o modelo pode excluí-lo.');
      return;
    }

    console.log('[DocumentModelPanel] Iniciando exclusão do modelo:', model.id);
    setDeletingModelId(model.id);
    try {
      if (model.isLocalDraft) {
        await apiService.deleteLocalModelDraft(model.id);
        toast.success('Rascunho local excluído com sucesso!');
      } else {
        const success = await apiService.deleteDocumentModel(model.id);
        if (success) {
          await apiService.deleteLocalModelDraft(`model_draft_${model.id}`);
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
        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <>
              <input
                ref={specFileInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={handleSpecFileChange}
              />
              <Button
                variant="secondary"
                onClick={handleEnviarSpecClick}
                disabled={isUploadingSpec}
                className="gap-2"
              >
                {isUploadingSpec ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enviando...
                  </span>
                ) : (
                  <><Upload className="h-4 w-4" />Enviar Spec</>
                )}
              </Button>
            </>
          )}
          {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
            <Button onClick={async () => {
              await apiService.deleteLocalModelDraft('model_draft_new');
              navigate('/create-document-model');
            }}>
              <Plus className="mr-2 h-4 w-4" /> Criar Novo Modelo
            </Button>
          )}
        </div>
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
              className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
              onClick={(e) => {
                // Só abre o editor se não clicou em um botão
                if (!(e.target as HTMLElement).closest('button')) {
                  handleEditModelClick(model);
                }
              }} // Adiciona o handler de clique ao card
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 overflow-hidden">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg break-words">{model.name}</CardTitle>
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
                    {model.isProtected && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" title="Modelo protegido — não pode ser excluído">
                        <Lock className="w-3 h-3 mr-1" />
                        Protegido
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{model.type}</CardDescription>
                </div>
                {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'technical_responsible') && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateModel(model);
                      }}
                      title="Duplicar modelo"
                      disabled={duplicatingModelId === model.id}
                    >
                      {duplicatingModelId === model.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
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
                    {canRestoreModel(model) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModelToRestore(model);
                          setRestoreConfirmOpen(true);
                        }}
                        title="Restaurar ao formato original"
                        disabled={restoringModelId === model.id}
                      >
                        {restoringModelId === model.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {canDeleteModel(model) && (
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
                    )}
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

      {/* Diálogo de confirmação de restauração */}
      <AlertDialog
        open={restoreConfirmOpen}
        onOpenChange={(open) => {
          setRestoreConfirmOpen(open);
          if (!open) setModelToRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar ao formato original</AlertDialogTitle>
            <AlertDialogDescription>
              {modelToRestore && (
                <>
                  Tem certeza que deseja restaurar o modelo &quot;{modelToRestore.name}&quot; ao formato original em que foi criado?
                  As alterações feitas desde a criação serão perdidas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setModelToRestore(null)}
              disabled={!!restoringModelId}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRestoreModel();
              }}
              disabled={!modelToRestore || !!restoringModelId}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoringModelId ? 'Restaurando...' : 'Sim, restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

