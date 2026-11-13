import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = clsx;

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const buttonClass = (variant: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition select-none",
    "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    variant === "primary" && "bg-primary text-primary-ink hover:brightness-110",
    variant === "secondary" && "bg-surface-2 text-text border border-border hover:border-primary/60",
    variant === "ghost" && "text-muted hover:text-text hover:bg-surface-2",
    variant === "danger" && "bg-bad text-white hover:brightness-110",
  );

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function Badge({ className, tone = "muted", ...props }: ComponentProps<"span"> & { tone?: "muted" | "good" | "bad" | "accent" | "primary" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "muted" && "bg-surface-2 text-muted",
        tone === "good" && "bg-good-soft text-good",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "primary" && "bg-primary/15 text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function ProgressBar({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "good" | "accent" }) {
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx("h-full rounded-full transition-all duration-500", tone === "primary" && "bg-primary", tone === "good" && "bg-good", tone === "accent" && "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-bad/40 bg-bad-soft px-4 py-3 text-sm text-bad">{children}</div>;
}
