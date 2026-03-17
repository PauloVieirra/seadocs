import React, { useEffect, useState, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  listAllDocuments,
  uploadDocument,
  uploadDocumentBinary,
  downloadDocument,
  deleteDocument,
  type BucketDocument,
  type BucketType,
} from '../../services/ai-storage-service';
import { PasswordConfirmationDialog } from '../components/PasswordConfirmationDialog';
import { apiService } from '../../services/api';
import { Upload, Edit, Save, Loader2, Search, ArrowUpDown, ArrowDownUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function AIManagementPage() {
  const [documents, setDocuments] = useState<BucketDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'specs' | 'skill' | 'examples'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<BucketDocument | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [uploadingSpecs, setUploadingSpecs] = useState(false);
  const [uploadingSkills, setUploadingSkills] = useState(false);
  const [uploadingExamples, setUploadingExamples] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<BucketDocument | null>(null);
  const specsInputRef = useRef<HTMLInputElement>(null);
  const skillsInputRef = useRef<HTMLInputElement>(null);
  const examplesInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await listAllDocuments();
      setDocuments(docs);
    } catch (e) {
      toast.error('Erro ao carregar documentos.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocs = documents
    .filter((d) => {
      const matchSearch =
        !searchQuery.trim() ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType =
        typeFilter === 'all' || d.type === typeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const handleUploadSpecs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingSpecs(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.md')) continue;
        const content = await file.text();
        const path = file.name.includes('/') ? file.name : `Spec/${file.name}`;
        const result = await uploadDocument('specs', path, content);
        if (result) {
          toast.success(`Spec "${file.name}" enviado.`);
        } else {
          toast.error(`Falha ao enviar "${file.name}".`);
        }
      }
      await loadDocuments();
    } finally {
      setUploadingSpecs(false);
      e.target.value = '';
    }
  };

  const handleUploadSkills = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingSkills(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.md')) continue;
        const content = await file.text();
        const path = file.name.includes('/') ? file.name : file.name;
        const result = await uploadDocument('skill', path, content);
        if (result) {
          toast.success(`Skill "${file.name}" enviado.`);
        } else {
          toast.error(`Falha ao enviar "${file.name}".`);
        }
      }
      await loadDocuments();
    } finally {
      setUploadingSkills(false);
      e.target.value = '';
    }
  };

  const handleUploadExamples = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingExamples(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (ext !== '.md' && ext !== '.docx') continue;
        const path = file.name.includes('/') ? file.name : file.name;
        const result = ext === '.docx'
          ? await uploadDocumentBinary('examples', path, file)
          : await uploadDocument('examples', path, await file.text());
        if (result) {
          toast.success(`Exemplo "${file.name}" enviado.`);
        } else {
          toast.error(`Falha ao enviar "${file.name}".`);
        }
      }
      await loadDocuments();
    } finally {
      setUploadingExamples(false);
      e.target.value = '';
    }
  };

  const handleEditClick = async (doc: BucketDocument) => {
    setEditingDoc(doc);
    setEditContent('');
    setEditDialogOpen(true);
    setEditLoading(true);
    try {
      const content = await downloadDocument(doc.type, doc.path);
      setEditContent(content ?? '');
    } catch {
      toast.error('Erro ao carregar documento.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    setEditSaving(true);
    try {
      const result = await uploadDocument(editingDoc.type, editingDoc.path, editContent);
      if (result) {
        toast.success('Documento atualizado.');
        setEditDialogOpen(false);
        setEditingDoc(null);
        await loadDocuments();
      } else {
        toast.error('Falha ao salvar.');
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteClick = (doc: BucketDocument) => {
    setDocToDelete(doc);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async (password: string) => {
    if (!docToDelete) return;
    const valid = await apiService.verifyPassword(password);
    if (!valid) throw new Error('Senha incorreta.');
    const ok = await deleteDocument(docToDelete.type, docToDelete.path);
    if (!ok) throw new Error('Falha ao excluir documento.');
    toast.success('Documento excluído.');
    setDocToDelete(null);
    await loadDocuments();
  };

  const typeLabel = (t: BucketType) => (t === 'specs' ? 'Spec' : t === 'skill' ? 'Skill' : 'Exemplo');
  const isDocxReadOnly = editingDoc?.path.toLowerCase().endsWith('.docx') ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Gestão de IA</h1>
      <p className="text-gray-600">
        Gerencie Specs, Skills e Documentos de Exemplo (.md, .docx) nos buckets. Faça upload, edite e visualize.
      </p>

      {/* Upload */}
      <div className="flex flex-wrap gap-4">
        <div>
          <input
            ref={specsInputRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={handleUploadSpecs}
          />
          <Button
            variant="outline"
            onClick={() => specsInputRef.current?.click()}
            disabled={uploadingSpecs}
            className="gap-2"
          >
            {uploadingSpecs ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Specs
          </Button>
        </div>
        <div>
          <input
            ref={skillsInputRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={handleUploadSkills}
          />
          <Button
            variant="outline"
            onClick={() => skillsInputRef.current?.click()}
            disabled={uploadingSkills}
            className="gap-2"
          >
            {uploadingSkills ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Skills
          </Button>
        </div>
        <div>
          <input
            ref={examplesInputRef}
            type="file"
            accept=".md,.docx"
            multiple
            className="hidden"
            onChange={handleUploadExamples}
          />
          <Button
            variant="outline"
            onClick={() => examplesInputRef.current?.click()}
            disabled={uploadingExamples}
            className="gap-2"
          >
            {uploadingExamples ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Exemplos
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600">Tipo:</Label>
          <Select value={typeFilter} onValueChange={(v: 'all' | 'specs' | 'skill' | 'examples') => setTypeFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="specs">Spec</SelectItem>
              <SelectItem value="skill">Skill</SelectItem>
              <SelectItem value="examples">Exemplo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          className="gap-2"
        >
          {sortOrder === 'asc' ? (
            <ArrowUpDown className="w-4 h-4" />
          ) : (
            <ArrowDownUp className="w-4 h-4" />
          )}
          {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Caminho</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-gray-500">
                    Nenhum documento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc) => (
                  <TableRow key={`${doc.type}-${doc.path}`}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{doc.path}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          doc.type === 'specs'
                            ? 'bg-blue-100 text-blue-800'
                            : doc.type === 'skill'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {typeLabel(doc.type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(doc)}
                          className="gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(doc)}
                          disabled={deleteConfirmOpen}
                          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Editor */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Editar {editingDoc ? typeLabel(editingDoc.type) : ''} — {editingDoc?.name ?? ''}
            </DialogTitle>
            <DialogDescription>
              {isDocxReadOnly
                ? 'Documentos Word (.docx) não podem ser editados inline. Faça upload de uma nova versão para substituir.'
                : 'Edite o conteúdo do documento. Clique em Salvar para atualizar no bucket.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {editLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                readOnly={isDocxReadOnly}
                className="flex-1 min-h-[400px] font-mono text-sm resize-none"
                placeholder="Conteúdo do documento..."
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
              Fechar
            </Button>
            {!isDocxReadOnly && (
              <Button onClick={handleSaveEdit} disabled={editLoading || editSaving}>
                {editSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão com senha */}
      <PasswordConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setDocToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Excluir documento?"
        description={`O documento "${docToDelete?.name ?? ''}" será removido permanentemente do bucket. Digite sua senha para confirmar.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
