"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-surface-0/60 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className="relative w-full max-w-md rounded-xl border border-border-default bg-surface-1 p-6 shadow-2xl animate-fade-in-up space-y-4"
      >
        <div className="space-y-2">
          <h2 id="confirm-modal-title" className="text-base font-semibold text-text-primary">{title}</h2>
          <p id="confirm-modal-desc" className="text-sm text-text-tertiary leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-border-default bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-surface-3 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 active:scale-[0.97] ${
              variant === "danger"
                ? "bg-danger hover:brightness-110 focus-visible:ring-danger/50"
                : "bg-accent hover:bg-accent-hover focus-visible:ring-accent/50"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
