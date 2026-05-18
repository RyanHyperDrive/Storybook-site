import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  startBookFromSavedCharacter,
  type SavedCharacter,
} from "@/lib/saved-characters";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { getArtStyle } from "@/lib/art-styles";

type Props = {
  /** Where to send the parent after a saved character is selected. */
  redirectTo?: "/create/style" | "/create/story";
  /** Show a delete button on each card (e.g. on the Account page). */
  allowDelete?: boolean;
  /** Compact heading-less variant. */
  compact?: boolean;
};

export function SavedCharactersPicker({
  redirectTo = "/create/style",
  allowDelete = false,
  compact = false,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedCharacter[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_characters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as SavedCharacter[];
    setItems(rows);

    const urls: Record<string, string> = {};
    await Promise.all(
      rows.map(async (r) => {
        if (!r.character_image_path) return;
        if (/^https?:\/\//i.test(r.character_image_path)) {
          urls[r.id] = r.character_image_path;
          return;
        }
        const { data: s } = await supabase.storage
          .from("character-sheets")
          .createSignedUrl(r.character_image_path, 600);
        if (s?.signedUrl) urls[r.id] = s.signedUrl;
      }),
    );
    setSigned(urls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function onPick(saved: SavedCharacter) {
    if (!user) return;
    setBusy(saved.id);
    try {
      await startBookFromSavedCharacter(user.id, saved);
      toast.success(`Starting a new book with ${saved.name}`);
      navigate({ to: redirectTo });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start a new book";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(saved: SavedCharacter) {
    if (!confirm(`Remove ${saved.name} from your saved characters?`)) return;
    const { error } = await supabase
      .from("saved_characters")
      .delete()
      .eq("id", saved.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  if (!user) return null;
  if (loading) {
    return (
      <div className="grid min-h-[80px] place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className={compact ? "" : "rounded-lg border border-border bg-paper/40 p-5"}>
      {!compact && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Start with a saved character
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reuse a child you've already approved — skip the photo + character
              steps and jump straight to a new story or art style.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-2.5 py-1 text-[11px] font-medium text-ember">
            <Sparkles className="h-3 w-3" /> Saved
          </span>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const style = s.art_style ? getArtStyle(s.art_style) : null;
          return (
            <li
              key={s.id}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/5] bg-muted">
                {signed[s.id] ? (
                  <img
                    src={signed[s.id]}
                    alt={`Saved character — ${s.name}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <UserRound className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-display text-base font-semibold">
                    {s.name}
                  </div>
                  {s.age != null && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {s.age} yrs
                    </span>
                  )}
                </div>
                {style && (
                  <div className="text-[11px] text-muted-foreground">
                    Last style: <span className="font-medium text-foreground">{style.name}</span>
                  </div>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ember"
                    onClick={() => onPick(s)}
                    disabled={busy === s.id}
                    className="flex-1"
                  >
                    {busy === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                    New book
                  </Button>
                  {allowDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(s)}
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
