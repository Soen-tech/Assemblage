import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validatePromoCodeLogic } from "./promo-validate";

export default async function checkoutHandler(req: VercelRequest, res: VercelResponse) {
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
    const { code, promo: promoInBody, orderTotal, orderId, userId, item, itemType, quantity, userEmail, clubMerchantId } = req.body || {};
    const totalNum = typeof orderTotal === "number" ? orderTotal : parseFloat(String(orderTotal || 0)) || 0;

    let finalAmount = totalNum;
    let promo: any = null;
    let discountApplied = 0;

    if (code && typeof code === "string" && code.trim()) {
      const promoResult = await validatePromoCodeLogic(db, code, totalNum, promoInBody);
      if (promoResult.valid) {
        finalAmount = promoResult.discountedTotal;
        discountApplied = promoResult.discountApplied;
        promo = promoResult.promo;
      } else {
        return res.status(400).json({ success: false, error: promoResult.error });
      }
    }

    const merchant_id = process.env.VITE_PAYFAST_MERCHANT_ID || process.env.PAYFAST_MERCHANT_ID || "10000100";
    const merchant_key = process.env.VITE_PAYFAST_MERCHANT_KEY || process.env.PAYFAST_MERCHANT_KEY || "46f09dbf5c057";
    const generatedOrderId = orderId || `TX-${(itemType || "SUB").substring(0,3).toUpperCase()}-${(item?.id || "item").substring(0,8)}-${Date.now()}`;

    const promoSuffix = promo ? ` [Promo: ${promo.code}]` : "";
    const titleName = item?.title || item?.name || "Order";

    const payfastData: Record<string, string> = {
      merchant_id,
      merchant_key,
      amount: finalAmount.toFixed(2),
      item_name: `${quantity || 1}x ${titleName}${promoSuffix} [Proof Club]`,
      item_description: `${item?.description || "Exclusive allocation from Proof Control Center"}${promo ? ` (Promo ${promo.code} Applied)` : ""}`,
      email_address: userEmail || "",
      m_payment_id: generatedOrderId,
      custom_str1: userId || "demo-user-id",
      custom_str2: item?.club_id || "",
      custom_str3: item?.id || "",
      custom_str4: itemType || "subscription",
      custom_str5: String(quantity || 1)
    };

    if (promo) {
      payfastData.custom_int1 = String(promo.id);
    }

    if (clubMerchantId) {
      payfastData.setup = JSON.stringify({
        split_payment: {
          merchant_id: clubMerchantId,
          percentage: 95
        }
      });
    }

    // Record redemption + increment usage count if promo code used
    if (promo && db) {
      try {
        await db.from("promo_codes")
          .update({ times_used: (promo.times_used || 0) + 1 })
          .eq("id", promo.id);

        await db.from("promo_code_redemptions").insert([{
          promo_code_id: promo.id,
          order_id: generatedOrderId,
          user_id: userId || null
        }]);
      } catch (err) {
        console.warn("[checkout] Failed to update promo usage in DB:", err);
      }
    }

    return res.status(200).json({
      success: true,
      payfastData,
      finalAmount,
      discountApplied,
      promo
    });
  } catch (error: any) {
    console.error("[checkout] Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
}
