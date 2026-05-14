import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export function AuthGate({ children, message }: { children: React.ReactNode; message?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!user) return <SignInPanel message={message} />;
  return <>{children}</>;
}

export function SignInPanel({ message }: { message?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Sign in to continue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? "We'll email you a one-tap magic link — no password needed."}
      </p>

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
        <form onSubmit={sendLink} className="mt-6 space-y-4">
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
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link to="/terms" className="underline">Terms</Link> and{" "}
        <Link to="/privacy" className="underline">Privacy</Link>.
      </p>
    </div>
  );
}
