import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileClock, FileSearch, FileText, UploadCloud } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.user.agencyId;
  const [documents, totalDocuments, processing, ready, essentials] = await Promise.all([
    prisma.document.findMany({
      where: { agencyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 16,
      include: {
        trip: { select: { id: true, title: true } },
        uploadedBy: { select: { name: true } },
      },
    }),
    prisma.document.count({ where: { agencyId, deletedAt: null } }),
    prisma.document.count({ where: { agencyId, deletedAt: null, processingStatus: 'PROCESSING' } }),
    prisma.document.count({ where: { agencyId, deletedAt: null, processingStatus: 'DONE' } }),
    prisma.document.count({ where: { agencyId, deletedAt: null, isEssential: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hub"
        title="Biblioteca Documental"
        description="Base global de vouchers, apolices, bilhetes e comprovantes da agencia, com foco em auditoria e processamento."
        actions={(
          <Link href="/dashboard/trips" className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]">
            Abrir jornadas globais
          </Link>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Documentos na base" value={totalDocuments} detail="Ultimos registros carregados" icon={FileText} />
        <StatCard title="Em processamento" value={processing} detail="OCR, parsing e estruturacao" icon={FileClock} tone="warn" />
        <StatCard title="Disponiveis" value={ready} detail="Prontos para operacao e portal" icon={FileSearch} tone="accent" />
        <StatCard title="Essenciais" value={essentials} detail="Itens criticos da jornada" icon={UploadCloud} />
      </div>

      <SectionCard title="Biblioteca documental" description="Arquivos mais recentes ligados a viagens e passageiros.">
        <div className="overflow-hidden rounded-[24px] border border-[#d9e2d5]">
          <table className="w-full text-sm">
            <thead className="bg-[#f6f7f2] text-left text-[#617063]">
              <tr>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Viagem</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ea] bg-white">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#5b665d]">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              ) : documents.map((document) => (
                <tr key={document.id}>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-[#142018]">{document.name}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#7b857b]">{document.category}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#5b665d]">
                    {document.trip ? (
                      <Link href={`/dashboard/trips/${document.trip.id}`} className="font-medium text-[#1f6b46]">
                        {document.trip.title}
                      </Link>
                    ) : 'Sem viagem'}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge
                      tone={document.processingStatus === 'DONE' ? 'success' : document.processingStatus === 'ERROR' ? 'danger' : 'warning'}
                    >
                      {document.processingStatus}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-[#5b665d]">{document.uploadedBy.name}</td>
                  <td className="px-4 py-4 text-[#5b665d]">{format(document.createdAt, 'dd/MM/yyyy', { locale: ptBR })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
