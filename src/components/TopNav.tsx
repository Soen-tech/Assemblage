import { useState, useEffect } from 'react';
import { Menu, User as UserIcon, Bell, LogOut, X, Shield, Sparkles, Mail, Hash, Landmark, MapPin, Users, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { View, User as UserType } from '../types';
import NotificationBell from './NotificationBell';

interface TopNavProps {
  onLogout?: () => void;
  onGuestUpgradeClick?: () => void;
  onSubscribeClick?: () => void;
  hasActiveSubscription?: boolean;
  user?: UserType | null;
  notifications?: any[];
  unreadCount?: number;
  onMarkAllRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  onNavigate?: (view: View) => void;
}

const getClubHeroImage = (clubId?: string, databaseImage?: string) => {
  if (databaseImage && databaseImage.trim().startsWith('http')) {
    return databaseImage;
  }
  
  const id = String(clubId || '').toLowerCase();
  if (id.includes('underground') || id === 'underground-001') {
    // Elegant luxury speakeasy / cellar bar with golden lights
    return 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80';
  }
  if (id.includes('speyside') || id === '2') {
    // Warm atmospheric lounge with leather seating and collection bottles
    return 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1200&q=80';
  }
  if (id.includes('dram') || id === '3') {
    // Historic distillery warehouse or rustic cellar barrels
    return 'https://images.unsplash.com/photo-1562601519-2ba929ef7003?auto=format&fit=crop&w=1200&q=80';
  }
  
  // Default premium moody whiskey setup
  return 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=1200&q=80';
};

const getClubLocation = (clubId?: string, databaseLocation?: string) => {
  if (databaseLocation) return databaseLocation;
  const id = String(clubId || '').toLowerCase();
  if (id.includes('underground') || id === 'underground-001') return 'Cape Town, SA';
  if (id.includes('speyside') || id === '2') return 'Johannesburg, GP';
  if (id.includes('dram') || id === '3') return 'London, UK';
  return 'Established Club';
};

const getClubManifesto = (clubId?: string, databaseDesc?: string) => {
  if (databaseDesc) return databaseDesc;
  const id = String(clubId || '').toLowerCase();
  if (id.includes('underground') || id === 'underground-001') {
    return 'An underground gathering place for Cape Town’s pre-eminent collectors of ultra-rare expressions and single cask releases.';
  }
  if (id.includes('speyside') || id === '2') {
    return 'A quiet Johannesburg sanctuary for celebrating Speyside finishes, high-density wood experiments, and private cask allocations.';
  }
  if (id.includes('dram') || id === '3') {
    return 'London’s historic inner circle dedicated to private client barrel curation, multi-vintage grain blends, and master tastings.';
  }
  return 'An exclusive guild of whisky enthusiasts dedicated to rare expressions, hand-held cask selections, and refined sensory exploration.';
};

export default function TopNav({
  onLogout,
  onGuestUpgradeClick,
  onSubscribeClick,
  hasActiveSubscription = false,
  user,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onMarkAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onNavigate
}: TopNavProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClubOpen, setIsClubOpen] = useState(false);
  const [clubDetails, setClubDetails] = useState<any>(null);
  const [isClubLoading, setIsClubLoading] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  // Initialize selected club ID when drawer opens
  useEffect(() => {
    if (isClubOpen && user) {
      if (!selectedClubId) {
        const id = user.clubId || (user.clubs && user.clubs.length > 0 ? user.clubs[0].club_id : null);
        if (id) {
          setSelectedClubId(id);
        }
      }
    } else if (!isClubOpen) {
      setSelectedClubId(null);
    }
  }, [isClubOpen, user]);

  // Fetch full club details from Supabase when the active selection changes
  useEffect(() => {
    if (isClubOpen && selectedClubId) {
      const fetchClubInfo = async () => {
        setIsClubLoading(true);
        try {
          if (supabase) {
            const { data, error } = await supabase
              .from('clubs')
              .select('*')
              .eq('id', selectedClubId)
              .maybeSingle();
            
            if (data && !error) {
              setClubDetails(data);
            }
          }
        } catch (err) {
          console.error("Error fetching club details in top nav:", err);
        } finally {
          setIsClubLoading(false);
        }
      };
      
      fetchClubInfo();
    }
  }, [isClubOpen, selectedClubId]);

  // Helper helper to format roles beautifully
  const getRoleBadge = (role: string = 'member') => {
    switch (role) {
      case 'master_admin':
        return {
          label: 'Master Club Admin',
          style: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
        };
      case 'admin':
        return {
          label: 'Club Operator',
          style: 'border-primary/40 bg-primary/10 text-primary',
        };
      default:
        return {
          label: 'Club Member',
          style: 'border-white/10 bg-white/5 text-white/70',
        };
    }
  };

  const roleDetails = getRoleBadge(user?.role);
  const firstLetter = (user?.username || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md px-6 py-4 border-b border-b-white/5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsClubOpen(true)}
            className="p-2 -ml-2 text-on-surface hover:text-primary transition-colors"
            id="menu-button"
          >
            <Menu size={24} />
          </motion.button>
          
          <h1 className="font-serif text-xl tracking-widest uppercase font-semibold text-secondary">
            PROOF
          </h1>

          <div className="flex items-center gap-2">
            {user && user.role !== 'guest' && (
              <NotificationBell
                userId={user.id}
                clubId={user.clubId}
                userRole={user.role}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllRead={onMarkAllRead || (() => {})}
                onMarkAsRead={onMarkAsRead}
                onDeleteNotification={onDeleteNotification}
                onClearAllNotifications={onClearAllNotifications}
                onNavigate={onNavigate}
              />
            )}
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsProfileOpen(true)}
              className="p-2 text-on-surface hover:text-primary transition-colors relative"
              id="profile-button"
            >
              <UserIcon size={24} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Club Profile Slide-out Sidebar / Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              id="profile-modal-backdrop"
            />

            {/* Panel Card */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-surface border-l border-white/5 h-screen max-h-screen overflow-hidden flex flex-col justify-between shadow-2xl"
              id="profile-modal-panel"
            >
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8 pb-6 scrollbar-none">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-primary" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Club Profile</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout?.();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200"
                    >
                      <LogOut size={12} />
                      LOG OUT
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsProfileOpen(false)}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </motion.button>
                  </div>
                </div>

                {/* Profile Header Card */}
                <div className="flex flex-col items-center text-center p-6 bg-surface-container rounded-3xl border border-white/5 mb-8">
                  <div className="w-18 h-18 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-4 text-primary relative">
                    <span className="text-3xl font-serif font-bold">{firstLetter}</span>
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-background rounded-full border border-white/10">
                      <Sparkles size={12} className="text-[#d8c39b]" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-serif text-white mb-1.5">
                    {user?.username || 'Independent Collector'}
                  </h3>
                  
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${roleDetails.style} uppercase tracking-wider`}>
                    {roleDetails.label}
                  </span>
                  {user?.role === 'member' && hasActiveSubscription && (
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-widest mt-3 bg-primary/15 border border-primary/25 px-3 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping block" style={{ transformOrigin: 'center' }} />
                      Active Club Standing
                    </span>
                  )}
                </div>

                {/* Profile Details Grid */}
                <div className="space-y-4">
                  <h4 className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 ml-1">Secure Vault Metadata</h4>
                  
                  {/* Nickname */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary">
                      <UserIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Bespoke Alias</span>
                      <span className="text-sm font-medium text-white block truncate">{user?.username || 'No alias registered'}</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary">
                      <Mail size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Secured Email</span>
                      <span className="text-sm font-medium text-white block truncate">{user?.email || 'anonymous@proof.co'}</span>
                    </div>
                  </div>

                  {/* Club Name */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary">
                      <Landmark size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Assigned Club</span>
                      <span className="text-sm font-medium text-[#d8c39b] font-serif block truncate">
                        {user?.clubName || 'Independent Circle'}
                      </span>
                    </div>
                  </div>

                  {/* Club ID */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary">
                      <Hash size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Club Access Key</span>
                      <span className="text-xs font-mono text-white/50 block select-all">
                        {user?.clubId || 'independent'}
                      </span>
                    </div>
                  </div>
                </div>

                {user?.role === 'member' && !hasActiveSubscription && (
                  <div className="mx-6 mt-1 mt-6 bg-gradient-to-br from-amber-500/10 to-primary/5 border border-primary/20 rounded-3xl p-5 text-center">
                    <span className="text-[9px] font-extrabold text-primary tracking-widest uppercase mb-1 block">CLUB CIRCLE STATUS</span>
                    <h5 className="text-white font-serif text-sm font-semibold mb-2">Unsubscribed Standing</h5>
                    <p className="text-xs text-white/50 leading-relaxed mb-4">
                      Your premium profile is ready. Activate. Complete your standing to unlock rare cask allocations.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsProfileOpen(false);
                        onSubscribeClick?.();
                      }}
                      className="w-full py-3 bg-primary text-black rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} className="animate-pulse" />
                      BECOME A MEMBER • SUBSCRIBE & JOIN
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Sticky Footer Panel */}
              <div className="p-6 border-t border-white/5 bg-surface">
                <p className="text-[8.5px] text-white/20 uppercase tracking-widest text-center">
                  Session token encrypted • Protocol SHA-256
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Club Slide-out Sidebar / Drawer */}
      <AnimatePresence>
        {isClubOpen && (
          <div className="fixed inset-0 z-50 flex justify-start">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClubOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              id="club-modal-backdrop"
            />

            {/* Panel Card */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-surface border-r border-white/5 h-screen max-h-screen overflow-hidden flex flex-col justify-between shadow-2xl shadow-black/80"
              id="club-modal-panel"
            >
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8 pb-6 scrollbar-none">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Landmark size={14} className="text-primary" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Club Registry</span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsClubOpen(false)}
                    className="p-1 text-white/40 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Club Details Block */}
                {isClubLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <span className="text-xs font-mono text-white/20 uppercase tracking-wider">Accessing Registry...</span>
                  </div>
                ) : selectedClubId ? (
                  <div className="space-y-6">
                    {/* Hero Card */}
                    <div className="relative rounded-3xl overflow-hidden border border-white/5 bg-surface-container aspect-video mb-6 flex flex-col justify-end p-6 group">
                      <img 
                        src={getClubHeroImage(selectedClubId, clubDetails?.image)} 
                        alt={clubDetails?.name || 'Club'} 
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                      
                      <div className="relative z-10 mt-auto animate-fade-in">
                        <span className="text-[8px] font-bold text-primary px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 uppercase tracking-widest mb-2 inline-block">
                          {getClubLocation(selectedClubId, clubDetails?.city || clubDetails?.location)}
                        </span>
                        <h3 className="text-xl font-serif text-white tracking-wide font-semibold mt-1">
                          {clubDetails?.name || 'Club'}
                        </h3>
                      </div>
                    </div>

                    {/* Main Content Details */}
                    <div className="space-y-4">
                      {/* Location Area */}
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary mt-0.5">
                          <MapPin size={16} />
                        </div>
                        <div className="flex-1">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Club Location</span>
                          <span className="text-sm font-medium text-white block mt-0.5 animate-fade-in">
                            {getClubLocation(selectedClubId, clubDetails?.location || clubDetails?.city)}
                          </span>
                        </div>
                      </div>

                      {/* Members Counter */}
                      {(clubDetails?.members || !isClubLoading) && (
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                          <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary mt-0.5">
                            <Users size={16} />
                          </div>
                          <div className="flex-1">
                            <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Registry Size</span>
                            <span className="text-sm font-medium text-white block mt-0.5 animate-fade-in">
                              {clubDetails?.members ?? (selectedClubId === 'underground-001' ? '1.2k' : selectedClubId === '2' ? '850' : selectedClubId === '3' ? '2.4k' : '500+')} Registered Collectors
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary mt-0.5">
                          <Compass size={16} />
                        </div>
                        <div className="flex-1">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Club Manifesto</span>
                          <p className="text-xs text-white/65 leading-relaxed mt-1.5 font-sans animate-fade-in">
                            {getClubManifesto(selectedClubId, clubDetails?.description)}
                          </p>
                        </div>
                      </div>

                      {/* Club Code / Access key */}
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="p-2.5 rounded-xl bg-background border border-white/5 text-primary mt-0.5">
                          <Hash size={16} />
                        </div>
                        <div className="flex-1">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">Secure Passkey</span>
                          <span className="text-xs font-mono text-white/50 block select-all mt-1">
                            {selectedClubId}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Clubs Selector List for Multi-club Members */}
                    {user?.clubs && user.clubs.length > 0 && (
                      <div className="pt-4 border-t border-white/5 space-y-3">
                        <h4 className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">My Active Clubs</h4>
                        <div className="space-y-2">
                          {user.clubs.map((membership) => {
                            const isSelected = selectedClubId === membership.club_id;
                            const isPrimary = user.clubId === membership.club_id;
                            return (
                              <motion.button
                                key={membership.club_id}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedClubId(membership.club_id)}
                                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                                  isSelected 
                                    ? 'bg-primary/20 border-primary/45 text-white shadow-lg' 
                                    : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary/20 text-primary' : 'bg-background border border-white/5 text-white/40'}`}>
                                    <Landmark size={14} />
                                  </div>
                                  <div>
                                    <span className="text-xs font-medium font-serif block text-white">{membership.club_name}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider block mt-0.5">
                                      {membership.role === 'admin' ? 'Operator' : 'Member'}
                                    </span>
                                  </div>
                                </div>
                                {isPrimary && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary uppercase tracking-widest leading-none">
                                    Home
                                  </span>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-4">
                      <Compass size={24} />
                    </div>
                    <h3 className="text-lg font-serif text-white mb-2">Independent Circle</h3>
                    <p className="text-xs text-white/40 leading-relaxed mb-6">
                      You are exploring as an independent curator. Join a local club to unlock specialized drops, localized tastings, and allocations.
                    </p>
                    {user?.role === 'guest' && (
                      <button
                        onClick={onGuestUpgradeClick}
                        className="w-full h-12 bg-primary text-on-primary rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
                      >
                        <Sparkles size={14} className="text-on-primary animate-pulse" /> SIGN UP AS FULL MEMBER
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="p-6 border-t border-white/5 bg-surface text-center">
                <span className="text-[8.5px] text-white/20 uppercase tracking-widest block">
                  PROOF Collective System • Level II Clearance
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
