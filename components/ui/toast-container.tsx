'use client';

import { useToast } from '@/lib/context/toast-context';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          {/* Icon */}
          {toast.type === 'success' && (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          )}

          {/* Message */}
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50 flex-1">
            {toast.message}
          </p>

          {/* Close button */}
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
