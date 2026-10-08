/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { View, Whisky, User, UserRole } from './types';
import { supabase, getUserProfile, syncProfile, signOut as supabaseSignOut, getJournalEntries, saveJournalEntry, deleteJournalEntry, getUserClubs } from './services/supabase';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import HomeScreen from './components/HomeScreen';
import ScanScreen from './components/ScanScreen';
import ResultScreen from './components/ResultScreen';
import JournalScreen from './components/JournalScreen';
import ChatScreen from './components/ChatScreen';
import EventsScreen from './components/EventsScreen';
import BoutiqueScreen from './components/BoutiqueScreen';
import LandingPage from './components/LandingPage';
import AdminSection from './components/AdminSection';
import TeaserLimitModal from './components/TeaserLimitModal';
import ExploreClubsScreen from './components/ExploreClubsScreen';
import PayfastCheckoutModal from './components/PayfastCheckoutModal';
import MembershipPlanSelectModal from './components/MembershipPlanSelectModal';
import { getSubscription } from './services/supabase';
import { 
  subscribeToNotifications,
  getNotifications 
} from './services/notifications';

function AppLoadingScreen() {
  const words = ['Distilling', 'Cooking', 'Fermenting'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface gap-4 min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-on-surface/60 font-mono text-xs uppercase tracking-widest animate-pulse transition-all duration-300">
        {words[index]}...
      </p>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [activeWhisky, setActiveWhisky] = useState<Whisky | null>(null);
  const [journal, setJournal] = useState<Whisky[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [teaserState, setTeaserState] = useState<{ isOpen: boolean; type: 'scan' | 'chat' }>({
    isOpen: false,
    type: 'scan'
  });
  const bypassRef = useState(false); // Track if we are in bypass mode

  const [pendingEventPreview, setPendingEventPreview] = useState<any | null>(null);
  const [pendingBoutiquePreview, setPendingBoutiquePreview] = useState<any | null>(null);

  // Parse invite tokens and events on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    const eventParam = params.get('event');

    if (inviteToken) {
      localStorage.setItem('pending_invite', inviteToken);
      // Clean query parameter from URL so it doesn't clutter
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (eventParam) {
      localStorage.setItem('pending_event', eventParam);
    }
  }, []);

  // Fetch preview details for incoming invite
  useEffect(() => {
    const fetchPendingInvite = async () => {
      const pendingInvite = localStorage.getItem('pending_invite');
      if (pendingInvite) {
        try {
          if (pendingInvite.startsWith('btq_')) {
            const { getBoutiqueInvite, getBoutiqueItem } = await import('./services/supabase');
            const { data: invite } = await getBoutiqueInvite(pendingInvite);
            if (invite && invite.boutique_id) {
               const { data: itemData } = await getBoutiqueItem(invite.boutique_id);
               if (itemData) {
                 setPendingBoutiquePreview(itemData);
               }
            }
          } else {
            const { getEventInvite, getEvent } = await import('./services/supabase');
            const { data: invite } = await getEventInvite(pendingInvite);
            if (invite && invite.event_id) {
              const { data: eventData } = await getEvent(invite.event_id);
              if (eventData) {
                setPendingEventPreview(eventData);
              }
            }
          }
        } catch (e) {
          console.warn("Failed to fetch pending preview:", e);
        }
      }
    };
    fetchPendingInvite();
  }, [user]);

  // Handle post-signup consumption and club linkage
  const handlePostAuth = async (userId: string) => {
    const pendingInvite = localStorage.getItem('pending_invite');

    if (pendingInvite) {
      try {
        if (pendingInvite.startsWith('btq_')) {
          const { getBoutiqueInvite, consumeBoutiqueInvite, addClubMember, getUserClubs } = await import('./services/supabase');
          const { data: invite } = await getBoutiqueInvite(pendingInvite);

          if (invite) {
            const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : Infinity;
            const withinLimit = (invite.uses_count || 0) < (invite.uses_limit || 50);

            if (expiresAt > Date.now() && withinLimit) {
              await consumeBoutiqueInvite(invite.id, invite.uses_count || 0);

              if (invite.club_id) {
                await addClubMember(userId, invite.club_id);
                const { data: list } = await getUserClubs(userId);
                if (list) {
                  setUser(prev => prev ? { ...prev, clubs: list, clubId: invite.club_id } : prev);
                }
              }

              localStorage.setItem('pending_boutique_product', invite.boutique_id);
              localStorage.removeItem('pending_invite');
              setPendingBoutiquePreview(null);
            } else {
              console.warn("[handlePostAuth] Invite token has expired or hit limit", invite);
            }
          }
        } else {
          const { getEventInvite, consumeEventInvite, addClubMember, getUserClubs } = await import('./services/supabase');
          const { data: invite } = await getEventInvite(pendingInvite);

          if (invite) {
            const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : Infinity;
            const withinLimit = (invite.uses_count || 0) < (invite.uses_limit || 50);

            if (expiresAt > Date.now() && withinLimit) {
              await consumeEventInvite(invite.id, invite.uses_count || 0);

              if (invite.club_id) {
                await addClubMember(userId, invite.club_id);
                const { data: list } = await getUserClubs(userId);
                if (list) {
                  setUser(prev => prev ? { ...prev, clubs: list, clubId: invite.club_id } : prev);
                }
              }

              localStorage.setItem('pending_event', invite.event_id);
              localStorage.removeItem('pending_invite');
              setPendingEventPreview(null);
            } else {
              console.warn("[handlePostAuth] Invite token has expired or hit limit", invite);
            }
          }
        }
      } catch (err) {
        console.error("[handlePostAuth] Error processing pending invite:", err);
      }
    }

    // After resolving invite, if there's a pending event, let's navigate to events and open checkout
    const activePendingEvent = localStorage.getItem('pending_event');
    if (activePendingEvent) {
      console.log("[handlePostAuth] Directing to events view to purchase checkout for:", activePendingEvent);
      setCurrentView('events');
      localStorage.setItem('auto_checkout_event_id', activePendingEvent);
      localStorage.removeItem('pending_event');
    }

    // After resolving boutique invite, if there's a pending boutique product, let's navigate to boutique and auto open item modal
    const activePendingBoutique = localStorage.getItem('pending_boutique_product');
    if (activePendingBoutique) {
      console.log("[handlePostAuth] Directing to boutique view to view product details for:", activePendingBoutique);
      setCurrentView('boutique');
      localStorage.setItem('auto_open_boutique_product_id', activePendingBoutique);
      localStorage.removeItem('pending_boutique_product');
    }
  };

  useEffect(() => {
    if (user?.id) {
      handlePostAuth(user.id);
    }
  }, [user?.id]);

  // Subscription management state and loaders
  const [subscription, setSubscription] = useState<any>(null);
  const [isPlanSelectOpen, setIsPlanSelectOpen] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<any>(null);

  const refreshSubscription = async (userIdToUse?: string) => {
    const targetUid = userIdToUse || user?.id;
    if (targetUid) {
      try {
        const { getSubscription } = await import('./services/supabase');
        const { data } = await getSubscription(targetUid);
        console.log("[App Subscription Monitor] Loaded sub state:", data);
        setSubscription(data);
      } catch (e) {
        console.error("Failed to load subscription status:", e);
      }
    } else {
      setSubscription(null);
    }
  };

  useEffect(() => {
    if (user?.id) {
      refreshSubscription(user.id);
    } else {
      setSubscription(null);
    }
  }, [user?.id]);

  const handleSelectPlan = (plan: 'monthly' | 'annual') => {
    setIsPlanSelectOpen(false);
    
    const fee = plan === 'annual' ? 2400 : 250;
    const name = plan === 'annual' ? 'Annual Membership' : 'Monthly Membership';
    const subItem = {
      id: `membership-${plan}`,
      title: name,
      name: name,
      payfast_price: fee,
      description: plan === 'annual' 
        ? 'Elite annual premium standing. Exclusive access to masterclasses, distillery partnerships, and early allocations.'
        : 'Full access to the PROOF Club Circle, rare bottle scan identifiers, and private club allocations',
      image: plan === 'annual'
        ? 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400'
        : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=400'
    };
    
    setCheckoutItem(subItem);
  };

  const getScanCount = () => {
    try {
      return parseInt(localStorage.getItem('proof_guest_scans_count') || '0', 10);
    } catch {
      return 0;
    }
  };

  const triggerTeaserModal = (type: 'scan' | 'chat') => {
    setTeaserState({ isOpen: true, type });
  };

  const handleUpgradeGuestToMember = (email?: string, username?: string, authData?: any) => {
    if (authData?.user) {
      setUser({
        id: authData.user.id,
        email: authData.user.email || email || '',
        role: 'member',
        username: username || authData.user.user_metadata?.username || 'Collector'
      });
      if (authData.user.id !== 'demo-user') {
        bypassRef[1](false); // Clear bypass as we now have a real session
      }
    } else if (user) {
      setUser({
        ...user,
        role: 'member',
        email: email || user.email,
        username: username || user.username || 'Collector'
      });
    }
    setTeaserState(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const fetchJournal = async () => {
      if (user?.id) {
        console.log("App: fetching user journal entries for:", user.id);
        const { data, error } = await getJournalEntries(user.id);
        if (data) {
          setJournal(data);
        }
      } else {
        setJournal([]);
      }
    };
    fetchJournal();
  }, [user?.id]);

  useEffect(() => {
    const initAuth = async () => {
      console.log("App: initAuth started");

      try {
        if (!supabase) {
          console.warn("App: Supabase not configured, stopping initAuth");
          setLoading(false);
          return;
        }

        console.log("App: fetching session...");
        // Give up to 30 seconds for the session check in case of cold-starts/paused free-tier databases.
        const authTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Supabase auth session check timed out")), 30000)
        );

        let data, error;
        try {
          const authResult = await Promise.race([
            supabase.auth.getSession(),
            authTimeout
          ]) as any;
          data = authResult.data;
          error = authResult.error;
        } catch (raceErr: any) {
          console.warn("App: Auth session race condition or timeout:", raceErr.message);
          error = raceErr;
        }

        if (error) {
          console.error("App: session error or timeout", error);
          // If we timeout, we proceed as unauthenticated
          setLoading(false);
          return;
        }
        
        const session = data?.session;
        console.log("App: session found?", !!session);
        if (session) {
          try {
            // ensure profile exists - with its own shorter timeout
            console.log("App: fetching profile...");
            const profileResponse = await getUserProfile(session.user.id);
            let profile = profileResponse.data;
            
            if (profileResponse.error) {
              console.warn("App: Profile fetch had error, using fallback/sync result", profileResponse.error);
            }

            const isMasterAdmin = session.user.email === 'proofadmin@gmail.com';

            if (!profileResponse.error && (!profile || (!profile.club_id && session.user.user_metadata?.club_id))) {
              console.log("App: profile missing or incomplete, attempting sync...");
              try {
                const synced = await syncProfile(session.user);
                if (synced) {
                  profile = synced;
                }
              } catch (e) {
                console.error("App: Async syncProfile error", e);
              }
            }

            console.log("App: Setting user state for:", session.user.email, isMasterAdmin ? "(MASTER)" : "");
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: isMasterAdmin ? 'master_admin' : (profile?.role as UserRole) || 'member',
              clubId: profile?.club_id || undefined,
              clubName: profile?.club_name || undefined,
              username: profile?.username || session.user.user_metadata?.username || ''
            });

            if (session.user.id !== 'admin-bypass-id') {
              getUserClubs(session.user.id)
                .then(({ data: clubMemberships }) => {
                  if (clubMemberships) {
                    setUser(prev => prev ? { 
                      ...prev, 
                      clubs: clubMemberships 
                    } : prev);
                  }
                })
                .catch(clubErr => {
                  console.warn("App: Could not load club memberships (background):", clubErr);
                });
            }
          } catch (profileErr) {
            console.error("App: profile fetch/sync error", profileErr);
            // Even if profile fails, we have the session
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: session.user.email === 'proofadmin@gmail.com' ? 'master_admin' : 'member'
            });
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        console.log("App: initAuth finished");
        setLoading(false);
      }
    };
    initAuth();
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("App: Auth state change event:", event, "Session exists:", !!session);
        if (session) {
          try {
            const profileResponse = await getUserProfile(session.user.id);
            let profile = profileResponse.data;
            
            if (!profileResponse.error && (!profile || (!profile.club_id && session.user.user_metadata?.club_id))) {
              const synced = await syncProfile(session.user);
              if (synced) profile = synced;
            }
            
            const isMasterAdmin = session.user.email === 'proofadmin@gmail.com';
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: isMasterAdmin ? 'master_admin' : (profile?.role as UserRole) || 'member',
              clubId: profile?.club_id || undefined,
              clubName: profile?.club_name || undefined,
              username: profile?.username || session.user.user_metadata?.username || ''
            });

            if (session.user.id !== 'admin-bypass-id') {
              getUserClubs(session.user.id)
                .then(({ data: clubMemberships }) => {
                  if (clubMemberships) {
                    setUser(prev => prev ? { 
                      ...prev, 
                      clubs: clubMemberships 
                    } : prev);
                  }
                })
                .catch(clubErr => {
                  console.warn("App: Club memberships load failed (background):", clubErr);
                });
            }
          } catch (err) {
            console.error("App: Auth state change profile error:", err);
            // set minimal user info
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: session.user.email === 'proofadmin@gmail.com' ? 'master_admin' : 'member'
            });
          }
        } else if (event === 'SIGNED_OUT' || (!session && !bypassRef[0])) {
          console.log("App: No session and not in bypass mode, clearing user");
          setUser(null);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id || user.role === 'guest') return;

    // Load initial notifications
    getNotifications(user.id).then(({ data }) => {
      if (data) {
        setNotifications(data);
        setUnreadCount(
          data.filter((n: any) => !n.read).length
        );
      }
    });

    // Subscribe to realtime updates
    const cleanup = subscribeToNotifications(
      user.id,
      (newNotification) => {
        setNotifications(prev => {
          // Avoid duplicate notification insertions from race conditions or dual channels
          if (prev.some(n => n.id === newNotification.id)) return prev;
          return [newNotification, ...prev];
        });
        setUnreadCount(prev => prev + 1);
      }
    );

    return cleanup;
  }, [user?.id]);

  // Check for session in real app, here we just use state
  const handleLogin = async (role: UserRole, email?: string, authData?: any) => {
    console.log("App: handleLogin called with role:", role, "email:", email, "authData.user.id:", authData?.user?.id);
    if (authData?.user) {
      const isMasterAdmin = authData.user.email === 'proofadmin@gmail.com' || email === 'proofadmin@gmail.com';
      
      if (authData.user.id === 'admin-bypass-id' || authData.user.id === 'guest-bypass-id') {
        bypassRef[1](true); // Mark as bypass mode
      }

      let clubId = isMasterAdmin ? 'underground-001' : undefined;
      let clubName = isMasterAdmin ? 'Underground Whisky Club Cape Town' : undefined;
      let username = '';
      let userRole: UserRole = isMasterAdmin ? 'master_admin' : (role as UserRole);

      try {
        if (authData.user.id !== 'guest-bypass-id') {
          const profileResponse = await getUserProfile(authData.user.id);
          let profile = profileResponse.data;
          if (!profile || (profile as any).is_fallback || (!profile.club_id && authData.user.user_metadata?.club_id)) {
            const synced = await syncProfile(authData.user);
            if (synced) profile = synced;
          }
          if (profile) {
            clubId = profile.club_id || clubId;
            clubName = profile.club_name || clubName;
            username = profile.username || '';
            userRole = isMasterAdmin ? 'master_admin' : (profile.role as UserRole) || userRole;
          }
        }
      } catch (err) {
        console.error("App: error resolving profile in handleLogin:", err);
      }

      setUser({
        id: authData.user.id,
        email: authData.user.email || email || '',
        role: userRole,
        clubName,
        clubId,
        username
      });

      if (authData.user.id !== 'guest-bypass-id' && authData.user.id !== 'admin-bypass-id') {
        getUserClubs(authData.user.id)
          .then(({ data: clubMemberships }) => {
            if (clubMemberships) {
              setUser(prev => prev ? { 
                ...prev, 
                clubs: clubMemberships 
              } : prev);
            }
          })
          .catch(clubErr => {
            console.warn("App: Club memberships load failed (background):", clubErr);
          });
      }
    } else if (!supabase) {
      const isMasterAdmin = email === 'proofadmin@gmail.com';
      setUser({
        id: '1',
        email: email || (isMasterAdmin ? 'proofadmin@gmail.com' : 'user@example.com'),
        role: isMasterAdmin ? 'master_admin' : (role as UserRole),
        clubName: isMasterAdmin ? 'Underground Whisky Club Cape Town' : undefined,
        clubId: isMasterAdmin ? 'underground-001' : undefined
      });
    }
    setCurrentView('home');
  };

  const handleLogout = async () => {
    try {
      console.log("App: handleLogout triggered");
      bypassRef[1](false); // Clear bypass mode
      setNotifications([]);  // Clear notifications state on logout
      setUnreadCount(0);     // Reset unread count
      // Don't await here to make UI response snappier, 
      // or at least handle errors gracefully.
      supabaseSignOut(); 
      setUser(null);
      setCurrentView('home'); 
    } catch (err) {
      console.error("Logout error:", err);
      setNotifications([]);
      setUnreadCount(0);
      setUser(null); // Force clear user even on error
    }
  };

  const handleScanComplete = (whiskyData: any) => {
    if (user?.role === 'guest') {
      try {
        const scanCount = parseInt(localStorage.getItem('proof_guest_scans_count') || '0', 10);
        localStorage.setItem('proof_guest_scans_count', String(scanCount + 1));
      } catch (err) {
        console.error("App: error saving guest scan count:", err);
      }
    }
    setActiveWhisky({
      ...whiskyData,
      id: whiskyData.id || Math.random().toString(36).substr(2, 9),
      image: whiskyData.image || "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b"
    });
    setCurrentView('home'); // Result panel is triggered by activeWhisky being set
  };

  const handleSaveToJournal = async () => {
    if (activeWhisky) {
      const newEntry: Whisky = {
        ...activeWhisky,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        rating: 5 // Default rating for new scans
      };

      if (user?.id) {
        console.log("App: Saving scanned item to Supabase journals...", newEntry);
        const { data, error } = await saveJournalEntry(user.id, newEntry);
        if (error) {
          console.warn("App: Save to Supabase failed, using client-side mock/fallback", error);
        }
        if (data) {
          setJournal(prev => {
            const filtered = prev.filter(item => item.id !== data.id && item.name !== data.name);
            return [data, ...filtered];
          });
        } else {
          setJournal(prev => [newEntry, ...prev]);
        }
      } else {
        setJournal(prev => [newEntry, ...prev]);
      }

      setActiveWhisky(null);
      setCurrentView('journal');
    }
  };

  const handleDeleteJournalEntry = async (id: string) => {
    if (user?.id) {
      console.log("App: Deleting journal entry with ID:", id);
      const { error } = await deleteJournalEntry(user.id, id);
      if (error) {
        console.warn("App: Delete from Supabase failed", error);
      }
    }
    setJournal(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateJournalEntry = async (updatedEntry: Whisky) => {
    const taste = updatedEntry.tasteRating ?? updatedEntry.rating ?? 5;
    const aroma = updatedEntry.aromaRating ?? updatedEntry.rating ?? 5;
    const value = updatedEntry.valueRating ?? updatedEntry.rating ?? 5;
    const average = Math.round(((taste + aroma + value) / 3) * 10) / 10;
    
    const entryToSave = {
      ...updatedEntry,
      rating: Math.round(average),
      tasteRating: taste,
      aromaRating: aroma,
      valueRating: value
    };

    setJournal(prev => prev.map(item => item.id === updatedEntry.id ? entryToSave : item));

    if (user?.id) {
      console.log("App: Updating journal entry:", entryToSave);
      const { data, error } = await saveJournalEntry(user.id, entryToSave);
      if (error) {
        console.warn("App: Update failed, client local copy kept", error);
      } else if (data) {
        setJournal(prev => prev.map(item => item.id === updatedEntry.id ? data : item));
      }
    }
  };

  const renderView = () => {
    if (loading) return <AppLoadingScreen />;
    if (!user) return <LandingPage onLogin={handleLogin} pendingEventPreview={pendingEventPreview} pendingBoutiquePreview={pendingBoutiquePreview} />;

    if (activeWhisky) {
      return (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <ResultScreen 
            whisky={activeWhisky} 
            onSave={handleSaveToJournal}
          />
        </motion.div>
      );
    }

    switch (currentView) {
      case 'home':
        return (
          <HomeScreen 
            onScanClick={() => {
              if (user?.role === 'guest' && getScanCount() >= 3) {
                triggerTeaserModal('scan');
              } else {
                setCurrentView('scan');
              }
            }} 
            onViewCellarClick={() => setCurrentView('journal')} 
            journal={journal} 
            onSubscribeClick={() => setIsPlanSelectOpen(true)}
            hasActiveSubscription={subscription?.status === 'active'}
            onNavigate={(view) => setCurrentView(view)}
          />
        );
      case 'scan':
        return <ScanScreen onComplete={handleScanComplete} />;
      case 'journal':
        return (
          <JournalScreen 
            entries={journal} 
            onDeleteEntry={handleDeleteJournalEntry} 
            onUpdateEntry={handleUpdateJournalEntry} 
          />
        );
      case 'chat':
        return <ChatScreen user={user} onTeaserLimit={() => triggerTeaserModal('chat')} />;
      case 'events': {
        const clubIds = user.clubs && user.clubs.length > 0 
          ? user.clubs.map(c => c.club_id) 
          : (user.clubId ? [user.clubId] : undefined);
        return <EventsScreen clubId={user.role === 'master_admin' ? undefined : clubIds} user={user} />;
      }
      case 'explore-clubs':
        return (
          <ExploreClubsScreen 
            user={user} 
            onRefreshUserClubs={async () => {
              if (user?.id) {
                try {
                  const { data } = await getUserClubs(user.id);
                  if (data) {
                    setUser(prev => prev ? { ...prev, clubs: data } : null);
                  }
                } catch (err) {
                  console.warn("App: Failed to refresh clubs:", err);
                }
              }
            }} 
          />
        );
      case 'boutique': {
        const clubIds = user.clubs && user.clubs.length > 0 
          ? user.clubs.map(c => c.club_id) 
          : (user.clubId ? [user.clubId] : undefined);
        return <BoutiqueScreen clubId={user.role === 'master_admin' ? undefined : clubIds} />;
      }
      case 'admin':
        return <AdminSection clubName={user.clubName} clubId={user.clubId} userRole={user.role} userId={user.id} />;
      default:
        return (
          <HomeScreen 
            onScanClick={() => {
              if (user?.role === 'guest' && getScanCount() >= 3) {
                triggerTeaserModal('scan');
              } else {
                setCurrentView('scan');
              }
            }} 
            onViewCellarClick={() => setCurrentView('journal')} 
            journal={journal} 
            onSubscribeClick={() => setIsPlanSelectOpen(true)}
            hasActiveSubscription={subscription?.status === 'active'}
            onNavigate={(view) => setCurrentView(view)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-full overflow-x-hidden">
      {user && (
        <TopNav 
          onLogout={handleLogout} 
          onGuestUpgradeClick={() => triggerTeaserModal('scan')} 
          onSubscribeClick={() => setIsPlanSelectOpen(true)}
          hasActiveSubscription={subscription?.status === 'active'}
          user={user} 
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={() => {
            setUnreadCount(0);
            setNotifications(prev => 
              prev.map(n => ({ ...n, read: true }))
            );
          }}
          onMarkAsRead={(id) => {
            setNotifications(prev =>
              prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
          }}
          onDeleteNotification={(id) => {
            setNotifications(prev => {
              const item = prev.find(n => n.id === id);
              if (item && !item.read) {
                setUnreadCount(c => Math.max(0, c - 1));
              }
              return prev.filter(n => n.id !== id);
            });
          }}
          onClearAllNotifications={() => {
            setNotifications([]);
            setUnreadCount(0);
          }}
          onNavigate={(view) => {
            setCurrentView(view);
          }}
        />
      )}
      
      <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden scrollbar-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={!user ? 'landing' : (activeWhisky ? 'result' : currentView)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {user && (
        <BottomNav 
          currentView={currentView} 
          userRole={user.role}
          onViewChange={(view) => {
            setActiveWhisky(null);
            setCurrentView(view);
          }} 
        />
      )}

      <TeaserLimitModal
        isOpen={teaserState.isOpen}
        onClose={() => setTeaserState(prev => ({ ...prev, isOpen: false }))}
        type={teaserState.type}
        onUpgrade={handleUpgradeGuestToMember}
      />

      <MembershipPlanSelectModal
        isOpen={isPlanSelectOpen}
        onClose={() => setIsPlanSelectOpen(false)}
        onSelectPlan={handleSelectPlan}
      />

      {checkoutItem && (
        <PayfastCheckoutModal
          isOpen={!!checkoutItem}
          onClose={() => setCheckoutItem(null)}
          item={checkoutItem}
          itemType="subscription"
          userEmail={user?.email || 'member@proof.club'}
          onSuccess={() => {
            setCheckoutItem(null);
            refreshSubscription();
          }}
        />
      )}
    </div>
  );
}

