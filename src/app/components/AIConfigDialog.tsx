import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { apiService, type AIConfig } from '../../services/api';
import { updateAIConfig as syncAIConfigToRAG } from '../../services/rag-api';
import { Cpu, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIConfigDialog({ open, onOpenChange }: AIConfigDialogProps) {
  const [provider, setProvider] = useState<'ollama' | 'groq'>('ollama');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      apiService.getAIConfiguracao().then((config) => {
        setProvider(config?.provider === 'groq' ? 'groq' : 'ollama');
      });
    }
  }, [open]);

  const handleOllamaToggle = (checked: boolean) => {
    if (checked) setProvider('ollama');
  };

  const handleGroqToggle = (checked: boolean) => {
    if (checked) setProvider('groq');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const config: AIConfig = { provider };

    try {
      await apiService.configurarIA(config);
      await syncAIConfigToRAG({ provider });
      setSuccess(true);
      toast.success('Configuração de IA salva com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações de IA</DialogTitle>
          <DialogDescription>
            Escolha o provedor de inteligência artificial. Apenas uma opção pode estar ativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-900">
              Se o Ollama não estiver disponível, o sistema usará automaticamente a Groq API (quando configurada).
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Ollama local */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <div>
                  <Label className="text-base font-medium">Ollama local</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modelo rodando localmente (ex.: phi3, llama)
                  </p>
                </div>
              </div>
              <Switch
                checked={provider === 'ollama'}
                onCheckedChange={handleOllamaToggle}
              />
            </div>

            {/* Groq API */}
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-emerald-600" />
                  <div>
                    <Label className="text-base font-medium">Groq API</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      API em nuvem (chave em GROQ_API_KEY no Vercel)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={provider === 'groq'}
                  onCheckedChange={handleGroqToggle}
                />
              </div>
            </div>

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm">Configuração salva com sucesso!</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
