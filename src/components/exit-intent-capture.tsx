import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { X, Loader2, CheckCircle2, AlertTriangle, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "exit_intent_shown";
const FAILURE_KEY = "exit_intent_capture_failure";
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

type CaptureErrorState = {
  message: string;
  referenceId: string;
  details: string;
};

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

function hasSessionFailureBackoff(): boolean {
  try {
    return Boolean(sessionStorage.getItem(FAILURE_KEY));
  } catch {
    return false;
  }
}

function rememberSessionFailure(error: CaptureErrorState) {
  try {
    sessionStorage.setItem(
      FAILURE_KEY,
      JSON.stringify({
        failedAt: Date.now(),
        referenceId: error.referenceId,
        message: error.message,
      }),
    );
  } catch {
    /* ignore */
  }
}

function clearSessionFailureBackoff() {
  try {
    sessionStorage.removeItem(FAILURE_KEY);
  } catch {
    /* ignore */
  }
}

function isCaptureError(error: CaptureErrorState | string | null): error is CaptureErrorState {
  return typeof error === "object" && error !== null;
}

function makeSupportReference() {
  return `EXIT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
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
    if (alreadyShown() || hasSessionFailureBackoff()) return;

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
      if (alreadyShown() || hasSessionFailureBackoff() || ctaClickedThisSession()) return;
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
        <DialogContent className="max-w-[480px] rounded-2xl border-border bg-paper p-0 sm:rounded-2xl">
          <DialogTitle className="sr-only">Wait — see a sample first.</DialogTitle>
          <DialogDescription className="sr-only">
            Get a free 3-page sample book preview by email. No signup required.
          </DialogDescription>
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

function getSupportHref(error: CaptureErrorState | null, email: string) {
  const subject = encodeURIComponent(
    `Exit-intent capture error ${error?.referenceId ?? ""}`.trim(),
  );
  const body = encodeURIComponent(
    [
      "Hi Storynest support,",
      "",
      "The sample email form failed for me.",
      `Support reference: ${error?.referenceId ?? "unknown"}`,
      email ? `Email entered: ${email}` : null,
      "",
      "Captured details:",
      error?.details ?? "No diagnostics captured.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return `mailto:hello@storynest.app?subject=${subject}&body=${body}`;
}

function summarizeUnknownError(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

async function captureExitIntentEmail(email: string): Promise<void> {
  const referenceId = makeSupportReference();
  const page = typeof window !== "undefined" ? window.location.pathname : "/";
  let sessionSummary = "not checked";

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) sessionSummary = `session check failed: ${error.message}`;
    else sessionSummary = data.session ? "active session present" : "no active session";
  } catch (sessionErr) {
    sessionSummary = `session check threw: ${summarizeUnknownError(sessionErr)}`;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    throw {
      message: "Email capture is missing its public backend configuration.",
      referenceId,
      details: [
        `Reference: ${referenceId}`,
        `Session: ${sessionSummary}`,
        `Backend URL present: ${Boolean(supabaseUrl)}`,
        `Public key present: ${Boolean(publishableKey)}`,
      ].join("\n"),
    } satisfies CaptureErrorState;
  }

  let endpoint: string;
  try {
    endpoint = new URL("/functions/v1/capture-email", supabaseUrl).toString();
  } catch (urlErr) {
    throw {
      message: "Email capture could not build a valid backend URL.",
      referenceId,
      details: [
        `Reference: ${referenceId}`,
        `Session: ${sessionSummary}`,
        `URL error: ${summarizeUnknownError(urlErr)}`,
      ].join("\n"),
    } satisfies CaptureErrorState;
  }

  const payload = {
    email,
    source: "exit_intent",
    page,
    referenceId,
    diagnostics: { session: sessionSummary },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "x-client-info": "storynest-exit-intent",
        "x-exit-intent-reference": referenceId,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: { ok?: boolean; error?: string; requestId?: string } | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok || !body?.ok) {
      const cloudRequestId = response.headers.get("sb-request-id");
      const executionId = response.headers.get("x-deno-execution-id");
      throw {
        message: body?.error || `Email capture failed with ${response.status}`,
        referenceId: body?.requestId || referenceId,
        details: [
          `Reference: ${body?.requestId || referenceId}`,
          `Session: ${sessionSummary}`,
          `Endpoint: /functions/v1/capture-email`,
          `Headers sent: content-type, apikey, authorization=publishable, x-client-info, x-exit-intent-reference`,
          `Payload sent: source=exit_intent, page=${page}, email=provided`,
          `Response: ${response.status} ${response.statusText}`,
          `Cloud request: ${cloudRequestId ?? "not returned"}`,
          `Execution: ${executionId ?? "not returned"}`,
          `Body: ${(text || "empty").slice(0, 500)}`,
        ].join("\n"),
      } satisfies CaptureErrorState;
    }
  } catch (err) {
    if (typeof err === "object" && err && "referenceId" in err && "details" in err) {
      throw err;
    }
    throw {
      message: "Email capture request could not reach the backend.",
      referenceId,
      details: [
        `Reference: ${referenceId}`,
        `Session: ${sessionSummary}`,
        `Endpoint: /functions/v1/capture-email`,
        `Headers intended: content-type, apikey, authorization=publishable, x-client-info, x-exit-intent-reference`,
        `Payload intended: source=exit_intent, page=${page}, email=provided`,
        `Network error: ${summarizeUnknownError(err)}`,
      ].join("\n"),
    } satisfies CaptureErrorState;
  }
}

function CaptureForm({ onClose, compact }: { onClose: () => void; compact: boolean }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<CaptureErrorState | string | null>(null);

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
      await captureExitIntentEmail(parsed.data);
      clearSessionFailureBackoff();
      setDone(true);
    } catch (err: unknown) {
      const diagnosticError =
        typeof err === "object" && err && "referenceId" in err && "details" in err
          ? (err as CaptureErrorState)
          : {
              message: err instanceof Error ? err.message : "Something went wrong. Try again?",
              referenceId: makeSupportReference(),
              details: summarizeUnknownError(err),
            };
      console.error("Exit-intent capture failed", diagnosticError);
      rememberSessionFailure(diagnosticError);
      setError(diagnosticError);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={compact ? "relative pr-8" : "relative p-8"}>
        {compact && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className={compact ? "flex items-center gap-3" : "text-center"}>
          <CheckCircle2
            className={compact ? "h-5 w-5 text-ember" : "mx-auto h-10 w-10 text-ember"}
          />
          <div>
            <p
              className={
                compact ? "text-sm font-medium" : "mt-3 font-display text-xl font-semibold"
              }
            >
              On its way.
            </p>
            <p
              className={
                compact ? "text-xs text-muted-foreground" : "mt-1 text-sm text-muted-foreground"
              }
            >
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
          <p className="text-xs text-muted-foreground">Free 3-page preview by email. No signup.</p>
          <form onSubmit={submit} className="mt-2 space-y-2">
            <div className="flex gap-2">
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
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <div className="min-w-0 flex-1">
                    <p>{isCaptureError(error) ? error.message : error}</p>
                    {isCaptureError(error) && (
                      <p className="mt-1 text-muted-foreground">Ref: {error.referenceId}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={submitting}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
                  </Button>
                  {isCaptureError(error) && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={getSupportHref(error, email)}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" /> Contact support
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
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
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send me the sample"
          )}
        </Button>
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <div className="min-w-0 flex-1">
                <p>{isCaptureError(error) ? error.message : error}</p>
                {isCaptureError(error) && (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Support reference ID: {error.referenceId}
                    </p>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Captured error details</summary>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-[11px]">
                        {error.details}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="submit" size="sm" variant="outline" disabled={submitting}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
              </Button>
              {isCaptureError(error) && (
                <Button asChild size="sm" variant="ghost">
                  <a href={getSupportHref(error, email)}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Contact support
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        One sample, one optional launch email. Unsubscribe anytime. We never share your address.
      </p>
    </div>
  );
}
