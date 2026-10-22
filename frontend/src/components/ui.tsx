import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Loader2, X } from 'lucide-react';

/* ── Buttons ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[3px] px-4',
        'font-condensed text-[13px] font-bold tracking-[0.08em] uppercase transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-race text-white hover:bg-race-deep',
        variant === 'secondary' &&
          'border border-seam-strong bg-paper text-ink hover:border-ink-3 hover:bg-ground',
        variant === 'ghost' && 'text-ink-2 hover:bg-ink/5 hover:text-ink',
        variant === 'danger' && 'border border-crit/40 bg-paper text-crit hover:bg-crit-tint',
        className,
      )}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ── Form fields ─────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="font-condensed mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-2 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-9 w-full rounded-[3px] border border-seam-strong bg-paper px-3 text-sm text-ink',
        'placeholder:text-ink-3 hover:border-ink-3 focus:border-race focus:outline-none',
        rest.type === 'number' && 'font-mono tnum text-[13px]',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'h-9 w-full cursor-pointer appearance-none rounded-[3px] border border-seam-strong bg-paper px-3 pr-8 text-sm',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%234a4e58%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[position:right_10px_center] bg-no-repeat',
        'hover:border-ink-3 focus:border-race focus:outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ── Panel: hairline-seam surface (no shadows) ───────────────────────── */

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('border border-seam bg-paper', className)}>{children}</div>;
}

/* ── Dialog ──────────────────────────────────────────────────────────── */

export function Dialog({
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx('settle relative w-full border border-seam-strong bg-paper', wide ? 'max-w-2xl' : 'max-w-md')}
      >
        <div className="flex items-center justify-between border-b border-seam px-5 py-3">
          <h2 className="font-condensed text-sm font-bold tracking-[0.1em] uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Empty / loading states ──────────────────────────────────────────── */

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 border border-dashed border-seam-strong px-6 py-14 text-center">
      <p className="font-condensed text-sm font-bold tracking-[0.08em] text-ink-2 uppercase">{title}</p>
      {detail && <p className="max-w-sm text-sm text-ink-3">{detail}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-3">
      <Loader2 size={16} className="animate-spin" />
      <span className="font-condensed text-xs font-bold tracking-[0.12em] uppercase">{label}…</span>
    </div>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────── */

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'settle pointer-events-auto border px-4 py-2.5 text-sm',
              t.kind === 'error'
                ? 'border-crit/40 bg-crit-tint text-crit'
                : 'border-ok/40 bg-ok-tint text-ok',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Confirm button (two-step inline, no native confirm) ─────────────── */

export function ConfirmButton({
  label,
  confirmLabel = 'Sure?',
  onConfirm,
  variant = 'danger',
  busy,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: ButtonVariant;
  busy?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant={armed ? 'danger' : variant}
      busy={busy}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────── */

export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-seam">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx(
            'font-condensed -mb-px cursor-pointer border-b-2 px-3.5 pt-2 pb-2 text-[13px] font-bold tracking-[0.08em] uppercase transition-colors',
            value === it.value
              ? 'border-race text-ink'
              : 'border-transparent text-ink-3 hover:text-ink-2',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
