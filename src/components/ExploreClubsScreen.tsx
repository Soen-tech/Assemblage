import { useState, useEffect } from 'react';
import { Compass, Loader2, MapPin, Search, Plus, Check, Trash2, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Club } from '../types';
import { getClubs, addClubMember, removeClubMember, getUserClubs } from '../services/supabase';
import { cn } from '../lib/utils';
import ClubMembershipSelectModal from './ClubMembershipSelectModal';
import PayfastCheckoutModal from './PayfastCheckoutModal';

interface ExploreClubsScreenProps {
  user: User;
  onRefreshUserClubs: () => void;
}

export default function ExploreClubsScreen({ user, onRefreshUserClubs }: ExploreClubsScreenProps) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Selection & Payfast State Tracking
  const [selectedClubForPlan, setSelectedClubForPlan] = useState<Club | null>(null);
  const [checkoutClubItem, setCheckoutClubItem] = useState<any | null>(null);

  // Local helper to load all public clubs
  const loadClubs = async () => {
    try {
      setLoading(true);
      const { data, error } = await getClubs();
      if (!error && data) {
        setClubs(data);
      }
    } catch (err) {
      console.error("ExploreClubs: failed to fetch clubs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, []);

  // Helper to check if user is a member of a given club ID
  const isMemberOf = (clubId: string) => {
    return user.clubs?.some(c => c.club_id === clubId) || user.clubId === clubId;
  };

  const handleJoinClick = (club: Club) => {
    setSelectedClubForPlan(club);
  };

  const handleSelectPlan = (plan: 'monthly' | 'annual') => {
    if (!selectedClubForPlan) return;
    
    const cost = plan === 'annual' ? 2400 : 250;
    const name = plan === 'annual' 
      ? `Annual Elite Club - ${selectedClubForPlan.name}` 
      : `Monthly Club - ${selectedClubForPlan.name}`;
      
    const checkoutItem = {
      id: `club-membership-${selectedClubForPlan.id}-${plan}`,
      club_id: selectedClubForPlan.id,
      club_name: selectedClubForPlan.name,
      title: name,
      name: name,
      payfast_price: cost,
      description: plan === 'annual' 
        ? `Elite annual standing with ${selectedClubForPlan.name}. Access rare allocated drops on the distillery routes.`
        : `Full monthly access to ${selectedClubForPlan.name}, private tasting notes, and cellar synchronizations.`,
      image: selectedClubForPlan.image || (plan === 'annual' ? 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400' : 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=400')
    };
    
    setSelectedClubForPlan(null);
    setCheckoutClubItem(checkoutItem);
  };

  const handleJoinClub = async (clubId: string) => {
    try {
      setJoiningId(clubId);
      const { error } = await addClubMember(user.id, clubId);
      if (!error) {
        // Trigger parent state update
        onRefreshUserClubs();
      } else {
        alert(`Failed to join club: ${error.message || error}`);
      }
    } catch (err: any) {
      console.error("Failed to join:", err);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    if (!confirm("Are you sure you want to resign your membership from this club?")) {
      return;
    }
    try {
      setJoiningId(clubId);
      const { error } = await removeClubMember(user.id, clubId);
      if (!error) {
        onRefreshUserClubs();
      } else {
        alert(`Failed to leave club: ${error.message || error}`);
      }
    } catch (err: any) {
      console.error("Failed to leave:", err);
    } finally {
      setJoiningId(null);
    }
  };

  const filteredClubs = clubs.filter(club => {
    const term = searchQuery.toLowerCase();
    return club.name.toLowerCase().includes(term) || 
           (club.location && club.location.toLowerCase().includes(term)) ||
           (club.description && club.description.toLowerCase().includes(term));
  });

  // Group clubs into user's joined clubs and discoverable clubs
  const joinedClubs = filteredClubs.filter(club => isMemberOf(club.id));
  const discoverClubs = filteredClubs.filter(club => !isMemberOf(club.id));

  return (
    <div className="flex-1 px-6 pt-6 pb-32 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="mb-8 mt-2">
        <div className="flex items-center gap-2 text-primary mb-1">
          <Compass size={18} />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono">DIRECTORY</p>
        </div>
        <h2 className="text-3xl font-serif text-white tracking-wide">Explore Clubs</h2>
        <p className="text-sm text-white/40 mt-1">Discover, join, and align with global elite clubs.</p>
      </div>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by city, name, or keywords..."
          className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 outline-none text-white text-sm placeholder-white/20 focus:border-primary focus:bg-white/[0.08] transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/40 hover:text-white"
          >
            CLEAR
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono">Scanning Channels...</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* My Active Clubs */}
          {joinedClubs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold font-mono uppercase tracking-[0.15em] text-primary mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping-slow" />
                My Active Clubs ({joinedClubs.length})
              </h3>
              <div className="space-y-4">
                {joinedClubs.map((club) => (
                  <ClubCard 
                    key={club.id}
                    club={club}
                    isMember={true}
                    isExpanded={expandedId === club.id}
                    onToggleExpand={() => setExpandedId(expandedId === club.id ? null : club.id)}
                    joining={joiningId === club.id}
                    onJoin={() => handleJoinClick(club)}
                    onLeave={() => handleLeaveClub(club.id)}
                    user={user}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discover New Clubs */}
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-[0.15em] text-white/40 mb-4">
              {joinedClubs.length > 0 ? "Discover New Clubs" : "All Clubs"} ({discoverClubs.length})
            </h3>
            
            {discoverClubs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-8 text-center">
                <p className="text-xs text-white/30 italic">No additional clubs match your filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {discoverClubs.map((club) => (
                  <ClubCard 
                    key={club.id}
                    club={club}
                    isMember={false}
                    isExpanded={expandedId === club.id}
                    onToggleExpand={() => setExpandedId(expandedId === club.id ? null : club.id)}
                    joining={joiningId === club.id}
                    onJoin={() => handleJoinClick(club)}
                    onLeave={() => handleLeaveClub(club.id)}
                    user={user}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Select Plan Modal */}
      <ClubMembershipSelectModal
        isOpen={!!selectedClubForPlan}
        onClose={() => setSelectedClubForPlan(null)}
        club={selectedClubForPlan}
        onSelectPlan={handleSelectPlan}
      />

      {/* Payfast Checkout Modal */}
      {checkoutClubItem && (
        <PayfastCheckoutModal
          isOpen={!!checkoutClubItem}
          onClose={() => setCheckoutClubItem(null)}
          item={checkoutClubItem}
          itemType="club_membership"
          userEmail={user?.email || 'member@proof.club'}
          onSuccess={() => {
            setCheckoutClubItem(null);
            onRefreshUserClubs();
          }}
        />
      )}
    </div>
  );
}

interface ClubCardProps {
  club: Club;
  isMember: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  joining: boolean;
  onJoin: () => void;
  onLeave: () => void;
  user: User;
}

function ClubCard({ 
  club, 
  isMember, 
  isExpanded, 
  onToggleExpand, 
  joining, 
  onJoin, 
  onLeave, 
  user
}: ClubCardProps) {
  const isPrimary = user.clubId === club.id;
  const alreadyPaid = user?.clubs?.some(
    c => c.club_id === club.id && c.membership_type === 'paid'
  ) || false;

  return (
    <div 
      className={cn(
        "bg-white/5 border rounded-2xl overflow-hidden transition-all duration-300 relative group",
        isExpanded ? "border-primary/40 bg-white/[0.08]" : "border-white/10 hover:border-white/20"
      )}
    >
      <div 
        onClick={onToggleExpand}
        className="p-5 flex items-start gap-4 cursor-pointer select-none"
      >
        {club.image ? (
          <img 
            src={club.image} 
            alt={club.name} 
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-xl object-cover bg-black/40 border border-white/10 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Compass className="text-primary" size={24} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-serif text-white font-medium truncate tracking-wide">
              {club.name}
            </h4>
            {isMember && (
              <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest flex items-center gap-1">
                <Check size={8} strokeWidth={3} className="text-primary" />
                Joined
              </span>
            )}
            {isPrimary && (
              <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#c9a96e]/20 border border-[#c9a96e]/30 text-[#e0c48f] uppercase tracking-widest">
                Home
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-white/40 text-xs mt-1 font-sans">
            <MapPin size={12} className="text-white/30 flex-shrink-0" />
            <span className="truncate uppercase font-mono tracking-wider text-[9px]">
              {club.location || 'GLOBAL EXPANSION'}
            </span>
          </div>
        </div>

        <button 
          type="button"
          className="self-center p-2 text-white/30 hover:text-white transition-colors"
        >
          <ChevronRight 
            size={18} 
            className={cn("transition-transform duration-300", isExpanded && "rotate-90 text-primary")} 
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-white/5 space-y-4">
              <p className="text-xs text-white/60 leading-relaxed font-sans">
                {club.description || "An ultra-exclusive enclave for master distillers and discerning connoisseurs alike. Indulge in private cellar events, custom private label allocations, and refined luxury."}
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-white/30 uppercase tracking-widest font-mono">
                  Club ID: {club.id}
                </span>

                {joining ? (
                  <div className="flex items-center gap-2 text-primary opacity-60">
                    <Loader2 className="animate-spin" size={14} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Processing...</span>
                  </div>
                ) : alreadyPaid ? (
                  <span className="text-[11px] font-semibold text-primary flex items-center gap-1.5 uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-full tracking-wider">
                    ✓ Member
                  </span>
                ) : (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoin();
                    }}
                    className="h-8 px-4 bg-primary text-black font-mono text-[9px] font-bold rounded-lg hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={3} />
                    JOIN CLUB
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
