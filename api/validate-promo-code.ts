import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validatePromoCodeLogic } from "./promo-validate";

export default async function validatePromoCodeHandler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const { code, orderTotal, promo } = req.body || {};
    const totalNum = typeof orderTotal === "number" ? orderTotal : parseFloat(String(orderTotal || 0)) || 0;

    const result = await validatePromoCodeLogic(db, code, totalNum, promo);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[validate-promo-code] Error:", error);
    return res.status(500).json({ valid: false, error: error.message || "Internal server error" });
  }
}
