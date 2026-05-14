// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Resolve the calling user from the Authorization header. Returns both an
 * RLS-scoped client (acting AS the user) and a service-role admin client for
 * trusted writes. Throws a Response on auth failure.
 */
export async function requireUser(req: Request): Promise<{
  user: { id: string; email?: string };
  userClient: SupabaseClient;
  admin: SupabaseClient;
}> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user: { id: data.user.id, email: data.user.email ?? undefined }, userClient, admin };
}

/** Throw a 403 Response unless the row exists AND belongs to the user. */
export async function assertOwnership(
  admin: SupabaseClient,
  table: string,
  rowId: string,
  userId: string,
  userColumn = "user_id",
): Promise<any> {
  const { data, error } = await admin.from(table).select("*").eq("id", rowId).maybeSingle();
  if (error) {
    throw new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!data || data[userColumn] !== userId) {
    throw new Response(JSON.stringify({ error: "Not found or forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return data;
}
