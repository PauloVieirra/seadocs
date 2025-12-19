import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Search, Globe, Lock, Clock, ArrowLeft, FileDown, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiService, type Document } from '../../services/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { DocumentEditor } from './DocumentEditor';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';

export function Wiki() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  
  // Estados para Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 30;

  useEffect(() => {
    loadWikiDocuments(currentPage);

    // Inscreve para qualquer mudança na tabela de documentos para atualizar a Wiki em tempo real
    const subscription = apiService.subscribeToDocuments(null, () => {
      loadWikiDocuments(currentPage);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [currentPage]);

  const loadWikiDocuments = async (page: number) => {
    try {
      setLoading(true);
      const { data, total } = await apiService.listWikiDocuments(page, pageSize);
      setDocuments(data);
      
      // Aplicar filtro de busca se houver
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = data.filter(doc => {
          const nameMatch = doc.name.toLowerCase().includes(lowerQuery);
          const contentMatch = doc.content?.sections.some(s => 
            s.title.toLowerCase().includes(lowerQuery) || 
            s.content.toLowerCase().includes(lowerQuery)
          );
          return nameMatch || contentMatch;
        });
        setFilteredDocuments(filtered);
      } else {
        setFilteredDocuments(data);
      }
      
      setTotalItems(total);
    } catch (error) {
      console.error('Erro ao carregar Wiki:', error);
      toast.error('Erro ao carregar documentos da Wiki');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const lowerQuery = query.toLowerCase();
    
    // Filtro local nos documentos já carregados
    const filtered = documents.filter(doc => {
      const nameMatch = doc.name.toLowerCase().includes(lowerQuery);
      const contentMatch = doc.content?.sections.some(s => 
        s.title.toLowerCase().includes(lowerQuery) || 
        s.content.toLowerCase().includes(lowerQuery)
      );
      return nameMatch || contentMatch;
    });
    
    setFilteredDocuments(filtered);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getSnippet = (doc: Document) => {
    if (!doc.content || doc.content.sections.length === 0) return 'Sem descrição disponível.';
    const firstSection = doc.content.sections.find(s => s.content && s.content.trim().length > 0) || doc.content.sections[0];
    if (!firstSection || !firstSection.content) return 'Documento sem conteúdo textual.';
    const text = firstSection.content.replace(/<[^>]*>/g, ''); // Remove HTML
    return text.length > 160 ? text.substring(0, 160) + '...' : text;
  };

  if (selectedDocument) {
    return (
      <div className="min-h-screen bg-gray-100 pb-10">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 print:hidden mb-6">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Wiki
              </Button>
              <h2 className="font-semibold text-lg">{selectedDocument.name}</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </header>

        <DocumentEditor 
          document={selectedDocument} 
          onSave={() => {}} 
          projectId={selectedDocument.projectId}
          viewMode={true}
          onExitViewMode={() => setSelectedDocument(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-20">
      {/* Google-like Search Header */}
      <div className="flex flex-col items-center mb-10">
        <h1 className="text-4xl font-bold mb-8 text-gray-900 flex items-center gap-3">
          <Globe className="text-blue-600 w-10 h-10" />
          Wiki SEAGID
        </h1>
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Pesquisar na Wiki por título, assunto ou conteúdo..."
            className="pl-12 h-12 text-lg rounded-full border-gray-200 shadow-sm focus:shadow-md transition-shadow"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Pesquise em documentos públicos e privados que você tem acesso.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">Nenhum resultado encontrado para "{searchQuery}"</p>
        </div>
      ) : (
        <>
          <div className="space-y-10 mb-16">
            <p className="text-sm text-gray-600 mb-2">Aproximadamente {totalItems} resultados encontrados (Página {currentPage} de {totalPages})</p>
            
            {filteredDocuments.map(doc => (
              <div key={doc.id} className="group cursor-pointer max-w-2xl" onClick={() => setSelectedDocument(doc)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {doc.securityLevel === 'public' ? (
                      <Globe className="w-3 h-3 text-green-600" />
                    ) : (
                      <Lock className="w-3 h-3 text-amber-500" />
                    )}
                    {doc.projectId} › {doc.name}
                  </span>
                </div>
                <h3 className="text-xl text-blue-800 group-hover:underline font-medium mb-1">
                  {doc.name}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="text-gray-500 mr-2">
                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')} —
                  </span>
                  {getSnippet(doc)}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Atualizado em {new Date(doc.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                  {doc.securityLevel === 'public' && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      Público
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Componente de Paginação */}
          {totalPages > 1 && (
            <Pagination className="mt-10">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    aria-disabled={currentPage === 1}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    aria-disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}

