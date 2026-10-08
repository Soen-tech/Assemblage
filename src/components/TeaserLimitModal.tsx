import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Crown, Sparkles, Gem, Loader2, Eye, EyeOff, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { signUp, supabase } from '../services/supabase';
import { cn } from '../lib/utils';

interface TeaserLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'scan' | 'chat';
  onUpgrade: (email?: string, username?: string, authData?: any) => void;
}

export default function TeaserLimitModal({ isOpen, onClose, type, onUpgrade }: TeaserLimitModalProps) {
  const [step, setStep] = useState<'teaser' | 'signup' | 'success'>('teaser');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const resetFormState = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setError(null);
    setUpgrading(false);
    setStep('teaser');
  };

  const handleClose = () => {
    resetFormState();
    onClose();
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter an email address.');
      return;
    }
    if (!username) {
      setError('Please choose a username.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setUpgrading(true);
    try {
      const response = await signUp(email, password, undefined, username);
      
      if (response.error) {
        throw response.error;
      }

      setStep('success');
      // Delay for success screen to be visible
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onUpgrade(email, username, response.data);
      resetFormState();
    } catch (err: any) {
      console.error("Teaser register error:", err);
      let message = err.message || 'Signature registration failed.';
      if (message.includes('already exists') || message.includes('already registered')) {
        message = 'This email address is already registered.';
      }
      setError(message);
    } finally {
      setUpgrading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-xl"
        />

        {/* Modal content container */}
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          className="relative w-full max-w-md bg-surface border border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl overflow-hidden z-10"
        >
          {/* Top aesthetic ambient glow */}
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

          {/* Close button */}
          {step !== 'success' && (
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 w-10 h-10 rounded-full glass flex items-center justify-center text-white/40 hover:text-white hover:scale-105 active:scale-95 transition-all z-20"
            >
              <X size={20} />
            </button>
          )}

          <AnimatePresence mode="wait">
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="py-12 flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary text-primary flex items-center justify-center mb-6 animate-bounce">
                  <Crown size={32} />
                </div>
                <h3 className="text-3xl font-serif text-white mb-2 font-medium tracking-tight">Welcome to the Club</h3>
                <p className="text-xs text-[#dac2b2]/80 uppercase tracking-widest font-bold">
                  Black Tier Membership Activated
                </p>
                {!supabase && (
                  <p className="text-[11px] text-white/40 mt-3 font-mono">
                    Demo Mode Upgrade Activated
                  </p>
                )}
              </motion.div>
            )}

            {step === 'teaser' && (
              <motion.div
                key="teaser"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative z-10"
              >
                {/* Visual lock/upgrade badge */}
                <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-6">
                  {type === 'scan' ? <Lock size={28} /> : <Crown size={28} />}
                </div>

                <span className="text-[10px] font-bold text-primary tracking-[0.25em] uppercase mb-3 block">
                  Teaser Limit Reached
                </span>
                
                <h3 className="text-3xl font-serif text-white mb-4 tracking-wide font-medium">
                  Unlock Unlimited Access
                </h3>

                <p className="text-sm text-on-surface-variant leading-relaxed mb-8 max-w-sm mx-auto font-light">
                  {type === 'scan' 
                    ? "You have used your 3 free bottle scans. Register a formal account to enjoy infinite label scanning, cellar tracking, and direct curation."
                    : "You have used your 3 free sommelier messages. Register a formal account to secure unlimited queries with STEVE, our elite AI spirits advisor."}
                </p>

                {/* Benefits List */}
                <div className="space-y-3.5 mb-8 text-left bg-white/5 border border-white/5 p-5 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-[#ffb77d]/20 text-[#ffb77d] mt-0.5">
                      <Sparkles size={11} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Unlimited Bottle Recognition</h4>
                      <p className="text-[11px] text-[#dac2b2]/75 mt-0.5 leading-normal">Scan and catalog labels of any scotch, bourbon, or rare vintage.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-[#ffb77d]/20 text-[#ffb77d] mt-0.5">
                      <Gem size={11} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Premium AI Sommelier</h4>
                      <p className="text-[11px] text-[#dac2b2]/75 mt-0.5 leading-normal">Enjoy detailed tasting pairings, finish notes, and live advice from STEVE.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-[#ffb77d]/20 text-[#ffb77d] mt-0.5">
                      <Crown size={11} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Club Cask Allocations</h4>
                      <p className="text-[11px] text-[#dac2b2]/75 mt-0.5 leading-normal">Priority access to closed-door masterclasses and localized drops.</p>
                    </div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl mb-8 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-primary uppercase tracking-widest block">Premium Tier</span>
                    <span className="text-xs text-white/50 block mt-0.5">Formal Collector account</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-serif text-white font-bold">$45.00</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block">/ month</span>
                  </div>
                </div>

                {/* Subscribe CTA Button - takes to Sign Up Popup step */}
                <button
                  onClick={() => setStep('signup')}
                  className="w-full h-16 bg-primary text-on-primary rounded-full font-bold active:scale-95 transition-all text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary/15"
                >
                  SUBSCRIBE & SIGN UP
                </button>
              </motion.div>
            )}

            {step === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative z-10 text-left pt-2"
              >
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                    <Sparkles size={20} className="animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-serif text-white font-medium">Activate Passkey</h3>
                  <p className="text-xs text-on-surface-variant font-light mt-1">
                    Enter email, username, and password to sign up
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs mb-4 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSignUpSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-bold text-[#dac2b2]/60 uppercase tracking-wider block mb-1.5 ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center text-white/30">
                        <Mail size={16} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        placeholder="collector@domain.com"
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="text-[10px] font-bold text-[#dac2b2]/60 uppercase tracking-wider block mb-1.5 ml-1">
                      Club Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center text-white/30">
                        <User size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        value={username}
                        placeholder="e.g., MacallanCask"
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[10px] font-bold text-[#dac2b2]/60 uppercase tracking-wider block mb-1.5 ml-1">
                      🔐 Key Passphrase
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        placeholder="At least 6 characters"
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-12 pl-4 pr-12 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={upgrading}
                    className={cn(
                      "w-full h-14 bg-primary text-on-primary rounded-xl font-bold active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/10 mt-6",
                      upgrading ? "opacity-80 cursor-wait" : ""
                    )}
                  >
                    {upgrading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> REGISTERING SIGNATURE...
                      </>
                    ) : (
                      "ACTIVATE UNLIMITED ACCESS"
                    )}
                  </button>
                </form>

                {/* Back Link */}
                <button
                  onClick={() => setStep('teaser')}
                  className="w-full text-center text-xs text-[#dac2b2]/50 hover:text-white transition-colors block mt-5"
                >
                  ← Back to membership details
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
