import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Terms — StoryNest" }, { name: "description", content: "StoryNest terms of service." }] }),
});

function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold">Terms of service</h1>
      <p className="mt-3 text-muted-foreground">Last updated May 13, 2026</p>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">
        <p>By using StoryNest you agree to use the service for personal, non-commercial purposes
          and to upload only photos you have the right to use.</p>
        <p>StoryNest grants you a personal license to print, share, and read the resulting storybooks
          with your family. Reselling generated content is not permitted.</p>
        <p>Refunds are handled case by case — see our pricing page for our promise.</p>
      </div>
    </article>
  );
}
