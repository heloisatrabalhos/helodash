/**
 * Kit de UI enxuto — estilizado nos tokens do design system (index.css).
 * Sem biblioteca de componentes: 9 peças cobrem o app inteiro.
 */
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from "react";
import { Loader2, X } from "lucide-react";

/* ---------------------------------------------------------------- Button */

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";

const btnBase =
  "press inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] text-sm font-medium " +
  "min-h-[44px] px-4 transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";

const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
  ghost: "text-foreground hover:bg-accent/60",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  return (
    <button
      className={`${btnBase} ${btnVariants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="lucide h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ Form field */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const controlBase =
  "w-full min-h-[44px] rounded-[var(--r-control)] border border-input bg-card px-3.5 text-base " +
  "text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 " +
  "focus:ring-ring/60 focus:border-ring transition-shadow";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlBase} min-h-[80px] py-2.5 ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlBase} appearance-none ${className}`} {...props}>
      {children}
    </select>
  );
}

/* ----------------------------------------------------------------- Card */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`mat-card rounded-[var(--r-card)] p-4 sm:p-5 ${className}`}>{children}</div>
  );
}

/* ---------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="mat-scrim absolute inset-0 will-fade animate-materialize" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`mat-sheet relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-[var(--r-window)] sm:rounded-[var(--r-window)] ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        } animate-fade-in-up`}
      >
        <div className="scroll-edge flex items-center justify-between px-5 pb-3 pt-4">
          <h2 className="vibrant text-lg">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent/60"
          >
            <X className="lucide h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-1">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Badge */

export function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "gold";
  children: ReactNode;
}) {
  const tones = {
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    danger: "bg-cost-light text-cost",
    neutral: "bg-muted text-muted-foreground",
    gold: "bg-gold/15 text-gold",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[var(--r-chip)] px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------- Estados de tela */

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <div className="text-muted-foreground/50">{icon}</div>
      <p className="font-medium text-muted-foreground">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="lucide h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ErroCarga({ msg }: { msg?: string }) {
  return (
    <div className="rounded-[var(--r-card)] bg-cost-light p-4 text-sm text-cost">
      Não foi possível carregar. {msg ?? "Verifique a conexão e tente de novo."}
    </div>
  );
}
