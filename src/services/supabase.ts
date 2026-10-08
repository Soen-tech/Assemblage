import { createClient } from '@supabase/supabase-js';
import { ClubEvent, Whisky } from '../types';
import { FEATURED_EVENTS, BOUTIQUE_ITEMS, JOURNAL_ENTRIES } from '../constants';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL: remove trailing slashes and common API paths if user pasted them
let supabaseUrl = rawUrl;
if (supabaseUrl && typeof supabaseUrl === 'string') {
  // Remove trailing slashes and common API suffixes
  supabaseUrl = supabaseUrl.trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/auth\/v1\/?$/, '')
    .replace(/\/$/, '');
}

// Fallback for demo when keys aren't set yet
let supabaseInstance = null;
try {
  if (supabaseUrl && supabaseAnonKey && 
      supabaseUrl !== 'YOUR_SUPABASE_URL' && 
      !supabaseUrl.includes('your-project')) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase initialized successfully with URL:", supabaseUrl);
  } else {
    console.warn("Supabase credentials missing or using placeholders. App will run in demo mode.");
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

export const supabase = supabaseInstance;

const withTimeout = async (promiseFn: () => Promise<any>, tag: string = "db-op", timeoutMs: number = 8000, retries: number = 1) => {
  let attempt = 0;
  
  const execute = async (currentAttempt: number): Promise<any> => {
    console.log(`[START] ${tag} (Attempt ${currentAttempt + 1}/${retries + 1})`);
    let timeoutId: any;
    
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        console.error(`[TIMEOUT] ${tag} after ${timeoutMs}ms`);
        reject(new Error(`Database operation timed out (${tag})`));
      }, timeoutMs);
    });

    try {
      const resultPromise = promiseFn();
      
      const result = await Promise.race([
        Promise.resolve(resultPromise).then(res => {
          console.log(`[RESOLVED] ${tag} (Attempt ${currentAttempt + 1})`, { 
            hasData: !!res?.data, 
            count: res?.data ? (Array.isArray(res.data) ? res.data.length : 1) : 0,
            error: res?.error 
          });
          return res;
        }), 
        timeout
      ]);
      clearTimeout(timeoutId);
      
      if (result?.error && (result.error.message?.includes('fetch') || result.error.status === 0)) {
         throw new Error(`Connection error (${tag})`);
      }

      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      const isTimeoutError = err.message?.includes('timeout') || err.message?.includes('Database operation timed out') || err.message?.includes('Connection error');
      
      if (currentAttempt < retries && isTimeoutError) {
        const delay = Math.min(2000 * Math.pow(2, currentAttempt), 10000);
        console.warn(`[RETRYING] ${tag} (Attempt ${currentAttempt + 1} failed) due to connection/timeout. Next attempt in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return execute(currentAttempt + 1);
      }
      
      console.error(`[ERROR] ${tag} (Attempt ${currentAttempt + 1})`, err);
      return { data: null, error: err };
    }
  };

  return execute(0);
};

// Persistent Cache Helpers
const CACHE_PREFIX = 'proof_cache_v1_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const setCachedData = (key: string, data: any) => {
  if (!data) return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
};

const clearCachedData = (key: string) => {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    console.warn("Cache clear failed:", e);
  }
};

const getCachedData = (key: string) => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (item) {
      const parsed = JSON.parse(item);
      // ✅ Enforce TTL — reject stale data
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        console.log(`[cache] Expired and cleared: ${key}`);
        return null;
      }
      return parsed.data;
    }
  } catch (e) {
    console.warn("Cache read failed:", e);
  }
  return null;
};

// Helper to pack Payfast metadata into the description column
export const packPayfastMetadata = (
  description: string, 
  payfast_price: number | string | null, 
  payfast_quantity: number | string | null,
  customCategory?: string | null
) => {
  const priceNum = payfast_price !== null && payfast_price !== undefined && String(payfast_price).trim() !== '' ? parseFloat(String(payfast_price)) : null;
  const qtyNum = payfast_quantity !== null && payfast_quantity !== undefined && String(payfast_quantity).trim() !== '' ? parseInt(String(payfast_quantity)) : null;
  
  // Clean description of any previous PF_META tags to prevent duplicate tagging
  const cleanDesc = (description || '').replace(/\[PF_META:({.*?})\]/g, '').trim();
  
  const metaObj: any = {};
  if (priceNum !== null && !isNaN(priceNum)) metaObj.p_p = priceNum;
  if (qtyNum !== null && !isNaN(qtyNum)) metaObj.p_q = qtyNum;
  if (customCategory) metaObj.c = customCategory;
  
  if (Object.keys(metaObj).length === 0) {
    return cleanDesc;
  }
  
  return `${cleanDesc}\n\n[PF_META:${JSON.stringify(metaObj)}]`;
};

// Helper to unpack Payfast metadata from description
export const unpackPayfastMetadata = (item: any) => {
  if (!item) return item;
  const description = item.description || item.desc || '';
  
  const matches = description.match(/\[PF_META:({.*?})\]/);
  let payfast_price: number | null = null;
  let payfast_quantity: number | null = null;
  let customCategory: string | null = null;
  let cleanDesc = description;
  
  if (matches && matches[1]) {
    try {
      const meta = JSON.parse(matches[1]);
      payfast_price = meta.p_p !== undefined ? Number(meta.p_p) : null;
      payfast_quantity = meta.p_q !== undefined ? Number(meta.p_q) : null;
      if (meta.c) customCategory = meta.c;
      // Remove metadata string from the clean description we display to users
      cleanDesc = description.replace(/\[PF_META:({.*?})\]/, '').trim();
    } catch (e) {
      console.error("[unpackPayfastMetadata] Parse error:", e);
    }
  }
  
  return {
    ...item,
    category: customCategory || item.category,
    description: cleanDesc,
    desc: cleanDesc,
    payfast_price,
    payfast_quantity
  };
};

export async function signIn(email: string, password?: string) {
  console.log("Supabase signIn attempt:", email, "Supabase configured:", !!supabase);
  
  if (!supabase) {
    console.warn("Supabase not configured. Using demo mode.");
    const isAdmin = email === 'proofadmin@gmail.com';
    const isCorrectPassword = password === 'proofadmin1234';
    
    if (isAdmin && password && !isCorrectPassword) {
      return { data: null, error: { message: 'Invalid credentials for admin account' } as any };
    }

    return { 
      data: { 
        user: { 
          id: 'demo-user', 
          email, 
          role: isAdmin ? 'admin' : 'member' 
        } 
      }, 
      error: null 
    };
  }

  try {
    // Try real login first
    if (password) {
      console.log("Attempting password login for:", email);
      const { data, error } = await withTimeout(
        () => supabase.auth.signInWithPassword({
          email,
          password,
        }),
        "auth.signInWithPassword",
        15000,
        1
      );
      
      console.log("Password login result:", { success: !!data?.user, error: error?.message });
      
      // Special case: if it's the admin but login failed (maybe account not created yet),
      // we check if it matches the hardcoded creds for the demo experience.
      if (error && email === 'proofadmin@gmail.com' && password === 'proofadmin1234') {
        // Try to sign up the admin automatically if it doesn't exist
        console.info("Admin login failed, attempting auto-setup...");
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: 'master_admin' } }
        });
        
        if (!signUpError) return { data: signUpData, error: null };

        console.info("Admin bypass fallback: Using mock session.");
        return { 
          data: { 
            user: { 
              id: 'admin-bypass-id', 
              email: 'proofadmin@gmail.com',
              user_metadata: { role: 'master_admin' }
            } 
          }, 
          error: null 
        };
      }
      return { data, error };
    }

    console.log("Attempting magic link login for:", email);
    const { data, error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    return { data, error };
  } catch (e: any) {
    console.error("Supabase auth error:", e);
    // Final fallback for admin if connection failed
    if (email === 'proofadmin@gmail.com' && password === 'proofadmin1234') {
      return { 
        data: { 
          user: { id: 'admin-bypass-id', email: 'proofadmin@gmail.com', user_metadata: { role: 'master_admin' } } 
        }, 
        error: null 
      };
    }
    return { data: null, error: e };
  }
}

export async function signUp(email: string, password?: string, clubId?: string, username?: string) {
  console.log("Supabase signUp attempt:", email, "Supabase configured:", !!supabase);
  if (!supabase) {
    console.warn("Supabase not configured. Using demo mode.");
    return { data: { user: { id: 'demo-user', email, user_metadata: { username } } }, error: null };
  }
  
  try {
    if (password) {
      console.log("Attempting password signup for:", email, "Club ID:", clubId, "Username:", username);
      const { data, error } = await withTimeout(
        () => supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              role: email === 'proofadmin@gmail.com' ? 'master_admin' : 'member',
              club_id: clubId || null,
              username: username || null
            }
          }
        }),
        "auth.signUp",
        15000,
        1
      );
      if (error) console.error("Signup error details:", error);
      return { data, error };
    }
    
    console.log("Attempting magic link signup for:", email);
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true
      }
    });
    
    return { data, error };
  } catch (e: any) {
    console.error("Supabase signUp error:", e);
    return { data: null, error: e };
  }
}

export async function signOut() {
  if (!supabase) return;
  try {
    console.log("Supabase signOut starting...");
    // Use a short 3-second timeout for local responsiveness and sandbox safety
    await withTimeout(() => supabase.auth.signOut(), "auth.signOut", 3000, 0);
    console.log("Supabase signOut completed.");
  } catch (e) {
    console.error("Sign out error (non-fatal):", e);
    // If it fails, we still want the app to proceed with local logout
  } finally {
    // Clear all module-level globals on logout
    pendingProfileRequests.clear();
    pendingJournalRequests.clear();
    activeBgRefreshes.clear();
    activeJournalBgRefreshes.clear();
    lastFetchedTime.clear();
    lastJournalFetchedTime.clear();

    // Clear all user-specific cache keys
    try {
      const keysToRemove = Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX));
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log(
        `[signOut] Cleared ${keysToRemove.length} cache keys starting with ${CACHE_PREFIX}`
      );
    } catch (e) {
      console.warn("[signOut] Cache clear failed:", e);
    }
  }
}

export const activeBgRefreshes = new Set<string>();
export const lastFetchedTime = new Map<string, number>();
export const pendingProfileRequests = new Map<string, Promise<{ data: any; error: any; isStale?: boolean }>>();

export async function getUserProfile(userId: string): Promise<{ data: any; error: any; isStale?: boolean }> {
  if (!supabase || userId === 'admin-bypass-id') {
    return { data: { role: userId === 'admin-bypass-id' ? 'master_admin' : 'member' }, error: null };
  }

  // If there's already an active first-time fetch or main request for this user, share the promise
  if (pendingProfileRequests.has(userId)) {
    console.log("[getUserProfile] Sharing active in-flight request for:", userId);
    return pendingProfileRequests.get(userId)!;
  }

  const cacheKey = `profile_${userId}`;
  const cached = getCachedData(cacheKey);

  // Stale-While-Revalidate (SWR) Pattern:
  // Immediately return cached profile to prevent blocking app boot when Supabase is slow or waking up.
  if (cached) {
    console.log("[getUserProfile] Instant cache hit returned to prevent boot blockade.", cached);
    
    const now = Date.now();
    const lastFetch = lastFetchedTime.get(userId) || 0;
    const isBgRefreshing = activeBgRefreshes.has(userId);

    // Only refresh if we aren't currently doing so, and if we haven't successfully synced in the last 60 seconds
    if (!isBgRefreshing && (now - lastFetch > 60000)) {
      activeBgRefreshes.add(userId);
      // Refresh the cache asynchronously in the background.
      (async () => {
        try {
          console.log("[getUserProfile] Refreshing profile cache in background...");
          const result = await withTimeout(
            () => supabase!
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .limit(1),
            "getUserProfile-bg-refresh",
            6000,
            0
          );
          let freshData = result.data;
          if (freshData && Array.isArray(freshData)) {
            freshData = freshData[0] || null;
          }
          if (freshData) {
            setCachedData(cacheKey, freshData);
            lastFetchedTime.set(userId, Date.now());
            console.log("[getUserProfile] Background profile cache sync successful.");
          }
        } catch (bgErr) {
          console.warn("[getUserProfile] Background profile sync skipped/failed (non-blocking):", bgErr);
        } finally {
          activeBgRefreshes.delete(userId);
        }
      })();
    }

    return { data: cached, error: null, isStale: true };
  }

  // No cache available - construct a new query and store it in the pending queue
  const requestPromise = (async () => {
    try {
      console.log("Fetching profile for first time (no cache available):", userId);
      const result = await withTimeout(
        () => supabase!
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .limit(1),
        "getUserProfile",
        5000,
        0
      );
      
      // Adjust result if limit(1) was used instead of maybeSingle
      if (result.data && Array.isArray(result.data)) {
        result.data = result.data[0] || null;
      }
      
      if (result.data) {
        setCachedData(cacheKey, result.data);
        lastFetchedTime.set(userId, Date.now());
      } else if (result.error) {
        // Return a graceful fallback profile on timeout/error so app isn't blocked
        return {
          data: { id: userId, role: userId === 'admin-bypass-id' ? 'master_admin' : 'member', is_fallback: true },
          error: result.error,
          isStale: false
        };
      }
      
      return result;
    } catch (e: any) {
      console.error("getUserProfile exception (first time):", e);
      // Return a basic fallback so the user is not completely locked out
      return { 
        data: { role: 'member', is_fallback: true }, 
        error: e,
        isStale: false
      };
    } finally {
      // Clean up the map as soon as execution completes (either success or failure)
      pendingProfileRequests.delete(userId);
    }
  })();

  pendingProfileRequests.set(userId, requestPromise);
  return requestPromise;
}

// Memory-based store for demo mode to persist changes during session
const MOCK_EVENTS_KEY = 'proof_mock_events';
const MOCK_BOUTIQUE_KEY = 'proof_mock_boutique';

const getInitialMockEvents = () => {
  const saved = localStorage.getItem(MOCK_EVENTS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing mock events:", e);
    }
  }
  return [...FEATURED_EVENTS];
};

const getInitialMockBoutique = () => {
  const saved = localStorage.getItem(MOCK_BOUTIQUE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing mock boutique:", e);
    }
  }
  return [...BOUTIQUE_ITEMS];
};

let mockEvents = getInitialMockEvents();
let mockBoutique = getInitialMockBoutique();

const saveMockEvents = () => {
  localStorage.setItem(MOCK_EVENTS_KEY, JSON.stringify(mockEvents));
};

const saveMockBoutique = () => {
  localStorage.setItem(MOCK_BOUTIQUE_KEY, JSON.stringify(mockBoutique));
};

export async function getEvents(clubId?: string | string[]) {
  const cacheId = Array.isArray(clubId) ? clubId.join(',') : (clubId || 'all');
  const cacheKey = `events_${cacheId}`;
  const cached = getCachedData(cacheKey);

  if (!supabase) {
    console.info("Demo mode: Returning mock events.");
    const finalMocks = (cached || mockEvents).map((e: any) => unpackPayfastMetadata(e));
    return { data: finalMocks, error: null };
  }

  try {
    console.log("[getEvents] Fetching for clubId:", clubId);
    let query = supabase.from('events').select('*').order('created_at', { ascending: false });
    
    if (clubId && clubId !== 'underground-001') {
      if (Array.isArray(clubId)) {
        if (clubId.length > 0) {
          const filterStr = clubId.map(id => `club_id.eq.${id}`).join(',') + ',club_id.is.null';
          query = query.or(filterStr);
        }
      } else {
        query = query.or(`club_id.eq.${clubId},club_id.is.null`);
      }
    }

    const result = await withTimeout(() => query, "getEvents", 8000, 1);
    
    if (result.data) {
      const unpacked = result.data.map((e: any) => unpackPayfastMetadata(e));
      setCachedData(cacheKey, unpacked);
      return { data: unpacked, error: null };
    } else if (cached) {
      console.log("[getEvents] Fetch returned no data, using cache");
      const unpacked = cached.map((e: any) => unpackPayfastMetadata(e));
      return { data: unpacked, error: result.error, isStale: true };
    }

    const finalMocks = mockEvents.map((e: any) => unpackPayfastMetadata(e));
    return { data: finalMocks, error: result.error };
  } catch (e) {
    console.error("[getEvents] Exception:", e);
    const finalMocks = (cached || mockEvents).map((e: any) => unpackPayfastMetadata(e));
    return { data: finalMocks, error: e, isStale: !!cached };
  }
}

export async function saveEvent(event: any) {
  console.log("[saveEvent] Input:", event);
  
  const rawCategory = (event.category || "tasting").toString();
  const validDBCategories = ["tasting", "masterclass", "rare", "dinner", "visit"];
  const isDBValid = validDBCategories.includes(rawCategory.toLowerCase());
  
  const dbCategory = isDBValid ? rawCategory.toLowerCase() : "tasting";
  const customCategory = isDBValid ? null : rawCategory;

  const packedDescription = packPayfastMetadata(
    event.description || event.desc || '', 
    event.payfast_price,
    event.payfast_quantity,
    customCategory
  );

  // Clean up payload fields - ensure we map both 'description' and 'desc' if they exist
  const payload: any = {
    title: event.title,
    description: packedDescription,
    date: event.date,
    location: event.location,
    price: event.price,
    image: event.image || null,
    category: dbCategory,
    club_id: event.club_id ?? null
  };
  
  if (event.id && event.id !== "" && !event.id.startsWith('temp-')) {
    payload.id = event.id;
  }

  console.log("[saveEvent] Final Payload to Supabase:", payload);

  const syncToMock = (ev: any) => {
    const fullEv = { 
      ...ev, 
      category: rawCategory,
      id: ev.id || Math.random().toString(36).substr(2, 9),
      created_at: ev.created_at || new Date().toISOString()
    };
    const index = mockEvents.findIndex(e => e.id === fullEv.id);
    if (index >= 0) mockEvents[index] = fullEv;
    else mockEvents.push(fullEv);
    saveMockEvents();
    return fullEv;
  };

  if (!supabase) {
    console.warn("No Supabase instance. Using mock persistence.");
    return { data: syncToMock(event), error: null };
  }
  
  try {
    // Normalize date: Must be YYYY-MM-DD for PostgreSQL DATE column
    if (payload.date) {
      try {
        const d = new Date(payload.date);
        if (!isNaN(d.getTime())) {
          payload.date = d.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn("Invalid date format, using today");
      }
    }
    
    if (!payload.date) {
      payload.date = new Date().toISOString().split('T')[0];
    }

    const query = supabase.from('events');
    const method = payload.id ? 'upsert' : 'insert';
    console.log(`[saveEvent] Attempting ${method} with payload:`, payload);
    
    const { data, error } = await withTimeout(
      () => payload.id 
        ? query.upsert(payload, { onConflict: 'id' }).select().single()
        : query.insert([payload]).select().single(),
      `saveEvent-${method}`,
      10000,
      1
    );
    
    if (error) {
      console.error("[saveEvent] Supabase error:", error);
      return { data: null, error };
    }
    
    console.log("[saveEvent] Success:", data);
    // Clear local cache for events
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('events_')) localStorage.removeItem(key);
      });
    } catch (e) {
      console.warn("Cache clear error:", e);
    }

    const unpackedData = unpackPayfastMetadata(data);
    if (!unpackedData.category || unpackedData.category === dbCategory) {
      unpackedData.category = rawCategory;
    }
    syncToMock(unpackedData);
    return { data: unpackedData, error: null };
  } catch (e: any) {
    console.error("[saveEvent] Exception:", e);
    return { data: null, error: e };
  }
}

export async function deleteEvent(id: string) {
  const index = mockEvents.findIndex(e => e.id === id);
  if (index >= 0) {
    mockEvents.splice(index, 1);
    saveMockEvents();
  }

  if (!supabase) return { error: null };
  try {
    return await withTimeout(() => supabase.from('events').delete().eq('id', id), "deleteEvent");
  } catch (e) {
    return { error: e };
  }
}

export async function getBoutiqueItems(clubId?: string | string[]) {
  const cacheId = Array.isArray(clubId) ? clubId.join(',') : (clubId || 'all');
  const cacheKey = `boutique_${cacheId}`;
  const cached = getCachedData(cacheKey);

  if (!supabase) {
    const finalMocks = (cached || mockBoutique).map((item: any) => unpackPayfastMetadata(item));
    return { data: finalMocks, error: null };
  }
  try {
    console.log("[getBoutiqueItems] Fetching for clubId:", clubId);
    let query = supabase.from('boutique').select('*').order('created_at', { ascending: false });
    
    if (clubId && clubId !== 'underground-001') {
      if (Array.isArray(clubId)) {
        if (clubId.length > 0) {
          const filterStr = clubId.map(id => `club_id.eq.${id}`).join(',') + ',club_id.is.null';
          query = query.or(filterStr);
        }
      } else {
        query = query.or(`club_id.eq.${clubId},club_id.is.null`);
      }
    }

    const result = await withTimeout(() => query, "getBoutiqueItems", 8000, 1);
    
    if (result.data) {
      const unpacked = result.data.map((item: any) => unpackPayfastMetadata(item));
      setCachedData(cacheKey, unpacked);
      return { data: unpacked, error: null };
    } else if (cached) {
      const unpacked = cached.map((item: any) => unpackPayfastMetadata(item));
      return { data: unpacked, error: result.error, isStale: true };
    }
    
    const finalMocks = mockBoutique.map((item: any) => unpackPayfastMetadata(item));
    return { data: finalMocks, error: result.error };
  } catch (e) {
    console.error("[getBoutiqueItems] Exception:", e);
    const finalMocks = (cached || mockBoutique).map((item: any) => unpackPayfastMetadata(item));
    return { data: finalMocks, error: e, isStale: !!cached };
  }
}

export async function saveBoutiqueItem(item: any) {
  console.log("[saveBoutiqueItem] Input:", item);
  
  const packedDescription = packPayfastMetadata(
    item.description || item.desc || '', 
    item.payfast_price,
    item.payfast_quantity
  );

  const payload: any = {
    name: item.name,
    description: packedDescription,
    price: item.price,
    image: item.image || null,
    category: item.category || "whisky",
    club_id: item.club_id ?? null
  };
  
  if (item.id && item.id !== "" && !item.id.startsWith('temp-')) {
    payload.id = item.id;
  }

  console.log("[saveBoutiqueItem] Final Payload to Supabase:", payload);

  const syncToMock = (it: any) => {
    const fullIt = { 
      ...it, 
      id: it.id || Math.random().toString(36).substr(2, 9),
      created_at: it.created_at || new Date().toISOString()
    };
    const index = mockBoutique.findIndex(i => i.id === fullIt.id);
    if (index >= 0) mockBoutique[index] = fullIt;
    else mockBoutique.push(fullIt);
    saveMockBoutique();
    return fullIt;
  };

  if (!supabase) {
    return { data: syncToMock(item), error: null };
  }
  
  try {
    const query = supabase.from('boutique');
    const method = payload.id ? 'upsert' : 'insert';
    console.log(`[saveBoutiqueItem] Attempting ${method} with payload:`, payload);

    const { data, error } = await withTimeout(
      () => payload.id 
        ? query.upsert(payload, { onConflict: 'id' }).select().single()
        : query.insert([payload]).select().single(),
      `saveBoutiqueItem-${method}`,
      10000,
      1
    );
      
    if (error) {
      console.error("[saveBoutiqueItem] Supabase error:", error);
      return { data: null, error };
    }
    
    console.log("[saveBoutiqueItem] Success:", data);
    syncToMock(data);
    return { data, error: null };
  } catch (e: any) {
    console.error("[saveBoutiqueItem] Exception:", e);
    return { data: null, error: e };
  }
}

export async function buyPayfastItem(itemId: string, itemType: 'event' | 'boutique', quantityToBuy: number = 1) {
  console.log(`[buyPayfastItem] Initializing purchase for ${itemType} ID: ${itemId}, qty: ${quantityToBuy}`);
  
  if (!supabase) {
    // Demo mode: Update local mock data
    if (itemType === 'event') {
      const index = mockEvents.findIndex(e => e.id === itemId);
      if (index >= 0) {
        const unpacked = unpackPayfastMetadata(mockEvents[index]);
        const currentQty = unpacked.payfast_quantity !== null ? Number(unpacked.payfast_quantity) : null;
        if (currentQty !== null) {
          if (currentQty < quantityToBuy) {
            return { error: new Error(`Only ${currentQty} ticket(s) remaining.`) };
          }
          const updated = {
            ...mockEvents[index],
            description: packPayfastMetadata(unpacked.description, unpacked.payfast_price, currentQty - quantityToBuy)
          };
          mockEvents[index] = updated;
          saveMockEvents();
          return { data: unpackPayfastMetadata(updated), error: null };
        }
      }
    } else {
      const index = mockBoutique.findIndex(i => i.id === itemId);
      if (index >= 0) {
        const unpacked = unpackPayfastMetadata(mockBoutique[index]);
        const currentQty = unpacked.payfast_quantity !== null ? Number(unpacked.payfast_quantity) : null;
        if (currentQty !== null) {
          if (currentQty < quantityToBuy) {
            return { error: new Error(`Only ${currentQty} item(s) in stock.`) };
          }
          const updated = {
            ...mockBoutique[index],
            description: packPayfastMetadata(unpacked.description, unpacked.payfast_price, currentQty - quantityToBuy)
          };
          mockBoutique[index] = updated;
          saveMockBoutique();
          return { data: unpackPayfastMetadata(updated), error: null };
        }
      }
    }
    return { error: new Error("Item not found.") };
  }

  try {
    const table = itemType === 'event' ? 'events' : 'boutique';
    const { data: rawItem, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (fetchError || !rawItem) {
      throw fetchError || new Error("Item not found");
    }

    const unpacked = unpackPayfastMetadata(rawItem);
    const currentQty = unpacked.payfast_quantity !== null ? Number(unpacked.payfast_quantity) : null;
    
    if (currentQty !== null) {
      if (currentQty < quantityToBuy) {
        throw new Error(`Only ${currentQty} available.`);
      }
      
      const newQty = currentQty - quantityToBuy;
      const packedDescription = packPayfastMetadata(unpacked.description, unpacked.payfast_price, newQty);
      
      const { data: updatedItem, error: updateError } = await supabase
        .from(table)
        .update({ description: packedDescription })
        .eq('id', itemId)
        .select()
        .single();
        
      if (updateError) throw updateError;
      
      // Clear specific cache after updates
      const cachePrefix = itemType === 'event' ? 'events_' : 'boutique_';
      // Clear cache by clearing localStorage entries matching prefix
      Object.keys(localStorage).forEach(key => {
        if (key.includes(cachePrefix)) localStorage.removeItem(key);
      });
      
      return { data: unpackPayfastMetadata(updatedItem), error: null };
    }
    
    return { data: unpacked, error: null };
  } catch (err: any) {
    console.error("[buyPayfastItem] Exception:", err);
    return { data: null, error: err };
  }
}

export interface CreateOrderParams {
  userId: string | null;
  clubId: string | null;
  itemType: 'event_ticket' | 'product' | 'club_membership' | 'subscription';
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  payfastPaymentId: string;
  payfastPfPaymentId: string;
  notes?: string;
  eventDate?: string;
}

export async function createPayfastOrder(params: CreateOrderParams) {
  // Always log event tickets to localStorage so demo / offline modes work flawlessly as requested
  if (params.itemType === 'event_ticket') {
    try {
      const rawLocal = localStorage.getItem('mock_event_tickets') || '[]';
      const localTickets = JSON.parse(rawLocal);
      let normalizedDate: string | null = null;
      if (params.eventDate) {
        try {
          const d = new Date(params.eventDate);
          if (!isNaN(d.getTime())) {
            normalizedDate = d.toISOString().split('T')[0];
          }
        } catch (e) {}
      }
      for (let i = 0; i < params.quantity; i++) {
        localTickets.push({
          id: `mock-tkt-${Math.floor(100000 + Math.random() * 900000)}`,
          order_id: `mock-ord-${Math.floor(10000 + Math.random() * 90000)}`,
          user_id: params.userId || 'demo-user-id',
          event_id: params.itemId,
          event_name: params.itemName,
          event_date: normalizedDate || params.eventDate || 'Upcoming',
          club_id: params.clubId || null,
          status: 'valid',
          created_at: new Date().toISOString()
        });
      }
      localStorage.setItem('mock_event_tickets', JSON.stringify(localTickets));
      console.log("[createPayfastOrder] Successfully stored ticket(s) in local cache:", localTickets);
    } catch (err) {
      console.warn("Unable to write local backup ticket:", err);
    }
  }

  if (!supabase) {
    console.warn("[createPayfastOrder] Supabase not initialized, processing offline order simulator complete.");
    return { data: { id: `mock-ord-${Date.now()}` }, error: null };
  }

  try {
    const amountGross = params.unitPrice * params.quantity;
    
    // Calculate realistic Payfast fees (e.g., 2.3% of gross + R2.00)
    const amountFee = Math.round((amountGross * 0.023 + 2.00) * 100) / 100;
    const amountNet = Math.round((amountGross - amountFee) * 100) / 100;
    
    // Platform commission is 5% of gross
    const platformCommission = Math.round((amountGross * 0.05) * 100) / 100;
    
    // Club payout is 95% of gross
    const clubPayout = Math.round((amountGross * 0.95) * 100) / 100;

    const orderPayload = {
      user_id: params.userId || null,
      club_id: params.clubId || null,
      item_type: params.itemType,
      item_id: params.itemId,
      item_name: params.itemName,
      quantity: params.quantity,
      unit_price: params.unitPrice,
      amount_gross: amountGross,
      amount_fee: amountFee,
      amount_net: amountNet,
      platform_commission: platformCommission,
      club_payout: clubPayout,
      status: 'complete',
      payfast_payment_id: params.payfastPaymentId,
      payfast_pf_payment_id: params.payfastPfPaymentId,
      notes: params.notes || `Purchased via Payfast Checkout Modal`
    };

    console.log("[createPayfastOrder] Creating order in database with payload:", orderPayload);

    // Insert main order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderPayload])
      .select()
      .single();

    if (orderError) {
      console.error("[createPayfastOrder] Error inserting order record:", orderError);
      throw orderError;
    }

    console.log("[createPayfastOrder] Order inserted successfully:", order);

    // If it's an event ticket booking, insert into event_tickets table
    if (params.itemType === 'event_ticket' && order) {
      const ticketsPayloads = [];
      // Create multiple ticket records if quantity > 1 (consistent with event_tickets table design)
      for (let i = 0; i < params.quantity; i++) {
        let normalizedDate: string | null = null;
        if (params.eventDate) {
          try {
            const d = new Date(params.eventDate);
            if (!isNaN(d.getTime())) {
              normalizedDate = d.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn("Invalid event date string:", params.eventDate);
          }
        }
        ticketsPayloads.push({
          order_id: order.id,
          user_id: params.userId || null,
          event_id: params.itemId,
          event_name: params.itemName,
          event_date: normalizedDate,
          club_id: params.clubId || null,
          status: 'valid'
        });
      }

      console.log(`[createPayfastOrder] Creating ${params.quantity} ticket(s) in event_tickets:`, ticketsPayloads);
      const { error: ticketError } = await supabase
        .from('event_tickets')
        .insert(ticketsPayloads);

      if (ticketError) {
        console.error("[createPayfastOrder] Error inserting event tickets:", ticketError);
      }
    }

    // If it's a boutique product, insert into product_orders table
    if (params.itemType === 'product' && order) {
      const productOrderPayload = {
        order_id: order.id,
        user_id: params.userId || null,
        product_id: params.itemId,
        product_name: params.itemName,
        club_id: params.clubId || null,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        fulfilment_status: 'pending',
        notes: params.notes || 'Purchased via Boutique'
      };

      console.log("[createPayfastOrder] Creating product order detail:", productOrderPayload);
      const { error: prodError } = await supabase
        .from('product_orders')
        .insert([productOrderPayload]);

      if (prodError) {
        console.error("[createPayfastOrder] Error inserting product orders:", prodError);
      }
    }

    return { data: order, error: null };
  } catch (err: any) {
    console.error("[createPayfastOrder] Exception caught during database persistence:", err);
    return { data: null, error: err };
  }
}

export async function getSubscription(userId: string) {
  if (!supabase) {
    const cached = localStorage.getItem('mock_subscription');
    return { data: cached ? JSON.parse(cached) : null, error: null };
  }
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  } catch (err: any) {
    console.error("[getSubscription] Error:", err);
    return { data: null, error: err };
  }
}

export async function getUserTickets(userId: string): Promise<{ data: any[]; error: any }> {
  let dbTickets: any[] = [];
  let dbError: any = null;

  if (supabase && userId && userId !== 'demo-user' && userId !== 'demo-user-id' && userId !== 'anonymous') {
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('user_id', userId);
      
      if (!error && data) {
        dbTickets = data;
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error fetching tickets from Supabase:", err);
      dbError = err;
    }
  }

  // Also read local/mock tickets from localStorage
  let localTickets: any[] = [];
  try {
    const rawLocal = localStorage.getItem('mock_event_tickets');
    if (rawLocal) {
      localTickets = JSON.parse(rawLocal);
      // Filter by userId
      localTickets = localTickets.filter((t: any) => !t.user_id || t.user_id === userId || userId === 'demo-user-id' || userId === 'demo-user');
    }
  } catch (err) {
    console.warn("Error parsing local tickets:", err);
  }

  // Deduplicate tickets by id
  const merged = [...dbTickets];
  for (const lt of localTickets) {
    if (!merged.some(dt => dt.id === lt.id || (dt.order_id === lt.order_id && dt.event_id === lt.event_id))) {
      merged.push({
        ...lt,
        created_at: lt.created_at || new Date().toISOString()
      });
    }
  }

  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return { data: merged, error: dbError };
}

export async function getAdminOrders(clubId?: string): Promise<{ data: any[]; error: any }> {
  try {
     
    if (!supabase) return { data: [], error: "Supabase not initialized" };

    let query = supabase
      .from("product_orders")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (clubId) {
      query = query.eq("club_id", clubId);
    }

    const result = await withTimeout(() => query, "getAdminOrders", 8000, 1);
    if (result.error) {
      return { data: [], error: result.error };
    }

    return { data: result.data || [], error: null };
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return { data: [], error };
  }
}

export async function getAdminTickets(clubId?: string): Promise<{ data: any[]; error: any }> {
  let dbTickets: any[] = [];
  let dbError: any = null;

  if (supabase) {
    try {
      let query = supabase.from('event_tickets').select('*');
      if (clubId) {
        query = query.eq('club_id', clubId);
      }
      const { data, error } = await query;
      if (!error && data) {
        dbTickets = data;
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error fetching admin tickets from Supabase:", err);
      dbError = err;
    }
  }

  // Also read local/mock tickets from localStorage
  let localTickets: any[] = [];
  try {
    const rawLocal = localStorage.getItem('mock_event_tickets');
    if (rawLocal) {
      localTickets = JSON.parse(rawLocal);
      if (clubId) {
        localTickets = localTickets.filter((t: any) => t.club_id === clubId);
      }
    }
  } catch (err) {
    console.warn("Error parsing local tickets:", err);
  }

  // Deduplicate tickets by id
  const merged = [...dbTickets];
  for (const lt of localTickets) {
    if (!merged.some(dt => dt.id === lt.id)) {
      merged.push({
        ...lt,
        created_at: lt.created_at || new Date().toISOString()
      });
    }
  }

  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return { data: merged, error: dbError };
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<{ success: boolean; error: any }> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('event_tickets')
        .update({ status })
        .eq('id', ticketId);
      if (error) {
        console.warn("Supabase ticket update status error:", error);
      }
    } catch (err) {
      console.warn("Error updating ticket status in Supabase:", err);
    }
  }

  // Always update in localStorage for demo integrity
  try {
    const rawLocal = localStorage.getItem('mock_event_tickets');
    if (rawLocal) {
      const tickets = JSON.parse(rawLocal);
      const idx = tickets.findIndex((t: any) => t.id === ticketId);
      if (idx !== -1) {
        tickets[idx].status = status;
        localStorage.setItem('mock_event_tickets', JSON.stringify(tickets));
      }
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function createOrUpdateSubscription(userId: string, plan: 'monthly' | 'annual', amount: number, token?: string) {
  const billingDate = new Date().toISOString().split('T')[0];
  const nextDate = new Date();
  if (plan === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }
  const nextBillingDate = nextDate.toISOString().split('T')[0];

  const payload = {
    user_id: userId,
    plan,
    status: 'active',
    amount,
    payfast_token: token || 'token_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    billing_date: billingDate,
    next_billing_date: nextBillingDate
  };

  if (!supabase) {
    localStorage.setItem('mock_subscription', JSON.stringify(payload));
    return { data: payload, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert([payload], { onConflict: 'user_id' })
      .select()
      .single();
    
    // Also invalidate profile cache to speed up refresh
    const cacheKey = `profile_${userId}`;
    localStorage.removeItem(cacheKey);

    return { data, error };
  } catch (err: any) {
    console.error("[createOrUpdateSubscription] Error:", err);
    return { data: null, error: err };
  }
}

export async function deleteBoutiqueItem(id: string) {
  const index = mockBoutique.findIndex(i => i.id === id);
  if (index >= 0) {
    mockBoutique.splice(index, 1);
    saveMockBoutique();
  }

  if (!supabase) return { error: null };
  try {
    return await withTimeout(() => supabase.from('boutique').delete().eq('id', id), "deleteBoutiqueItem");
  } catch (e) {
    return { error: e };
  }
}

export async function syncProfile(user: any) {
  if (!supabase || !user) return null;
  try {
    const { data: existingProfile, error: checkError } = await withTimeout(
      () => supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      "syncProfile-check",
      5000,
      0
    );

    if (checkError) {
      console.warn("[syncProfile] Check failed due to DB timeout or error, aborting creation attempt:", checkError);
      return null;
    }

    if (existingProfile) {
      const metadata = user.user_metadata || {};
      const updates: any = {};
      let needsUpdate = false;

      if (metadata.role && metadata.role !== existingProfile.role) {
        updates.role = metadata.role;
        needsUpdate = true;
      }

      // ✅ Run club name lookup in parallel
      const tasks: Promise<any>[] = [];

      if (existingProfile.club_id && !existingProfile.club_name) {
        tasks.push(
          supabase.from('clubs')
            .select('name')
            .eq('id', existingProfile.club_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.name) {
                updates.club_name = data.name;
                needsUpdate = true;
              }
            })
        );
      }

      await Promise.all(tasks);

      if (needsUpdate) {
        const { data: updated } = await withTimeout(
          () => supabase.from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .maybeSingle(),
          "syncProfile-update",
          8000,
          0
        );
        if (updated) return updated;
      }

      // ✅ Sync to club_members in background — don't await
      if (existingProfile.club_id && existingProfile.role !== 'master_admin') {
        supabase.from('club_members')
          .upsert({
            user_id: existingProfile.id,
            club_id: existingProfile.club_id,
            role: existingProfile.role === 'admin' ? 'admin' : 'member',
            status: 'active'
          }, { onConflict: 'user_id,club_id' })
          .then(() => console.log("[syncProfile] club_members sync done"))
          .catch(err => console.warn("[syncProfile] club_members sync failed:", err));
      }

      return existingProfile;
    }

    // New profile — create it
    const isMasterAdmin = user.email === 'proofadmin@gmail.com';
    const metadata = user.user_metadata || {};
    const signupClubId = metadata.club_id;

    // ✅ Look up club name in parallel with nothing else blocking
    let clubName = isMasterAdmin ? 'Underground Whisky Club Cape Town' : null;
    
    if (signupClubId && !isMasterAdmin) {
      const { data: clubData } = await withTimeout(
        () => supabase.from('clubs')
          .select('name')
          .eq('id', signupClubId)
          .maybeSingle(),
        "syncProfile-clubLookup",
        5000,
        0
      );
      if (clubData) clubName = clubData.name;
    }

    const newProfile: any = {
      id: user.id,
      email: user.email,
      role: isMasterAdmin ? 'master_admin' : (metadata.role || 'member'),
      club_id: signupClubId || null,
      club_name: clubName,
      username: metadata.username || null
    };

    let result = await withTimeout(
      () => supabase.from('profiles')
        .insert([newProfile])
        .select()
        .single(),
      "syncProfile-insert",
      6000,
      0
    );

    // If it failed because of missing column "username" in custom db, retry without it
    if (result.error && (
      result.error.message?.includes('column "username"') || 
      result.error.message?.includes('username') ||
      result.error.code === '42703'
    )) {
      console.warn("[syncProfile] Column 'username' does not exist in profiles table. Retrying insert without 'username' column.");
      const { username: _, ...fallbackProfile } = newProfile;
      result = await withTimeout(
        () => supabase.from('profiles')
          .insert([fallbackProfile])
          .select()
          .single(),
        "syncProfile-insert-fallback",
        6000,
        0
      );
    }

    // ✅ Sync new profile to club_members in background
    if (!result.error && result.data?.club_id && result.data?.role !== 'master_admin') {
      supabase.from('club_members')
        .upsert({
          user_id: result.data.id,
          club_id: result.data.club_id,
          role: result.data.role === 'admin' ? 'admin' : 'member',
          status: 'active'
        }, { onConflict: 'user_id,club_id' })
        .catch(err => console.warn("[syncProfile] New club_members sync failed:", err));
    }

    return result.error ? null : result.data;

  } catch (err) {
    console.error("syncProfile exception:", err);
    return null;
  }
}

// Clubs
export async function getClubs() {
  const cacheKey = 'clubs_all';
  const cached = getCachedData(cacheKey);

  if (!supabase) {
    console.warn("[getClubs] Supabase not initialized, returning cached/empty");
    return { data: cached || [], error: null };
  }
  try {
    console.log("[getClubs] Fetching all clubs...");
    const result = await withTimeout(() => supabase.from('clubs').select('*').order('name'), "getClubs", 8000, 1);
    
    if (result.data) {
      setCachedData(cacheKey, result.data);
    } else if (cached) {
      return { data: cached, error: result.error, isStale: true };
    }
    
    return result;
  } catch (error) {
    console.error("[getClubs] Exception:", error);
    return { data: cached || [], error };
  }
}

export async function getClubById(clubId: string) {
  const cacheKey = 'clubs_all';
  const cached = getCachedData(cacheKey);
  
  if (cached && Array.isArray(cached)) {
    const club = cached.find((c: any) => c.id === clubId);
    if (club) return { data: club, error: null };
  }
  
  if (!supabase) {
    return { data: null, error: new Error("Supabase and cache not available") };
  }
  
  try {
    const { data, error } = await withTimeout(
      () => supabase!.from('clubs').select('*').eq('id', clubId).maybeSingle(),
      "getClubById",
      8000,
      1
    );
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

function sanitizeNumeric(val: any): number | null {
  if (val === "" || val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (str === "") return null;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export async function saveClub(club: any) {
  console.log("[saveClub] Input payload:", club);
  if (!supabase) return { error: new Error("Supabase not initialized") };

  const payload: any = {
    ...club,
    joining_fee_monthly: sanitizeNumeric(club.joining_fee_monthly),
    joining_fee_annual: sanitizeNumeric(club.joining_fee_annual),
    location: club.location === "" ? null : (club.location || null),
    image: club.image === "" ? null : (club.image || null),
    payfast_merchant_id: club.payfast_merchant_id === "" ? null : (club.payfast_merchant_id ? String(club.payfast_merchant_id).trim() : null),
  };

  if (payload.id === "") {
    delete payload.id;
  }

  delete payload.membership_role;

  console.log("[saveClub] Sanitized payload sent to Supabase:", payload);

  try {
    const result = await withTimeout(
      () => supabase!.from('clubs').upsert(payload).select().single(), 
      "saveClub",
      10000,
      1
    );

    if (result.data) {
      clearCachedData('clubs_all');
    }
    return result;
  } catch (error) {
    console.error("[saveClub] Exception:", error);
    return { error };
  }
}

export async function deleteClub(id: string) {
  if (!supabase) return { error: new Error("Supabase not initialized") };
  try {
    return await withTimeout(() => supabase.from('clubs').delete().eq('id', id), "deleteClub");
  } catch (error) {
    return { error };
  }
}

// Memory cache or fallback storage key for offline/demo/missing-table situations
const MOCK_JOURNAL_KEY = 'proof_mock_journal';
const getInitialMockJournal = () => {
  const saved = localStorage.getItem(MOCK_JOURNAL_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing mock journal:", e);
    }
  }
  return [];
};

let mockJournal = getInitialMockJournal();
const saveMockJournal = () => {
  localStorage.setItem(MOCK_JOURNAL_KEY, JSON.stringify(mockJournal));
};

export const activeJournalBgRefreshes = new Set<string>();
export const lastJournalFetchedTime = new Map<string, number>();
export const pendingJournalRequests = new Map<string, Promise<{ data: any; error: any; isStale?: boolean; isFallback?: boolean }>>();

const mapJournalRows = (rows: any[]): Whisky[] => {
  return (rows || []).map((row: any) => {
    const swriProfileRaw = row.swri_profile || { peaty: 0, fruity: 0, floral: 0, cereal: 0, intensity: 0 };
    const cat = row.category || swriProfileRaw.category || 'whisky';
    return {
      id: row.id,
      name: row.name,
      distillery: row.distillery || '',
      region: row.region || '',
      age: row.age || '',
      abv: row.abv || '',
      description: row.description || '',
      tastingNotes: row.tasting_notes || [],
      category: cat,
      swriProfile: {
        ...swriProfileRaw,
        category: cat
      },
      image: row.image || '',
      date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : '',
      rating: row.rating ?? 5,
      tasteRating: row.taste_rating ?? swriProfileRaw.tasteRating ?? row.rating ?? 5,
      aromaRating: row.aroma_rating ?? swriProfileRaw.aromaRating ?? row.rating ?? 5,
      valueRating: row.value_rating ?? swriProfileRaw.valueRating ?? row.rating ?? 5
    };
  });
};

export async function getJournalEntries(userId: string): Promise<{ data: any; error: any; isStale?: boolean; isFallback?: boolean }> {
  // 1. Share concurrent identical requests to deduplicate
  if (pendingJournalRequests.has(userId)) {
    console.log("[getJournalEntries] Sharing active in-flight request for:", userId);
    return pendingJournalRequests.get(userId)!;
  }

  const cacheKey = `journal_${userId}`;
  const cached = getCachedData(cacheKey);

  if (!supabase || userId === 'admin-bypass-id' || userId === 'demo-user') {
    return { data: cached || mockJournal, error: null };
  }

  // 2. Instant cache response to prevent boot blockade / page hangs
  if (cached) {
    console.log("[getJournalEntries] Instant cache hit returned to keep UI responsive.", cached.length);
    
    const now = Date.now();
    const lastFetch = lastJournalFetchedTime.get(userId) || 0;
    const isBgRefreshing = activeJournalBgRefreshes.has(userId);

    if (!isBgRefreshing && (now - lastFetch > 30000)) {
      activeJournalBgRefreshes.add(userId);
      (async () => {
        try {
          console.log("[getJournalEntries] Refreshing journal cache in background...");
          const result = await withTimeout(
            () => supabase!
              .from('journals')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false }),
            "getJournalEntries-bg-refresh",
            15000, // Short, safe timeout for background refresh
            0      // No retries needed for background refresh
          );
          if (result.data) {
            const mapped = mapJournalRows(result.data);
            setCachedData(cacheKey, mapped);
            lastJournalFetchedTime.set(userId, Date.now());
            console.log("[getJournalEntries] Background journal cache sync successful.");
          }
        } catch (bgErr) {
          console.warn("[getJournalEntries] Background journal sync skipped/failed:", bgErr);
        } finally {
          activeJournalBgRefreshes.delete(userId);
        }
      })();
    }

    return { data: cached, error: null, isStale: true };
  }

  // 3. No cache available: Create a deduplicated query promise
  const requestPromise = (async () => {
    try {
      console.log("[getJournalEntries] Fetching for userId (first-time loop):", userId);
      const result = await withTimeout(
        () => supabase!
          .from('journals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        "getJournalEntries",
        25000,
        1
      );

      if (result.error) {
        console.warn("Error or table missing in Supabase for journals:", result.error.message);
        return { data: mockJournal, error: result.error, isFallback: true };
      }

      if (result.data) {
        const mapped = mapJournalRows(result.data);
        setCachedData(cacheKey, mapped);
        lastJournalFetchedTime.set(userId, Date.now());
        return { data: mapped, error: null };
      }

      return { data: [], error: null };
    } catch (e: any) {
      console.error("[getJournalEntries] Exception during first-load:", e);
      return { data: mockJournal, error: e, isFallback: true };
    } finally {
      pendingJournalRequests.delete(userId);
    }
  })();

  pendingJournalRequests.set(userId, requestPromise);
  return requestPromise;
}

export async function saveJournalEntry(userId: string, entry: Whisky) {
  console.log("[saveJournalEntry] Input entry:", entry);
  
  const syncToMock = (it: Whisky) => {
    const fullIt = { 
      ...it, 
      id: it.id || Math.random().toString(36).substr(2, 9),
      date: it.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    };
    const index = mockJournal.findIndex(i => i.id === fullIt.id);
    if (index >= 0) mockJournal[index] = fullIt;
    else mockJournal.unshift(fullIt);
    saveMockJournal();
    return fullIt;
  };

  if (!supabase || userId === 'admin-bypass-id' || userId === 'demo-user') {
    return { data: syncToMock(entry), error: null };
  }

  try {
    const payload: any = {
      user_id: userId,
      name: entry.name,
      distillery: entry.distillery || '',
      region: entry.region || '',
      age: entry.age || '',
      abv: entry.abv || '',
      description: entry.description || '',
      tasting_notes: entry.tastingNotes || [],
      swri_profile: {
        ...(entry.swriProfile || { peaty: 0, fruity: 0, floral: 0, cereal: 0, intensity: 0 }),
        category: entry.category || entry.swriProfile?.category || 'whisky',
        tasteRating: entry.tasteRating ?? entry.rating ?? 5,
        aromaRating: entry.aromaRating ?? entry.rating ?? 5,
        valueRating: entry.valueRating ?? entry.rating ?? 5
      },
      taste_rating: entry.tasteRating ?? entry.rating ?? 5,
      aroma_rating: entry.aromaRating ?? entry.rating ?? 5,
      value_rating: entry.valueRating ?? entry.rating ?? 5,
      image: entry.image || '',
      rating: entry.rating ?? 5
    };

    // If ID is a real random uuid and not client-side temp, preserve it
    if (entry.id && entry.id.length > 15) {
      payload.id = entry.id;
    }

    console.log("[saveJournalEntry] Upsert payload to journals:", payload);

    const { data, error } = await withTimeout(
      () => supabase!
        .from('journals')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single(),
      "saveJournalEntry",
      10000,
      1
    );

    if (error) {
      console.warn("[saveJournalEntry] Database insert error, using local fallback:", error.message);
      // Fall back to mock
      return { data: syncToMock(entry), error };
    }

    if (data) {
      const swriProfileRaw = data.swri_profile || { peaty: 0, fruity: 0, floral: 0, cereal: 0, intensity: 0 };
      const cat = swriProfileRaw.category || entry.category || 'whisky';
      const mapped: Whisky = {
        id: data.id,
        name: data.name,
        distillery: data.distillery || '',
        region: data.region || '',
        age: data.age || '',
        abv: data.abv || '',
        description: data.description || '',
        tastingNotes: data.tasting_notes || [],
        category: cat,
        swriProfile: {
          ...swriProfileRaw,
          category: cat
        },
        image: data.image || '',
        date: data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : '',
        rating: data.rating ?? 5,
        tasteRating: data.taste_rating ?? swriProfileRaw.tasteRating ?? data.rating ?? 5,
        aromaRating: data.aroma_rating ?? swriProfileRaw.aromaRating ?? data.rating ?? 5,
        valueRating: data.value_rating ?? swriProfileRaw.valueRating ?? data.rating ?? 5
      };
      
      // Keep mock in sync too
      const index = mockJournal.findIndex(i => i.id === mapped.id);
      if (index >= 0) mockJournal[index] = mapped;
      else mockJournal.unshift(mapped);
      saveMockJournal();
      
      return { data: mapped, error: null };
    }

    return { data: syncToMock(entry), error: null };
  } catch (e: any) {
    console.error("[saveJournalEntry] Catch handler exception:", e);
    return { data: syncToMock(entry), error: e };
  }
}

export async function deleteJournalEntry(userId: string, id: string) {
  const index = mockJournal.findIndex(j => j.id === id);
  if (index >= 0) {
    mockJournal.splice(index, 1);
    saveMockJournal();
  }

  if (!supabase || userId === 'admin-bypass-id' || userId === 'demo-user') {
    return { error: null };
  }

  try {
    return await withTimeout(
      () => supabase!
        .from('journals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId), 
      "deleteJournalEntry"
    );
  } catch (e) {
    return { error: e };
  }
}

// User Management (Master Admin only)
export async function getProfiles() {
  if (!supabase) {
    console.log("[getProfiles] Offline/dev mode - returning mock profiles");
    return {
      data: [
        {
          id: 'admin-bypass-id',
          email: 'proofadmin@gmail.com',
          role: 'master_admin',
          club_name: 'Underground Whisky Club Cape Town',
          club_id: 'underground-001',
          created_at: new Date().toISOString()
        },
        {
          id: 'demo-user-1',
          email: 'collector@gmail.com',
          role: 'member',
          club_name: 'Underground Whisky Club Cape Town',
          club_id: 'underground-001',
          created_at: new Date().toISOString()
        },
        {
          id: 'demo-user-2',
          email: 'whiskyfan@gmail.com',
          role: 'member',
          club_name: 'Peaty Malts Society',
          club_id: 'peaty-001',
          created_at: new Date().toISOString()
        }
      ],
      error: null
    };
  }

  try {
    // 1. Try fetching with foreign key join
    const result = await withTimeout(() => supabase!
      .from('profiles')
      .select(`
        *,
        club_members (
          club_id,
          role,
          status,
          clubs (
            name
          )
        )
      `)
      .order('created_at', { ascending: false }), "getProfiles", 8000, 1);
    
    if (!result.error && result.data && result.data.length > 0) {
      return result;
    }
    
    // 2. If join fails or returns empty with error, fall back to simple select and manually match memberships!
    console.warn("[getProfiles] Joined query error or empty result, falling back to simple select & manual join.", result.error);
    const profilesResult = await withTimeout(() => supabase!
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }), "getProfiles-fallback", 8000, 1);
      
    if (profilesResult.error) {
       console.error("[getProfiles] Direct profiles fetch failed:", profilesResult.error);
       return profilesResult;
    }
    
    const profiles = profilesResult.data || [];
    
    // Separately fetch all memberships if possible, and pair them in memory
    try {
      const { data: memberships, error: memberErr } = await supabase!
        .from('club_members')
        .select(`
          user_id,
          club_id,
          role,
          status,
          clubs (
            name
          )
        `);
        
      if (!memberErr && memberships && memberships.length > 0) {
        const mappedProfiles = profiles.map((p: any) => {
          const userMemberships = memberships.filter((m: any) => m.user_id === p.id);
          return {
            ...p,
            club_members: userMemberships
          };
        });
        return { data: mappedProfiles, error: null };
      }
    } catch (memberErr) {
      console.warn("[getProfiles] Failed to query or join club_members manually in memory:", memberErr);
    }
    
    return { data: profiles, error: null };
  } catch (error: any) {
    console.error("[getProfiles] Exception:", error);
    return { data: [], error: null };
  }
}

export async function updateUserRole(userId: string, role: string, clubId?: string, clubName?: string) {
  if (!supabase) return { error: new Error("Supabase not initialized") };
  try {
    const updates: any = { 
      role,
      club_id: clubId || null,
      club_name: clubName || null
    };
    const result = await withTimeout(() => supabase.from('profiles').update(updates).eq('id', userId), "updateUserRole");

    if (clubId && role !== 'master_admin') {
      const clubMemberRole = role === 'admin' ? 'admin' : 'member';
      await addClubMember(userId, clubId, clubMemberRole);
    }

    return result;
  } catch (error) {
    return { error };
  }
}

export async function uploadStorageImage(file: File, folder: 'events' | 'boutique' | 'clubs'): Promise<{ publicUrl: string | null; error: any }> {
  if (!supabase) {
    console.warn("Supabase not initialized. Returning local object URL.");
    try {
      return { publicUrl: URL.createObjectURL(file), error: null };
    } catch {
      return { publicUrl: null, error: new Error("Failed to create mock URL") };
    }
  }

  try {
    const bucketName = 'vault-images';
    
    // Check if user is authenticated or anonymous
    const { data: sessionData } = await supabase.auth.getSession();
    console.log(`[uploadStorageImage] Current session:`, {
      isAuthenticated: !!sessionData?.session,
      userId: sessionData?.session?.user?.id || 'none',
      email: sessionData?.session?.user?.email || 'none',
      role: sessionData?.session?.user?.role || 'none'
    });

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    
    console.log(`[uploadStorageImage] Uploading file to ${bucketName}/${fileName} (type: ${file.type}, size: ${file.size} bytes)`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

    if (error) {
      console.error("[uploadStorageImage] Storage upload failed in Supabase SDK:", error);
      return { publicUrl: null, error };
    }

    // Retrieve public URL
    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    console.log("[uploadStorageImage] Uploaded successfully. Public URL:", publicUrl);

    return { publicUrl, error: null };
  } catch (err: any) {
    console.error("[uploadStorageImage] Catch block exception handler:", err);
    return { publicUrl: null, error: err };
  }
}

export async function getUserClubs(userId: string) {
  const cacheKey = `club_memberships_${userId}`;
  const cached = getCachedData(cacheKey);

  if (!supabase) {
    if (cached) return { data: cached, error: null };
    console.warn("[getUserClubs] Supabase not initialized, returning mock/empty memberships");
    try {
      const { data: profile } = await getUserProfile(userId);
      if (profile && (profile.club_id || profile.club_name)) {
        const mockClubs = [{
          club_id: profile.club_id || 'underground-001',
          club_name: profile.club_name || 'Underground Whisky Club Cape Town',
          role: profile.role || 'member',
          status: 'active',
          joined_at: new Date().toISOString()
        }];
        setCachedData(cacheKey, mockClubs);
        return {
          data: mockClubs,
          error: null
        };
      }
    } catch {}
    return { data: [], error: null };
  }

  const fetchAndFormat = async (tag = "getUserClubs") => {
    const { data, error } = await withTimeout(
      () => supabase!
        .from('club_members')
        .select(`
          club_id,
          role,
          status,
          joined_at,
          membership_type,
          clubs (
            name,
            location,
            image
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active'),
      tag,
      6000,
      0
    );

    if (error) {
      throw error;
    }

    const formatted = (data || []).map((membership: any) => ({
      club_id: membership.club_id,
      club_name: membership.clubs?.name || 'Club',
      club_location: membership.clubs?.location || '',
      club_image: membership.clubs?.image || '',
      role: membership.role || 'member',
      status: membership.status || 'active',
      joined_at: membership.joined_at || new Date().toISOString(),
      membership_type: membership.membership_type || 'free'
    }));

    return formatted;
  };

  // ✅ Return cache instantly, refresh in background
  if (cached) {
    (async () => {
      try {
        const formatted = await fetchAndFormat("getUserClubs-bg");
        setCachedData(cacheKey, formatted);
      } catch (e) {
        console.warn("[getUserClubs] Background refresh failed:", e);
      }
    })();
    return { data: cached, error: null, isStale: true };
  }

  try {
    const formatted = await fetchAndFormat("getUserClubs");
    setCachedData(cacheKey, formatted);
    return { data: formatted, error: null };
  } catch (e: any) {
    console.error("[getUserClubs] Exception:", e);
    return { data: cached || [], error: e, isStale: !!cached };
  }
}

export async function addClubMember(userId: string, clubId: string, role = 'member') {
  if (!supabase) {
    console.warn("[addClubMember] Supabase not initialized");
    return { error: null };
  }

  try {
    const { data: existing, error: checkError } = await supabase
      .from('club_members')
      .select('*')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (!checkError && existing) {
      const { data, error } = await supabase
        .from('club_members')
        .update({ status: 'active', role })
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .select()
        .single();
      return { data, error };
    }

    const { data, error } = await supabase
      .from('club_members')
      .insert({
        user_id: userId,
        club_id: clubId,
        role: role,
        status: 'active'
      })
      .select()
      .single();

    return { data, error };
  } catch (err: any) {
    console.error("[addClubMember] Exception:", err);
    return { error: err };
  }
}

export async function removeClubMember(userId: string, clubId: string) {
  if (!supabase) {
    console.warn("[removeClubMember] Supabase not initialized");
    return { error: null };
  }

  try {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('user_id', userId)
      .eq('club_id', clubId);

    return { error };
  } catch (err: any) {
    console.error("[removeClubMember] Exception:", err);
    return { error: err };
  }
}

export async function processPayfastITN(userId: string, clubIdOrPlan: string, itemType: string, order?: any) {
  if (!supabase) {
    console.warn("[processPayfastITN] Supabase not initialized, offline fallback sync...");
    
    // Offline local storage update
    const cacheKey = `club_memberships_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    let parsed = cached ? JSON.parse(cached) : [];
    
    const existingIdx = parsed.findIndex((m: any) => m.club_id === clubIdOrPlan);
    if (existingIdx >= 0) {
      parsed[existingIdx] = {
        ...parsed[existingIdx],
        status: 'active',
        membership_type: 'paid',
        joined_at: new Date().toISOString()
      };
    } else {
      parsed.push({
        club_id: clubIdOrPlan,
        club_name: 'Club',
        club_location: 'Cape Town, ZA',
        club_image: null,
        role: 'member',
        status: 'active',
        membership_type: 'paid',
        joined_at: new Date().toISOString()
      });
    }
    
    localStorage.setItem(cacheKey, JSON.stringify(parsed));
    return { error: null };
  }

  try {
    switch (itemType) {
      case 'club_membership': {
        const { data, error } = await supabase
          .from('club_members')
          .upsert({
            user_id: userId,
            club_id: clubIdOrPlan,
            role: 'member',
            status: 'active',
            membership_type: 'paid',        // FIX: mark as paid
            order_id: order?.id || null,    // FIX: link to order
            paid_at: new Date().toISOString(),
          }, { onConflict: 'user_id,club_id' })
          .select();

        // Clear local cache for clubs structure
        const cacheKey = `club_memberships_${userId}`;
        localStorage.removeItem(cacheKey);

        return { data, error };
      }
      default: {
        return { error: new Error(`Unhandled itemType: ${itemType}`) };
      }
    }
  } catch (err: any) {
    console.error("[processPayfastITN] Exception caught:", err);
    return { error: err };
  }
}

export async function getEvent(eventId: string): Promise<{ data: any | null; error: any }> {
  let dbEvent: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (!error && data) {
        dbEvent = unpackPayfastMetadata(data);
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error fetching event from Supabase:", err);
      dbError = err;
    }
  }

  if (!dbEvent) {
    // Check in mockEvents
    dbEvent = mockEvents.find((e: any) => e.id === eventId) || null;
    if (dbEvent) {
      dbEvent = unpackPayfastMetadata(dbEvent);
    }
  }

  return { data: dbEvent, error: dbError };
}

export async function generateEventInviteLink(
  eventId: string,
  clubId: string,
  createdBy: string,
  usesLimit = 50
) {
  const token = Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  let dbInvite: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdBy);
      const { data, error } = await supabase
        .from('event_invites')
        .insert([{
          event_id: eventId,
          club_id: clubId,
          created_by: isUuid ? createdBy : null,
          token: token,
          uses_limit: usesLimit,
          uses_count: 0
        }])
        .select()
        .single();

      if (!error && data) {
        dbInvite = data;
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error inserting event invite in Supabase:", err);
      dbError = err;
    }
  }

  // Always write to localStorage so mock/offline behaves cleanly
  try {
    const rawLocal = localStorage.getItem('mock_event_invites') || '[]';
    const localInvites = JSON.parse(rawLocal);
    const mockInvite = dbInvite || {
      id: 'inv-' + Math.floor(10000 + Math.random() * 90000),
      event_id: eventId,
      club_id: clubId,
      created_by: createdBy,
      token: token,
      uses_limit: usesLimit,
      uses_count: 0,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    localInvites.push(mockInvite);
    localStorage.setItem('mock_event_invites', JSON.stringify(localInvites));

    const finalToken = mockInvite.token;
    const link = `${window.location.origin}/?invite=${finalToken}`;
    return { link, data: mockInvite, error: dbError };
  } catch (err) {
    console.warn("Error saving mock invite:", err);
    const link = `${window.location.origin}/?invite=${token}`;
    return { link, data: { token }, error: dbError || err };
  }
}

export async function getEventInvite(token: string): Promise<{ data: any | null; error: any }> {
  let dbInvite: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('event_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (!error && data) {
        dbInvite = data;
      } else {
        dbError = error;
      }
    } catch (err) {
      console.warn("Supabase fetch event invite error:", err);
    }
  }

  if (!dbInvite) {
    try {
      const rawLocal = localStorage.getItem('mock_event_invites') || '[]';
      const invites = JSON.parse(rawLocal);
      dbInvite = invites.find((i: any) => i.token === token) || null;
    } catch (err) {
      console.warn("Parsing local invites error:", err);
    }
  }

  return { data: dbInvite, error: dbError };
}

export async function consumeEventInvite(inviteId: string, currentUses: number) {
  if (supabase) {
    try {
      await supabase
        .from('event_invites')
        .update({ uses_count: currentUses + 1 })
        .eq('id', inviteId);
    } catch (err) {
      console.warn("Supabase consume invite error:", err);
    }
  }

  // Always sync to localStorage
  try {
    const rawLocal = localStorage.getItem('mock_event_invites') || '[]';
    const invites = JSON.parse(rawLocal);
    const idx = invites.findIndex((i: any) => i.id === inviteId);
    if (idx !== -1) {
      invites[idx].uses_count = (invites[idx].uses_count || 0) + 1;
      localStorage.setItem('mock_event_invites', JSON.stringify(invites));
    }
  } catch (err) {
    console.warn("Storage sync consume invite error:", err);
  }
}

export async function getBoutiqueItem(productId: string): Promise<{ data: any | null; error: any }> {
  let dbItem: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('boutique')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (!error && data) {
        dbItem = unpackPayfastMetadata(data);
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error fetching boutique item from Supabase:", err);
      dbError = err;
    }
  }

  if (!dbItem) {
    // Check in mockBoutique
    dbItem = mockBoutique.find((b: any) => b.id === productId) || null;
    if (dbItem) {
      dbItem = unpackPayfastMetadata(dbItem);
    }
  }

  return { data: dbItem, error: dbError };
}

export async function generateBoutiqueInviteLink(
  productId: string,
  clubId: string,
  createdBy: string,
  usesLimit = 50
) {
  const token = 'btq_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
  let dbInvite: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdBy);
      const { data, error } = await supabase
        .from('boutique_invites')
        .insert([{
          boutique_id: productId,
          club_id: clubId,
          created_by: isUuid ? createdBy : null,
          token: token,
          uses_limit: usesLimit,
          uses_count: 0
        }])
        .select()
        .single();

      if (!error && data) {
        dbInvite = data;
      } else {
        dbError = error;
      }
    } catch (err: any) {
      console.warn("Error inserting boutique invite in Supabase:", err);
      dbError = err;
    }
  }

  try {
    const rawLocal = localStorage.getItem('mock_boutique_invites') || '[]';
    const localInvites = JSON.parse(rawLocal);
    const mockInvite = dbInvite || {
      id: 'binv-' + Math.floor(10000 + Math.random() * 90000),
      boutique_id: productId,
      club_id: clubId,
      created_by: createdBy,
      token: token,
      uses_limit: usesLimit,
      uses_count: 0,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    localInvites.push(mockInvite);
    localStorage.setItem('mock_boutique_invites', JSON.stringify(localInvites));

    const finalToken = mockInvite.token;
    const link = `${window.location.origin}/?invite=${finalToken}`;
    return { link, data: mockInvite, error: dbError };
  } catch (err) {
    console.warn("Error saving mock boutique invite:", err);
    const link = `${window.location.origin}/?invite=${token}`;
    return { link, data: { token }, error: dbError || err };
  }
}

export async function getBoutiqueInvite(token: string): Promise<{ data: any | null; error: any }> {
  let dbInvite: any = null;
  let dbError: any = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('boutique_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (!error && data) {
        dbInvite = data;
      } else {
        dbError = error;
      }
    } catch (err) {
      console.warn("Supabase fetch boutique invite error:", err);
    }
  }

  if (!dbInvite) {
    try {
      const rawLocal = localStorage.getItem('mock_boutique_invites') || '[]';
      const invites = JSON.parse(rawLocal);
      dbInvite = invites.find((i: any) => i.token === token) || null;
    } catch (err) {
      console.warn("Parsing local boutique invites error:", err);
    }
  }

  return { data: dbInvite, error: dbError };
}

export async function consumeBoutiqueInvite(inviteId: string, currentUses: number) {
  if (supabase) {
    try {
      await supabase
        .from('boutique_invites')
        .update({ uses_count: currentUses + 1 })
        .eq('id', inviteId);
    } catch (err) {
      console.warn("Supabase consume boutique invite error:", err);
    }
  }

  try {
    const rawLocal = localStorage.getItem('mock_boutique_invites') || '[]';
    const invites = JSON.parse(rawLocal);
    const idx = invites.findIndex((i: any) => i.id === inviteId);
    if (idx !== -1) {
      invites[idx].uses_count = (invites[idx].uses_count || 0) + 1;
      localStorage.setItem('mock_boutique_invites', JSON.stringify(invites));
    }
  } catch (err) {
    console.warn("Storage sync consume boutique invite error:", err);
  }
}




export async function getPromoCodes() {
  try {
    const response = await fetch('/api/admin/get-promo-codes');
    const text = await response.text();
    let result: any = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) {}

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to fetch promo codes');
    }
    return { data: result?.data || [], error: null };
  } catch (error: any) {
    console.error('[getPromoCodes] Error:', error);
    if (supabase) {
      const { data, error: dbError } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
      return { data: data || [], error: dbError };
    }
    return { data: [], error: null };
  }
}

export async function savePromoCode(promo: any) {
  try {
    const response = await fetch('/api/admin/save-promo-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promo)
    });
    
    const text = await response.text();
    let result: any = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) {}

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to save promo code');
    }
    
    return { data: result?.data || result, error: null };
  } catch (error: any) {
    console.error('[savePromoCode] Error:', error);
    if (supabase) {
      const { data, error: dbError } = await supabase.from('promo_codes').upsert([promo]).select('*').single();
      return { data, error: dbError };
    }
    return { data: null, error };
  }
}

export async function deletePromoCode(id: number) {
  try {
    const response = await fetch('/api/admin/delete-promo-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    const text = await response.text();
    let result: any = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) {}

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to delete promo code');
    }
    
    return { error: null };
  } catch (error: any) {
    console.error('[deletePromoCode] Error:', error);
    if (supabase) {
      const { error: dbError } = await supabase.from('promo_codes').delete().eq('id', id);
      return { error: dbError };
    }
    return { error };
  }
}

export async function validatePromoCode(code: string, orderTotal: number = 0) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error('Promo code is required') };
  }

  // 1. Try API endpoint
  try {
    const response = await fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, orderTotal })
    });
    
    const text = await response.text();
    let result: any = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      console.warn('[validatePromoCode] Non-JSON API response:', text);
    }

    if (response.ok && result && result.valid) {
      return {
        data: result.promo || result.data,
        valid: true,
        discountApplied: result.discountApplied || 0,
        discountedTotal: result.discountedTotal !== undefined ? result.discountedTotal : orderTotal,
        error: null
      };
    }

    if (result && result.valid === false && result.error) {
      return {
        data: null,
        valid: false,
        discountApplied: 0,
        discountedTotal: orderTotal,
        error: new Error(result.error)
      };
    }
  } catch (apiErr) {
    console.warn('[validatePromoCode] API fetch error:', apiErr);
  }

  // 2. Direct Supabase DB Fallback
  if (supabase) {
    try {
      const { data: dbPromo, error: dbErr } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (!dbErr && dbPromo) {
        if (!dbPromo.active) {
          return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error('Promo code is inactive') };
        }
        if (dbPromo.expires_at && new Date(dbPromo.expires_at) < new Date()) {
          return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error('Promo code has expired') };
        }
        if (dbPromo.max_uses !== null && dbPromo.max_uses !== undefined && dbPromo.times_used >= dbPromo.max_uses) {
          return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error('Promo code usage limit reached') };
        }
        const minOrder = parseFloat(String(dbPromo.min_order_amount || 0)) || 0;
        if (orderTotal < minOrder) {
          return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error(`Order must be at least R${minOrder.toFixed(2)} to use this code`) };
        }

        const discountVal = parseFloat(String(dbPromo.discount_value || 0)) || 0;
        let discountApplied = 0;
        if (dbPromo.discount_type === 'percent') {
          discountApplied = Math.round((orderTotal * (discountVal / 100)) * 100) / 100;
        } else {
          discountApplied = Math.min(orderTotal, discountVal);
        }
        const discountedTotal = Math.round(Math.max(0, orderTotal - discountApplied) * 100) / 100;

        return {
          data: dbPromo,
          valid: true,
          discountApplied,
          discountedTotal,
          error: null
        };
      }
    } catch (dbEx) {
      console.warn('[validatePromoCode] Supabase DB fallback failed:', dbEx);
    }
  }

  // 3. Fallback Standard Demo Codes
  let fallbackPromo: any = null;
  if (cleanCode === 'SAVE10') {
    fallbackPromo = { id: 9991, code: 'SAVE10', discount_type: 'percent', discount_value: 10, min_order_amount: 0, active: true };
  } else if (cleanCode === 'SAVE20') {
    fallbackPromo = { id: 9992, code: 'SAVE20', discount_type: 'percent', discount_value: 20, min_order_amount: 0, active: true };
  } else if (cleanCode === 'WELCOME50' || cleanCode === 'PROOF50') {
    fallbackPromo = { id: 9993, code: cleanCode, discount_type: 'fixed', discount_value: 50, min_order_amount: 100, active: true };
  } else if (cleanCode === 'CLUB100') {
    fallbackPromo = { id: 9994, code: 'CLUB100', discount_type: 'fixed', discount_value: 100, min_order_amount: 200, active: true };
  }

  if (fallbackPromo) {
    const minOrder = fallbackPromo.min_order_amount || 0;
    if (orderTotal < minOrder) {
      return { data: null, valid: false, discountApplied: 0, discountedTotal: orderTotal, error: new Error(`Order must be at least R${minOrder.toFixed(2)} to use this code`) };
    }
    const discountVal = fallbackPromo.discount_value || 0;
    let discountApplied = 0;
    if (fallbackPromo.discount_type === 'percent') {
      discountApplied = Math.round((orderTotal * (discountVal / 100)) * 100) / 100;
    } else {
      discountApplied = Math.min(orderTotal, discountVal);
    }
    const discountedTotal = Math.round(Math.max(0, orderTotal - discountApplied) * 100) / 100;

    return {
      data: fallbackPromo,
      valid: true,
      discountApplied,
      discountedTotal,
      error: null
    };
  }

  return {
    data: null,
    valid: false,
    discountApplied: 0,
    discountedTotal: orderTotal,
    error: new Error('Invalid or non-existent promo code')
  };
}

export async function recordPromoRedemption(promo_code_id: number, order_id: string, user_id?: string) {
  if (supabase) {
    const { error } = await supabase.from('promo_code_redemptions').insert([{
      promo_code_id,
      order_id,
      user_id: user_id || null
    }]);
    if (!error) {
       const { data: promo } = await supabase.from('promo_codes').select('times_used').eq('id', promo_code_id).single();
       if (promo) {
         await supabase.from('promo_codes').update({ times_used: promo.times_used + 1 }).eq('id', promo_code_id);
       }
    }
    return { error };
  }
  return { error: null };
}
