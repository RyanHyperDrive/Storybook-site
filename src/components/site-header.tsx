import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Menu, X } from "lucide-react";

const navLinks = [
  { to: "/create" as const, label: "Create" },
  { to: "/examples" as const, label: "Examples" },
  { to: "/gift" as const, label: "Gifts" },
  { to: "/pricing" as const, label: "Pricing" },
  { to: "/library" as const, label: "Library" },
];

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight sm:text-xl">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper">
            <BookOpen className="h-4 w-4" />
          </span>
          StoryNest
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground bg-muted" }}
              activeOptions={{ exact: false }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {email ? (
            <Link to="/account">
              <Button variant="outline" size="sm">{email.split("@")[0]}</Button>
            </Link>
          ) : (
            <Link to="/account">
              <Button variant="outline" size="sm">Sign in</Button>
            </Link>
          )}
          <Link to="/create">
            <Button size="sm" variant="ember">Start free preview</Button>
          </Link>
        </div>

        {/* Mobile cluster: compact CTA + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <Link to="/create">
            <Button size="sm" variant="ember">Start free</Button>
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-border p-2"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link to="/account" className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              {email ? "Account" : "Sign in"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
