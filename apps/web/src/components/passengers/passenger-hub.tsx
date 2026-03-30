'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarRange,
  ChevronDown,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  PlaneTakeoff,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast-provider';
import { DOCUMENT_CATEGORY_OPTIONS } from '@/modules/documents/document-meta';
import { TripDocumentsManager } from '@/components/trips/trip-documents-manager';
import { TripOperationsManager } from '@/components/trips/trip-operations-manager';
import { TRIP_STATUS_OPTIONS } from '@/modules/trips/trip-meta';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'dados' | 'viagens' | 'documentos' | 'conversas';

export type CompanionData = {
  id: string;
  name: string;
  relationship: string | null;
  dateOfBirth: string | null;
  notes: string | null;
};

export type TripEntityOption = { id: string; label: string; type: string };

export type TripData = {
  tripPassengerId: string;
  tripId: string;
  isLead: boolean;
  title: string;
  status: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  documentCount: number;
  entityOptions: TripEntityOption[];
  passengerOptions: Array<{ value: string; label: string }>;
  documents: DocumentItem[];
  flights: Array<Record<string, unknown>>;
  hotels: Array<Record<string, unknown>>;
  transports: Array<Record<string, unknown>>;
  tours: Array<Record<string, unknown>>;
  trains: Array<Record<string, unknown>>;
  insurances: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
};

export type ConversationData = {
  id: string;
  phone: string | null;
  status: string;
  lastMessageAt: string | null;
  lastMessage: string | null;
};

export type DocumentItem = {
  id: string;
  passengerId: string | null;
  passengerName: string | null;
  isEssential?: boolean;
  category: string;
  categoryLabel: string;
  title: string;
  originalFilename: string;
  fileUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  mimeType: string;
  extractedText?: string | null;
  structuredMetadata?: Record<string, unknown> | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  linkedEntityLabel: string | null;
  processingStatus: string;
  fileSizeBytes: number;
  description?: string | null;
  createdAt: string;
  uploadedBy?: string | null;
};

export type PassengerHubData = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  portalStatus: string;
  portalLink: string | null;
  personalDocumentCount: number;
  companions: CompanionData[];
  trips: TripData[];
  conversations: ConversationData[];
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = [
  { key: 'boarding_pass',     emoji: '✈',  label: 'Boarding Pass',  bg: 'bg-[#e8f2ff]',  text: 'text-[#17406d]' },
  { key: 'hotel_voucher',     emoji: '🏨', label: 'Hotel',          bg: 'bg-[#fff4de]',  text: 'text-[#7a4f00]' },
  { key: 'transport_voucher', emoji: '🚌', label: 'Transfer',       bg: 'bg-[#f3e8ff]',  text: 'text-[#5b21b6]' },
  { key: 'tour_voucher',      emoji: '🎟', label: 'Passeio',        bg: 'bg-[#fff0e8]',  text: 'text-[#7c3a00]' },
  { key: 'train_ticket',      emoji: '🚂', label: 'Trem',           bg: 'bg-[#f0f0f0]',  text: 'text-[#404040]' },
  { key: 'insurance',         emoji: '🛡', label: 'Seguro',         bg: 'bg-[#ecf6ea]',  text: 'text-[#1f6b46]' },
  { key: 'itinerary',         emoji: '📄', label: 'Itinerário',     bg: 'bg-[#e8f5f0]',  text: 'text-[#0d5c45]' },
  { key: 'passport_copy',     emoji: '🛂', label: 'Passaporte',     bg: 'bg-[#fdecea]',  text: 'text-[#7f2315]' },
  { key: 'visa',              emoji: '🔖', label: 'Visto',          bg: 'bg-[#eef0ff]',  text: 'text-[#3730a3]' },
  { key: 'other',             emoji: '📎', label: 'Outro',          bg: 'bg-[#f5f5f5]',  text: 'text-[#525252]' },
] as const;

const TABS: { key: Tab; label: string }[] = [
  { key: 'dados',       label: 'Dados pessoais' },
  { key: 'viagens',     label: 'Jornadas'       },
  { key: 'documentos',  label: 'Docs pessoais'  },
  { key: 'conversas',   label: 'Conversas'      },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function tripStatusConfig(status: string) {
  const configs: Record<string, { label: string; dot: string; text: string }> = {
    DRAFT:       { label: 'Pre-viagem',    dot: 'bg-[#c8b89a]',  text: 'text-[#7a5c34]' },
    READY:       { label: 'Pronta',        dot: 'bg-[#60b0f0]',  text: 'text-[#1a5a8a]' },
    IN_PROGRESS: { label: 'Em andamento',  dot: 'bg-[#4caf7d]',  text: 'text-[#1a6040]' },
    COMPLETED:   { label: 'Concluída',     dot: 'bg-[#aaa]',     text: 'text-[#555]'    },
    CANCELLED:   { label: 'Cancelada',     dot: 'bg-[#e57373]',  text: 'text-[#8f2d22]' },
  };
  return configs[status] ?? configs.DRAFT;
}

function portalStatusConfig(status: string) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    PENDING:   { label: 'Pendente',  bg: 'bg-[#fff4de]', text: 'text-[#7a4f00]' },
    INVITED:   { label: 'Convidado', bg: 'bg-[#e8f2ff]', text: 'text-[#17406d]' },
    ACTIVE:    { label: 'Ativo',     bg: 'bg-[#ecf6ea]', text: 'text-[#1f6b46]' },
    SUSPENDED: { label: 'Suspenso',  bg: 'bg-[#fdecea]', text: 'text-[#7f2315]' },
  };
  return configs[status] ?? configs.PENDING;
}

// ─── Upload Form ───────────────────────────────────────────────────────────────

type UploadFormProps = {
  endpoint: string;
  passengerId: string;
  passengerName: string;
  defaultCategory?: string;
  entityOptions?: TripEntityOption[];
  onSuccess: (doc: DocumentItem) => void;
  onCancel: () => void;
};

function UploadForm({ endpoint, passengerId, passengerName, defaultCategory = 'other', entityOptions = [], onSuccess, onCancel }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ title: '', category: defaultCategory, linkedEntityId: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Selecione um arquivo.'); return; }
    setUploading(true); setError('');
    const linked = entityOptions.find(o => o.id === form.linkedEntityId);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || file.name,
          originalFilename: file.name,
          category: form.category,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
          passengerId,
          linkedEntityType: linked?.type,
          linkedEntityId: linked?.id,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.document) { setError(payload?.error || 'Erro ao preparar upload.'); return; }
      if (payload.uploadUrl) {
        const put = await fetch(payload.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
        if (!put.ok) { setError('Falha ao enviar arquivo.'); return; }
      }
      onSuccess(payload.document);
    } catch { setError('Erro de conexão.'); }
    finally { setUploading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528] border border-[#f1c4bc]">{error}</p>}

      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
          dragging ? 'border-[#1f6b46] bg-[#f0f9f4]' : file ? 'border-[#1f6b46] bg-[#f8fcf9]' : 'border-[#d9e2d5] bg-[#fbfcfa] hover:border-[#a8c4ac]'
        }`}
      >
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ecf6ea] text-[#1f6b46]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#142018]">{file.name}</p>
              <p className="text-xs text-[#7b857b]">{formatBytes(file.size)} · clique para trocar</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f0f0] text-[#7b857b]">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#38463a]">Arraste o arquivo ou clique para selecionar</p>
              <p className="mt-0.5 text-xs text-[#7b857b]">PDF, PNG, JPG, DOCX</p>
            </div>
          </>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Título <span className="font-normal normal-case tracking-normal">(opcional)</span></span>
          <input value={form.title} onChange={e => setForm(c => ({ ...c, title: e.target.value }))} placeholder="Ex: Boarding pass ida" className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10" />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Categoria</span>
          <select value={form.category} onChange={e => setForm(c => ({ ...c, category: e.target.value }))} className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10">
            {DOCUMENT_CATEGORY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>

        {entityOptions.length > 0 && (
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Vincular a item da viagem</span>
            <select value={form.linkedEntityId} onChange={e => setForm(c => ({ ...c, linkedEntityId: e.target.value }))} className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10">
              <option value="">Documento geral da viagem</option>
              {entityOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-50">
          {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? 'Enviando…' : 'Enviar documento'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-[#d9e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]">Cancelar</button>
      </div>
    </form>
  );
}

// ─── Document Row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onDelete }: { doc: DocumentItem; onDelete: (id: string) => void }) {
  const cat = DOC_CATEGORIES.find(c => c.key === doc.category) ?? DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#edf1ea] bg-white px-4 py-3 transition hover:border-[#d9e2d5]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bg} text-lg`}>{cat.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#142018]">{doc.title}</p>
        <p className="text-xs text-[#7b857b]">{doc.originalFilename} · {formatBytes(doc.fileSizeBytes)}</p>
        {doc.linkedEntityLabel && <p className="text-xs text-[#5b665d]">↳ {doc.linkedEntityLabel}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {doc.previewUrl && (
          <a href={doc.previewUrl} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7b857b] transition hover:bg-[#f0f0f0] hover:text-[#142018]" title="Preview">
            <Eye className="h-4 w-4" />
          </a>
        )}
        {doc.downloadUrl && (
          <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7b857b] transition hover:bg-[#f0f0f0] hover:text-[#142018]" title="Download">
            <Download className="h-4 w-4" />
          </a>
        )}
        <button type="button" onClick={() => onDelete(doc.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c8958a] transition hover:bg-[#fff3f0] hover:text-[#9b3528]" title="Excluir">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Personal Docs Section ─────────────────────────────────────────────────────

function PersonalDocsSection({ passengerId, passengerName }: { passengerId: string; passengerName: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/passengers/${passengerId}/documents`, { cache: 'no-store' });
      const payload = await res.json().catch(() => []);
      setDocs(Array.isArray(payload) ? payload : []);
    } finally { setLoading(false); }
  }, [passengerId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/passengers/${passengerId}/documents/${confirmDeleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs(c => c.filter(d => d.id !== confirmDeleteId));
        toastSuccess('Documento excluído.');
      } else {
        toastError('Erro ao excluir documento.');
      }
    } catch {
      toastError('Erro de conexão.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const personalCategories = DOC_CATEGORIES.filter(c => ['passport_copy', 'visa', 'other'].includes(c.key));
  const docToDelete = docs.find(d => d.id === confirmDeleteId);

  return (
    <>
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir documento"
        description={`Deseja excluir "${docToDelete?.title ?? 'este documento'}"? Esta ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <div className="rounded-[20px] border border-[#d9e2d5] bg-white">
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <h3 className="font-semibold text-[#142018]">Documentos pessoais</h3>
            <p className="mt-0.5 text-sm text-[#7b857b]">Passaporte, visto e outros documentos independentes de viagem</p>
          </div>
          <button onClick={() => setShowUpload(v => !v)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto border-t border-[#f0f2ee] px-5 py-3">
          {personalCategories.map(cat => {
            const count = docs.filter(d => d.category === cat.key).length;
            return (
              <div key={cat.key} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cat.bg} ${cat.text}`}>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {count > 0 && <span className="ml-0.5 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 p-5 pt-2">
          {showUpload && (
            <UploadForm
              endpoint={`/api/admin/passengers/${passengerId}/documents`}
              passengerId={passengerId}
              passengerName={passengerName}
              onSuccess={doc => {
                setDocs(c => [doc, ...c]);
                setShowUpload(false);
                toastSuccess('Documento enviado com sucesso.');
              }}
              onCancel={() => setShowUpload(false)}
            />
          )}

          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#f0f2ee]" />)}
            </div>
          ) : docs.length === 0 && !showUpload ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] py-8 text-center">
              <p className="text-sm text-[#7b857b]">Nenhum documento pessoal ainda</p>
              <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]">
                <Plus className="h-3.5 w-3.5" /> Adicionar primeiro
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => <DocRow key={doc.id} doc={doc} onDelete={setConfirmDeleteId} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Trip Docs Accordion ───────────────────────────────────────────────────────

function TripDocsAccordion({ trip, passengerId, passengerName }: { trip: TripData; passengerId: string; passengerName: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadDocs() {
    if (docs !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trips/${trip.tripId}/documents`, { cache: 'no-store' });
      const payload = await res.json().catch(() => []);
      setDocs(Array.isArray(payload) ? payload : []);
    } finally { setLoading(false); }
  }

  function toggle() { const n = !open; setOpen(n); if (n) loadDocs(); }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/trips/${trip.tripId}/documents/${confirmDeleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs(c => c ? c.filter(d => d.id !== confirmDeleteId) : c);
        toastSuccess('Documento excluído.');
      } else {
        toastError('Erro ao excluir documento.');
      }
    } catch {
      toastError('Erro de conexão.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  function openUpload(categoryKey: string) {
    setUploadCategory(categoryKey);
    setShowUpload(true);
    if (!open) { setOpen(true); loadDocs(); }
  }

  const cfg = tripStatusConfig(trip.status);
  const docCount = docs !== null ? docs.length : trip.documentCount;
  const docToDelete = (docs ?? []).find(d => d.id === confirmDeleteId);

  const categoryCounts = (docs ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  const tripCategories = DOC_CATEGORIES.filter(c => !['passport_copy', 'visa'].includes(c.key));

  return (
    <>
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir documento"
        description={`Deseja excluir "${docToDelete?.title ?? 'este documento'}"? Esta ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    <div className="overflow-hidden rounded-[20px] border border-[#d9e2d5] bg-white transition">
      {/* Header */}
      <button type="button" onClick={toggle} className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-[#fbfcfa]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ecf6ea] text-[#1f6b46]">
          <PlaneTakeoff className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#142018]">{trip.title}</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {trip.isLead && (
              <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#17406d]">Titular</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#7b857b]">
            {trip.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{trip.destination}</span>}
            <span className="flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />
              {format(new Date(trip.startDate), 'dd/MM/yyyy', { locale: ptBR })} – {format(new Date(trip.endDate), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <span>{docCount} doc{docCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-[#7b857b] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[#f0f2ee]">
          {/* Category quick-add tiles */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Adicionar por categoria</p>
            <div className="flex flex-wrap gap-2">
              {tripCategories.map(cat => {
                const count = categoryCounts[cat.key] ?? 0;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => openUpload(cat.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:shadow-sm ${cat.bg} ${cat.text} border-transparent hover:border-current/20`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    {count > 0 && <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>}
                    <Plus className="h-3 w-3 opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload form */}
          {showUpload && (
            <div className="border-t border-[#f0f2ee] px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#142018]">Novo documento</p>
                <Link href={`/dashboard/trips/${trip.tripId}/documents`} className="text-xs text-[#1f6b46] underline-offset-2 hover:underline">Hub completo →</Link>
              </div>
              <UploadForm
                endpoint={`/api/admin/trips/${trip.tripId}/documents`}
                passengerId={passengerId}
                passengerName={passengerName}
                defaultCategory={uploadCategory}
                entityOptions={trip.entityOptions}
                onSuccess={doc => {
                  setDocs(c => c ? [doc, ...c] : [doc]);
                  setShowUpload(false);
                  toastSuccess('Documento enviado com sucesso.');
                }}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          )}

          {/* Documents list */}
          <div className="px-5 pb-5">
            {loading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#f0f2ee]" />)}
              </div>
            ) : (docs ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] py-8 text-center text-sm text-[#7b857b]">
                Nenhum documento nesta viagem ainda
              </div>
            ) : (
              <div className="space-y-2">
                {(docs ?? []).map(doc => <DocRow key={doc.id} doc={doc} onDelete={setConfirmDeleteId} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

function DadosTab({ p }: { p: PassengerHubData }) {
  const portalCfg = portalStatusConfig(p.portalStatus);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Personal info */}
      <div className="space-y-4">
        <div className="rounded-[20px] border border-[#d9e2d5] bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Informações de contato</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecf6ea] text-[#1f6b46]"><Phone className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-[#7b857b]">WhatsApp</p>
                <p className="text-sm font-semibold text-[#142018]">{p.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecf6ea] text-[#1f6b46]"><Mail className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-[#7b857b]">E-mail</p>
                <p className="text-sm font-semibold text-[#142018]">{p.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecf6ea] text-[#1f6b46]"><FileText className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-[#7b857b]">Documento / Passaporte</p>
                <p className="text-sm font-semibold text-[#142018]">{p.passportNumber || '—'}</p>
              </div>
            </div>
            {p.dateOfBirth && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecf6ea] text-[#1f6b46]"><CalendarRange className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs text-[#7b857b]">Data de nascimento</p>
                  <p className="text-sm font-semibold text-[#142018]">{format(new Date(p.dateOfBirth), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#d9e2d5] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Status do portal</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${portalCfg.bg} ${portalCfg.text}`}>{portalCfg.label}</span>
          </div>
          {p.portalLink && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f6f7f2] p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b46]" />
              <p className="break-all text-xs text-[#5b665d]">{p.portalLink}</p>
            </div>
          )}
        </div>

        {p.notes && (
          <div className="rounded-[20px] border border-[#d9e2d5] bg-white p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Observações</p>
            <p className="text-sm leading-6 text-[#38463a]">{p.notes}</p>
          </div>
        )}
      </div>

      {/* Companions */}
      <div className="rounded-[20px] border border-[#d9e2d5] bg-white p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Companions · {p.companions.length}</p>
        {p.companions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] py-10 text-center text-sm text-[#7b857b]">Nenhum companion cadastrado</div>
        ) : (
          <div className="space-y-3">
            {p.companions.map(c => (
              <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-[#edf1ea] bg-[#fbfcfa] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff4de] text-[#8a5a00]">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#142018]">{c.name}</p>
                    {c.relationship && <span className="rounded-full bg-[#fff4de] px-2 py-0.5 text-[11px] font-semibold text-[#7a4f00]">{c.relationship}</span>}
                  </div>
                  {c.dateOfBirth && <p className="mt-1 text-xs text-[#7b857b]">{format(new Date(c.dateOfBirth), 'dd/MM/yyyy', { locale: ptBR })}</p>}
                  {c.notes && <p className="mt-1 text-sm text-[#5b665d]">{c.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ViagensTab({ p }: { p: PassengerHubData }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [persistedTripStatuses, setPersistedTripStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(p.trips.map((trip) => [trip.tripId, trip.status])),
  );
  const [tripStatuses, setTripStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(p.trips.map((trip) => [trip.tripId, trip.status])),
  );
  const [savingTripId, setSavingTripId] = useState<string | null>(null);
  const [openTripIds, setOpenTripIds] = useState<Record<string, boolean>>(
    () => Object.fromEntries(p.trips.map((trip, index) => [trip.tripId, index === 0])),
  );

  useEffect(() => {
    setPersistedTripStatuses(Object.fromEntries(p.trips.map((trip) => [trip.tripId, trip.status])));
    setTripStatuses(Object.fromEntries(p.trips.map((trip) => [trip.tripId, trip.status])));
  }, [p.trips]);

  useEffect(() => {
    setOpenTripIds((current) => {
      const next = { ...current };
      for (const trip of p.trips) {
        if (!(trip.tripId in next)) {
          next[trip.tripId] = false;
        }
      }
      return next;
    });
  }, [p.trips]);

  async function handleStatusSave(tripId: string) {
    const nextStatus = tripStatuses[tripId];
    const currentTrip = p.trips.find((trip) => trip.tripId === tripId);

    const persistedStatus = persistedTripStatuses[tripId] ?? currentTrip?.status;

    if (!currentTrip || !nextStatus || nextStatus === persistedStatus) {
      return;
    }

    setSavingTripId(tripId);
    try {
      const response = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        toastError('Nao foi possivel atualizar o status da viagem.');
        setTripStatuses((current) => ({ ...current, [tripId]: persistedStatus ?? currentTrip.status }));
        return;
      }

      setPersistedTripStatuses((current) => ({ ...current, [tripId]: nextStatus }));
      toastSuccess('Status da viagem atualizado.');
    } catch {
      toastError('Erro de conexao ao atualizar o status da viagem.');
      setTripStatuses((current) => ({ ...current, [tripId]: persistedStatus ?? currentTrip.status }));
    } finally {
      setSavingTripId(null);
    }
  }

  function toggleTrip(tripId: string) {
    setOpenTripIds((current) => ({ ...current, [tripId]: !current[tripId] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#7b857b]">{p.trips.length} jornada{p.trips.length !== 1 ? 's' : ''} vinculada{p.trips.length !== 1 ? 's' : ''}</p>
        <Link href={`/dashboard/trips/new?passengerId=${p.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27]">
          <Plus className="h-4 w-4" /> Nova jornada
        </Link>
      </div>

      {p.trips.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#d9e2d5] bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ecf6ea] text-[#1f6b46]"><PlaneTakeoff className="h-7 w-7" /></div>
          <p className="font-semibold text-[#38463a]">Nenhuma viagem ainda</p>
          <p className="mt-1 text-sm text-[#7b857b]">Crie a primeira jornada para este passageiro</p>
          <Link href={`/dashboard/trips/new?passengerId=${p.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27]">
            <Plus className="h-4 w-4" /> Criar jornada
          </Link>
        </div>
      ) : p.trips.map(trip => {
        const selectedStatus = tripStatuses[trip.tripId] ?? trip.status;
        const persistedStatus = persistedTripStatuses[trip.tripId] ?? trip.status;
        const cfg = tripStatusConfig(selectedStatus);
        const statusChanged = selectedStatus !== persistedStatus;
        const isSaving = savingTripId === trip.tripId;
        const isOpen = openTripIds[trip.tripId] ?? false;
        return (
          <div key={trip.tripPassengerId} className="rounded-[20px] border border-[#d9e2d5] bg-white p-5 transition hover:border-[#c6d7c4]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#142018]">{trip.title}</h3>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  {trip.isLead && <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#17406d]">Titular</span>}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[#5b665d]">
                  {trip.destination && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#1f6b46]" />{trip.destination}</span>}
                  <span className="flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5 text-[#1f6b46]" />
                    {format(new Date(trip.startDate), 'dd MMM yyyy', { locale: ptBR })} – {format(new Date(trip.endDate), 'dd MMM yyyy', { locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-[#7b857b]">{trip.documentCount} doc{trip.documentCount !== 1 ? 's' : ''} · {trip.entityOptions.length} item{trip.entityOptions.length !== 1 ? 'ns' : ''} operacional{trip.entityOptions.length !== 1 ? 'is' : ''}</p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7b857b]">Status da viagem</span>
                    <select
                      value={selectedStatus}
                      onChange={(event) => setTripStatuses((current) => ({ ...current, [trip.tripId]: event.target.value }))}
                      disabled={isSaving}
                      className="min-w-[180px] rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] outline-none focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10 disabled:opacity-60"
                    >
                      {TRIP_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleStatusSave(trip.tripId)}
                    disabled={!statusChanged || isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1f6b46] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Salvando...' : 'Atualizar status'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTrip(trip.tripId)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-xs font-semibold text-[#142018] transition hover:bg-[#f6f7f2]"
                  >
                    {isOpen ? 'Recolher jornada' : 'Abrir jornada'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <Link href={`/dashboard/trips/${trip.tripId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#ecf6ea] px-3 py-2 text-xs font-semibold text-[#1f6b46] transition hover:bg-[#ddf0e3]">
                    Tela completa <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="mt-5 space-y-6 border-t border-[#edf1ea] pt-5">
                <TripOperationsManager
                  tripId={trip.tripId}
                  passengers={trip.passengerOptions.map((option) => ({ id: option.value, name: option.label }))}
                  flights={trip.flights}
                  hotels={trip.hotels}
                  transports={trip.transports}
                  tours={trip.tours}
                  trains={trip.trains}
                  insurances={trip.insurances}
                  notes={trip.notes}
                />

                <TripDocumentsManager
                  tripId={trip.tripId}
                  initialDocuments={trip.documents.map((document) => ({
                    ...document,
                    extractedText: document.extractedText ?? null,
                    structuredMetadata: document.structuredMetadata ?? null,
                    description: document.description ?? null,
                    uploadedBy: document.uploadedBy ?? null,
                  }))}
                  passengerOptions={trip.passengerOptions}
                  entityOptions={trip.entityOptions.map((option) => ({ value: option.id, label: option.label, type: option.type }))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentosTab({ p }: { p: PassengerHubData }) {
  return (
    <div className="space-y-4">
      <PersonalDocsSection passengerId={p.id} passengerName={p.name} />
      <div className="rounded-[20px] border border-[#d9e2d5] bg-white p-5 text-sm text-[#5b665d]">
        Os documentos operacionais da viagem agora ficam dentro da aba de jornadas, junto com o restante da operação.
      </div>
    </div>
  );
}

function ConversasTab({ p }: { p: PassengerHubData }) {
  return (
    <div className="space-y-3">
      {p.conversations.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#d9e2d5] bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f4ff] text-[#4a6fa5]">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <p className="font-semibold text-[#38463a]">Nenhuma conversa ainda</p>
          <p className="mt-1 text-sm text-[#7b857b]">O histórico de atendimento aparecerá aqui</p>
        </div>
      ) : p.conversations.map(conv => (
        <div key={conv.id} className="rounded-[20px] border border-[#d9e2d5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${conv.status === 'OPEN' ? 'bg-[#fff4de] text-[#7a4f00]' : 'bg-[#f0f2ee] text-[#5b665d]'}`}>{conv.status}</span>
                {conv.phone && <span className="text-xs text-[#7b857b]">{conv.phone}</span>}
              </div>
              {conv.lastMessage && <p className="mt-2 text-sm text-[#38463a]">{conv.lastMessage}</p>}
            </div>
            {conv.lastMessageAt && (
              <p className="text-xs text-[#7b857b]">{format(new Date(conv.lastMessageAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function PassengerHub({ passenger: p }: { passenger: PassengerHubData }) {
  const [tab, setTab] = useState<Tab>('viagens');

  const tabCounts: Partial<Record<Tab, number>> = {
    viagens:    p.trips.length,
    documentos: p.personalDocumentCount,
    conversas:  p.conversations.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { key: 'viagens' as Tab,    icon: PlaneTakeoff,      label: 'Jornadas',   value: p.trips.length,         bg: 'bg-[#ecf6ea]', ico: 'text-[#1f6b46]' },
          { key: 'dados' as Tab,      icon: Users,             label: 'Companions', value: p.companions.length,    bg: 'bg-[#fff4de]', ico: 'text-[#8a5a00]' },
          { key: 'documentos' as Tab, icon: FileText,          label: 'Docs pessoais', value: p.personalDocumentCount, bg: 'bg-[#e8f2ff]', ico: 'text-[#17406d]' },
          { key: 'conversas' as Tab,  icon: MessageSquareText, label: 'Conversas',  value: p.conversations.length, bg: 'bg-[#fdecea]', ico: 'text-[#7f2315]' },
        ] as const).map(({ key, icon: Icon, label, value, bg, ico }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`group rounded-[20px] border bg-white p-4 text-left transition hover:shadow-md ${tab === key ? 'border-[#1f6b46] shadow-sm' : 'border-[#d9e2d5]'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${ico} transition group-hover:scale-105`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight text-[#142018]">{value}</p>
                <p className="text-xs text-[#7b857b]">{label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="border-b border-[#e8ece5]">
        <div className="flex gap-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative px-5 py-3.5 text-sm font-semibold transition-colors ${
                tab === key ? 'text-[#1f6b46]' : 'text-[#7b857b] hover:text-[#38463a]'
              }`}
            >
              <span className="flex items-center gap-2">
                {label}
                {tabCounts[key] !== undefined && tabCounts[key]! > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${tab === key ? 'bg-[#ecf6ea] text-[#1f6b46]' : 'bg-[#eef2ec] text-[#7b857b]'}`}>
                    {tabCounts[key]}
                  </span>
                )}
              </span>
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[#1f6b46]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'dados'      && <DadosTab p={p} />}
        {tab === 'viagens'    && <ViagensTab p={p} />}
        {tab === 'documentos' && <DocumentosTab p={p} />}
        {tab === 'conversas'  && <ConversasTab p={p} />}
      </div>
    </div>
  );
}
