import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import { Gift, Mail, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/gift")({
  head: () => ({
    meta: [
      { title: "Give a storybook starring them — StoryNest Gifts" },
      {
        name: "description",
        content:
          "Gift a personalized illustrated storybook. You pay, the parent uploads the photo, the child gets the magic. Perfect for grandparents, aunts, uncles, and family friends.",
      },
      { property: "og:title", content: "Give a storybook starring them — StoryNest" },
      {
        property: "og:description",
        content:
          "Gift a personalized illustrated storybook. You pay, the parent uploads the photo, the child gets the magic.",
      },
    ],
  }),
  component: GiftPage,
});

const giftSchema = z.object({
  gifter_name: z.string().trim().min(1, "Your name is required").max(120),
  gifter_email: z.string().trim().email("Enter a valid email").max(320),
  parent_name: z.string().trim().min(1, "Parent's name is required").max(120),
  parent_email: z.string().trim().email("Enter a valid email").max(320),
  child_first_name: z.string().trim().min(1, "Child's name is required").max(60),
  child_age: z.coerce.number().int().min(4).max(7),
  dedication_message: z.string().max(200).optional(),
  hardcover_interest: z.boolean().optional(),
});

function GiftPage() {
  const [form, setForm] = useState({
    gifter_name: "",
    gifter_email: "",
    parent_name: "",
    parent_email: "",
    child_first_name: "",
    child_age: "5",
    dedication_message: "",
    hardcover_interest: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = giftSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gift-checkout", {
        body: { ...parsed.data, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) {
        // Real Stripe URL will redirect away; stub returns local success.
        if (data.stub) {
          setSuccess(true);
        } else {
          window.location.href = data.url;
        }
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-ember" />
        <h1 className="mt-4 font-display text-3xl font-semibold">Gift on its way</h1>
        <p className="mt-3 text-muted-foreground">
          We've emailed {form.parent_name || "the parent"} a private upload link with
          your dedication. You'll get a confirmation at {form.gifter_email}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          (Payments are stubbed in this preview — no card was charged.)
        </p>
        <Link to="/" className="mt-6">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section className="bg-paper/40 px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Gift className="h-3.5 w-3.5 text-ember" /> StoryNest Gifts
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Give a storybook <span className="text-ember">starring them.</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              The perfect gift for grandparents, aunts, uncles, and family friends.
              You pay. The parent uploads the photo. The child gets the magic.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xs">
            <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_30px_60px_-22px_oklch(0.22_0.03_260/0.55)]">
              <span aria-hidden className="absolute inset-y-0 left-0 z-20 w-[6px] bg-gradient-to-b from-foreground/30 via-foreground/10 to-foreground/30" />
              <div className="relative aspect-[3/4] w-full">
                <img
                  src={sampleWatercolor}
                  alt="Sample StoryNest gift book cover: The Tea Party with Pip"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-foreground/55 via-foreground/15 to-transparent px-5 pb-8 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-background/95">
                    A StoryNest Gift
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-foreground/85 via-foreground/55 to-transparent px-5 pb-5 pt-14">
                  <div className="font-display text-[1.55rem] font-semibold leading-[1.05] tracking-tight text-background drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-3xl">
                    The Tea Party<br />with Pip
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW GIFTING WORKS */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight">
            How gifting works
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Gift,
                title: "You pay",
                body: "$29.99 — or $49.99 hardcover when available.",
              },
              {
                icon: Mail,
                title: "We email the parent",
                body: "A private upload link, with your name on the dedication.",
              },
              {
                icon: Sparkles,
                title: "They approve, the book arrives",
                body: "They review the illustrated character, then download or read in the browser.",
              },
            ].map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-background p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-ember/15 text-ember">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </div>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GIFT FORM */}
      <section className="bg-paper/40 px-4 py-16">
        <div className="mx-auto max-w-[480px]">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight">
            Send the gift
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Takes about 90 seconds. We email the parent right after checkout.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="Your name" required>
              <Input
                value={form.gifter_name}
                onChange={(e) => setForm({ ...form, gifter_name: e.target.value })}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Your email" required>
              <Input
                type="email"
                value={form.gifter_email}
                onChange={(e) => setForm({ ...form, gifter_email: e.target.value })}
                maxLength={320}
                required
              />
            </Field>
            <Field label="Recipient parent's first name" required>
              <Input
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Recipient parent's email" required>
              <Input
                type="email"
                value={form.parent_email}
                onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
                maxLength={320}
                required
              />
            </Field>
            <Field label="Child's first name" required>
              <Input
                value={form.child_first_name}
                onChange={(e) =>
                  setForm({ ...form, child_first_name: e.target.value })
                }
                maxLength={60}
                required
              />
            </Field>
            <Field label="Child's age" required>
              <Select
                value={form.child_age}
                onValueChange={(v) => setForm({ ...form, child_age: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} years old</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Personal message for the dedication (optional)">
              <Textarea
                value={form.dedication_message}
                onChange={(e) =>
                  setForm({ ...form, dedication_message: e.target.value.slice(0, 200) })
                }
                maxLength={200}
                placeholder="From Grandma & Grandpa — with love"
                rows={3}
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {form.dedication_message.length}/200
              </div>
            </Field>

            <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
              <Checkbox
                checked={form.hardcover_interest}
                onCheckedChange={(v) =>
                  setForm({ ...form, hardcover_interest: Boolean(v) })
                }
              />
              <span>
                I'd prefer the hardcover version{" "}
                <span className="text-muted-foreground">(currently waitlist)</span>
              </span>
            </label>

            <Button
              type="submit"
              variant="ember"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                "Send the gift — $29.99"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Charged when the parent approves the character. Free until then.
            </p>
          </form>
        </div>
      </section>

      {/* GIFT FAQ */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight">
            Gift FAQ
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {[
              {
                q: "What happens if the parent never uploads a photo?",
                a: "They have 30 days. After that we'll refund you.",
              },
              {
                q: "Can I send it anonymously?",
                a: "No — the parent needs to know who it's from so they trust the email.",
              },
              {
                q: "When is the parent charged?",
                a: "Never. You are.",
              },
              {
                q: "Can I include a printed copy?",
                a: "Hardcover ships in 7–10 days when available — join the waitlist for early access pricing.",
              },
            ].map((item, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-ember">*</span>}
      </Label>
      {children}
    </div>
  );
}
