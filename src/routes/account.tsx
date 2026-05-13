import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGate, SignInPanel } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { clearDraftId } from "@/lib/draft";

export const Route = createFileRoute("/account")({
  component: AccountRoute,
  head: () => ({ meta: [{ title: "Account — StoryNest" }] }),
});

function AccountRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <SignInPanel />;
  return <AuthGate><Inner /></AuthGate>;
}

function Inner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <div className="mt-6 rounded-md border border-border bg-background p-4">
        <div className="text-xs uppercase text-muted-foreground">Signed in as</div>
        <div className="mt-1 text-sm font-medium">{user?.email}</div>
      </div>
      <Button variant="outline" className="mt-6"
        onClick={async () => { await supabase.auth.signOut(); clearDraftId(); navigate({ to: "/" }); }}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
