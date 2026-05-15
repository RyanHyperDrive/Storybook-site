/**
 * Deterministic fixture data for the /create wizard visual regression.
 *
 * Used by `scripts/visual-regression-create-journey.mjs` to seed
 * localStorage and to mock Supabase REST + Storage responses so every
 * screenshot is byte-stable across runs.
 *
 * Nothing in here should be derived from Date.now(), Math.random(),
 * crypto.randomUUID(), or any environment-dependent value.
 */

export const SUPABASE_PROJECT_REF = "pllzhwnvfpyahlwiypwk";
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
export const SUPABASE_AUTH_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

// Fixed clock — every render uses this exact moment.
export const FIXED_NOW_MS = Date.UTC(2026, 4, 15, 12, 0, 0); // 2026-05-15T12:00:00Z
export const FIXED_NOW_ISO = new Date(FIXED_NOW_MS).toISOString();

export const FIXTURE_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "fixture.parent@storynest.test",
  email_confirmed_at: FIXED_NOW_ISO,
  phone: "",
  confirmed_at: FIXED_NOW_ISO,
  last_sign_in_at: FIXED_NOW_ISO,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Fixture Parent" },
  identities: [],
  created_at: FIXED_NOW_ISO,
  updated_at: FIXED_NOW_ISO,
};

export const FIXTURE_DRAFT_BOOK_ID = "00000000-0000-4000-8000-000000000010";
export const FIXTURE_CHILD_PROFILE_ID = "00000000-0000-4000-8000-000000000020";
export const FIXTURE_PHOTO_ID = "00000000-0000-4000-8000-000000000030";
export const FIXTURE_CHILD_SUBJECT_ID = "00000000-0000-4000-8000-000000000040";

// 1×1 transparent PNG used for any signed image URL the wizard requests.
// Keeps the rendered <img> deterministic regardless of network/CDN state.
export const PLACEHOLDER_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

// A larger deterministic placeholder (256×256 sage square, baked at build time)
// for the character-sheet preview, so the panel is non-blank but stable.
export const PLACEHOLDER_CHARACTER_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
      `<rect width="256" height="256" fill="#cfd9c5"/>` +
      `<circle cx="128" cy="104" r="44" fill="#8aa37a"/>` +
      `<rect x="64" y="156" width="128" height="68" rx="12" fill="#8aa37a"/>` +
      `<text x="128" y="240" text-anchor="middle" font-family="serif" font-size="14" fill="#3a4a36">Fixture character</text>` +
      `</svg>`,
  );

// Profile draft seeded into localStorage so /create/profile hydrates
// the same way every run.
export const FIXTURE_PROFILE_DRAFT = {
  isTwins: false,
  children: [
    {
      name: "Pip",
      age: "5",
      pronouns: "she/her",
      favorite_color: "marigold orange",
      favorite_activities: "splashing in puddles, drawing dragons, baking with grandma",
      loves: "wisteria trees, foxes, the smell of rain",
      personality_traits: "curious, gentle, a little shy at first",
      accessibility_details: "",
    },
    {
      name: "",
      age: "",
      pronouns: "",
      favorite_color: "",
      favorite_activities: "",
      loves: "",
      personality_traits: "",
      accessibility_details: "",
    },
  ],
};

// Book row returned by GET /rest/v1/books?id=eq.<draft>
export const FIXTURE_BOOK_ROW = {
  id: FIXTURE_DRAFT_BOOK_ID,
  user_id: FIXTURE_USER.id,
  status: "draft",
  is_twins: false,
  title: "Pip and the Wisteria Tea Party",
  story_theme: "Magical forest",
  story_prompt:
    "Pip discovers a tiny tea party under the wisteria tree and learns a quiet kind of bravery.",
  details_include: "Grandma Rose, a small red kettle, four porcelain cups",
  details_avoid: "no thunderstorms, no scary monsters",
  dedication: "For Pip, our brave little explorer. Love, Mum & Dad.",
  reading_level: "ages_4_6",
  art_style: "watercolor_storybook",
  guardian_consent_at: FIXED_NOW_ISO,
  cover_url: null,
  created_at: FIXED_NOW_ISO,
  updated_at: FIXED_NOW_ISO,
};

export const FIXTURE_CHILD_PROFILE_ROW = {
  id: FIXTURE_CHILD_PROFILE_ID,
  book_id: FIXTURE_DRAFT_BOOK_ID,
  user_id: FIXTURE_USER.id,
  name: "Pip",
  slot: "primary",
  age: 5,
  pronouns: "she/her",
  favorite_color: "marigold orange",
  favorite_activities: "splashing in puddles, drawing dragons, baking with grandma",
  loves: "wisteria trees, foxes, the smell of rain",
  personality_traits: "curious, gentle, a little shy at first",
  accessibility_details: null,
  created_at: FIXED_NOW_ISO,
};

export const FIXTURE_UPLOADED_PHOTO_ROW = {
  id: FIXTURE_PHOTO_ID,
  user_id: FIXTURE_USER.id,
  book_id: FIXTURE_DRAFT_BOOK_ID,
  child_profile_id: FIXTURE_CHILD_PROFILE_ID,
  slot: "primary",
  storage_bucket: "raw-uploads",
  storage_path: `${FIXTURE_USER.id}/${FIXTURE_DRAFT_BOOK_ID}/primary-fixture.jpg`,
  mime_type: "image/jpeg",
  size_bytes: 204800,
  status: "accepted",
  created_at: FIXED_NOW_ISO,
};

export const FIXTURE_CHILD_SUBJECT_ROW = {
  id: FIXTURE_CHILD_SUBJECT_ID,
  user_id: FIXTURE_USER.id,
  child_profile_id: FIXTURE_CHILD_PROFILE_ID,
  description: "Pip — 5 years old, marigold orange dungarees, gentle curious smile.",
  reference_storage_path: FIXTURE_UPLOADED_PHOTO_ROW.storage_path,
  character_image_url: PLACEHOLDER_CHARACTER_DATA_URL,
  status: "ready",
  error_message: null,
  approved: false,
  regenerations: 0,
  created_at: FIXED_NOW_ISO,
};

// Fake Supabase auth session — written into localStorage under
// `sb-<ref>-auth-token` so `supabase.auth.getSession()` returns this user
// without any network call.
export function fixtureAuthSession() {
  // Far-future expiry so the client never tries to refresh.
  const expiresAt = Math.floor(FIXED_NOW_MS / 1000) + 60 * 60 * 24 * 365;
  return {
    access_token: "fixture-access-token",
    refresh_token: "fixture-refresh-token",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expiresAt,
    user: FIXTURE_USER,
  };
}

// Map of REST table name → list of rows the mock should return for any GET.
export const FIXTURE_TABLES = {
  books: [FIXTURE_BOOK_ROW],
  child_profiles: [FIXTURE_CHILD_PROFILE_ROW],
  uploaded_photos: [FIXTURE_UPLOADED_PHOTO_ROW],
  child_subjects: [FIXTURE_CHILD_SUBJECT_ROW],
};
