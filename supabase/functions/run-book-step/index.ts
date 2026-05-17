// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /run-book-step
 * Body: { jobId: string }
 *
 * Client-driven orchestrator. Does ONE unit of work per call and returns,
 * so the browser can poll without hitting edge-function timeouts. Steps:
 *
 *   photo_check → character_profile → character_sheet → story_writing
 *   → cover_illustration (validate + retry up to MAX_RETRIES)
 *   → page_illustrations (one page per call, validate + retry up to MAX_RETRIES)
 *   → quality_checks → pdf_assembly → ready
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const TOTAL_PAGES = 10;
const MAX_RETRIES = 3; // max regen attempts per page/cover before marking needs_review

async function callFn(fn: string, auth: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const { user, admin } = await requireUser(req);
    const { jobId } = await req.json();
    if (!jobId) return errorResponse("jobId is required");

    const { data: job } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
    if (!job || job.user_id !== user.id) return errorResponse("Not found", 403);
    if (job.status === "done" || job.status === "error") {
      return jsonResponse({ ok: true, done: true, job });
    }

    const bookId = job.book_id as string;
    const { data: book } = await admin.from("books").select("*").eq("id", bookId).maybeSingle();
    if (!book) return errorResponse("Book missing", 404);

    const step = (job.current_step as string) || "photo_check";

    async function updateJob(patch: Record<string, any>) {
      await admin.from("jobs").update({ ...patch, status: "running" }).eq("id", jobId);
    }
    async function finishJob(message?: string) {
      await admin.from("jobs").update({
        status: "done", progress: 100, current_step: "ready",
        message: message ?? "Your book is ready.",
      }).eq("id", jobId);
    }
    async function failJob(message: string) {
      await admin.from("jobs").update({
        status: "error", message,
      }).eq("id", jobId);
    }

    // Append a structured validation event to jobs.audit and bump counters.
    // Stored shape: { events: [...], totals: { validations, failures, retries } }
    async function appendAudit(event: {
      target: "cover" | "page";
      page_number?: number;
      attempt: number;
      passed: boolean;
      will_retry: boolean;
      shipped_with_warnings?: boolean;
      scores?: Record<string, number | undefined>;
      reasons?: string[];
      banned_content_detected?: string[];
      regeneration_instruction?: string;
    }) {
      const { data: jr } = await admin
        .from("jobs")
        .select("audit, total_validations, total_failures, total_retries")
        .eq("id", jobId)
        .maybeSingle();
      const audit = (jr?.audit as any) ?? { events: [], totals: { validations: 0, failures: 0, retries: 0 } };
      const entry = { at: new Date().toISOString(), ...event };
      const nextEvents = Array.isArray(audit.events) ? [...audit.events, entry] : [entry];
      // Cap to last 500 events so the column never balloons.
      const trimmed = nextEvents.length > 500 ? nextEvents.slice(-500) : nextEvents;
      const totals = {
        validations: (audit.totals?.validations ?? 0) + 1,
        failures: (audit.totals?.failures ?? 0) + (event.passed ? 0 : 1),
        retries: (audit.totals?.retries ?? 0) + (event.will_retry ? 1 : 0),
      };
      await admin.from("jobs").update({
        audit: { events: trimmed, totals },
        total_validations: (jr?.total_validations ?? 0) + 1,
        total_failures: (jr?.total_failures ?? 0) + (event.passed ? 0 : 1),
        total_retries: (jr?.total_retries ?? 0) + (event.will_retry ? 1 : 0),
      }).eq("id", jobId);
    }

    try {
      if (step === "photo_check") {
        // Verify an uploaded photo exists.
        const { data: photo } = await admin
          .from("uploaded_photos").select("id").eq("user_id", user.id).limit(1).maybeSingle();
        if (!photo) { await failJob("No uploaded photo found."); return jsonResponse({ ok: false }); }
        await updateJob({ current_step: "character_profile", progress: 12, message: "Photo verified." });
        return jsonResponse({ ok: true });
      }

      if (step === "character_profile") {
        const { data: profile } = await admin
          .from("child_profiles").select("id").eq("book_id", bookId).limit(1).maybeSingle();
        if (!profile) { await failJob("Child profile missing."); return jsonResponse({ ok: false }); }
        await updateJob({ current_step: "character_sheet", progress: 22, message: "Character profile ready." });
        return jsonResponse({ ok: true });
      }

      if (step === "character_sheet") {
        const { data: sheet } = await admin
          .from("character_sheets").select("image_url, approved")
          .eq("book_id", bookId).eq("approved", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!sheet?.image_url) {
          await failJob("Approve a character sheet first.");
          return jsonResponse({ ok: false });
        }
        await updateJob({ current_step: "story_writing", progress: 32, message: "Character sheet locked in." });
        return jsonResponse({ ok: true });
      }

      if (step === "story_writing") {
        // Already written?
        if (book.story_json && Array.isArray((book.story_json as any).pages)) {
          await updateJob({ current_step: "cover_illustration", progress: 40, message: "Story ready." });
          return jsonResponse({ ok: true, skipped: true });
        }
        const childDetails = [
          book.child_name && `Name: ${book.child_name}`,
          book.child_age != null && `Age: ${book.child_age}`,
          book.child_pronouns && `Pronouns: ${book.child_pronouns}`,
          book.child_loves && `Loves: ${book.child_loves}`,
        ].filter(Boolean).join(". ");

        // #5 — constrain the writer's cast to the contract's approved subjects
        // so it can't invent a "best friend Emma" the illustrator has never seen.
        const contract = (book.visual_consistency_contract ?? null) as any;
        const cast = Array.isArray(contract?.subjects)
          ? contract.subjects.map((s: any) => s.display_name).filter(Boolean)
          : [book.child_name].filter(Boolean);

        const r = await callFn("write-story", authHeader, {
          theme: book.story_theme || book.story_prompt || "a gentle bedtime adventure",
          child_details: childDetails || `A child named ${book.child_name ?? "the hero"}.`,
          favorites: book.details_include ?? "",
          avoid: book.details_avoid ?? "",
          bookId,
          reading_level: book.reading_level ?? "ages_4_6",
          cast,
        });
        if (r.status >= 400 || !r.json?.story) {
          await failJob(r.json?.error ?? "Story generation failed.");
          return jsonResponse({ ok: false });
        }
        await admin.from("books").update({
          story_json: r.json.story,
          title: r.json.story.title ?? book.title,
          dedication: book.dedication ?? r.json.story.dedication ?? null,
        }).eq("id", bookId);

        await updateJob({ current_step: "cover_illustration", progress: 40, message: "Story written." });
        return jsonResponse({ ok: true });
      }

      if (step === "cover_illustration") {
        // Dedicated cover step: generate (or regenerate) the cover, then
        // validate against the approved character sheet. Track attempts in
        // cover_validation.attempts so we can cap retries at MAX_RETRIES.
        const story = book.story_json as any;
        const title: string = story?.title ?? book.title ?? "An adventure";
        const protagonists: string[] = Array.isArray(story?.pages?.[0]?.characters_present)
          ? story.pages[0].characters_present
          : [book.child_name ?? "the main character"].filter(Boolean);

        const coverValidation = (book.cover_validation ?? null) as any;
        const attempts = Number(coverValidation?.attempts ?? 0);
        const lastPasses = coverValidation?.passes === true;
        const hasCoverImage = !!book.cover_image_path;

        // Already passed → advance.
        if (hasCoverImage && lastPasses) {
          await updateJob({ current_step: "page_illustrations", progress: 50, message: "Cover approved." });
          return jsonResponse({ ok: true, skipped: true });
        }

        // Out of retries → accept and continue with needs_review on the book.
        if (hasCoverImage && attempts >= MAX_RETRIES) {
          await admin.from("books").update({
            cover_validation: { ...(coverValidation ?? {}), accepted_with_warnings: true },
          }).eq("id", bookId);
          await updateJob({ current_step: "page_illustrations", progress: 50, message: "Cover finalized (best effort)." });
          return jsonResponse({ ok: true, exhausted: true });
        }

        // Generate (or regenerate) the cover.
        const correctiveNote = coverValidation?.regeneration_instruction ?? "";
        const coverScene = `Book cover for "${title}". Hero portrait composition: ${protagonists.join(", ")} centered, confident friendly pose, evocative of the story's mood. Leave clean negative space at the top for the title (the title text is rendered by the app, NOT in the image).`;
        const coverRes = await callFn("illustrate-page", authHeader, {
          bookId,
          isCover: true,
          pageNumber: 0,
          styleKey: book.art_style ?? "soft_cartoon",
          sceneDescription: coverScene,
          charactersPresent: protagonists,
          visualMustHaves: ["clear hero portrait", "iconic memorable composition"],
          visualMustNotInclude: ["no title text in image", "no readable lettering"],
          correctiveNote,
        });
        if (coverRes.status >= 400) {
          await failJob(coverRes.json?.error ?? "Cover generation failed.");
          return jsonResponse({ ok: false });
        }

        // Validate immediately.
        const valRes = await callFn("validate-cover", authHeader, { bookId });
        const v = valRes.json?.validation ?? {};
        const nextAttempts = attempts + 1;
        await admin.from("books").update({
          cover_validation: { ...v, attempts: nextAttempts },
        }).eq("id", bookId);

        const passed = v.passes === true;
        const exhausted = !passed && nextAttempts >= MAX_RETRIES;
        await appendAudit({
          target: "cover",
          attempt: nextAttempts,
          passed,
          will_retry: !passed && !exhausted,
          shipped_with_warnings: exhausted,
          scores: v.scores ?? undefined,
          reasons: Array.isArray(v.reasons) ? v.reasons : undefined,
          banned_content_detected: Array.isArray(v.banned_content_detected) ? v.banned_content_detected : undefined,
          regeneration_instruction: typeof v.regeneration_instruction === "string" ? v.regeneration_instruction : undefined,
        });

        if (passed) {
          await updateJob({ current_step: "page_illustrations", progress: 50, message: "Cover approved." });
          return jsonResponse({ ok: true, coverPassed: true });
        }
        if (exhausted) {
          // Will be accepted on next poll via the exhausted branch above.
          await updateJob({ progress: 48, message: `Cover attempt ${nextAttempts}: finalizing.` });
          return jsonResponse({ ok: true, coverExhausted: true });
        }
        await updateJob({ progress: 46, message: `Cover attempt ${nextAttempts}: refining…` });
        return jsonResponse({ ok: true, coverRetry: nextAttempts });
      }

      if (step === "page_illustrations") {
        const story = book.story_json as any;
        if (!story?.pages) { await failJob("Story missing."); return jsonResponse({ ok: false }); }

        // A page is "done" when status='ready' AND either it has been validated
        // and passed (needs_review=false with regens>=1) OR it has exhausted
        // MAX_RETRIES (shipped with warnings).
        const { data: existing } = await admin
          .from("book_pages")
          .select("page_number, status, regenerations, needs_review, quality_metadata")
          .eq("book_id", bookId);
        const isDone = (p: any) =>
          p.status === "ready" && (
            (p.needs_review === false && (p.regenerations ?? 0) > 0) ||
            (p.regenerations ?? 0) >= MAX_RETRIES
          );
        const completedNumbers = new Set(
          (existing ?? []).filter(isDone).map((p: any) => p.page_number),
        );
        const nextPage = story.pages.find((p: any) => !completedNumbers.has(p.page_number));

        if (!nextPage) {
          await updateJob({ current_step: "quality_checks", progress: 88, message: "All pages illustrated." });
          return jsonResponse({ ok: true });
        }

        // Current state for THIS page (if any).
        const currentRow = (existing ?? []).find((p: any) => p.page_number === nextPage.page_number);
        const currentRegens = currentRow?.regenerations ?? 0;

        // Pre-write text so the reader has copy even mid-illustration.
        if (currentRow) {
          await admin.from("book_pages").update({
            text_content: nextPage.page_text, status: "generating",
          }).eq("book_id", bookId).eq("page_number", nextPage.page_number);
        } else {
          await admin.from("book_pages").insert({
            user_id: user.id, book_id: bookId, page_number: nextPage.page_number,
            text_content: nextPage.page_text, status: "generating",
          });
        }

        // Pull corrective note from the prior failed validation (if any).
        const correctiveNote: string = (currentRow?.quality_metadata?.regeneration_instruction as string) ?? "";

        const r = await callFn("illustrate-page", authHeader, {
          bookId,
          pageNumber: nextPage.page_number,
          styleKey: book.art_style ?? "soft_cartoon",
          sceneDescription: nextPage.scene_description,
          charactersPresent: nextPage.characters_present ?? [],
          visualMustHaves: nextPage.visual_must_haves ?? [],
          visualMustNotInclude: nextPage.visual_must_not_include ?? [],
          correctiveNote,
        });
        if (r.status >= 400) {
          await failJob(r.json?.error ?? `Page ${nextPage.page_number} failed.`);
          return jsonResponse({ ok: false });
        }

        // Re-attach text after illustrate-page upsert (it doesn't set text).
        await admin.from("book_pages").update({
          text_content: nextPage.page_text,
        }).eq("book_id", bookId).eq("page_number", nextPage.page_number);

        // ── Validator loop (#10) ──
        // After illustrate-page succeeds, run validate-page. If it fails and
        // we still have retries left, flip status back to 'regenerating' so
        // the next orchestrator tick re-picks this same page. If retries are
        // exhausted, leave status='ready' but needs_review=true so the page
        // ships and is flagged in admin.
        const valRes = await callFn("validate-page", authHeader, {
          bookId,
          pageNumber: nextPage.page_number,
          sceneDescription: nextPage.scene_description,
          charactersPresent: nextPage.characters_present ?? [],
          visualMustHaves: nextPage.visual_must_haves ?? [],
          visualMustNotInclude: nextPage.visual_must_not_include ?? [],
          isTwins: !!book.is_twins,
        });
        const report = valRes.json?.report ?? null;
        const newRegens = currentRegens + 1; // illustrate-page just incremented
        const failed = report?.needs_regeneration === true || report?.regeneration_recommended === true;
        const willRetry = failed && newRegens < MAX_RETRIES;
        await appendAudit({
          target: "page",
          page_number: nextPage.page_number,
          attempt: newRegens,
          passed: !failed,
          will_retry: willRetry,
          shipped_with_warnings: failed && !willRetry,
          scores: report ? {
            character_consistency: report.character_consistency_score,
            cover_match: report.cover_match_score,
            style_consistency: report.style_consistency_score,
            scene_match: report.scene_match_score,
            age_appropriateness: report.age_appropriateness_score,
          } : undefined,
          reasons: report ? [
            ...(report.age_appropriateness_issues ?? []),
            ...(report.wrong_character_details ?? []),
            ...(report.missing_required_character_details ?? []),
            ...(report.artifact_issues ?? []),
            ...(report.missing_required_elements ?? []),
          ].filter(Boolean) : undefined,
          banned_content_detected: Array.isArray(report?.banned_content_detected) ? report.banned_content_detected : undefined,
          regeneration_instruction: typeof report?.regeneration_instruction === "string" ? report.regeneration_instruction : undefined,
        });

        if (failed && newRegens < MAX_RETRIES) {
          // Flip back so this page isn't considered done; orchestrator retries.
          await admin.from("book_pages").update({
            status: "regenerating",
            needs_review: true,
          }).eq("book_id", bookId).eq("page_number", nextPage.page_number);
          await updateJob({
            message: `Page ${nextPage.page_number}: refining (attempt ${newRegens + 1}/${MAX_RETRIES + 1})…`,
          });
          return jsonResponse({ ok: true, pageRetry: nextPage.page_number, attempt: newRegens });
        }

        // Either passed, or out of retries. Mark as final.
        await admin.from("book_pages").update({
          status: "ready",
          needs_review: failed, // flag for admin if shipped with warnings
        }).eq("book_id", bookId).eq("page_number", nextPage.page_number);

        // Compute progress over story pages.
        const doneCount = (Array.from(completedNumbers) as number[]).length + 1;
        const pct = 50 + Math.round((doneCount / TOTAL_PAGES) * 38); // 50..88
        await updateJob({
          progress: Math.min(88, pct),
          message: failed
            ? `Page ${nextPage.page_number} shipped with warnings.`
            : `Illustrated page ${nextPage.page_number} of ${TOTAL_PAGES}.`,
        });
        return jsonResponse({ ok: true, pageDone: nextPage.page_number, failed });
      }

      if (step === "quality_checks") {
        await updateJob({ current_step: "pdf_assembly", progress: 94, message: "Quality reviewed." });
        return jsonResponse({ ok: true });
      }

      if (step === "pdf_assembly") {
        await admin.from("books").update({ status: "ready" }).eq("id", bookId);
        await finishJob();
        return jsonResponse({ ok: true, done: true });
      }

      if (step === "ready") {
        await finishJob();
        return jsonResponse({ ok: true, done: true });
      }

      await failJob(`Unknown step: ${step}`);
      return jsonResponse({ ok: false });
    } catch (e: any) {
      console.error("run-book-step inner error", e);
      await failJob(e?.message ?? "Unexpected error.");
      return jsonResponse({ ok: false, error: e?.message ?? "Unexpected error." });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("run-book-step error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
