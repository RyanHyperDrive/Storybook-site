import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2 } from "lucide-react";
import { z } from "zod";

type Source = "hardcover" | "gift_edition" | "exit_intent";

const schema = z.object({
  email: z.string().trim().email().max(320),
});

export function WaitlistModal({
  open,
  onOpenChange,
  source,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source: Source;
  title: string;
  description: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("submitting");
    const { error: insertError } = await supabase
      .from("waitlist_signups")
      .insert({ email: parsed.data.email, source });
    if (insertError) {
      setStatus("error");
      setError("Something went wrong. Please try again.");
      return;
    }
    setStatus("success");
  }

  function handleClose(v: boolean) {
    if (!v) {
      setEmail("");
      setStatus("idle");
      setError(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-sage/15 text-sage">
              <Check className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">You're on the list!</p>
            <p className="text-sm text-muted-foreground">
              We'll email you the moment it's available.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
              required
              maxLength={320}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              variant="ember"
              className="w-full"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…
                </>
              ) : (
                "Join the waitlist"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              We'll only email you about this. Unsubscribe anytime.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
