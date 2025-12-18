import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { apiService, type DatabaseConfig, type AIConfig } from '../../services/api';
import { Database, CheckCircle2, Bot, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatabaseConfigDialog({ open, onOpenChange }: DatabaseConfigDialogProps) {
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: 5432,
    database: 'requirements_db',
    username: 'postgres',
    password: '',
    type: 'postgresql'
  });
  
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    apiKey: '',
    provider: 'openai'
  });

  const [dbSuccess, setDbSuccess] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const existingDbConfig = apiService.getConfiguracao();
    if (existingDbConfig) {
      setDbConfig(existingDbConfig);
      setDbSuccess(true);
    }
    
    const existingAiConfig = apiService.getAIConfiguracao();
    if (existingAiConfig) {
      setAiConfig(existingAiConfig);
      setAiSuccess(true);
    }
  }, [open]);

  const handleDbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbLoading(true);
    setDbSuccess(false);

    const result = await apiService.configurarBancoDeDados(dbConfig);
    
    setDbLoading(false);
    if (result) {
      setDbSuccess(true);
      toast.success('Banco de dados configurado com sucesso!');
    } else {
      toast.error('Erro ao configurar o banco de dados.');
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);
    setAiSuccess(false);

    const result = await apiService.configurarIA(aiConfig);
    
    setAiLoading(false);
    if (result) {
      setAiSuccess(true);
      toast.success('IA configurada com sucesso!');
    } else {
      toast.error('Erro ao configurar a IA.');
    }
  };

  const portDefaults: Record<DatabaseConfig['type'], number> = {
    postgresql: 5432,
    mysql: 3306,
    mongodb: 27017,
    sqlserver: 1433
  };

  const handleTypeChange = (type: DatabaseConfig['type']) => {
    setDbConfig({
      ...dbConfig,
      type,
      port: portDefaults[type]
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Sistema</DialogTitle>
          <DialogDescription>
            Configure o banco de dados e a inteligência artificial de forma independente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="database" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="database" className="gap-2">
              <Database className="w-4 h-4" />
              Banco de Dados
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" />
              Inteligência Artificial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="space-y-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900">
                Configure a conexão com o banco de dados. Esta configuração é independente da IA.
              </p>
            </div>

            <form onSubmit={handleDbSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="db-type">Tipo de Banco de Dados</Label>
                  <Select value={dbConfig.type} onValueChange={handleTypeChange}>
                    <SelectTrigger id="db-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                      <SelectItem value="sqlserver">SQL Server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="db-port">Porta</Label>
                  <Input
                    id="db-port"
                    type="number"
                    value={dbConfig.port}
                    onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-host">Host / Endereço</Label>
                <Input
                  id="db-host"
                  placeholder="localhost ou IP do servidor"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-database">Nome do Banco de Dados</Label>
                <Input
                  id="db-database"
                  placeholder="requirements_db"
                  value={dbConfig.database}
                  onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-username">Usuário</Label>
                <Input
                  id="db-username"
                  placeholder="postgres"
                  value={dbConfig.username}
                  onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-password">Senha</Label>
                <Input
                  id="db-password"
                  type="password"
                  placeholder="••••••••"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                  required
                />
              </div>

              {dbSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm">Banco de dados configurado com sucesso!</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={dbLoading}>
                  {dbLoading ? 'Salvando...' : 'Salvar Configuração do Banco'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-purple-900">
                Configure a chave de API da IA. Esta configuração funciona independentemente do banco de dados.
              </p>
            </div>

            <form onSubmit={handleAiSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-provider">Provedor de IA</Label>
                <Select 
                  value={aiConfig.provider} 
                  onValueChange={(value: 'openai' | 'anthropic' | 'manus' | 'custom') => 
                    setAiConfig({ ...aiConfig, provider: value })
                  }
                >
                  <SelectTrigger id="ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="manus">Manus AI</SelectItem>
                    <SelectItem value="custom">Outro / Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {aiConfig.provider === 'manus' && (
                <div className="space-y-2">
                  <Label htmlFor="manus-endpoint">Endpoint da API Manus (Opcional)</Label>
                  <Input
                    id="manus-endpoint"
                    type="url"
                    placeholder="https://api.manus.ai/v1"
                    value={(aiConfig as any).endpoint || ''}
                    onChange={(e) => setAiConfig({ ...aiConfig, endpoint: e.target.value } as any)}
                  />
                  <p className="text-xs text-gray-600">
                    Deixe em branco para usar o endpoint padrão
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ai-api-key">Chave de API</Label>
                <Input
                  id="ai-api-key"
                  type="password"
                  placeholder={
                    aiConfig.provider === 'openai' ? 'sk-...' : 
                    aiConfig.provider === 'anthropic' ? 'sk-ant-...' :
                    aiConfig.provider === 'manus' ? 'Sua chave Manus API' : 
                    'Sua chave de API'
                  }
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-600">
                  {aiConfig.provider === 'openai' && 
                    'Obtenha sua chave em: https://platform.openai.com/api-keys'}
                  {aiConfig.provider === 'anthropic' && 
                    'Obtenha sua chave em: https://console.anthropic.com/'}
                  {aiConfig.provider === 'manus' && 
                    'Use a chave de API gerada no painel Manus'}
                  {aiConfig.provider === 'custom' && 
                    'Forneça a chave de API do seu provedor personalizado'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm mb-2">🚀 O que a IA pode fazer:</h4>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Analisar documentos enviados (PDF/DOC)</li>
                  <li>Gerar conteúdo automaticamente para cada seção</li>
                  <li>Responder perguntas via chat</li>
                  <li>Editar e melhorar textos existentes</li>
                  <li>Sugerir requisitos baseados nos documentos</li>
                  {aiConfig.provider === 'manus' && (
                    <>
                      <li><strong>Compreender contexto completo dos documentos</strong></li>
                      <li><strong>Escrever etapas de processo automaticamente</strong></li>
                    </>
                  )}
                </ul>
              </div>

              {aiSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm">IA configurada com sucesso!</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={aiLoading}>
                  {aiLoading ? 'Salvando...' : 'Salvar Configuração da IA'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm mb-2">ℹ️ Importante</h4>
            <p className="text-xs text-gray-700">
              <strong>Banco de Dados</strong> e <strong>Inteligência Artificial</strong> são configurações independentes. 
              Você pode configurar apenas uma, ou ambas, conforme necessário. Em ambiente de demonstração, 
              as credenciais são armazenadas localmente no navegador.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}