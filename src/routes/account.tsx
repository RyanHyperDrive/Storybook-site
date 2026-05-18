import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGate, SignInPanel } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { clearDraftId } from "@/lib/draft";
import { SavedCharactersPicker } from "@/components/saved-characters-picker";

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
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <div className="mt-6 rounded-md border border-border bg-background p-4">
        <div className="text-xs uppercase text-muted-foreground">Signed in as</div>
        <div className="mt-1 text-sm font-medium">{user?.email}</div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold">Saved characters</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Children you've approved before. Start a new book and we'll skip
          straight to the story and art style.
        </p>
        <div className="mt-4">
          <SavedCharactersPicker redirectTo="/create/style" allowDelete compact />
        </div>
      </div>

      <Button variant="outline" className="mt-10"
        onClick={async () => { await supabase.auth.signOut(); clearDraftId(); navigate({ to: "/" }); }}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
