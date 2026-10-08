sed -i '/export async function getAdminTickets/i \
export async function getAdminOrders(clubId?: string): Promise<{ data: any[]; error: any }> {\
  try {\
    if (useMockData()) {\
      console.warn("getAdminOrders: Using mock data (not implemented)");\
      return { data: [], error: null };\
    }\
    const { supabase } = await import("./supabase-client");\
    if (!supabase) return { data: [], error: "Supabase not initialized" };\
\
    let query = supabase\
      .from("orders")\
      .select("*")\
      .eq("item_type", "product")\
      .order("created_at", { ascending: false });\
    \
    if (clubId) {\
      query = query.eq("club_id", clubId);\
    }\
\
    const result = await withTimeout(() => query, "getAdminOrders", 8000, 1);\
    if (result.error) {\
      return { data: [], error: result.error };\
    }\
\
    return { data: result.data || [], error: null };\
  } catch (error) {\
    console.error("Error fetching admin orders:", error);\
    return { data: [], error };\
  }\
}\
' src/services/supabase.ts
