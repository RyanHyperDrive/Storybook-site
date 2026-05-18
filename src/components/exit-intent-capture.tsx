import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "exit_intent_shown";
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const CTA_CLICKED_KEY = "primary_cta_clicked";
const INACTIVITY_MS = 90_000;
const MOBILE_DELAY_MS = 30_000;
const MOBILE_SCROLL_THRESHOLD = 0.6;

const CTA_PHRASES = [
  "start free character preview",
  "see your child as a storybook hero",
  "start free preview",
  "start free",
];

const emailSchema = z.string().trim().email().max(320);

function alreadyShown(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function ctaClickedThisSession(): boolean {
  try {
    return sessionStorage.getItem(CTA_CLICKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function ExitIntentCapture() {
  const [open, setOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (alreadyShown()) return;

    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);

    // Track primary CTA clicks anywhere on the page.
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest("a, button");
      if (!el) return;
      const text = (el.textContent || "").trim().toLowerCase();
      if (CTA_PHRASES.some((p) => text.includes(p))) {
        try {
          sessionStorage.setItem(CTA_CLICKED_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("click", onClickCapture, true);

    const trigger = () => {
      if (triggered.current) return;
      if (alreadyShown() || ctaClickedThisSession()) return;
      triggered.current = true;
      markShown();
      if (mobile) setStickyVisible(true);
      else setOpen(true);
    };

    let inactivityTimer: number | undefined;
    const resetInactivity = () => {
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(trigger, INACTIVITY_MS);
    };
    resetInactivity();
    window.addEventListener("scroll", resetInactivity, { passive: true });
    window.addEventListener("click", resetInactivity);
    window.addEventListener("keydown", resetInactivity);

    let mobileTimer: number | undefined;
    let onMobileScroll: (() => void) | undefined;
    if (!mobile) {
      const onMouseOut = (e: MouseEvent) => {
        if (e.relatedTarget) return;
        if (e.clientY <= 0) trigger();
      };
      document.addEventListener("mouseout", onMouseOut);
      return () => {
        document.removeEventListener("mouseout", onMouseOut);
        document.removeEventListener("click", onClickCapture, true);
        window.removeEventListener("scroll", resetInactivity);
        window.removeEventListener("click", resetInactivity);
        window.removeEventListener("keydown", resetInactivity);
        if (inactivityTimer) window.clearTimeout(inactivityTimer);
      };
    } else {
      mobileTimer = window.setTimeout(trigger, MOBILE_DELAY_MS);
      onMobileScroll = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        if (window.scrollY / max >= MOBILE_SCROLL_THRESHOLD) trigger();
      };
      window.addEventListener("scroll", onMobileScroll, { passive: true });
      return () => {
        document.removeEventListener("click", onClickCapture, true);
        window.removeEventListener("scroll", resetInactivity);
        window.removeEventListener("click", resetInactivity);
        window.removeEventListener("keydown", resetInactivity);
        if (inactivityTimer) window.clearTimeout(inactivityTimer);
        if (mobileTimer) window.clearTimeout(mobileTimer);
        if (onMobileScroll) window.removeEventListener("scroll", onMobileScroll);
      };
    }
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[480px] rounded-2xl border-border bg-paper p-0 sm:rounded-2xl"
        >
          <CaptureForm onClose={() => setOpen(false)} compact={false} />
        </DialogContent>
      </Dialog>

      {stickyVisible && isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-paper p-4 shadow-2xl md:hidden">
          <CaptureForm onClose={() => setStickyVisible(false)} compact />
        </div>
      )}
    </>
  );
}

function CaptureForm({
  onClose,
  compact,
}: {
  onClose: () => void;
  compact: boolean;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setSubmitting(true);
    try {
      const { error: invokeErr } = await supabase.functions.invoke("capture-email", {
        body: { email: parsed.data, source: "exit_intent" },
      });
      if (invokeErr) throw invokeErr;
      setDone(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Something went wrong. Try again?");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={compact ? "relative pr-8" : "relative p-8 pr-10"}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className={compact ? "flex items-center gap-3" : "text-center"}>
          <CheckCircle2 className={compact ? "h-5 w-5 text-ember" : "mx-auto h-10 w-10 text-ember"} />
          <div>
            <p className={compact ? "text-sm font-medium" : "mt-3 font-display text-xl font-semibold"}>
              On its way.
            </p>
            <p className={compact ? "text-xs text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>
              Check your inbox in about a minute.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-0 top-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8">
          <p className="font-display text-base font-semibold">See a sample first.</p>
          <p className="text-xs text-muted-foreground">
            Free 3-page preview by email. No signup.
          </p>
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-9 flex-1"
              required
            />
            <Button type="submit" variant="ember" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </form>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-8">
      <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
        Wait — see a sample first.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Get a free 3-page sample book preview by email. No signup required.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button type="submit" variant="ember" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
          ) : (
            "Send me the sample"
          )}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        One sample, one optional launch email. Unsubscribe anytime. We never share your address.
      </p>
    </div>
  );
}
