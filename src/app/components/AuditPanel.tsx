import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { FileEdit, Sparkles, Upload, UserPlus, Clock, List } from 'lucide-react'; // Adicionar List
import { apiService, type AuditLog, type DocumentVersion } from '../../services/api'; // Importar DocumentVersion
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'; // Importar Tabs
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'; // Importar Dialog
import { Button } from './ui/button'; // Adicionar Button

interface AuditPanelProps {
  projectId: string;
}

export function AuditPanel({ projectId }: AuditPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]); // Novo estado para versões do documento
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null); // Versão selecionada para visualização
  const [versionDialogOpen, setVersionDialogOpen] = useState(false); // Controle do diálogo de versão

  useEffect(() => {
    loadLogs();
    loadDocumentVersions(); // Carregar versões do documento
  }, [projectId]);

  const loadLogs = async () => {
    setLoading(true);
    const data = await apiService.getAuditLogs(projectId);
    setLogs(data);
    setLoading(false);
  };

  const loadDocumentVersions = async () => {
    const versions = await apiService.getDocumentVersions(projectId);
    setDocumentVersions(versions);
  };

  const handleViewVersion = (version: DocumentVersion) => {
    setSelectedVersion(version);
    setVersionDialogOpen(true);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'project_created':
        return <UserPlus className="w-4 h-4" />;
      case 'document_edited':
        return <FileEdit className="w-4 h-4" />;
      case 'ai_generation':
        return <Sparkles className="w-4 h-4" />;
      case 'file_uploaded':
        return <Upload className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'project_created':
        return 'bg-green-100 text-green-700';
      case 'document_edited':
        return 'bg-blue-100 text-blue-700';
      case 'ai_generation':
        return 'bg-purple-100 text-purple-700';
      case 'file_uploaded':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0 && documentVersions.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600">Nenhuma atividade ou versão registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="activities">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="versions">Versões ({documentVersions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          <div>
            <h3 className="text-sm mb-1">Histórico de Atividades</h3>
            <p className="text-xs text-gray-600">
              Registro completo de todas as ações no projeto
            </p>
          </div>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 pb-4 border-b last:border-b-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm">{log.details}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-600">{log.userName}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {log.action.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <div>
            <h3 className="text-sm mb-1">Histórico de Versões do Documento</h3>
            <p className="text-xs text-gray-600">
              Todas as versões salvas automaticamente do documento
            </p>
          </div>

          {documentVersions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <List className="w-10 h-10 mx-auto mb-3" />
              <p>Nenhuma versão anterior encontrada.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {documentVersions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Versão {version.versionNumber}</p>
                      <p className="text-xs text-gray-600">
                        Editado por {version.updatedBy} em {new Date(version.updatedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleViewVersion(version)}>
                      Visualizar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para Visualizar Versão */}
      {selectedVersion && (
        <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Visualizando Versão {selectedVersion.versionNumber}</DialogTitle>
              <DialogDescription>
                Editado por {selectedVersion.updatedBy} em {new Date(selectedVersion.updatedAt).toLocaleString('pt-BR')}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] p-4 border rounded-md mt-4 prose prose-sm max-w-none">
              {selectedVersion.content.sections.map((section, index) => (
                <div key={index} className="mb-4">
                  <h4 className="text-lg font-semibold mb-2">{section.title}</h4>
                  <p className="whitespace-pre-wrap text-gray-700">{section.content || '[Seção vazia]'}</p>
                </div>
              ))}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm mb-2">🔒 Segurança e Conformidade</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Todos os logs são imutáveis e criptografados</li>
          <li>• Rastreabilidade completa para auditoria LGPD</li>
          <li>• Retenção de dados conforme política da empresa</li>
        </ul>
      </div>
    </div>
  );
}
