import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Menu, X } from "lucide-react";

const links = [
  { to: "/create", label: "Create" },
  { to: "/", label: "Examples", hash: "examples" },
  { to: "/pricing", label: "Pricing" },
  { to: "/library", label: "Library" },
];

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper">
            <BookOpen className="h-4 w-4" />
          </span>
          StoryNest
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to as any}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground bg-muted" }}
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
            <Button size="sm" variant="ember">Create a book</Button>
          </Link>
        </div>

        <button
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden rounded-md border border-border p-2"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to as any}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link to="/account" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm">
              {email ? "Account" : "Sign in"}
            </Link>
            <Link to="/create" onClick={() => setOpen(false)}>
              <Button className="w-full" variant="ember">Create a book</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
