import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

type AuthGateProps = {
  children: React.ReactNode;
  message?: string;
  title?: string;
  bullets?: string[];
};

export function AuthGate({ children, message, title, bullets }: AuthGateProps) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!user) return <SignInPanel message={message} title={title} bullets={bullets} />;
  return <>{children}</>;
}

export function SignInPanel({ message, title, bullets }: { message?: string; title?: string; bullets?: string[] }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "apple" | null>(null);
  const [sent, setSent] = useState(false);
  const { pathname } = useLocation();

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}${pathname}` : undefined,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Magic link sent — check your email.");
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't send the link");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setOauthBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri:
          typeof window !== "undefined" ? `${window.location.origin}${pathname}` : undefined,
      });
      if (result.error) throw result.error;
      // If redirected, the browser will navigate away. Otherwise session is set.
    } catch (err: any) {
      toast.error(err?.message ?? `Couldn't sign in with ${provider}`);
    } finally {
      setOauthBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">{title ?? "Sign in to continue"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? "Continue with Google, Apple, or email — no password needed."}
      </p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-md border border-border bg-paper/40 p-3 text-xs text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {sent ? (
        <div className="mt-6 rounded-md border border-border bg-paper/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Mail className="h-4 w-4 text-sage" /> Check {email}
          </div>
          <p className="mt-2 text-muted-foreground">
            Tap the link in the email to come back here and continue. You can close this tab.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              disabled={oauthBusy !== null}
              onClick={() => oauth("google")}
            >
              {oauthBusy === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleGlyph />
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              disabled={oauthBusy !== null}
              onClick={() => oauth("apple")}
            >
              {oauthBusy === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AppleGlyph />
              )}
              Continue with Apple
            </Button>
          </div>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={sendLink} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" variant="ember" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Email me a magic link
            </Button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link to="/terms" className="underline">Terms</Link> and{" "}
        <Link to="/privacy" className="underline">Privacy</Link>.
      </p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.46 2.27-1.21 3.07-.79.86-2.06 1.5-3.13 1.42-.13-1.13.42-2.32 1.18-3.13.85-.91 2.31-1.59 3.16-1.36zM20.5 17.16c-.55 1.27-.81 1.83-1.52 2.95-.99 1.55-2.39 3.49-4.13 3.5-1.55.02-1.95-1-4.05-.99-2.1.01-2.55 1.01-4.1.99-1.74-.01-3.07-1.76-4.06-3.32C-.04 16.7-.32 11.6 1.43 8.92c1.24-1.9 3.21-3.01 5.06-3.01 1.88 0 3.06.99 4.6.99 1.5 0 2.41-.99 4.59-.99 1.65 0 3.4.9 4.65 2.45-4.09 2.24-3.43 8.07-.83 8.8z"/>
    </svg>
  );
}
