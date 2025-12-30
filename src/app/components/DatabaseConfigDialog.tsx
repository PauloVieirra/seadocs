import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { apiService, type DatabaseConfig } from '../../services/api';
import { Database, CheckCircle2, AlertCircle } from 'lucide-react';
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
  
  const [dbSuccess, setDbSuccess] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    const existingDbConfig = apiService.getConfiguracao();
    if (existingDbConfig) {
      setDbConfig(existingDbConfig);
      setDbSuccess(true);
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
          <DialogTitle>Configurações do Banco de Dados</DialogTitle>
          <DialogDescription>
            Configure a conexão com o banco de dados para persistência remota
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-900">
              Esta configuração permite que o sistema se conecte a um banco de dados externo (PostgreSQL, MySQL, etc).
            </p>
          </div>

          <form onSubmit={handleDbSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-type">Tipo de Banco de Dados</Label>
                <div className="mt-1">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-port">Porta</Label>
                <Input
                  id="db-port"
                  type="number"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })}
                  required
                  className="mt-1"
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
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm mb-2">ℹ️ Importante</h4>
            <p className="text-xs text-gray-700">
              O sistema utiliza o <strong>Ollama (Local)</strong> como inteligência artificial padrão. 
              Em ambiente de demonstração, as credenciais do banco são armazenadas localmente no navegador.
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
