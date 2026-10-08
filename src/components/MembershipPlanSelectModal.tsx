import { motion } from 'framer-motion';
import { X, Sparkles, Check, Shield, Zap } from 'lucide-react';
import { useState } from 'react';

interface MembershipPlanSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
}

export default function MembershipPlanSelectModal({
  isOpen,
  onClose,
  onSelectPlan
}: MembershipPlanSelectModalProps) {
  const [selected, setSelected] = useState<'monthly' | 'annual'>('monthly');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-surface border border-primary/20 rounded-[2rem] overflow-hidden shadow-2xl p-8"
        id="membership-plan-select-modal"
      >
        {/* Border Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

        {/* Close Switch */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/50 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Header content */}
        <div className="mt-2 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 text-primary">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <h3 className="text-3xl font-serif text-white tracking-wide">Become a Member</h3>
          <p className="text-sm text-white/60 mt-2 max-w-sm mx-auto leading-relaxed">
            Unlock elite private club allocations, priority events tickets booking, and complete cellar tracking tools.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-3 my-6 bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Rare Allocations Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Distillery Exclusive Drops</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Infinite AI Taste Sommelier</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-primary flex-shrink-0" />
            <span>Bespoke Digital Cellar Hub</span>
          </div>
        </div>

        {/* Plan Cards Stack */}
        <div className="space-y-4">
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
                  src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=300" 
                  alt="Monthly Membership" 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="text-left">
                <span className="font-serif font-bold text-white text-sm sm:text-base block">Monthly Subscription</span>
                <span className="text-xs text-white/50 block mt-0.5">Recurring billing monthly. Cancel anytime.</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <span className="text-lg sm:text-xl font-mono text-primary font-bold">R 250</span>
              <span className="text-[10px] text-white/40 block">/ month</span>
            </div>
          </div>

          {/* Annual */}
          <div
            onClick={() => setSelected('annual')}
            className={`relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              selected === 'annual'
                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
            }`}
          >
            {/* Value Badge */}
            <div className="absolute -top-2.5 right-6 px-2.5 py-0.5 bg-primary text-black font-bold text-[8px] uppercase tracking-widest rounded-full shadow-lg shadow-primary/20">
              Save 20%
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === 'annual' ? 'border-primary' : 'border-white/30'
              }`}>
                {selected === 'annual' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>

              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-black/40">
                <img 
                  src="https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=300" 
                  alt="Annual Subscription" 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="text-left">
                <span className="font-serif font-bold text-white text-sm sm:text-base block flex items-center gap-1.5">
                  Annual Subscription
                </span>
                <span className="text-xs text-white/50 block mt-0.5">Single annual secure payment. Best value.</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <span className="text-lg sm:text-xl font-mono text-primary font-bold">R 2400</span>
              <span className="text-[10px] text-white/40 block">/ year</span>
            </div>
          </div>
        </div>

        {/* Pay buttons */}
        <div className="mt-8 space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectPlan(selected)}
            className="w-full h-14 bg-primary text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all text-sm uppercase tracking-wider"
          >
            <Shield size={16} />
            SUBSCRIBE AND JOIN NOW
          </motion.button>
          
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/30 uppercase tracking-widest">
            <Zap size={10} className="text-primary animate-pulse" />
            Secured Payfast Checkout Gate
          </div>
        </div>
      </motion.div>
    </div>
  );
}
