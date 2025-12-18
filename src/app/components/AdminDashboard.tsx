import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Users, FileText, Bug, MessageSquare } from 'lucide-react';
import { apiService, User } from '../../services/api'; // Importar apiService e User

interface AdminDashboardProps {
  currentUser: User;
}

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [totalDocuments, setTotalDocuments] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [reportedErrors, setReportedErrors] = useState<number | null>(15); // Placeholder por enquanto
  const [openTickets, setOpenTickets] = useState<number | null>(7);    // Placeholder por enquanto

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const docsCount = await apiService.getTotalDocumentsCount();
        setTotalDocuments(docsCount);

        const usersCount = await apiService.getTotalUsersCount();
        setTotalUsers(usersCount);
      } catch (error) {
        console.error("Erro ao buscar contagens do dashboard:", error);
        // Pode adicionar um toast de erro aqui, se desejar
      }
    };

    fetchCounts();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard do Administrador</h1>
      <p className="text-gray-600">Bem-vindo, {currentUser.name}! Visão geral do sistema.</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos Criados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments !== null ? totalDocuments : 'Carregando...'}</div>
            <p className="text-xs text-muted-foreground">Total de documentos no sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Registrados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers !== null ? totalUsers : 'Carregando...'}</div>
            <p className="text-xs text-muted-foreground">Total de usuários ativos e inativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erros Reportados</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportedErrors !== null ? reportedErrors : 'Carregando...'}</div>
            <p className="text-xs text-muted-foreground">Chamados de erro e bugs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chamados em Aberto</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets !== null ? openTickets : 'Carregando...'}</div>
            <p className="text-xs text-muted-foreground">Requisições de suporte e novas funcionalidades</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
