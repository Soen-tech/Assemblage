import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function deletePromoCodeHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const { error } = await db.from('promo_codes').delete().eq('id', id);
    if (error) throw error;
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[delete-promo-code] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
