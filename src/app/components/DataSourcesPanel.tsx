import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, Headphones, Type } from 'lucide-react'; // Adicionar Headphones e Type
import { apiService, type UploadedFile } from '../../services/api';
import { toast } from 'sonner';

interface DataSourcesPanelProps {
  projectId: string;
}

export function DataSourcesPanel({ projectId }: DataSourcesPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
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
    setFiles(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Validar tipo de arquivo
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.mp3', '.wav', '.ogg', '.aac']; // Novos tipos
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

        await apiService.uploadFile(projectId, file);
        toast.success(`${file.name} enviado com sucesso!`);
      }

      loadFiles();
    } catch (error) {
      toast.error('Erro ao enviar arquivos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          <h3 className="text-sm mb-1">Documentos de Origem</h3>
          <p className="text-xs text-gray-600">
            Envie PDF ou DOC para alimentar a base de conhecimento da IA
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Enviando...' : 'Upload'}
        </Button>
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
                  <p className="text-sm truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {file.type.toUpperCase()} {/* Mostrar tipo do arquivo */}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {file.uploadedBy}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(file.status)}
                <Badge variant={file.status === 'processed' ? 'default' : 'secondary'}>
                  {getStatusLabel(file.status)}
                </Badge>
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