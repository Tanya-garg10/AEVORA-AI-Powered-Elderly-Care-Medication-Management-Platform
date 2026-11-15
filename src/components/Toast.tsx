import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (title: string, options?: { description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, options?: { description?: string; variant?: ToastVariant }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const variant = options?.variant ?? 'success';
      setToasts((prev) => [...prev.slice(-3), { id, title, description: options?.description, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isErr = t.variant === 'error';
          const isInfo = t.variant === 'info';
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-2xl border p-4 shadow-lg flex items-start gap-3 transition-all ${
                isErr
                  ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                  : isInfo
                  ? 'bg-white border-[#142B3B]/15 text-[#142B3B]'
                  : 'bg-[#142B3B] border-[#167C80] text-white'
              }`}
            >
              {isErr ? (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#B42318]" />
              ) : isInfo ? (
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-[#167C80]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#D9F0E8]" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-sm">{t.title}</div>
                {t.description && (
                  <div className={`text-xs mt-0.5 ${isErr ? 'text-[#B42318]/90' : isInfo ? 'text-[#74818B]' : 'text-white/80'}`}>
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
