import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { FileText, Trash2, Upload, Sparkles, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/api';
import { Badge } from './ui/badge';

interface ProjectModelsPanelProps {
  projectId: string;
}

interface ProjectModelFile {
  name: string;
  size: number;
  lastModified: string;
}

export function ProjectModelsPanel({ projectId }: ProjectModelsPanelProps) {
  const [files, setFiles] = useState<ProjectModelFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, [projectId]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('Modelos')
        .list(projectId);

      if (error) throw error;

      if (data) {
        setFiles(data.map(f => ({
          name: f.name,
          size: f.metadata?.size || 0,
          lastModified: f.updated_at || f.created_at
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await apiService.uploadModelFile(projectId, file);
      toast.success('Modelo enviado com sucesso!');
      loadModels();
    } catch (err: any) {
      toast.error('Erro ao enviar modelo: ' + err.message);
    } finally {
      setUploading(true); // Manter true momentaneamente para resetar input
      setTimeout(() => setUploading(false), 500);
    }
  };

  const handleDeleteModel = async (fileName: string) => {
    if (!confirm(`Deseja realmente remover o modelo "${fileName}"?`)) return;

    try {
      const { error } = await supabase.storage
        .from('Modelos')
        .remove([`${projectId}/${fileName}`]);

      if (error) throw error;

      toast.success('Modelo removido');
      loadModels();
    } catch (err: any) {
      toast.error('Erro ao remover modelo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg flex gap-4 items-start">
        <Sparkles className="w-5 h-5 text-purple-600 mt-1 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-purple-900">Treinamento de Padrão (IA)</h4>
          <p className="text-xs text-purple-700 mt-1">
            Suba documentos reais que servem de modelo para a IA. Ela aprenderá a estrutura, 
            linguagem técnica e formatação preferida da sua empresa para criar novos documentos seguindo este padrão.
          </p>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-purple-300 transition-colors bg-gray-50/50">
        <input
          type="file"
          id="model-upload"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf,.docx,.txt"
          disabled={uploading}
        />
        <label htmlFor="model-upload" className="cursor-pointer flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
            {uploading ? <Upload className="w-6 h-6 animate-bounce" /> : <FileText className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {uploading ? 'Enviando...' : 'Clique para subir um documento modelo'}
            </p>
            <p className="text-xs text-gray-500 mt-1">PDF, DOCX ou TXT (Máx 10MB)</p>
          </div>
        </label>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          Modelos Atuais
          <Badge variant="outline" className="text-[10px] font-normal">{files.length}</Badge>
        </h4>

        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Carregando modelos...</div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center border rounded-lg border-gray-100 bg-white">
            <p className="text-sm text-gray-400">Nenhum modelo de referência adicionado.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {files.map(file => (
              <div key={file.name} className="flex items-center justify-between p-4 bg-white border rounded-lg group hover:border-purple-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-500 transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[10px] text-gray-400">Adicionado em {new Date(file.lastModified).toLocaleDateString('pt-BR')}</span>
                      <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Aprendizado Ativo
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteModel(file.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

