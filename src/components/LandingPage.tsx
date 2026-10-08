import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { LogIn, Compass, UserPlus, ShieldCheck, ChevronRight, X, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { signIn, signUp, supabase, getClubs } from '../services/supabase';
import { UserRole } from '../types';

interface LandingPageProps {
  onLogin: (role: UserRole, email?: string, authData?: any) => void;
  pendingEventPreview?: any;
  pendingBoutiquePreview?: any;
}

export default function LandingPage({ onLogin, pendingEventPreview, pendingBoutiquePreview }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [showClubs, setShowClubs] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAdminSignup, setShowAdminSignup] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [clubId, setClubId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const [adminClubName, setAdminClubName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminDetails, setAdminDetails] = useState('');

  useEffect(() => {
    if (pendingEventPreview) {
      setShowLogin(true);
      setAuthMode('signup');
      if (pendingEventPreview.club_id) {
        setClubId(pendingEventPreview.club_id);
      }
    }
  }, [pendingEventPreview]);

  useEffect(() => {
    if (pendingBoutiquePreview) {
      setShowLogin(true);
      setAuthMode('signup');
      if (pendingBoutiquePreview.club_id) {
        setClubId(pendingBoutiquePreview.club_id);
      }
    }
  }, [pendingBoutiquePreview]);

  const [clubs, setClubs] = useState<any[]>([
    { id: 'underground-001', name: 'Underground Whisky Club Cape Town', location: 'Cape Town', members: '1.2k' },
    { id: '2', name: 'Speyside Circle JHB', location: 'Johannesburg', members: '850' },
    { id: '3', name: 'Dram Society London', location: 'London', members: '2.4k' },
  ]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);

  useEffect(() => {
    async function loadClubs() {
      console.log("LandingPage: Fetching clubs...");
      setClubsLoading(true);
      try {
        const { data, error } = await getClubs();
        if (error) {
          console.error("LandingPage: Error fetching clubs:", error);
          // Keep mocks if error
          return;
        }
        if (data && data.length > 0) {
          console.log("LandingPage: Clubs fetched successfully:", data.length, data);
          setClubs(data);
        } else if (data) {
          console.log("LandingPage: No clubs found in Supabase database.");
          // If Supabase is connected but empty, maybe we keep mocks for a better first look
        }
      } catch (err) {
        console.error("LandingPage: Exception during club fetch:", err);
      } finally {
        setClubsLoading(false);
      }
    }
    loadClubs();
  }, []);

  const handleAuth = async (role: 'member' | 'admin' | 'master_admin') => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }
    
    if (authMode === 'signup' && !password) {
      setError('Please enter a password');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let authResponse;
      if (authMode === 'signup') {
        authResponse = await signUp(email, password, clubId, username);
      } else {
        // If password is provided, try password login, otherwise magic link
        authResponse = await signIn(email, password || undefined);
      }

      if (authResponse.error) {
        console.error("Auth helper returned error:", authResponse.error);
        throw authResponse.error;
      }
      
      console.log("Auth successful:", !!authResponse.data?.user);
      const isDemoMode = !supabase;
      if (isDemoMode || email.includes('demo')) {
        console.log("Proceeding in demo mode");
        onLogin(role, email);
      } else {
        if (authMode === 'signup') {
          setError('Success! Please check your email to confirm your account before logging in.');
        } else if (!password) {
          setError('Magic Link sent! Please check your email.');
        } else if (authResponse.data?.user) {
          console.log("Proceeding with user session:", authResponse.data.user.id);
          onLogin(role, email, authResponse.data);
        } else {
          setError('Login successful, but no user data returned.');
        }
      }
    } catch (err: any) {
      console.error("Caught auth error in component:", err);
      let message = err.message || 'Authentication failed';
      
      if (message.includes('Invalid login credentials')) {
        message = "Invalid email or password. Please check your credentials or switch to \"Sign Up\".";
      } else if (message.includes('rate limit')) {
        message = 'Rate limit exceeded. Please try again in 60 seconds.';
      } else if (message.includes('Email not confirmed')) {
        message = 'Your email is not confirmed. Please check your inbox for the verification link.';
      } else if (message.includes('Database operation timed out')) {
        message = 'The connection to our secure vault is taking longer than usual. Please try again.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-surface flex flex-col overflow-y-auto scrollbar-none">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video 
          autoPlay 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-80"
          poster="https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=1200"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
          {/* Fallback to image if video not found - using high quality background */}
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-surface/40 to-surface" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-20 text-center max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-16"
        >
          <span className="text-label-md text-primary tracking-[0.3em] mb-4 block">THE ART OF HOSPITALITY</span>
          <h1 className="text-5xl md:text-6xl font-serif text-white mb-6 leading-[1.1] tracking-tight">
            PROOF
          </h1>
          <p className="text-lg text-on-surface-variant font-light leading-relaxed italic opacity-80">
            Private members clubs, made effortless.
          </p>
        </motion.div>

        <div className="w-full space-y-4">
          <button 
            onClick={() => setShowLogin(true)}
            className="w-full h-16 bg-white text-black rounded-full font-bold flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-95"
            id="login-cta"
          >
            <LogIn size={20} /> LOGIN TO YOUR ACCOUNT
          </button>

          <button 
            onClick={() => setShowSubscription(true)}
            className="w-full h-16 glass rounded-full font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95 border-primary/20 text-primary"
            id="member-cta"
          >
            <UserPlus size={20} /> BECOME A MEMBER
          </button>

          <button 
            onClick={() => setShowClubs(true)}
            className="w-full h-16 glass rounded-full font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95 border-white/5"
            id="explore-cta"
          >
            <Compass size={20} /> EXPLORE CLUBS
          </button>

          <button 
            onClick={() => onLogin('guest', 'guest@proof.collective', { user: { id: 'guest-bypass-id', email: 'guest@proof.collective' } })}
            className="w-full h-16 glass rounded-full font-bold flex items-center justify-center gap-3 hover:bg-white/10 text-primary border-primary/20 transition-all active:scale-95"
            id="guest-cta"
          >
            <Sparkles size={20} className="text-primary animate-pulse" /> EXPLORE AS GUEST
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 w-full"
        >
          <button 
            onClick={() => setShowAdminSignup(true)}
            className="text-[10px] font-bold tracking-[0.2em] text-white/50 hover:text-primary uppercase flex items-center gap-2 mx-auto transition-colors"
          >
            <ShieldCheck size={14} /> Become a Club operator
          </button>
        </motion.div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(showLogin || showClubs || showSubscription || showAdminSignup) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl p-6 flex items-center justify-center overflow-y-auto"
          >
            <button 
              onClick={() => {
                setShowLogin(false);
                setShowClubs(false);
                setShowSubscription(false);
                setShowAdminSignup(false);
              }}
              className="absolute top-8 right-8 w-12 h-12 rounded-full glass flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={24} />
            </button>

            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md"
            >
              {showLogin && (
                <div className="text-center">
                  {pendingEventPreview && (
                    <div className="mb-6 bg-white/5 border border-[#d8c39b]/25 rounded-2xl p-4 text-left flex gap-4 items-center">
                      <img 
                        src={pendingEventPreview.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=200'}
                        className="w-16 h-16 object-cover rounded-xl shrink-0" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className="text-[8px] font-extrabold px-2 py-0.5 rounded border border-[#d8c39b]/30 text-[#d8c39b] bg-[#d8c39b]/5 uppercase tracking-wider inline-block">INVITATION ACCESS</span>
                        <h4 className="font-serif text-white font-medium text-sm truncate mt-0.5">{pendingEventPreview.title}</h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-[#d8c39b] leading-tight font-mono">
                          <span>{pendingEventPreview.date || 'Upcoming'}</span>
                          <span>•</span>
                          <span className="truncate">{pendingEventPreview.location || 'Private Club'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {pendingBoutiquePreview && (
                    <div className="mb-6 bg-white/5 border border-[#d8c39b]/25 rounded-2xl p-4 text-left flex gap-4 items-center">
                      <img 
                        src={pendingBoutiquePreview.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=200'}
                        className="w-16 h-16 object-cover rounded-xl shrink-0" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className="text-[8px] font-extrabold px-2 py-0.5 rounded border border-[#d8c39b]/30 text-[#d8c39b] bg-[#d8c39b]/5 uppercase tracking-wider inline-block">EXCLUSIVE OFFERING ACCESS</span>
                        <h4 className="font-serif text-white font-medium text-sm truncate mt-0.5">{pendingBoutiquePreview.name}</h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-[#d8c39b] leading-tight font-mono">
                          <span>{pendingBoutiquePreview.price || 'Allocation Only'}</span>
                          <span>•</span>
                          <span className="truncate">{pendingBoutiquePreview.category || 'Rare Reserve'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 className="text-3xl font-serif text-white mb-4">
                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-6">
                    {authMode === 'login' 
                      ? 'Enter your email to receive a secure login link.' 
                      : 'Join the club to access exclusive whisky experiences.'}
                  </p>

                  <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                        authMode === 'login' ? "bg-white text-black" : "text-white/40 hover:text-white"
                      )}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                        authMode === 'signup' ? "bg-white text-black" : "text-white/40 hover:text-white"
                      )}
                    >
                      Sign Up
                    </button>
                  </div>
                  
                  {error && (
                    <div className={cn(
                      "mb-6 p-4 rounded-xl text-xs font-bold",
                      error.includes('sent') ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-400"
                    )}>
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    {authMode === 'signup' && (
                      <div>
                        <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Create Username" 
                          disabled={loading}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-white text-base placeholder-white/20"
                        />
                        <p className="text-[9px] text-[#d8c39b] font-serif font-bold italic mt-2 uppercase tracking-wide text-left pl-2">
                          Optional: Use a bespoke nickname for your user profile and taste reviews.
                        </p>
                      </div>
                    )}

                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address" 
                      disabled={loading}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-base"
                    />
                    
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={authMode === 'signup' ? "Create Password" : "Password (Optional for Magic Link)"} 
                        disabled={loading}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 pr-14 outline-none focus:border-primary transition-all disabled:opacity-50 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    
                    {authMode === 'signup' && (
                      <div className="mb-4">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block text-left ml-2">Club ID / Access Code</label>
                        <input 
                          type="text"
                          value={clubId}
                          onChange={(e) => setClubId(e.target.value)}
                          placeholder="e.g., underground-001"
                          disabled={loading}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-white placeholder-white/20 text-base"
                        />
                        <p className="text-[9px] text-[#d8c39b] mt-2 uppercase tracking-tight text-left pl-2 leading-relaxed font-serif font-bold italic">
                          Enter your precise Club ID (created by your Club Operator) to join their private circle, or leave blank to join as an independent collector.
                        </p>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-3 pt-4">
                      <button 
                        onClick={() => handleAuth('member')}
                        disabled={loading}
                        className="w-full h-14 bg-primary text-black rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? 'LOG IN AS MEMBER' : 'SIGN UP AS MEMBER')}
                      </button>
                      {authMode === 'login' && (
                        <button 
                          onClick={() => handleAuth('admin')}
                          disabled={loading}
                          className="w-full h-14 glass text-white rounded-xl font-bold active:scale-95 transition-all border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="animate-spin" size={20} /> : 'LOG IN AS ADMIN'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showClubs && (
                <div>
                  <h3 className="text-3xl font-serif text-white mb-2">Explore Clubs</h3>
                  <p className="text-sm text-on-surface-variant mb-8">Join the world's most exclusive whisky circles.</p>
                  
                  {clubsLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                      <Loader2 className="animate-spin mb-4" size={32} />
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Verifying Thresholds...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clubs.map((club) => (
                        <div 
                          key={club.id} 
                          onClick={() => setExpandedClubId(expandedClubId === club.id ? null : club.id)}
                          className={cn(
                            "p-6 bg-white/5 border rounded-2xl transition-all cursor-pointer group",
                            expandedClubId === club.id ? "border-primary/50 bg-white/[0.08]" : "border-white/10 hover:border-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className={cn(
                                "text-lg font-serif transition-colors",
                                expandedClubId === club.id ? "text-primary" : "text-white group-hover:text-primary/80"
                              )}>
                                {club.name}
                              </h4>
                              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-2 font-bold">
                                {club.location || club.city || 'GLOBAL'} {club.members && `• ${club.members} Members`}
                              </p>
                            </div>
                            <ChevronRight 
                              className={cn(
                                "transition-transform duration-300",
                                expandedClubId === club.id ? "rotate-90 text-primary" : "text-white/20 group-hover:text-white/40"
                              )} 
                              size={20} 
                            />
                          </div>

                          <AnimatePresence>
                            {expandedClubId === club.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="pt-4 border-t border-white/10">
                                  <p className="text-sm text-on-surface-variant leading-relaxed">
                                    {club.description || "An exclusive community of whisky enthusiasts dedicated to rare selections and refined experiences."}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showSubscription && (
                <div className="text-center max-w-md mx-auto">
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase mb-2 block">Membership Club Circle</span>
                  <h3 className="text-4xl font-serif text-white mb-4">Select Standing</h3>
                  <p className="text-sm text-white/60 mb-6 leading-relaxed">
                    Once you make your profile, activate your standing to unlock exclusive distillery drops, priority masterclasses, and complete cellar tools.
                  </p>
                  
                  {/* Options Display */}
                  <div className="space-y-3 mb-8">
                    <div className="bg-primary/5 hover:bg-primary/10 border border-primary/30 p-5 rounded-2xl flex items-center justify-between text-left transition-all">
                      <div>
                        <span className="font-serif font-bold text-white text-base block">Monthly Plan</span>
                        <span className="text-xs text-white/40 block mt-0.5">Cancel anytime</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-mono text-primary font-bold">R 250</span>
                        <span className="text-[10px] text-white/40 block">/ month</span>
                      </div>
                    </div>

                    <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 p-5 rounded-2xl flex items-center justify-between text-left transition-all relative">
                      <div className="absolute top-2 right-4 bg-primary text-black text-[7.5px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-widest">
                        Best Value (Save R600)
                      </div>
                      <div>
                        <span className="font-serif font-bold text-white text-base block">Annual Plan</span>
                        <span className="text-xs text-white/40 block mt-0.5">Recurring billing annually</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-mono text-primary font-bold">R 2400</span>
                        <span className="text-[10px] text-white/40 block">/ year</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShowSubscription(false);
                      setAuthMode('signup');
                      setShowLogin(true);
                    }}
                    className="w-full h-16 bg-primary text-black rounded-full font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
                  >
                    CONTINUE TO CREATE PROFILE
                  </button>
                </div>
              )}

              {showAdminSignup && (
                <div>
                  <h3 className="text-3xl font-serif text-white mb-2">Become a Club</h3>
                  <p className="text-sm text-on-surface-variant mb-8">Digitize your hospitality experience with PROOF.</p>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Club Name" 
                      value={adminClubName}
                      onChange={(e) => setAdminClubName(e.target.value)}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary transition-all" 
                    />
                    <input 
                      type="email" 
                      placeholder="Contact Email" 
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-6 outline-none focus:border-primary transition-all" 
                    />
                    <textarea 
                      placeholder="Proposed Club Details" 
                      value={adminDetails}
                      onChange={(e) => setAdminDetails(e.target.value)}
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-6 outline-none focus:border-primary transition-all resize-none" 
                    />
                    
                    <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl mb-4">
                      <p className="text-[10px] font-bold text-primary tracking-widest mb-1 uppercase">PLATFORM FEE</p>
                      <p className="text-2xl font-serif text-white">$149.00 <span className="text-sm text-white/40">/ month</span></p>
                    </div>

                    <button 
                      onClick={() => {
                        const subject = encodeURIComponent('NEW CLUB REQUEST');
                        const body = encodeURIComponent(`Club Name: ${adminClubName}\nContact Email: ${adminEmail}\n\nProposed Club Details:\n${adminDetails}`);
                        window.location.href = `mailto:proofadmin@gmail.com?subject=${subject}&body=${body}`;
                      }}
                      className="w-full h-16 bg-primary text-black rounded-full font-bold active:scale-95 transition-transform"
                    >
                      REQUEST
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
