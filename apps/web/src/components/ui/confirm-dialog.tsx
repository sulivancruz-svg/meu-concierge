'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, LoaderCircle } from 'lucide-react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#d9e2d5] bg-white p-6 shadow-[0_32px_80px_rgba(16,24,40,0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3f0]">
              <AlertTriangle className="h-6 w-6 text-[#9b3528]" />
            </div>
            <Dialog.Title className="text-base font-semibold text-[#142018]">{title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-[#5b665d]">{description}</Dialog.Description>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-2xl border border-[#d9e2d5] bg-white py-2.5 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#9b3528] py-2.5 text-sm font-semibold text-white transition hover:bg-[#7f2315] disabled:opacity-50"
            >
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
