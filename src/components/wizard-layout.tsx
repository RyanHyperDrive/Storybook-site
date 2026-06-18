import { Link, useLocation } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const STEPS = [
  { to: "/create/photos", label: "Photo" },
  { to: "/create/profile", label: "About child" },
  { to: "/create/story", label: "Story" },
  { to: "/create/avoid", label: "Avoid list" },
  { to: "/create/style", label: "Art style" },
  { to: "/create/character-sheet", label: "Character" },
] as const;

export function WizardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const idx = STEPS.findIndex((s) => pathname.startsWith(s.to));
  const isCheckout = pathname.startsWith("/checkout");
  const mobileLabel = idx >= 0
    ? `Step ${idx + 1} of ${STEPS.length} · ${STEPS[idx].label}`
    : isCheckout
      ? "Checkout"
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-testid="wizard-layout">
      {mobileLabel && (
        <div
          className="mb-4 rounded-md border border-border bg-paper/60 px-3 py-2 text-center text-sm font-semibold sm:hidden"
          data-testid="wizard-stepper-mobile"
        >
          {mobileLabel}
        </div>
      )}
      <ol className="mb-10 hidden grid-cols-6 gap-2 sm:grid" data-testid="wizard-stepper">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.to}>
              <Link
                to={s.to}
                className={[
                  "flex flex-col items-center gap-2 rounded-md border px-2 py-3 text-center text-xs transition-colors",
                  active
                    ? "border-ember bg-ember/10 text-foreground"
                    : done
                      ? "border-sage/40 bg-sage/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                <span className={[
                  "grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold",
                  active ? "border-ember bg-ember text-ember-foreground"
                    : done ? "border-sage bg-sage text-sage-foreground"
                    : "border-border bg-background"
                ].join(" ")}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span>{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {children}
    </div>
  );
}
