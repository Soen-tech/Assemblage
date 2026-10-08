import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function getPromoCodesHandler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  let supabaseUrl = rawUrl;
  if (supabaseUrl && typeof supabaseUrl === "string") {
    supabaseUrl = supabaseUrl.trim()
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/auth\/v1\/?$/, "")
      .replace(/\/$/, "");
  }

  const db = supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project-id")
    ? createClient(supabaseUrl, supabaseKey)
    : null;

  if (!db) {
    return res.status(500).json({ error: "Database not configured on server" });
  }

  try {
    const { data, error } = await db.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data });
  } catch (error: any) {
    console.error("[get-promo-codes] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
