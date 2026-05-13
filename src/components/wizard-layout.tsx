import { Link, useLocation } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const STEPS = [
  { to: "/create/profile", label: "Profile" },
  { to: "/create/photos", label: "Photos" },
  { to: "/create/story", label: "Story" },
  { to: "/create/style", label: "Style" },
  { to: "/create/character-sheet", label: "Character" },
] as const;

export function WizardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const idx = STEPS.findIndex((s) => pathname.startsWith(s.to));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ol className="mb-10 grid grid-cols-5 gap-2">
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
                <span className="hidden sm:block">{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {children}
    </div>
  );
}
