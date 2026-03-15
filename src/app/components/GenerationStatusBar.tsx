/**
 * Barra flutuante global que mostra gerações de documentos em andamento.
 * Visível em qualquer tela do sistema enquanto a IA está trabalhando.
 * Ao clicar, navega para o documento e centraliza a seção sendo gerada.
 */
import { useNavigate } from 'react-router-dom';
import { useDocumentGeneration } from '../../contexts/DocumentGenerationContext';

export function GenerationStatusBar() {
  const { activeJobs } = useDocumentGeneration();
  const navigate = useNavigate();

  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2">
      {activeJobs.map(job => (
        <button
          key={job.documentId}
          type="button"
          onClick={() => {
            navigate(`/project/${job.projectId}/document/${job.documentId}`, {
              state: { scrollToActiveSection: true },
            });
          }}
          className="flex items-center gap-3 bg-white border border-blue-200 shadow-lg rounded-full px-4 py-2.5 text-sm text-blue-800 whitespace-nowrap hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="font-medium">
            {job.status === 'reviewing' ? 'Revisando:' : 'IA gerando:'}
          </span>
          <span className="truncate max-w-[220px]">{job.documentTitle}</span>
          <span className="text-blue-400 text-xs flex-shrink-0">
            {job.status === 'reviewing'
              ? `ajustando sessão ${job.reviewSectionIndex ?? 0}`
              : `${job.completedSections}/${job.totalSections} seções`}
          </span>
        </button>
      ))}
    </div>
  );
}
