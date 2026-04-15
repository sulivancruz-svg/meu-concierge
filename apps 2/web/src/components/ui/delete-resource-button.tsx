'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast-provider';

type DeleteResourceButtonProps = {
  endpoint: string;
  redirectTo: string;
  dialogTitle: string;
  dialogDescription: string;
  idleLabel: string;
  pendingLabel?: string;
  successMessage: string;
  errorMessage: string;
  className?: string;
};

export function DeleteResourceButton({
  endpoint,
  redirectTo,
  dialogTitle,
  dialogDescription,
  idleLabel,
  pendingLabel = 'Excluindo...',
  successMessage,
  errorMessage,
  className,
}: DeleteResourceButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('DELETE_FAILED');
      }

      toast({ title: successMessage, variant: 'success' });
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast({ title: errorMessage, variant: 'error' });
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className={className ?? 'inline-flex items-center gap-2 rounded-2xl border border-[#efc8c1] bg-[#fff5f3] px-4 py-3 text-sm font-semibold text-[#9b3528] transition hover:bg-[#ffecea] disabled:opacity-60'}
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {loading ? pendingLabel : idleLabel}
      </button>

      <ConfirmDialog
        open={open}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel="Excluir"
        loading={loading}
        onCancel={() => {
          if (!loading) {
            setOpen(false);
          }
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
