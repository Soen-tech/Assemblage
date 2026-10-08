import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, Calendar, ShoppingBag, Save, X, Loader2, Users, ShieldCheck, Database, Upload, Ticket, Check, RefreshCw, Eye, Share2, Link } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ClubEvent, UserRole } from '../types';
import { FEATURED_EVENTS, BOUTIQUE_ITEMS } from '../constants';
import { cn } from '../lib/utils';
import { 
  getEvents, saveEvent, deleteEvent, 
  getBoutiqueItems, saveBoutiqueItem, deleteBoutiqueItem,
  getClubs, saveClub, deleteClub,
  getProfiles, updateUserRole,
  addClubMember, removeClubMember,
  uploadStorageImage,
  getAdminTickets, updateTicketStatus,
  getAdminOrders,
  generateEventInviteLink, generateBoutiqueInviteLink,
  getPromoCodes, savePromoCode, deletePromoCode
} from '../services/supabase';

type AdminTab = 'events' | 'boutique' | 'clubs' | 'users' | 'tickets' | 'orders' | 'promo';

export default function AdminSection({ 
  clubName, 
  clubId, 
  userRole,
  userId
}: { 
  clubName?: string; 
  clubId?: string;
  userRole?: UserRole;
  userId?: string;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>('events');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Announcement Broadcast States
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastClubId, setBroadcastClubId] = useState(clubId || '');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const folder = activeTab === 'boutique' ? 'boutique' : activeTab === 'clubs' ? 'clubs' : 'events';
      console.log(`[handleFileUpload] Triggering storage bucket upload for ${folder}:`, file.name);
      const { publicUrl, error } = await uploadStorageImage(file, folder);
      
      if (error) {
        throw error;
      }
      
      if (publicUrl) {
        if (imageInputRef.current) {
          imageInputRef.current.value = publicUrl;
        }
        setImagePreview(publicUrl);
        console.log("[handleFileUpload] Bucket upload completed. Public URL attached:", publicUrl);
      }
    } catch (err: any) {
      console.error("[handleFileUpload] Failed to upload:", err);
      alert(`Storage Bucket Upload failed: ${err.message || 'Please check your Supabase Storage permissions for public access.'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  const [events, setEvents] = useState<ClubEvent[]>(FEATURED_EVENTS);
  const [products, setProducts] = useState<any[]>(BOUTIQUE_ITEMS);
  const [clubs, setClubs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'valid' | 'pending' | 'used' | 'cancelled'>('all');
  const [updatingTicketStatusId, setUpdatingTicketStatusId] = useState<string | null>(null);

  const isMasterAdmin = userRole === 'master_admin';

  useEffect(() => {
    const loadClubsForBroadcast = async () => {
      try {
        const { data } = await getClubs();
        if (data) {
          setClubs(data);
          if (!broadcastClubId && data.length > 0) {
            setBroadcastClubId(clubId || data[0].id);
          }
        }
      } catch (e) {
        console.warn("Could not pre-load clubs:", e);
      }
    };
    loadClubsForBroadcast();
  }, [clubId]);

  useEffect(() => {
    fetchData(true);
  }, [activeTab]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchData = async (showLoading = false) => {
    if (showLoading) setFetching(true);
    try {
      if (activeTab === 'events') {
        const { data, error } = await getEvents(clubId);
        if (error) console.error("Error fetching events:", error);
        if (data) {
          setEvents(data);
        }
      } else if (activeTab === 'boutique') {
        const { data, error } = await getBoutiqueItems(clubId);
        if (error) console.error("Error fetching items:", error);
        if (data) {
          setProducts(data);
        }
      } else if (activeTab === 'clubs' && isMasterAdmin) {
        const { data, error } = await getClubs();
        if (error) console.error("Error fetching clubs:", error);
        if (data) setClubs(data);
      } else if (activeTab === 'users' && isMasterAdmin) {
        const { data, error } = await getProfiles();
        if (error) console.error("Error fetching profiles:", error);
        if (data) setProfiles(data);
        
        // Also ensure we have clubs for the user edit dropdown
        const { data: clubData } = await getClubs();
        if (clubData) setClubs(clubData);
      } else if (activeTab === 'tickets') {
        const { data, error } = await getAdminTickets(clubId);
        if (error) console.error("Error fetching admin tickets:", error);
        if (data) {
          setTickets(data);
        }
        // Also load profiles so we can match user_id to email!
        const { data: profileData } = await getProfiles();
        if (profileData) {
          setProfiles(profileData);
        }
      } else if (activeTab === 'orders') {
        const { data, error } = await getAdminOrders(clubId);
        if (error) console.error("Error fetching admin orders:", error);
        if (data) {
          setOrders(data);
        }
        const { data: profileData } = await getProfiles();
        if (profileData) {
          setProfiles(profileData);
        }
      } else if (activeTab === 'promo' && isMasterAdmin) {
        const { data, error } = await getPromoCodes();
        if (error) console.error("Error fetching promo codes:", error);
        if (data) {
          setPromoCodes(data);
        }
      }
    } catch (err) {
      console.error("fetchData exception:", err);
    } finally {
      if (showLoading) setFetching(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setImagePreview(item.image || null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = Object.fromEntries(formData.entries());
    
    console.log(`[AdminSection] Saving ${activeTab}:`, updates);
    
    setSaving(true);
    try {
      let result;
      
      if (activeTab === 'events') {
        const payload = { 
          ...editingItem, 
          ...updates, 
          category: updates.category || editingItem.category || 'tasting',
          price: updates.price || editingItem.price || '',
          club_id: (updates as any).club_id || clubId || null
        };
        console.log("[AdminSection] Event payload created:", payload);
        result = await saveEvent(payload);
      } else if (activeTab === 'boutique') {
        const payload = { 
          ...editingItem, 
          ...updates, 
          category: updates.category || editingItem.category || 'whisky',
          price: updates.price || editingItem.price || '',
          club_id: (updates as any).club_id || clubId || null
        };
        console.log("[AdminSection] Boutique payload created:", payload);
        result = await saveBoutiqueItem(payload);
      } else if (activeTab === 'clubs' && isMasterAdmin) {
        const clubPayload = { 
          ...editingItem, 
          ...updates,
          image: updates.image || imagePreview || editingItem.image || null
        };
        console.log("[AdminSection] Club payload:", clubPayload);
        result = await saveClub(clubPayload);
      } else if (activeTab === 'users' && isMasterAdmin) {
        // User update is a specific API call
        const { role } = updates as any;
        
        // Find which clubs were checked
        const checkedClubs = clubs.filter(c => !!updates[`membership_${c.id}`]);
        const checkedClubIds = checkedClubs.map(c => c.id);
        
        // Use the first checked club as the primary club, otherwise fall back to null
        const club_id = checkedClubIds[0] || null;
        const selectedClub = club_id ? clubs.find(c => c.id === club_id) : null;
        
        console.log("[AdminSection] User update with memberships:", { 
          id: editingItem.id, role, club_id, checkedClubIds
        });
        
        // First update the primary role and club on the profile
        result = await updateUserRole(
          editingItem.id, 
          role, 
          club_id || undefined, 
          selectedClub?.name
        );
        
        // Update other club memberships
        const clubMemberRole = role === 'admin' ? 'admin' : 'member';
        for (const club of clubs) {
          const isChecked = !!updates[`membership_${club.id}`];
          const originallyMember = editingItem.club_members?.some((m: any) => m.club_id === club.id) || editingItem.club_id === club.id;
          
          if (isChecked && !originallyMember) {
            console.log(`[AdminSection] Adding user to club membership:`, club.id);
            await addClubMember(editingItem.id, club.id, clubMemberRole);
          } else if (!isChecked && originallyMember) {
            console.log(`[AdminSection] Removing user from club membership:`, club.id);
            await removeClubMember(editingItem.id, club.id);
          }
        }
      } else if (activeTab === 'promo' && isMasterAdmin) {
        const payload = {
          ...editingItem,
          ...updates,
          code: (updates.code as string).toUpperCase(),
          discount_type: updates.discount_type || 'percent',
          discount_value: Number(updates.discount_value) || 0,
          min_order_amount: Number(updates.min_order_amount) || 0,
          max_uses: updates.max_uses ? Number(updates.max_uses) : null,
          times_used: editingItem?.times_used || 0,
          active: updates.active === 'on' || updates.active === 'true',
          expires_at: updates.expires_at ? new Date(updates.expires_at as string).toISOString() : null,
        };
        console.log("[AdminSection] Promo payload created:", payload);
        result = await savePromoCode(payload);
      }

      console.log(`[AdminSection] Save result:`, result);

      if (result?.error) {
        throw result.error;
      }

      // Automatically trigger background OneSignal and DB Notification on new item creation
      if (!editingItem || !editingItem.id) {
        const appUrl = (window.location.origin || "").replace(/\/$/, "");
        const targetUrl = `${appUrl}/api/send-notification`;
        let notifyPayload: any = null;

        if (activeTab === "events") {
          notifyPayload = {
            userId: null,
            clubId: updates.club_id || clubId || null,
            type: "new_event",
            title: updates.title || "Exclusive Tasting Event",
            message: "A new private invitation has been secured for you. Tap to RSVP.",
            url: "/events"
          };
        } else if (activeTab === "boutique") {
          notifyPayload = {
            userId: null,
            clubId: updates.club_id || clubId || null,
            type: "new_product",
            title: updates.name || "Boutique Allocation",
            message: "A new curated bottle/item has been cataloged. Tap to secure allocation.",
            url: "/boutique"
          };
        } else if (activeTab === "clubs" && isMasterAdmin) {
          notifyPayload = {
            userId: null,
            clubId: null, // Global segment segment
            type: "new_club",
            title: updates.name || "New Private Club",
            message: "A new exclusive club has opened. Tap to view local listings.",
            url: "/clubs"
          };
        }

        if (notifyPayload) {
          console.log("[AdminAction] Creating content broadcast trigger:", notifyPayload);
          fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notifyPayload)
          })
            .then(async (r) => {
              const body = await r.json().catch(() => ({}));
              console.log("[AdminAction] Notification API response status:", r.status, "body:", body);
              if (!r.ok || !body.success) {
                console.warn("[AdminAction] Notification backend synchronization issue:", body.dbError || body.error || "unknown err");
              }
            })
            .catch((err) => console.warn("[AdminAction] Notification request network failure:", err));
        }
      }

      setEditingItem(null);
      await fetchData(true);
    } catch (err: any) {
      console.error("Save error in handleSave:", err);
      alert(`Failed to save: ${err.message || 'Check your connection and try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Please fill in both the title and message fields for the announcement.");
      return;
    }

    setBroadcasting(true);
    setBroadcastStatus(null);

    try {
      const appUrl = (window.location.origin || '').replace(/\/$/, "");
      const targetUrl = `${appUrl}/api/send-club-announcement`;

      const payload = {
        clubId: broadcastClubId || clubId || null,
        title: broadcastTitle,
        message: broadcastMessage,
        senderUserId: userId || null
      };

      console.log("[Broadcast Console] Sending payload:", targetUrl, payload);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Broadcast Console] Success:", data);
        setBroadcastStatus({ success: true, msg: "Club Announcement successfully broadcasted!" });
        setBroadcastTitle('');
        setBroadcastMessage('');
      } else {
        const text = await response.text();
        console.error("[Broadcast Console] Error status:", text);
        setBroadcastStatus({ success: false, msg: `Broadcast failed: ${text || "Server error"}` });
      }
    } catch (err: any) {
      console.error("[Broadcast Console] Exception occurs:", err);
      setBroadcastStatus({ success: false, msg: `Broadcast error: ${err.message || String(err)}` });
    } finally {
      setBroadcasting(false);
    }
  };

  const [generatingInviteId, setGeneratingInviteId] = useState<string | null>(null);
  const [copiedLinkEventId, setCopiedLinkEventId] = useState<string | null>(null);

  const handleGenerateInvite = async (event: any) => {
    setGeneratingInviteId(event.id);
    try {
      const defaultClubId = clubId || event.club_id || 'underground-001';
      // Supposing admin is user or demo
      const creatorId = userId || 'demo-admin-id';

      const { link, error } = await generateEventInviteLink(
        event.id,
        defaultClubId,
        creatorId,
        50
      );

      if (link) {
        await navigator.clipboard.writeText(link);
        setCopiedLinkEventId(event.id);
        setTimeout(() => setCopiedLinkEventId(null), 3000);
      } else {
        console.error("Failed to generate invite link:", error);
        alert(`Failed to generate invite: ${error?.message || 'Check database tables'}`);
      }
    } catch (err: any) {
      console.error("handleGenerateInvite error:", err);
      alert(`Error generating share link: ${err.message || 'Clipboard permission issue'}`);
    } finally {
      setGeneratingInviteId(null);
    }
  };

  const [generatingBoutiqueInviteId, setGeneratingBoutiqueInviteId] = useState<string | null>(null);
  const [copiedLinkBoutiqueId, setCopiedLinkBoutiqueId] = useState<string | null>(null);

  const handleGenerateBoutiqueInvite = async (product: any) => {
    setGeneratingBoutiqueInviteId(product.id);
    try {
      const defaultClubId = clubId || product.club_id || 'underground-001';
      const creatorId = userId || 'demo-admin-id';

      const { link, error } = await generateBoutiqueInviteLink(
        product.id,
        defaultClubId,
        creatorId,
        50
      );

      if (link) {
        await navigator.clipboard.writeText(link);
        setCopiedLinkBoutiqueId(product.id);
        setTimeout(() => setCopiedLinkBoutiqueId(null), 3000);
      } else {
        console.error("Failed to generate boutique invite link:", error);
        alert(`Failed to generate boutique invite: ${error?.message || 'Check database tables'}`);
      }
    } catch (err: any) {
      console.error("handleGenerateBoutiqueInvite error:", err);
      alert(`Error generating share link: ${err.message || 'Clipboard permission issue'}`);
    } finally {
      setGeneratingBoutiqueInviteId(null);
    }
  };

  const confirmDelete = (id: string | number) => {
    setDeletingId(String(id));
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    setSaving(true);
    try {
      let result;
      if (activeTab === 'events') {
        result = await deleteEvent(deletingId);
      } else if (activeTab === 'boutique') {
        result = await deleteBoutiqueItem(deletingId);
      } else if (activeTab === 'clubs' && isMasterAdmin) {
        result = await deleteClub(deletingId);
      } else if (activeTab === 'promo') {
        result = await deletePromoCode(Number(deletingId));
      }
      
      if (result?.error) {
        console.error("Delete error:", result.error);
        alert(`Failed to delete: ${result.error.message || 'Unknown error'}`);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      console.error("Delete exception:", err);
      alert(`Error during deletion: ${err.message || 'Connection issue'}`);
    } finally {
      setSaving(false);
      setDeletingId(null);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex-1 px-6 pt-6 pb-32">
      <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase">
              {clubName || 'Control Center'}
            </span>
            {clubId && (
              <span className="text-[9px] text-[#d8c39b] font-mono border border-primary/20 bg-primary/5 px-2 py-0.5 rounded-md cursor-help select-all active:scale-95 transition-transform" title="Click to select & copy Club ID for new members">
                Club ID: {clubId}
              </span>
            )}
          </div>
          <h2 className="text-4xl font-serif text-white">Management Vault</h2>
        </div>
      </header>

      <div className={cn(
        "grid gap-2 mb-8 bg-white/5 p-1 rounded-2xl border border-white/5",
        isMasterAdmin ? "grid-cols-2 md:grid-cols-5" : "grid-cols-3"
      )}>
        <button 
          onClick={() => setActiveTab('events')}
          className={cn(
            "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
            activeTab === 'events' ? "bg-primary text-black" : "text-white/40 hover:text-white"
          )}
        >
          <Calendar size={14} /> EVENTS
        </button>
        <button 
          onClick={() => setActiveTab('boutique')}
          className={cn(
            "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
            activeTab === 'boutique' ? "bg-primary text-black" : "text-white/40 hover:text-white"
          )}
        >
          <ShoppingBag size={14} /> BOUTIQUE
        </button>
        <button 
          onClick={() => setActiveTab('tickets')}
          className={cn(
            "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
            activeTab === 'tickets' ? "bg-primary text-black" : "text-white/40 hover:text-white"
          )}
        >
          <Ticket size={14} /> TICKETS
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={cn(
            "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
            activeTab === 'orders' ? "bg-primary text-black" : "text-white/40 hover:text-white"
          )}
        >
          <ShoppingBag size={14} /> ORDERS
        </button>
        {isMasterAdmin && (
          <>
            <button 
              onClick={() => setActiveTab('clubs')}
              className={cn(
                "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
                activeTab === 'clubs' ? "bg-primary text-black" : "text-white/40 hover:text-white"
              )}
            >
              <Database size={14} /> CLUBS
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
                activeTab === 'users' ? "bg-primary text-black" : "text-white/40 hover:text-white"
              )}
            >
              <Users size={14} /> USERS
            </button>
            <button 
              onClick={() => setActiveTab('promo')}
              className={cn(
                "h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all",
                activeTab === 'promo' ? "bg-primary text-black" : "text-white/40 hover:text-white"
              )}
            >
              <Ticket size={14} /> PROMO CODES
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-serif text-white capitalize">
          {activeTab === 'tickets' ? 'Participant Tickets' : activeTab === 'orders' ? 'Boutique Orders' : activeTab === 'promo' ? 'Promo Codes' : `${activeTab} Listings`}
        </h3>
        {activeTab !== 'users' && activeTab !== 'tickets' && activeTab !== 'orders' && (
          <button 
            onClick={() => setEditingItem({})}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <Plus size={16} /> ADD NEW
          </button>
        )}
      </div>

      <div className="space-y-4">
        {fetching ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-xs uppercase tracking-widest">Accessing Vault...</p>
          </div>
        ) : activeTab === 'events' ? (
          events.map(event => (
            <div key={event.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4">
                <img src={event.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=200'} className="w-16 h-16 object-cover rounded-xl" alt="" />
                <div>
                  <h4 className="font-serif text-white leading-tight">{event.title}</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{event.date} • {event.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  onClick={() => handleGenerateInvite(event)}
                  disabled={generatingInviteId === event.id}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap",
                    copiedLinkEventId === event.id
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold"
                      : "bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:border-primary/45"
                  )}
                  title="Generate invitation code & dynamic route"
                >
                  {generatingInviteId === event.id ? (
                    <Loader2 size={12} className="animate-spin text-primary" />
                  ) : copiedLinkEventId === event.id ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Share2 size={12} className="text-primary" />
                  )}
                  <span>
                    {generatingInviteId === event.id ? 'Generating...' : copiedLinkEventId === event.id ? 'Copied Link!' : 'Generate Share Link'}
                  </span>
                </button>

                <div className="flex gap-1">
                  <button onClick={() => handleEdit(event)} className="p-2 text-white/40 hover:text-primary transition-colors" title="Edit Event Details">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => confirmDelete(event.id)} className="p-2 text-white/40 hover:text-red-400 transition-colors" title="Remove Event">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : activeTab === 'boutique' ? (
          products.map(product => (
            <div key={product.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center text-primary overflow-hidden shrink-0">
                  {product.image ? (
                    <img src={product.image} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <ShoppingBag size={24} />
                  )}
                </div>
                <div>
                  <h4 className="font-serif text-white leading-tight">{product.name}</h4>
                  <p className="text-xs text-primary mt-1 font-bold">{product.price}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  onClick={() => handleGenerateBoutiqueInvite(product)}
                  disabled={generatingBoutiqueInviteId === product.id}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap",
                    copiedLinkBoutiqueId === product.id
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold"
                      : "bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:border-primary/45"
                  )}
                  title="Generate boutique invitation code & dynamic route"
                >
                  {generatingBoutiqueInviteId === product.id ? (
                    <Loader2 size={12} className="animate-spin text-primary" />
                  ) : copiedLinkBoutiqueId === product.id ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Share2 size={12} className="text-primary" />
                  )}
                  <span>
                    {generatingBoutiqueInviteId === product.id ? 'Generating...' : copiedLinkBoutiqueId === product.id ? 'Copied Link!' : 'Generate Share Link'}
                  </span>
                </button>

                <div className="flex gap-1">
                  <button onClick={() => handleEdit(product)} className="p-2 text-white/40 hover:text-primary transition-colors" title="Edit Item Details">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => confirmDelete(product.id)} className="p-2 text-white/40 hover:text-red-400 transition-colors" title="Remove Item">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : activeTab === 'clubs' ? (
          clubs.map(club => (
            <div key={club.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center text-primary overflow-hidden">
                  {club.image ? (
                    <img src={club.image} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Database size={24} />
                  )}
                </div>
                <div>
                  <h4 className="font-serif text-white leading-tight">{club.name}</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{club.location || 'Location Pending'}</p>
                  <p className="text-[8px] text-white/20 font-mono mt-1 select-all">ID: {club.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(club)} className="p-2 text-white/40 hover:text-primary transition-colors">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => confirmDelete(club.id)} className="p-2 text-white/40 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : activeTab === 'tickets' ? (
          <div className="space-y-6">
            {/* Tickets Filters Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Filter by email, event name, ticket ID..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#d8c39b]/50 transition-colors"
                />
                {ticketSearch && (
                  <button 
                    onClick={() => setTicketSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {(['all', 'valid', 'pending', 'used', 'cancelled'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setTicketStatusFilter(status)}
                    className={cn(
                      "h-9 px-3.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border transition-all whitespace-nowrap",
                      ticketStatusFilter === status 
                        ? "bg-primary/25 border-primary text-primary" 
                        : "bg-transparent border-white/10 text-white/50 hover:text-white hover:border-white/20"
                    )}
                  >
                    {status === 'all' ? 'All Statuses' : status === 'valid' ? 'Valid' : status === 'pending' ? 'Pending' : status === 'used' ? 'Checked In' : 'Cancelled'}
                  </button>
                ))}
                
                {/* Refresh Database button */}
                <button
                  onClick={() => fetchData(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/10 bg-transparent text-white/50 hover:text-white hover:border-white/20 transition-all ml-1"
                  title="Refresh status logs"
                >
                  <RefreshCw size={12} className={cn(fetching && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              {(() => {
                const filtered = tickets.filter(tkt => {
                  if (ticketStatusFilter !== 'all' && tkt.status !== ticketStatusFilter) return false;
                  if (ticketSearch.trim()) {
                    const q = ticketSearch.toLowerCase();
                    const email = profiles.find(p => p.id === tkt.user_id)?.email?.toLowerCase() || '';
                    return (
                      tkt.event_name?.toLowerCase().includes(q) ||
                      tkt.id?.toLowerCase().includes(q) ||
                      tkt.order_id?.toLowerCase().includes(q) ||
                      email.includes(q)
                    );
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl opacity-40">
                      <Ticket className="mx-auto mb-4" size={32} />
                      <p className="text-xs uppercase tracking-widest font-mono">No Tickets Found</p>
                    </div>
                  );
                }

                return filtered.map(tkt => {
                  const userEmail = profiles.find(p => p.id === tkt.user_id)?.email || tkt.user_id || 'demo-user@proof.com';
                  return (
                    <div key={tkt.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-white/10 transition-colors">
                      <div className="flex items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                          <Ticket size={24} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-serif text-white leading-tight text-base">{tkt.event_name}</h4>
                            <span className={cn(
                              "text-[8px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider",
                              tkt.status === 'valid' ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" :
                              tkt.status === 'used' ? "border-blue-500/30 text-blue-400 bg-blue-500/5" :
                              tkt.status === 'pending' ? "border-amber-500/30 text-amber-400 bg-amber-500/5" :
                              "border-red-500/30 text-red-400 bg-red-500/5"
                            )}>
                              {tkt.status === 'valid' ? 'Valid' : tkt.status === 'used' ? 'Checked In' : tkt.status === 'pending' ? 'Pending' : 'Cancelled'}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 text-[10px] text-white/50 font-mono">
                            <span>ID: <span className="text-white select-all">#{String(tkt.id).substring(Math.max(0, String(tkt.id).length - 8)).toUpperCase()}</span></span>
                            <span className="hidden sm:inline text-white/20">•</span>
                            <span>Order: <span className="text-white/70">#{String(tkt.order_id || '').substring(0, 10).toUpperCase()}</span></span>
                            <span className="hidden sm:inline text-white/20">•</span>
                            <span>Date: <span className="text-[#d8c39b]">{tkt.event_date || 'Upcoming'}</span></span>
                          </div>
                          <p className="text-xs text-white/70">
                            Purchaser: <span className="text-primary font-medium">{userEmail}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 md:border-t-0 md:pt-0">
                        {updatingTicketStatusId === tkt.id ? (
                          <div className="flex items-center gap-1.5 text-xs text-white/40 px-3 py-1.5 font-mono">
                            <Loader2 className="animate-spin text-primary" size={14} />
                            <span>UPDATING</span>
                          </div>
                        ) : (
                          <>
                            {tkt.status !== 'used' && (
                              <button
                                onClick={async () => {
                                  setUpdatingTicketStatusId(tkt.id);
                                  await updateTicketStatus(tkt.id, 'used');
                                  const { data } = await getAdminTickets(clubId);
                                  if (data) setTickets(data);
                                  setUpdatingTicketStatusId(null);
                                }}
                                className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                title="Mark ticket as Used/Checked-in"
                              >
                                <Check size={12} /> Check In
                              </button>
                            )}
                            {tkt.status !== 'valid' && (
                              <button
                                onClick={async () => {
                                  setUpdatingTicketStatusId(tkt.id);
                                  await updateTicketStatus(tkt.id, 'valid');
                                  const { data } = await getAdminTickets(clubId);
                                  if (data) setTickets(data);
                                  setUpdatingTicketStatusId(null);
                                }}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                title="Set status to Valid"
                              >
                                Set Valid
                              </button>
                            )}
                            {tkt.status !== 'pending' && (
                              <button
                                onClick={async () => {
                                  setUpdatingTicketStatusId(tkt.id);
                                  await updateTicketStatus(tkt.id, 'pending');
                                  const { data } = await getAdminTickets(clubId);
                                  if (data) setTickets(data);
                                  setUpdatingTicketStatusId(null);
                                }}
                                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                title="Set status to Pending"
                              >
                                Set Pending
                              </button>
                            )}
                            {tkt.status !== 'cancelled' && (
                              <button
                                onClick={async () => {
                                  setUpdatingTicketStatusId(tkt.id);
                                  await updateTicketStatus(tkt.id, 'cancelled');
                                  const { data } = await getAdminTickets(clubId);
                                  if (data) setTickets(data);
                                  setUpdatingTicketStatusId(null);
                                }}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                title="Cancel Ticket"
                              >
                                Cancel Pass
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="py-10 text-center opacity-40">
                <ShoppingBag className="mx-auto mb-4" size={32} />
                <p className="text-xs uppercase tracking-widest font-mono">No Orders Found</p>
              </div>
            ) : (
              orders.map(order => {
                const orderUser = profiles.find(p => p.id === order.user_id);
                const userEmail = orderUser ? orderUser.email : "Guest User";
                return (
                  <div key={order.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-white/10 transition-colors">
                    <div>
                      <h4 className="font-serif text-white leading-tight">{order.product_name || order.item_name}</h4>
                      <p className="text-[10px] text-white/50 font-mono mt-1">Order #{(order.order_id || order.id)?.substring(0,8) || order.payfast_pf_payment_id || "N/A"}</p>
                      <p className="text-[11px] text-white/40 mt-1 uppercase tracking-widest">
                        Qty: {order.quantity} • Total: R{order.amount_gross || (order.quantity * order.unit_price)}
                      </p>
                      <p className="text-[10px] text-primary/80 mt-1 uppercase tracking-widest">
                        Ordered by: {userEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest border",
                        order.fulfilment_status === 'complete' ? "border-green-500/30 text-green-400 bg-green-500/10" :
                        order.fulfilment_status === 'pending' ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" :
                        "border-white/20 text-white/50 bg-white/5"
                      )}>
                        {order.fulfilment_status || order.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === 'promo' ? (
          <div className="space-y-4">
            {promoCodes.length === 0 ? (
              <div className="py-10 text-center opacity-40">
                <Ticket className="mx-auto mb-4" size={32} />
                <p className="text-xs uppercase tracking-widest font-mono">No Promo Codes Found</p>
              </div>
            ) : (
              promoCodes.map(promo => (
                <div key={promo.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                      <Ticket size={20} />
                    </div>
                    <div>
                      <h4 className="font-mono text-white text-lg font-bold tracking-wider">{promo.code}</h4>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                        {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : `R${promo.discount_value} OFF`}
                        {promo.min_order_amount > 0 && ` • MIN R${promo.min_order_amount}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-white/70">
                        Uses: {promo.times_used} {promo.max_uses ? `/ ${promo.max_uses}` : '(Unlimited)'}
                      </p>
                      <p className="text-[10px] text-white/40 mt-1 uppercase">
                        {promo.expires_at ? `Exp: ${new Date(promo.expires_at).toLocaleDateString()}` : 'Never Expires'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                        promo.active ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {promo.active ? "Active" : "Disabled"}
                      </span>
                      <button onClick={() => handleEdit(promo)} className="p-2 text-white/40 hover:text-primary transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => confirmDelete(promo.id)} className="p-2 text-white/40 hover:text-red-400 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          profiles.map(profile => (
            <div key={profile.id} className="p-5 bg-surface-container border border-white/5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white/40">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="font-serif text-white leading-tight">{profile.email}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest",
                      profile.role === 'admin' ? "border-primary text-primary" : 
                      profile.role === 'master_admin' ? "border-purple-400 text-purple-400 font-extrabold" :
                      "border-white/20 text-white/40"
                    )}>
                      {profile.role}
                    </span>
                    {profile.club_members && profile.club_members.length > 0 ? (
                      profile.club_members.map((m: any, idx: number) => {
                        const cName = m.clubs?.name || m.club_id;
                        if (!cName) return null;
                        return (
                          <span key={idx} className="text-[8px] text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {cName}
                          </span>
                        );
                      })
                    ) : profile.club_name ? (
                      <span className="text-[8px] text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {profile.club_name}
                      </span>
                    ) : (
                      <span className="text-[8px] text-white/25 italic uppercase tracking-wider px-1">
                        No Club Assigned
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(profile)} className="p-2 text-white/40 hover:text-primary transition-colors">
                  <Edit2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}

        {!fetching && activeTab === 'events' && events.length === 0 && (
          <div className="py-20 text-center opacity-40">
            <Calendar className="mx-auto mb-4" size={32} />
            <p className="text-xs uppercase tracking-widest">No events scheduled.</p>
          </div>
        )}
      </div>

      {/* Club Announcement Broadcast Console */}
      <div className="mt-12 p-8 bg-surface-container border border-white/5 rounded-3xl relative overflow-hidden shadow-2xl" id="broadcast-center-card">
        {/* Subtle Decorative Golden Edge Accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent opacity-60" />

        <div className="max-w-xl">
          <span className="text-[10px] font-extrabold text-[#c9a96e] tracking-[0.25em] uppercase block mb-2">Communications Center</span>
          <h3 className="text-2xl font-serif text-white mb-2 leading-tight">Club Announcement Broadcasts</h3>
          <p className="text-xs text-white/50 leading-relaxed mb-8">
            Dispatch a high-priority push notice and live feed alert to members. Announcements are pushed instantly via OneSignal segment rules.
          </p>

          <form onSubmit={handleSendBroadcastAnnouncement} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Target Club</label>
                <select
                  value={broadcastClubId}
                  onChange={(e) => setBroadcastClubId(e.target.value)}
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 outline-none focus:border-[#c9a96e] text-xs text-white"
                  id="broadcast-audience-selector"
                >
                  <option value="" className="bg-neutral-900 text-white/80">All OneSignal Subscribers (Global Broadcast)</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id} className="bg-neutral-900 text-white/80">
                      Club: {club.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. Rare Highland Release Tasting"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 outline-none focus:border-[#c9a96e] text-xs text-white"
                  id="broadcast-title-input"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Message / Announcement Body</label>
              <textarea
                placeholder="Declare dates, limited cask bottles availability, or access instructions here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 outline-none focus:border-[#c9a96e] text-xs text-white resize-none"
                id="broadcast-message-area"
              />
            </div>

            {broadcastStatus && (
              <div
                className={`p-4 rounded-xl text-xs font-medium border ${
                  broadcastStatus.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
                id="broadcast-feedback-status"
              >
                {broadcastStatus.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={broadcasting}
              className="h-12 w-full md:w-auto px-6 bg-[#c9a96e] hover:bg-[#c9a96e]/90 text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              id="broadcast-submit-btn"
            >
              {broadcasting ? (
                <>
                  <Loader2 className="animate-spin text-black" size={12} />
                  <span>DISPATCHING BROADCAST...</span>
                </>
              ) : (
                <span>DISPATCH ANNOUNCEMENT</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-400/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-serif text-white mb-2">Confirm Delete</h3>
              <p className="text-sm text-white/60 mb-8 leading-relaxed">
                Are you sure you want to remove this listing? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDelete}
                  disabled={saving}
                  className="h-14 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" /> : 'YES, DELETE LISTING'}
                </button>
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingId(null);
                  }}
                  disabled={saving}
                  className="h-14 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Overlay */}
      <AnimatePresence>
        {editingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl p-6 flex flex-col pt-24 overflow-y-auto"
          >
            <div className="max-w-lg mx-auto w-full">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-3xl font-serif text-white">
                  {activeTab === 'users' ? 'Admin Privileges' : `Edit ${activeTab.slice(0, -1)}`}
                </h3>
                <button onClick={() => setEditingItem(null)} className="p-2 text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form key={editingItem.id || 'new-item'} onSubmit={handleSave} className="space-y-6">
                {activeTab === 'users' ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Email Address</label>
                      <input 
                        disabled
                        value={editingItem.email}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">User Role</label>
                      <select 
                        name="role"
                        defaultValue={editingItem.role || 'member'}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary appearance-none text-white"
                      >
                        <option value="member" className="bg-black">Member</option>
                        <option value="admin" className="bg-black">Admin</option>
                        <option value="master_admin" className="bg-black">Master Admin</option>
                        <option value="guest" className="bg-black">Guest</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Club Memberships (Select Multiple)</label>
                      <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto mb-2 select-none">
                        {clubs.map(club => {
                          const isMember = editingItem.club_members?.some((m: any) => m.club_id === club.id) || editingItem.club_id === club.id;
                          return (
                            <label key={club.id} className="flex items-center gap-3 cursor-pointer text-white/80 hover:text-white group">
                              <input 
                                type="checkbox"
                                name={`membership_${club.id}`}
                                defaultChecked={isMember}
                                className="w-5 h-5 rounded border border-white/20 text-primary accent-primary bg-black/40 cursor-pointer"
                              />
                              <div className="text-xs">
                                <span className="font-serif block font-medium group-hover:text-primary transition-colors text-white">{club.name}</span>
                                <span className="text-[9px] text-white/30 font-mono">{club.id}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-white/30 uppercase tracking-tighter">Check all clubs this member belongs to. Privilege tokens will automatically bind.</p>
                    </div>
                  </>
                ) : activeTab === 'promo' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Promo Code</label>
                        <input 
                          name="code"
                          defaultValue={editingItem.code}
                          placeholder="e.g. SAVE10"
                          required
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary uppercase font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Discount Type</label>
                        <select
                          name="discount_type"
                          defaultValue={editingItem.discount_type || 'percent'}
                          className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 outline-none focus:border-primary text-white"
                        >
                          <option value="percent">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (ZAR)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Discount Value</label>
                        <input 
                          name="discount_value"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={editingItem.discount_value}
                          placeholder="e.g. 10 or 50.00"
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Min Order Amount (Optional)</label>
                        <input 
                          name="min_order_amount"
                          type="number"
                          step="0.01"
                          defaultValue={editingItem.min_order_amount || 0}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Max Uses (Optional)</label>
                        <input 
                          name="max_uses"
                          type="number"
                          defaultValue={editingItem.max_uses}
                          placeholder="Leave blank for unlimited"
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Expiry Date (Optional)</label>
                        <input 
                          name="expires_at"
                          type="date"
                          defaultValue={editingItem.expires_at ? new Date(editingItem.expires_at).toISOString().split('T')[0] : ''}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          name="active"
                          defaultChecked={editingItem.active !== false}
                          className="w-5 h-5 rounded border border-white/20 text-primary accent-primary bg-black/40 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors uppercase tracking-widest">
                          Code is Active
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">
                        {activeTab === 'events' ? 'Event Title' : activeTab === 'boutique' ? 'Product Name' : 'Club Name'}
                      </label>
                      <input 
                        name={activeTab === 'events' ? 'title' : 'name'}
                        defaultValue={editingItem.title || editingItem.name}
                        placeholder="Enter identifier..."
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                      />
                    </div>
                    
                    {activeTab !== 'clubs' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Display Price / Fee</label>
                            <input 
                              name="price"
                              defaultValue={editingItem.price}
                              placeholder="$0.00 or R250"
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block flex justify-between items-center">
                              <span>Visual Asset</span>
                              {uploading && (
                                <span className="text-[9px] text-primary flex items-center gap-1 animate-pulse font-serif italic">
                                  <Loader2 size={10} className="animate-spin text-primary" /> Uploading to Bucket...
                                </span>
                              )}
                            </label>
                            <div 
                              onDragEnter={handleDrag}
                              onDragOver={handleDrag}
                              onDragLeave={handleDrag}
                              onDrop={handleDrop}
                              className={cn(
                                "relative h-14 bg-white/5 border rounded-xl flex items-center group overflow-hidden transition-all duration-300",
                                dragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-white/10"
                              )}
                            >
                              <input 
                                ref={imageInputRef}
                                name="image"
                                defaultValue={editingItem.image}
                                placeholder={dragActive ? "Drop image here..." : uploading ? "Uploading..." : "https://example.com/image.jpg or Drop File"}
                                className={cn(
                                  "w-full h-full bg-transparent px-10 outline-none text-xs pr-12 transition-all",
                                  uploading ? "opacity-30 pl-12" : "pl-12"
                                )}
                                disabled={uploading}
                              />
                              {uploading ? (
                                <div className="absolute left-4">
                                  <Loader2 size={14} className="animate-spin text-primary" />
                                </div>
                              ) : (
                                <div className="absolute left-4 opacity-30 select-none group-focus-within:opacity-85 transition-opacity">
                                  <Upload size={14} className="text-white" />
                                </div>
                              )}
                              <div className="absolute right-4 pointer-events-none opacity-40 group-hover:opacity-100 flex items-center gap-1.5">
                                <Plus size={14} strokeWidth={2.5} className="text-primary" />
                                <span className="text-[9px] uppercase tracking-widest text-[#d8c39b] font-serif font-bold">Upload</span>
                              </div>
                              <input 
                                type="file" 
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={uploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    await handleFileUpload(file);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payfast Integration Form Fields */}
                        <div className="pt-2 border-t border-white/5 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase">Payfast Payment Integration</span>
                            <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider font-bold">ZAR Terminal</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">ZAR Price (R ZAR)</label>
                              <input 
                                type="number"
                                step="0.01"
                                name="payfast_price"
                                defaultValue={editingItem.payfast_price || ''}
                                placeholder="e.g. 250.00"
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 block">Capacity / Stock Quantity</label>
                              <input 
                                type="number"
                                name="payfast_quantity"
                                defaultValue={editingItem.payfast_quantity || ''}
                                placeholder="e.g. 50"
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs text-white"
                              />
                            </div>
                          </div>
                          <p className="text-[8px] text-white/30 uppercase tracking-tighter leading-tight">Specify ZAR amounts to activate standard Payfast sandbox checkout and interactive card/EFT checkout for members.</p>
                        </div>
                      </div>
                    )}

                    {activeTab === 'events' && (
                      <>
                        {isMasterAdmin && (
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Assign to Club (Master Admin Only)</label>
                            <select 
                              name="club_id"
                              defaultValue={editingItem.club_id || ""}
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary appearance-none text-white font-mono text-xs"
                            >
                              <option value="" className="bg-black text-primary font-bold italic">Global Access (No Club)</option>
                              {clubs.map(club => (
                                <option key={club.id} value={club.id} className="bg-black">{club.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Date</label>
                            <input 
                              name="date"
                              defaultValue={editingItem.date}
                              placeholder="2024-05-24"
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Location</label>
                            <input 
                              name="location"
                              defaultValue={editingItem.location}
                              placeholder="Main Salon"
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Event Type</label>
                          <select 
                            name="category"
                            defaultValue={editingItem.category || 'tasting'}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary appearance-none text-white"
                          >
                            <option value="tasting" className="bg-black">Whisky Tasting</option>
                            <option value="masterclass" className="bg-black">Masterclass</option>
                            <option value="rare" className="bg-black">Rare Allocation</option>
                            <option value="lounge" className="bg-black">Lounge Session</option>
                            <option value="dinner" className="bg-black">Gourmet Dinner</option>
                            <option value="special" className="bg-black">Special Event</option>
                          </select>
                        </div>
                      </>
                    )}

                    {activeTab === 'boutique' && (
                      <div className="space-y-6">
                        {isMasterAdmin && (
                          <div>
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Assign to Club (Master Admin Only)</label>
                            <select 
                              name="club_id"
                              defaultValue={editingItem.club_id || ""}
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary appearance-none text-white font-mono text-xs"
                            >
                              <option value="" className="bg-black text-primary font-bold italic">Global Access (No Club)</option>
                              {clubs.map(club => (
                                <option key={club.id} value={club.id} className="bg-black">{club.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Category</label>
                          <select 
                            name="category"
                          defaultValue={editingItem.category || 'whisky'}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary appearance-none text-white"
                        >
                          <option value="whisky" className="bg-black">Single Malt</option>
                          <option value="blend" className="bg-black">Blended Whisky</option>
                          <option value="rare" className="bg-black">Rare Collection</option>
                          <option value="accessories" className="bg-black">Accessories</option>
                        </select>
                      </div>
                    </div>
                  )}

                    {activeTab === 'clubs' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Club ID (Unique Handle)</label>
                          <input 
                            name="id"
                            defaultValue={editingItem.id}
                            placeholder="custom-id-or-uuid"
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs"
                          />
                          <p className="text-[8px] text-white/30 mt-1 uppercase tracking-tighter">Warning: Changing an existing ID may disconnect linked members.</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Base Of Operations</label>
                          <input 
                            name="location"
                            defaultValue={editingItem.location}
                            placeholder="City, Province"
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Club Payfast Merchant ID</label>
                          <input 
                            name="payfast_merchant_id"
                            defaultValue={editingItem.payfast_merchant_id || ""}
                            placeholder="e.g. 10000100 (Leave empty for standard Sandbox account code)"
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs text-white"
                          />
                          <p className="text-[8px] text-white/30 mt-1 uppercase tracking-tighter">Required for split payouts: splits 95% of member ticket/boutique payments directly to this account, and 5% platform commission remains with Master/Platform account.</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Monthly Joining Fee</label>
                          <input 
                            name="joining_fee_monthly"
                            defaultValue={editingItem.joining_fee_monthly || ""}
                            placeholder="e.g. 100"
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Annual Joining Fee</label>
                          <input 
                            name="joining_fee_annual"
                            defaultValue={editingItem.joining_fee_annual || ""}
                            placeholder="e.g. 1000"
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block flex justify-between items-center">
                            <span>Club Hero Banner (Visual Asset)</span>
                            {uploading && (
                              <span className="text-[9px] text-primary flex items-center gap-1 animate-pulse font-serif italic">
                                <Loader2 size={10} className="animate-spin text-primary" /> Uploading to Bucket...
                              </span>
                            )}
                          </label>
                          <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={cn(
                              "relative h-14 bg-white/5 border rounded-xl flex items-center group overflow-hidden transition-all duration-300",
                              dragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-white/10"
                            )}
                          >
                            <input 
                              ref={imageInputRef}
                              name="image"
                              defaultValue={editingItem.image}
                              placeholder={dragActive ? "Drop image here..." : uploading ? "Uploading..." : "https://example.com/club-banner.jpg or Drop File"}
                              className={cn(
                                "w-full h-full bg-transparent px-10 outline-none text-xs pr-12 transition-all",
                                uploading ? "opacity-30 pl-12" : "pl-12"
                              )}
                              disabled={uploading}
                            />
                            {uploading ? (
                              <div className="absolute left-4">
                                <Loader2 size={14} className="animate-spin text-primary" />
                              </div>
                            ) : (
                              <div className="absolute left-4 opacity-30 select-none group-focus-within:opacity-85 transition-opacity">
                                <Upload size={14} className="text-white" />
                              </div>
                            )}
                            <div className="absolute right-4 pointer-events-none opacity-40 group-hover:opacity-100 flex items-center gap-1.5">
                              <Plus size={14} strokeWidth={2.5} className="text-primary" />
                              <span className="text-[9px] uppercase tracking-widest text-[#d8c39b] font-serif font-bold">Upload</span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={uploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  await handleFileUpload(file);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">Description</label>
                      <textarea 
                        name="description"
                        defaultValue={editingItem.description || editingItem.desc}
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-6 outline-none focus:border-primary resize-none"
                      />
                    </div>
                  </>
                )}

                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full h-16 bg-primary text-black rounded-full font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform mt-10 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} 
                  {activeTab === 'users' ? 'CONFIRM PRIVILEGES' : 'SAVE CHANGES'}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
