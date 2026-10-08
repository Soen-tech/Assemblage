import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

function computeDiscount(promo: any, orderTotal: number): number {
  const discountVal = parseFloat(String(promo.discount_value)) || 0;
  if (promo.discount_type === "percent") {
    return orderTotal * (discountVal / 100);
  }
  return Math.min(orderTotal, discountVal);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function validatePromoCodeLogic(db: any, code: string, orderTotal: number, promoDataInBody?: any) {
  if (!code || typeof orderTotal !== "number") {
    return { valid: false, error: "Missing code or orderTotal" };
  }

  const cleanCode = code.trim().toUpperCase();
  let promo: any = null;

  if (db) {
    try {
      const { data, error } = await db
        .from("promo_codes")
        .select("*")
        .eq("code", cleanCode)
        .maybeSingle();

      if (!error && data) {
        promo = data;
      }
    } catch (e) {
      console.warn("[validatePromoCodeLogic] DB query failed, trying fallbacks:", e);
    }
  }

  // Fallback to promoDataInBody if code matches
  if (!promo && promoDataInBody && promoDataInBody.code && promoDataInBody.code.trim().toUpperCase() === cleanCode) {
    promo = promoDataInBody;
  }

  // Fallback standard demo promo codes
  if (!promo) {
    if (cleanCode === 'SAVE10') {
      promo = { id: 9991, code: 'SAVE10', discount_type: 'percent', discount_value: 10, min_order_amount: 0, active: true };
    } else if (cleanCode === 'SAVE20') {
      promo = { id: 9992, code: 'SAVE20', discount_type: 'percent', discount_value: 20, min_order_amount: 0, active: true };
    } else if (cleanCode === 'WELCOME50' || cleanCode === 'PROOF50') {
      promo = { id: 9993, code: cleanCode, discount_type: 'fixed', discount_value: 50, min_order_amount: 100, active: true };
    } else if (cleanCode === 'CLUB100') {
      promo = { id: 9994, code: 'CLUB100', discount_type: 'fixed', discount_value: 100, min_order_amount: 200, active: true };
    }
  }

  if (!promo) {
    return { valid: false, error: "Promo code not found" };
  }

  if (!promo.active) {
    return { valid: false, error: "Promo code is inactive" };
  }

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: "Promo code has expired" };
  }

  if (promo.max_uses !== null && promo.max_uses !== undefined && promo.times_used >= promo.max_uses) {
    return { valid: false, error: "Promo code usage limit reached" };
  }

  const minOrder = parseFloat(String(promo.min_order_amount || 0)) || 0;
  if (orderTotal < minOrder) {
    return {
      valid: false,
      error: `Order must be at least R${minOrder.toFixed(2)} to use this code`,
    };
  }

  const discountApplied = round2(computeDiscount(promo, orderTotal));
  const discountedTotal = round2(Math.max(0, orderTotal - discountApplied));

  return {
    valid: true,
    discountApplied,
    discountedTotal,
    promo,
    data: promo,
  };
}

export default async function promoValidateHandler(req: VercelRequest, res: VercelResponse) {
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
    console.error("[promo-validate] Error:", error);
    return res.status(500).json({ valid: false, error: error.message || "Internal server error" });
  }
}
