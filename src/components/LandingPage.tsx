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
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-y-auto scrollbar-none selection:bg-primary selection:text-black">
      {/* Cinematic Background with Video support from /public */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
        <video 
          autoPlay 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-80 scale-105 transition-transform duration-1000"
          poster="https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=1200"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
          <source src="/background.mp4" type="video/mp4" />
          <source src="/video.mp4" type="video/mp4" />
        </video>
        {/* Shading lightened by 50% so background video shines through cleanly */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.32)_100%)]" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-8 py-16 text-center max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-12"
        >
          <span className="text-xs font-bold text-primary tracking-[0.35em] mb-4 block uppercase drop-shadow-md">THE ART OF HOSPITALITY</span>
          <h1 className="text-5xl md:text-6xl font-serif text-[#FAF4E5] mb-5 leading-[1.1] tracking-tight drop-shadow-xl">
            ASSEMBLAGE
          </h1>
          <p className="text-base md:text-lg text-[#E3EDE7]/80 font-light leading-relaxed italic max-w-sm mx-auto drop-shadow-md">
            Private members clubs and VIP events.
          </p>
        </motion.div>

        <div className="w-full space-y-4 max-w-md mx-auto">
          <button 
            onClick={() => setShowLogin(true)}
            className="w-full h-16 bg-primary hover:bg-[#d4af65] text-[#123826] rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 shadow-xl shadow-black/40 group cursor-pointer"
            id="login-cta"
          >
            <LogIn size={20} className="text-[#123826] group-hover:scale-110 transition-transform" />
            <span className="tracking-wider text-sm font-bold">LOGIN TO YOUR ACCOUNT</span>
          </button>

          <button 
            onClick={() => setShowSubscription(true)}
            className="w-full h-16 bg-[#123826]/60 hover:bg-[#123826]/80 text-[#FAF4E5] backdrop-blur-md rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 border border-[#123826]/80 hover:border-primary/60 group cursor-pointer shadow-lg shadow-black/20"
            id="member-cta"
          >
            <UserPlus size={20} className="text-primary group-hover:scale-110 transition-transform" />
            <span className="tracking-wider text-sm font-bold">BECOME A MEMBER</span>
          </button>

          <button 
            onClick={() => setShowClubs(true)}
            className="w-full h-16 bg-white/5 hover:bg-white/15 text-[#FAF4E5]/90 backdrop-blur-md rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 border border-white/10 hover:border-white/25 group cursor-pointer"
            id="explore-cta"
          >
            <Compass size={20} className="text-primary group-hover:rotate-45 transition-transform" />
            <span className="tracking-wider text-sm font-bold">EXPLORE CLUBS</span>
          </button>

          <button 
            onClick={() => onLogin('guest', 'guest@proof.collective', { user: { id: 'guest-bypass-id', email: 'guest@proof.collective' } })}
            className="w-full h-16 bg-white/5 hover:bg-white/10 text-[#FAF4E5]/75 hover:text-white backdrop-blur-md rounded-full font-bold flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 border border-white/10 group cursor-pointer"
            id="guest-cta"
          >
            <Sparkles size={20} className="text-primary animate-pulse group-hover:scale-110 transition-transform" />
            <span className="tracking-wider text-sm font-bold">EXPLORE AS GUEST</span>
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 w-full"
        >
          <button 
            onClick={() => setShowAdminSignup(true)}
            className="text-[11px] font-bold tracking-[0.2em] text-[#C5A059] hover:text-white uppercase inline-flex items-center gap-2 mx-auto transition-colors cursor-pointer"
          >
            <ShieldCheck size={14} className="text-primary" /> Become a Club operator
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
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
          >
            <button 
              onClick={() => {
                setShowLogin(false);
                setShowClubs(false);
                setShowSubscription(false);
                setShowAdminSignup(false);
              }}
              className="absolute top-6 right-6 w-11 h-11 rounded-full bg-[#123826] border border-primary/40 flex items-center justify-center text-primary hover:text-white hover:border-primary shadow-lg transition-all z-10 cursor-pointer"
            >
              <X size={22} />
            </button>

            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-[#0e271a] border border-primary/35 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/85 text-white relative my-auto"
            >
              {showLogin && (
                <div className="text-center">
                  {pendingEventPreview && (
                    <div className="mb-6 bg-[#081810] border border-primary/30 rounded-2xl p-4 text-left flex gap-4 items-center">
                      <img 
                        src={pendingEventPreview.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=200'}
                        className="w-16 h-16 object-cover rounded-xl shrink-0" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className="text-[8px] font-extrabold px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/10 uppercase tracking-wider inline-block">INVITATION ACCESS</span>
                        <h4 className="font-serif text-[#FAF4E5] font-medium text-sm truncate mt-0.5">{pendingEventPreview.title}</h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-primary leading-tight font-mono">
                          <span>{pendingEventPreview.date || 'Upcoming'}</span>
                          <span>•</span>
                          <span className="truncate">{pendingEventPreview.location || 'Private Club'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {pendingBoutiquePreview && (
                    <div className="mb-6 bg-[#081810] border border-primary/30 rounded-2xl p-4 text-left flex gap-4 items-center">
                      <img 
                        src={pendingBoutiquePreview.image || 'https://images.unsplash.com/photo-1527281480658-198cb28a1db0?auto=format&fit=crop&q=80&w=200'}
                        className="w-16 h-16 object-cover rounded-xl shrink-0" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className="text-[8px] font-extrabold px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/10 uppercase tracking-wider inline-block">EXCLUSIVE OFFERING ACCESS</span>
                        <h4 className="font-serif text-[#FAF4E5] font-medium text-sm truncate mt-0.5">{pendingBoutiquePreview.name}</h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-primary leading-tight font-mono">
                          <span>{pendingBoutiquePreview.price || 'Allocation Only'}</span>
                          <span>•</span>
                          <span className="truncate">{pendingBoutiquePreview.category || 'Rare Reserve'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 className="text-3xl font-serif text-[#FAF4E5] mb-3">
                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h3>
                  <p className="text-sm text-[#E3EDE7]/80 mb-6 font-light">
                    {authMode === 'login' 
                      ? 'Enter your email to receive a secure login link.' 
                      : 'Join the club to access exclusive whisky experiences.'}
                  </p>

                  <div className="flex bg-[#081810] rounded-xl p-1 mb-6 border border-primary/25">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
                        authMode === 'login' 
                          ? "bg-gradient-to-r from-[#123826] to-[#1c5036] text-primary border border-primary/50 shadow-sm" 
                          : "text-white/50 hover:text-white"
                      )}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
                        authMode === 'signup' 
                          ? "bg-gradient-to-r from-[#123826] to-[#1c5036] text-primary border border-primary/50 shadow-sm" 
                          : "text-white/50 hover:text-white"
                      )}
                    >
                      Sign Up
                    </button>
                  </div>
                  
                  {error && (
                    <div className={cn(
                      "mb-6 p-4 rounded-xl text-xs font-bold",
                      error.includes('sent') ? "bg-primary/20 text-primary border border-primary/30" : "bg-red-500/20 text-red-300 border border-red-500/30"
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
                          className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-white text-base placeholder-white/30"
                        />
                        <p className="text-[9px] text-primary font-serif font-bold italic mt-2 uppercase tracking-wide text-left pl-2">
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
                      className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-white placeholder-white/30 text-base"
                    />
                    
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={authMode === 'signup' ? "Create Password" : "Password (Optional for Magic Link)"} 
                        disabled={loading}
                        className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 pr-14 outline-none focus:border-primary transition-all disabled:opacity-50 text-white placeholder-white/30 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-primary transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    
                    {authMode === 'signup' && (
                      <div className="mb-4">
                        <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2 block text-left ml-2">Club ID / Access Code</label>
                        <input 
                          type="text"
                          value={clubId}
                          onChange={(e) => setClubId(e.target.value)}
                          placeholder="e.g., underground-001"
                          disabled={loading}
                          className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 outline-none focus:border-primary transition-all disabled:opacity-50 text-white placeholder-white/30 text-base"
                        />
                        <p className="text-[9px] text-primary mt-2 uppercase tracking-tight text-left pl-2 leading-relaxed font-serif font-bold italic">
                          Enter your precise Club ID (created by your Club Operator) to join their private circle, or leave blank to join as an independent collector.
                        </p>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-3 pt-4">
                      <button 
                        onClick={() => handleAuth('member')}
                        disabled={loading}
                        className="w-full h-14 bg-primary hover:bg-[#d4af65] text-[#123826] rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/40 cursor-pointer disabled:opacity-50 tracking-wider text-xs"
                      >
                        {loading ? <Loader2 className="animate-spin text-[#123826]" size={20} /> : (authMode === 'login' ? 'LOG IN AS MEMBER' : 'SIGN UP AS MEMBER')}
                      </button>
                      {authMode === 'login' && (
                        <button 
                          onClick={() => handleAuth('admin')}
                          disabled={loading}
                          className="w-full h-14 bg-[#081810] border border-primary/40 hover:border-primary text-primary rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-wider text-xs"
                        >
                          {loading ? <Loader2 className="animate-spin text-primary" size={20} /> : 'LOG IN AS ADMIN'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showClubs && (
                <div>
                  <h3 className="text-3xl font-serif text-[#FAF4E5] mb-2">Explore Clubs</h3>
                  <p className="text-sm text-[#E3EDE7]/80 mb-8 font-light">Join the world's most exclusive whisky circles.</p>
                  
                  {clubsLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-60">
                      <Loader2 className="animate-spin mb-4 text-primary" size={32} />
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary">Verifying Thresholds...</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                      {clubs.map((club) => (
                        <div 
                          key={club.id} 
                          onClick={() => setExpandedClubId(expandedClubId === club.id ? null : club.id)}
                          className={cn(
                            "p-6 bg-[#081810]/80 border rounded-2xl transition-all cursor-pointer group",
                            expandedClubId === club.id ? "border-primary bg-[#123826]/80 shadow-md" : "border-primary/25 hover:border-primary/60"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className={cn(
                                "text-lg font-serif transition-colors",
                                expandedClubId === club.id ? "text-primary" : "text-[#FAF4E5] group-hover:text-primary"
                              )}>
                                {club.name}
                              </h4>
                              <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] mt-2 font-bold">
                                {club.location || club.city || 'GLOBAL'} {club.members && `• ${club.members} Members`}
                              </p>
                            </div>
                            <ChevronRight 
                              className={cn(
                                "transition-transform duration-300",
                                expandedClubId === club.id ? "rotate-90 text-primary" : "text-primary/60 group-hover:text-primary"
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
                                <div className="pt-4 border-t border-primary/20">
                                  <p className="text-sm text-[#E3EDE7]/80 leading-relaxed font-light">
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
                  <h3 className="text-4xl font-serif text-[#FAF4E5] mb-4">Select Standing</h3>
                  <p className="text-sm text-[#E3EDE7]/80 mb-6 leading-relaxed font-light">
                    Once you make your profile, activate your standing to unlock exclusive distillery drops, priority masterclasses, and complete cellar tools.
                  </p>
                  
                  {/* Options Display */}
                  <div className="space-y-3 mb-8">
                    <div className="bg-[#081810]/80 hover:bg-[#123826]/70 border border-primary/30 hover:border-primary/60 p-5 rounded-2xl flex items-center justify-between text-left transition-all">
                      <div>
                        <span className="font-serif font-bold text-[#FAF4E5] text-base block">Monthly Plan</span>
                        <span className="text-xs text-white/50 block mt-0.5">Cancel anytime</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-mono text-primary font-bold">R 250</span>
                        <span className="text-[10px] text-white/50 block">/ month</span>
                      </div>
                    </div>

                    <div className="bg-[#081810]/80 hover:bg-[#123826]/70 border border-primary/40 hover:border-primary p-5 rounded-2xl flex items-center justify-between text-left transition-all relative">
                      <div className="absolute top-2 right-4 bg-primary text-[#123826] text-[7.5px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-widest">
                        Best Value (Save R600)
                      </div>
                      <div>
                        <span className="font-serif font-bold text-[#FAF4E5] text-base block">Annual Plan</span>
                        <span className="text-xs text-white/50 block mt-0.5">Recurring billing annually</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-mono text-primary font-bold">R 2400</span>
                        <span className="text-[10px] text-white/50 block">/ year</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShowSubscription(false);
                      setAuthMode('signup');
                      setShowLogin(true);
                    }}
                    className="w-full h-16 bg-primary hover:bg-[#d4af65] text-[#123826] rounded-full font-bold shadow-xl shadow-black/50 active:scale-95 transition-all uppercase tracking-widest text-xs cursor-pointer"
                  >
                    CONTINUE TO CREATE PROFILE
                  </button>
                </div>
              )}

              {showAdminSignup && (
                <div>
                  <h3 className="text-3xl font-serif text-[#FAF4E5] mb-2">Become a Club</h3>
                  <p className="text-sm text-[#E3EDE7]/80 mb-8 font-light">Digitize your hospitality experience with PROOF.</p>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Club Name" 
                      value={adminClubName}
                      onChange={(e) => setAdminClubName(e.target.value)}
                      className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 outline-none focus:border-primary transition-all text-white placeholder-white/30" 
                    />
                    <input 
                      type="email" 
                      placeholder="Contact Email" 
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full h-14 bg-[#081810]/90 border border-primary/30 rounded-xl px-6 outline-none focus:border-primary transition-all text-white placeholder-white/30" 
                    />
                    <textarea 
                      placeholder="Proposed Club Details" 
                      value={adminDetails}
                      onChange={(e) => setAdminDetails(e.target.value)}
                      className="w-full h-32 bg-[#081810]/90 border border-primary/30 rounded-xl p-6 outline-none focus:border-primary transition-all resize-none text-white placeholder-white/30" 
                    />
                    
                    <div className="p-6 bg-[#081810]/90 border border-primary/30 rounded-2xl mb-4">
                      <p className="text-[10px] font-bold text-primary tracking-widest mb-1 uppercase">PLATFORM FEE</p>
                      <p className="text-2xl font-serif text-[#FAF4E5]">$149.00 <span className="text-sm text-white/50">/ month</span></p>
                    </div>

                    <button 
                      onClick={() => {
                        const subject = encodeURIComponent('NEW CLUB REQUEST');
                        const body = encodeURIComponent(`Club Name: ${adminClubName}\nContact Email: ${adminEmail}\n\nProposed Club Details:\n${adminDetails}`);
                        window.location.href = `mailto:proofadmin@gmail.com?subject=${subject}&body=${body}`;
                      }}
                      className="w-full h-16 bg-primary hover:bg-[#d4af65] text-[#123826] rounded-full font-bold active:scale-95 transition-transform tracking-widest text-xs uppercase cursor-pointer"
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
