'use client';

import { useMemo, useState } from 'react';
import { Download, Eye, FileArchive, LoaderCircle, Plus, Trash2, UploadCloud } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DOCUMENT_CATEGORY_OPTIONS, getDocumentCategoryLabel } from '@/modules/documents/document-meta';

type DocumentItem = {
  id: string;
  passengerId: string | null;
  passengerName: string | null;
  category: string;
  categoryLabel: string;
  title: string;
  originalFilename: string;
  fileUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  mimeType: string;
  extractedText: string | null;
  structuredMetadata: Record<string, unknown> | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  linkedEntityLabel: string | null;
  processingStatus: string;
  fileSizeBytes: number;
  description: string | null;
  createdAt: string;
  uploadedBy: string | null;
};

type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  tripId: string;
  initialDocuments: DocumentItem[];
  passengerOptions: SelectOption[];
  entityOptions: Array<SelectOption & { type: string }>;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TripDocumentsManager({
  tripId,
  initialDocuments,
  passengerOptions,
  entityOptions,
}: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    title: '',
    category: 'other',
    passengerId: '',
    linkedEntityValue: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const documentsByContext = useMemo(() => {
    const groups = new Map<string, DocumentItem[]>();
    for (const document of documents) {
      const key = document.linkedEntityId ? `${document.linkedEntityType}:${document.linkedEntityId}` : 'trip:general';
      const current = groups.get(key) ?? [];
      current.push(document);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: items[0]?.linkedEntityLabel || 'Documentos gerais da viagem',
      items,
    }));
  }, [documents]);

  async function reloadDocuments() {
    const response = await fetch(`/api/admin/trips/${tripId}/documents`, { cache: 'no-store' });
    const payload = await response.json().catch(() => []);
    setDocuments(Array.isArray(payload) ? payload : []);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo.');
      setSuccess('');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    const linkedEntity = entityOptions.find((option) => option.value === form.linkedEntityValue);

    try {
      const response = await fetch(`/api/admin/trips/${tripId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || file.name,
          originalFilename: file.name,
          category: form.category,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
          passengerId: form.passengerId || undefined,
          linkedEntityType: linkedEntity?.type || undefined,
          linkedEntityId: linkedEntity?.value || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.document) {
        setError(payload?.error || 'Nao foi possivel preparar o upload.');
        return;
      }

      if (payload.uploadUrl) {
        const uploadResponse = await fetch(payload.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });

        if (!uploadResponse.ok) {
          setError('Falha ao enviar o arquivo para o storage.');
          return;
        }
      }

      setShowUpload(false);
      setFile(null);
      setForm({ title: '', category: 'other', passengerId: '', linkedEntityValue: '' });
      await reloadDocuments();
      setSuccess(payload.mockedUpload
        ? 'Documento cadastrado na viagem em modo mock. O arquivo podera ser anexado depois.'
        : 'Documento enviado com sucesso para o storage e vinculado a viagem.');
    } catch {
      setError('Erro de comunicacao ao enviar documento.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm('Deseja excluir este documento? Esta acao remove o arquivo do storage.');
    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');
    const response = await fetch(`/api/admin/trips/${tripId}/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      setError('Nao foi possivel excluir o documento.');
      return;
    }

    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setSuccess('Documento removido com sucesso.');
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Documentos da viagem"
        description="Upload real no Supabase Storage com categorizacao, vinculo opcional por passageiro e contexto operacional."
        action={(
          <button
            type="button"
            onClick={() => setShowUpload((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
          >
            <Plus className="h-4 w-4" />
            Adicionar documento
          </button>
        )}
      >
        <div className="space-y-4">
          {(error || success) && (
            <div className={error
              ? 'rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]'
              : 'rounded-2xl border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm text-[#163020]'}
            >
              {error || success}
            </div>
          )}

          {showUpload && (
            <form onSubmit={handleUpload} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[#38463a]">Arquivo</span>
                  <input
                    type="file"
                    required
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Titulo</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Ex: Boarding pass ida"
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Categoria</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                  >
                    {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Passageiro</span>
                  <select
                    value={form.passengerId}
                    onChange={(event) => setForm((current) => ({ ...current, passengerId: event.target.value }))}
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                  >
                    <option value="">Nenhum passageiro especifico</option>
                    {passengerOptions.map((passenger) => (
                      <option key={passenger.value} value={passenger.value}>
                        {passenger.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Vincular a item operacional</span>
                  <select
                    value={form.linkedEntityValue}
                    onChange={(event) => setForm((current) => ({ ...current, linkedEntityValue: event.target.value }))}
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                  >
                    <option value="">Documento geral da viagem</option>
                    {entityOptions.map((entity) => (
                      <option key={`${entity.type}:${entity.value}`} value={entity.value}>
                        {entity.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#7ba78d]"
                >
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading ? 'Enviando...' : 'Enviar documento'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-10 text-center text-sm text-[#5b665d]">
                Nenhum documento anexado a esta viagem.
              </div>
            ) : documents.map((document) => (
              <div key={document.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#142018]">{document.title}</p>
                      <StatusBadge tone="info">{getDocumentCategoryLabel(document.category)}</StatusBadge>
                      <StatusBadge tone={document.processingStatus === 'DONE' ? 'success' : 'warning'}>
                        {document.processingStatus}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-[#5b665d]">{document.originalFilename}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-[#7b857b]">
                      <span>{formatBytes(document.fileSizeBytes)}</span>
                      {document.passengerName && <span>Passageiro: {document.passengerName}</span>}
                      {document.linkedEntityLabel && <span>Contexto: {document.linkedEntityLabel}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {document.previewUrl && (
                      <a
                        href={document.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018]"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </a>
                    )}
                    {document.downloadUrl && (
                      <a
                        href={document.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018]"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(document.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#f1c4bc] bg-white px-3 py-2 text-sm font-semibold text-[#9b3528]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos por contexto" description="Arquivos reaparecem agrupados no contexto operacional correto.">
        <div className="space-y-4">
          {documentsByContext.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-10 text-center text-sm text-[#5b665d]">
              Nenhum documento contextualizado ainda.
            </div>
          )}
          {documentsByContext.map((group) => (
            <div key={group.key} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-[#1f6b46]" />
                <p className="text-sm font-semibold text-[#142018]">{group.label}</p>
                <StatusBadge tone="neutral">{group.items.length}</StatusBadge>
              </div>
              <div className="space-y-2">
                {group.items.map((document) => (
                  <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#142018]">{document.title}</p>
                      <p className="mt-1 text-xs text-[#7b857b]">{getDocumentCategoryLabel(document.category)} · {document.originalFilename}</p>
                    </div>
                    <div className="flex gap-2">
                      {document.previewUrl && (
                        <a href={document.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#1f6b46]">
                          Preview
                        </a>
                      )}
                      {document.downloadUrl && (
                        <a href={document.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#1f6b46]">
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
