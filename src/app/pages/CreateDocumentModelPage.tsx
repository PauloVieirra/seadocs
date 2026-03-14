import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RichTextDocumentModelEditor } from '../components/RichTextDocumentModelEditor';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { listTemplateExamples, analyzeDocumentTemplate, type AnalyzedTemplate } from '../../services/template-analysis-api';
import { Wand2, Loader2 } from 'lucide-react';

export function CreateDocumentModelPage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);
  const [initialDraft, setInitialDraft] = useState<{ name: string; type: string; templateContent: string; specPath?: string } | null>(null);

  // Estado para geração automática a partir de exemplo
  const [exampleFiles, setExampleFiles] = useState<string[]>([]);
  const [selectedExample, setSelectedExample] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<AnalyzedTemplate | null>(null);

  useEffect(() => {
    apiService.getLocalModelDrafts().then((drafts) => {
      const draft = drafts.find(d => d.id === 'model_draft_new');
      if (draft) {
        setInitialDraft({ name: draft.name, type: draft.type, templateContent: draft.templateContent, specPath: draft.specPath });
        setDraftSaved(true);
      }
    });
    // Carrega lista de documentos de exemplo disponíveis
    listTemplateExamples()
      .then(setExampleFiles)
      .catch(() => setExampleFiles([]));
  }, []);

  const handleAnalyzeExample = async () => {
    if (!selectedExample) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeDocumentTemplate(selectedExample);
      setGeneratedTemplate(result);
      toast.success(`Modelo gerado a partir de "${selectedExample}"! Revise o conteúdo abaixo.`);
    } catch (err: any) {
      toast.error(`Erro ao analisar documento: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveModel = async (name: string, type: string, templateContent: string, isDraft: boolean, aiGuidance: string, specPath?: string) => {
    setIsSaving(true);
    try {
      await apiService.createDocumentModel(name, type, templateContent, false, undefined, isDraft, aiGuidance, specPath); 
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

  // initialData: prioridade ao template gerado automaticamente, depois ao rascunho salvo
  const editorInitialData = generatedTemplate
    ? {
        id: 'model_draft_new',
        name: generatedTemplate.suggested_name,
        type: '',
        templateContent: generatedTemplate.template_html,
        isGlobal: false,
        createdAt: '',
        updatedAt: '',
        isLocalDraft: true,
      }
    : initialDraft
    ? { ...initialDraft, id: 'model_draft_new', isGlobal: false, createdAt: '', updatedAt: '', isLocalDraft: true, specPath: initialDraft.specPath }
    : undefined;

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

        {/* Geração automática a partir de documento de exemplo */}
        {exampleFiles.length > 0 && (
          <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-indigo-900">Gerar modelo a partir de documento de exemplo</h2>
            </div>
            <p className="text-sm text-indigo-700 mb-4">
              Selecione um documento existente. O sistema irá ler sua estrutura, fontes, cores e tabelas para gerar o modelo automaticamente.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={selectedExample} onValueChange={setSelectedExample}>
                  <SelectTrigger className="bg-white border-indigo-300 focus:border-indigo-500">
                    <SelectValue placeholder="Selecione um documento de exemplo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {exampleFiles.map((file) => (
                      <SelectItem key={file} value={file}>{file}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAnalyzeExample}
                disabled={!selectedExample || isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
                ) : (
                  <><Wand2 className="h-4 w-4" />Analisar e Gerar</>
                )}
              </Button>
            </div>
            {generatedTemplate && (
              <p className="mt-3 text-xs text-indigo-600 font-medium">
                ✓ Modelo gerado com {generatedTemplate.sections.length} seção(ões). Revise e edite abaixo antes de salvar.
              </p>
            )}
          </div>
        )}

        <RichTextDocumentModelEditor
          key={generatedTemplate ? `gen-${generatedTemplate.suggested_name}` : 'draft'}
          onSave={handleSaveModel}
          onCancel={handleCancel}
          isLoading={isSaving}
          onDraftStatusChange={handleDraftStatusChange}
          initialData={editorInitialData}
        />
      </div>
    </div>
  );
}



