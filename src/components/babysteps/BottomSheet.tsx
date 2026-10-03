import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function BottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-overlay animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-3xl bg-popover p-5 pb-8 text-popover-foreground shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ChoiceButton({
  children, onClick, active, className = "",
}: { children: ReactNode; onClick: () => void; active?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`tap flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-base font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}
