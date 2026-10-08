sed -i 's/\.from("orders")/.from("product_orders")/g' src/services/supabase.ts
sed -i '/\.eq("item_type", "product")/d' src/services/supabase.ts
