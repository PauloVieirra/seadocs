import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, Headphones, Type, PlusCircle, Trash2 } from 'lucide-react';
import { apiService, type UploadedFile } from '../../services/api';
import { toast } from 'sonner';

interface ProjectDocumentsPanelProps {
  projectId: string;
}

export function ProjectDocumentsPanel({ projectId }: ProjectDocumentsPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, [projectId]);

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
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.mp3', '.wav', '.ogg', '.aac'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
          toast.error(`Arquivo ${file.name} não é suportado.`);
          continue;
        }

        // Validar tamanho (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} é muito grande.`);
          continue;
        }

        // Faz upload como documento geral
        await apiService.uploadFile(projectId, file, false);
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

  const handleAddToDataSource = async (file: UploadedFile) => {
    try {
      await apiService.setFileAsDataSource(projectId, file.id, true);
      toast.success('Documento adicionado à base de conhecimento da IA!');
      loadFiles();
    } catch (error) {
      toast.error('Erro ao adicionar documento.');
    }
  };

  const handleDeleteFile = async (file: UploadedFile) => {
    if (!confirm(`Tem certeza que deseja excluir DEFINITIVAMENTE o arquivo "${file.name}"?`)) {
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

  const getFileIcon = (fileType: UploadedFile['type']) => {
    switch (fileType) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'txt': return <Type className="w-5 h-5 text-gray-500" />;
      case 'audio': return <Headphones className="w-5 h-5 text-purple-500" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
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
          <h3 className="text-sm mb-1">Documentos do Projeto</h3>
          <p className="text-xs text-gray-600">
            Armazene documentos gerais do projeto (não lidos pela IA por padrão)
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

      {files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-600">Nenhum documento enviado</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
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
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{new Date(file.uploadedAt).toLocaleDateString('pt-BR')}</span>
                    {file.isDataSource && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Base de Dados
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!file.isDataSource && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => handleAddToDataSource(file)}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    +Base de dados
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteFile(file)}
                  title="Excluir arquivo"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

