import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Shield, Bookmark } from 'lucide-react';
import { useState } from 'react';
import { Club } from '../types';

interface ClubMembershipSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: Club | null;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
}

export default function ClubMembershipSelectModal({
  isOpen,
  onClose,
  club,
  onSelectPlan
}: ClubMembershipSelectModalProps) {
  const [selected, setSelected] = useState<'monthly' | 'annual'>('monthly');

  if (!isOpen || !club) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-surface border border-primary/20 rounded-[2rem] overflow-hidden shadow-2xl p-8"
        id="club-membership-select-modal"
      >
        {/* Border Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/50 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Header content */}
        <div className="mt-2 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 text-primary">
            <Bookmark size={22} className="animate-pulse" />
          </div>
          <p className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase font-mono mb-1">Join Elite Club</p>
          <h3 className="text-2xl font-serif text-white tracking-wide">Join {club.name}</h3>
          <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto leading-relaxed">
            Select your membership level to activate private distillery allocations, club-specific tasting routes, and masterclass invitations.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-3 my-6 bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Club Allocations</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Local Tasting Events</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Exclusive Cask Bottling</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Interactive Palate Map</span>
          </div>
        </div>

        {/* Plan Cards Stack */}
        <div className="space-y-3">
          {/* Monthly */}
          <div
            onClick={() => setSelected('monthly')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              selected === 'monthly'
                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === 'monthly' ? 'border-primary' : 'border-white/30'
              }`}>
                {selected === 'monthly' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>

              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-black/40">
                <img 
                  src={club.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=300'} 
                  alt={club.name} 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="text-left">
                <span className="font-serif font-bold text-white text-sm block">Monthly Club Plan</span>
                <span className="text-[11px] text-white/50 block mt-0.5">Cancel anytime. Standard club access.</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <span className="text-lg font-mono text-primary font-bold">R 250</span>
              <span className="text-[9px] text-white/40 block">/ month</span>
            </div>
          </div>

          {/* Annual */}
          <div
            onClick={() => setSelected('annual')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between relative ${
              selected === 'annual'
                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
            }`}
          >
            <div className="absolute top-2 right-4 bg-primary text-black text-[7.5px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-widest">
              Save R600 (Best Value)
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === 'annual' ? 'border-primary' : 'border-white/30'
              }`}>
                {selected === 'annual' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>

              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-black/40">
                <img 
                  src={club.image || 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=300'} 
                  alt={club.name} 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="text-left">
                <span className="font-serif font-bold text-white text-sm block">Annual Club Elite</span>
                <span className="text-[11px] text-white/50 block mt-0.5">Recurring billing. Top-tier standing.</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <span className="text-lg font-mono text-primary font-bold">R 2400</span>
              <span className="text-[9px] text-white/40 block">/ year</span>
            </div>
          </div>
        </div>

        {/* Complete Payment CTA */}
        <div className="mt-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectPlan(selected)}
            className="w-full py-4 bg-primary text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
            CONTINUE TO SECURED PAYFAST CHECKOUT
          </motion.button>
          
          <div className="flex items-center justify-center gap-1.5 mt-4 text-[9px] text-white/30 tracking-wider">
            <Shield size={10} />
            <span>SECURED BY PAYFAST • ENCRYPTED ENDPOINT</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
