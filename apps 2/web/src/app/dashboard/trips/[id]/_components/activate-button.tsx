'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

type Props = {
  tripId: string;
  isActive: boolean;
};

export function ActivateButton({ tripId, isActive }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    if (isActive) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast({ title: 'Viagem ativada para WhatsApp', variant: 'success' });
      router.refresh();
    } catch {
      toast({ title: 'Erro ao ativar viagem', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (isActive) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-2xl bg-[#ecf6ea] px-4 py-3 text-sm font-semibold text-[#1f6b46] opacity-90 cursor-default"
      >
        Viagem ativa ✓
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-60"
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      Ativar para WhatsApp
    </button>
  );
}
