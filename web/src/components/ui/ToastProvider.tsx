"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";

type Toast = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = { showToast: (message: string, variant?: ToastVariant) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 0;

/** Non-blocking success/error feedback (00_MASTER_SPEC.md § 9.11 Notifications). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-lg backdrop-blur-sm ${
              toast.variant === "success"
                ? "border-success/25 bg-success/10 text-success"
                : "border-danger/25 bg-danger/10 text-danger"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
