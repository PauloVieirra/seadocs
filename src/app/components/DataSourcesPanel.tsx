import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, Headphones, Type, Trash2, RefreshCw, Eye } from 'lucide-react'; // Adicionar Eye
import { apiService, type UploadedFile } from '../../services/api';
import { toast } from 'sonner';

interface DataSourcesPanelProps {
  projectId: string;
}

export function DataSourcesPanel({ projectId }: DataSourcesPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false); // Novo estado para sincronização
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manusEnabled, setManusEnabled] = useState(false);

  useEffect(() => {
    loadFiles();
    checkManusConfig();
  }, [projectId]);

  const checkManusConfig = () => {
    const aiConfig = apiService.getAIConfiguracao();
    setManusEnabled(aiConfig?.provider === 'manus');
  };

  const loadFiles = async () => {
    const data = await apiService.getProjectFiles(projectId);
    // Filtrar apenas arquivos que são fontes de dados
    setFiles(data.filter(f => f.isDataSource));
  };

  const handleSyncFiles = async () => {
    setSyncing(true);
    try {
      toast.info('Iniciando sincronização dos documentos com a nuvem...');
      
      // Busca todos os arquivos reais do projeto no storage
      for (const file of files) {
        const url = await apiService.getFilePublicUrl(projectId, file.name);
        // Abre o download em nova aba (o navegador gerencia o download local)
        window.open(url, '_blank');
      }
      
      toast.success('Sincronização concluída! Salve os arquivos na pasta de documentos do Ollama.');
    } catch (error) {
      toast.error('Erro ao sincronizar arquivos.');
    } finally {
      setSyncing(false);
    }
  };

  const handleViewFile = async (file: UploadedFile) => {
    try {
      const url = await apiService.getFilePublicUrl(projectId, file.name);
      if (url && url !== '#') {
        window.open(url, '_blank');
      } else {
        toast.error('Não foi possível obter a URL do arquivo.');
      }
    } catch (error) {
      toast.error('Erro ao abrir o arquivo.');
    }
  };

  const truncateFilename = (name: string, limit: number = 38) => {
    if (name.length <= limit) return name;
    const extension = name.split('.').pop();
    const nameWithoutExtension = name.substring(0, name.lastIndexOf('.'));
    return nameWithoutExtension.substring(0, limit - 3 - (extension?.length || 0)) + '...' + (extension ? '.' + extension : '');
  };

  const handleRemoveFile = async (file: UploadedFile) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR DEFINITIVAMENTE o arquivo "${file.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await apiService.deleteFile(projectId, file.id);
      toast.success('Arquivo excluído com sucesso.');
      loadFiles();
    } catch (error) {
      toast.error('Erro ao excluir arquivo.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Validar tipo de arquivo
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.mp3', '.wav', '.ogg', '.aac'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
          toast.error(`Arquivo ${file.name} não é suportado. Use PDF, DOC, DOCX, TXT ou áudio.`);
          continue;
        }

        // Validar tamanho (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} é muito grande. Máximo: 10MB.`);
          continue;
        }

        toast.info(`Processando "${truncateFilename(file.name, 25)}"...`);

        // Faz upload já marcando como fonte de dados
        await apiService.uploadFile(projectId, file, true);
        
        // Disparar análise automática em background para alimentar o RAG imediatamente (forçando atualização)
        apiService.analyzeProjectMaterials(projectId, undefined, true).catch(console.error);
        
        toast.success(`${truncateFilename(file.name, 25)} adicionado e analisado!`);
      }

      loadFiles();
    } catch (error) {
      toast.error('Erro ao enviar ou converter arquivos.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFromDataSource = async (file: UploadedFile) => {
    if (!confirm(`Tem certeza que deseja remover "${file.name}" da base de conhecimento da IA? O arquivo continuará disponível nos documentos do projeto.`)) {
      return;
    }

    try {
      await apiService.setFileAsDataSource(projectId, file.id, false);
      toast.success('Documento removido da base de conhecimento.');
      loadFiles();
    } catch (error) {
      toast.error('Erro ao remover documento.');
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getFileIcon = (fileType: UploadedFile['type']) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'txt':
        return <Type className="w-5 h-5 text-gray-500" />;
      case 'audio':
        return <Headphones className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processed':
        return 'Processado';
      case 'processing':
        return 'Processando';
      case 'error':
        return 'Erro';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm mb-1">Fonte de Dados (Base de Conhecimento IA)</h3>
          <p className="text-xs text-gray-600">
            Documentos que a IA irá <strong>estudar, examinar e extrair informações</strong> para entender as necessidades do cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncFiles}
            disabled={syncing || files.length === 0}
            title="Baixar documentos para o RAG local"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar RAG
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Enviando...' : 'Upload'}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.ogg,.aac"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {manusEnabled && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-purple-900">
              <strong>Manus AI ativado!</strong> Documentos serão processados automaticamente e estarão 
              disponíveis para geração de conteúdo e chat contextual.
            </p>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 mb-2">Nenhum documento enviado</p>
          <p className="text-xs text-gray-500 mb-4">
            A IA usará estes documentos como fonte de conhecimento
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Enviar primeiro documento
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1">
                {getFileIcon(file.type)} {/* Usar o novo ícone do arquivo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={file.name}>
                    {truncateFilename(file.name, 38)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {file.type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(file.status)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => handleViewFile(file)}
                  title="Visualizar arquivo"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRemoveFile(file)}
                  title="Excluir arquivo definitivamente"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm mb-2">💡 Dicas</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Formatos aceitos: PDF, DOC, DOCX, TXT, Áudio (MP3, WAV, OGG, AAC)</li>
          <li>• Tamanho máximo por arquivo: 10 MB</li>
          <li>• A IA analisa apenas documentos deste projeto</li>
          <li>• Documentos processados ficam disponíveis imediatamente</li>
        </ul>
      </div>
    </div>
  );
}