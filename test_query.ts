import { getAdminOrders } from "./src/services/supabase";
getAdminOrders().then(console.log).catch(console.error);
