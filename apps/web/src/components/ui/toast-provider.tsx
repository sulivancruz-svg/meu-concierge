'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (opts: { variant?: ToastVariant; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const variantConfig = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-[#ecf6ea]',
    border: 'border-[#c4ddc4]',
    iconColor: 'text-[#1f6b46]',
    titleColor: 'text-[#142018]',
  },
  error: {
    icon: XCircle,
    bg: 'bg-[#fff3f0]',
    border: 'border-[#f1c4bc]',
    iconColor: 'text-[#9b3528]',
    titleColor: 'text-[#142018]',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-[#d9e2d5]',
    iconColor: 'text-[#1f6b46]',
    titleColor: 'text-[#142018]',
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback(({ variant = 'info', title, description }: { variant?: ToastVariant; title: string; description?: string }) => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev, { id, variant, title, description }]);
  }, []);

  const success = useCallback((title: string, description?: string) => toast({ variant: 'success', title, description }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ variant: 'error', title, description }), [toast]);
  const info = useCallback((title: string, description?: string) => toast({ variant: 'info', title, description }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((t) => {
          const cfg = variantConfig[t.variant];
          const Icon = cfg.icon;
          return (
            <RadixToast.Root
              key={t.id}
              onOpenChange={(open) => {
                if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }}
              defaultOpen
              className={`group pointer-events-auto flex items-start gap-3 rounded-[20px] border p-4 shadow-[0_16px_48px_rgba(16,24,40,0.12)] transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-right-full data-[swipe=move]:translate-x-[--radix-toast-swipe-move-x] data-[swipe=end]:translate-x-[--radix-toast-swipe-end-x] ${cfg.bg} ${cfg.border}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} />
              <div className="flex-1">
                <RadixToast.Title className={`text-sm font-semibold ${cfg.titleColor}`}>
                  {t.title}
                </RadixToast.Title>
                {t.description && (
                  <RadixToast.Description className="mt-1 text-xs text-[#5b665d]">
                    {t.description}
                  </RadixToast.Description>
                )}
              </div>
              <RadixToast.Close className="ml-1 rounded-lg p-1 text-[#7b857b] opacity-0 transition hover:bg-black/5 hover:text-[#142018] group-hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport className="fixed bottom-6 right-6 z-[9999] flex w-[360px] max-w-[calc(100vw-3rem)] flex-col gap-3 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
