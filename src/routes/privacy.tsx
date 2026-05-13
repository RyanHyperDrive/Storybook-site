import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({ meta: [{ title: "Privacy — StoryNest" }, { name: "description", content: "How StoryNest handles your photos and data." }] }),
});

function Privacy() {
  return (
    <article className="prose prose-sm mx-auto max-w-3xl px-4 py-16 text-foreground">
      <h1 className="font-display text-4xl font-semibold">Privacy</h1>
      <p className="mt-3 text-muted-foreground">Last updated May 13, 2026</p>

      <h2 className="mt-8 font-display text-xl font-semibold">Photos & children's data</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Photos uploaded to StoryNest are private to your account and used only to design the illustrated character
        for the storybook you're creating. We never sell your photos and never use them to train models.
      </p>

      <h2 className="mt-6 font-display text-xl font-semibold">What we store</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
        <li>Account email for sign-in</li>
        <li>The book details you provide (name, age, prompt)</li>
        <li>Generated story text and illustrations</li>
        <li>Reference photos you upload (encrypted, account-private)</li>
      </ul>

      <h2 className="mt-6 font-display text-xl font-semibold">Deleting your data</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You can delete any book or photo from your library at any time. Email us to delete your account entirely.
      </p>
    </article>
  );
}
