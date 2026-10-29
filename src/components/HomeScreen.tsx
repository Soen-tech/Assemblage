import { motion } from 'framer-motion';
import { Camera, ArrowRight, BookOpen, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { WhiskyCard } from './Cards';
import { useState, useEffect } from 'react';
import { getEvents } from '../services/supabase';

import { Whisky, View, ClubEvent } from '../types';

export default function HomeScreen({ 
  onScanClick, 
  onViewCellarClick, 
  journal = [],
  onSubscribeClick,
  hasActiveSubscription = false,
  onNavigate
}: { 
  onScanClick: () => void; 
  onViewCellarClick: () => void; 
  journal?: Whisky[];
  onSubscribeClick?: () => void;
  hasActiveSubscription?: boolean;
  onNavigate: (view: View) => void;
}) {
  const [featuredEvent, setFeaturedEvent] = useState<ClubEvent | null>(null);

  useEffect(() => {
    async function fetchFeaturedEvent() {
      try {
        const { data } = await getEvents();
        if (data && data.length > 0) {
          // getEvents already returns events sorted by created_at descending
          setFeaturedEvent(data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch events for featured section:", err);
      }
    }
    fetchFeaturedEvent();
  }, []);

  // Calculate average palate architecture from journal entries
  const palateData = [
    { label: 'PEATY', key: 'peaty', color: '#ffb77d' },
    { label: 'FRUITY', key: 'fruity', color: '#e9c176' },
    { label: 'CEREAL', key: 'cereal', color: '#d27d2d' },
    { label: 'FLORAL', key: 'floral', color: '#ddc0ba' },
    { label: 'INTENSITY', key: 'intensity', color: '#a5c0b0' },
  ].map(item => {
    const total = journal.reduce((acc, entry) => {
      const val = entry.swriProfile?.[item.key as keyof typeof entry.swriProfile];
      return acc + (typeof val === 'number' ? val : 0);
    }, 0);
    const avg = journal.length > 0 ? (total / journal.length) : 0;
    // The model uses 0-100, but we display 0-10 in the UI for density
    const val = avg > 0 ? parseFloat((avg / 10).toFixed(1)) : parseFloat((Math.random() * 2 + 3).toFixed(1));
    return { ...item, value: val };
  });

  // Display up to 4 most recent entries in the user's Journal (no dummy card fallback)
  const recentlyScannedList = journal && journal.length > 0 ? journal.slice(0, 4) : [];

  return (
    <div className="flex-1 pb-32">
      {/* Premium Membership Banner */}
      {!hasActiveSubscription && (
        <section className="mx-6 mt-6 bg-gradient-to-r from-[#123826] via-[#1a4a34] to-[#123826] border border-primary/30 rounded-[2rem] p-6 relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold text-primary tracking-widest uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Standing Activation Period
              </span>
              <h3 className="text-lg font-serif text-white font-semibold">Join the Club Circle</h3>
              <p className="text-xs text-white/75 max-w-sm leading-relaxed">
                Unlock exclusive distillery allocations, priority ticketing for private masterclasses, and complete cellar vault features.
              </p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSubscribeClick}
              className="px-6 py-2.5 bg-primary text-secondary font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-primary/25 self-start md:self-auto cursor-pointer"
            >
              SUBSCRIBE AND JOIN
            </motion.button>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="relative h-64 mx-6 mt-6 rounded-[2rem] overflow-hidden group shadow-md">
        <img 
          src="https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=1200" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          alt="Whisky background"
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        <div className="relative h-full flex flex-col items-center justify-center text-center p-6">
          <h2 className="text-headline-md text-white mb-2">Identify Your Pour</h2>
          <p className="text-sm text-balance text-white/80 max-w-[240px] mb-6">
            Scan any bottle to unlock tasting notes, market value, and heritage data.
          </p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onScanClick}
            className="flex items-center gap-2 bg-primary text-secondary px-8 py-3 rounded-full font-extrabold shadow-xl shadow-primary/30 cursor-pointer"
          >
            <Camera size={20} className="text-secondary" />
            SCAN BOTTLE
          </motion.button>
        </div>
      </section>

      {/* Recently Scanned */}
      <section className="mt-10">
        <div className="flex items-center justify-between px-6 mb-4">
          <h3 className="text-headline-md text-secondary">Recently Scanned</h3>
          {recentlyScannedList.length > 0 && (
            <button 
              type="button"
              onClick={onViewCellarClick}
              className="text-sm font-bold text-primary flex items-center gap-1 hover:underline"
            >
              View Cellar <ChevronRight size={16} />
            </button>
          )}
        </div>
        {recentlyScannedList.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-none">
            {recentlyScannedList.map((whisky) => (
              <WhiskyCard 
                key={whisky.id} 
                whisky={whisky} 
                onClick={onViewCellarClick}
              />
            ))}
          </div>
        ) : (
          <div className="mx-6 p-6 rounded-2xl bg-surface-container border border-stone-200/80 text-center flex flex-col items-center justify-center">
            <p className="text-xs text-on-surface/50 uppercase tracking-widest font-medium">No recently scanned bottles</p>
            <button 
              type="button"
              onClick={onScanClick}
              className="mt-3 px-5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-secondary text-xs font-bold hover:bg-primary/20 transition-all uppercase tracking-wider cursor-pointer"
            >
              Scan a bottle now
            </button>
          </div>
        )}
      </section>

      {/* Expert Guidance */}
      <section className="mt-12 px-6">
        <h3 className="text-headline-md text-secondary mb-6">Expert Guidance</h3>
        
        {featuredEvent ? (
          <div className="bg-surface rounded-[2rem] p-8 mb-6 border border-primary/30 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-secondary transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12 pointer-events-none">
              <CalendarIcon size={120} />
            </div>
            <span className="text-[10px] font-extrabold text-primary tracking-widest uppercase mb-4 block">Featured Event</span>
            <h4 className="text-2xl font-serif text-secondary mb-3 font-semibold">{featuredEvent.title}</h4>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-8">
              {featuredEvent.description.split('. ')[0]}.
            </p>
            <button 
              onClick={() => onNavigate('events')}
              className="h-10 px-6 rounded-lg border border-secondary/40 text-secondary text-xs font-bold transition-colors hover:bg-secondary/10 cursor-pointer"
            >
              SEE EVENT
            </button>
          </div>
        ) : (
          <div 
            onClick={() => onNavigate('journal')}
            className="bg-surface rounded-3xl p-6 border border-stone-200/80 shadow-sm flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-all mb-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary">
              <BookOpen size={24} />
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-bold text-secondary mb-1">Tasting Journal</h5>
              <p className="text-xs text-on-surface-variant">You haven't logged a tasting today.</p>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('journal');
              }}
              aria-label="Go to Tasting Journal"
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <ArrowRight className="text-primary" size={20} />
            </button>
          </div>
        )}

        <div 
          onClick={() => onNavigate('journal')}
          className="bg-surface rounded-3xl p-6 border border-stone-200/80 shadow-sm flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary">
            <BookOpen size={24} />
          </div>
          <div className="flex-1">
            <h5 className="text-sm font-bold text-secondary mb-1">Tasting Journal</h5>
            <p className="text-xs text-on-surface-variant">Access your personal logs and tasting history.</p>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('journal');
            }}
            aria-label="Go to Tasting Journal"
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <ArrowRight className="text-primary" size={20} />
          </button>
        </div>
      </section>

      {/* Palate Architecture */}
      <section className="mt-12 px-6">
        <h3 className="text-headline-md text-secondary mb-6">Your Palate Architecture</h3>
        <div className="grid grid-cols-2 gap-4">
          {palateData.map((item) => (
            <div key={item.label} className="bg-surface rounded-2xl p-5 border border-stone-200/80 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-bold text-secondary/60 tracking-widest">{item.label}</span>
                <div className="relative w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.value * 10}%` }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
                <span className="text-2xl font-serif text-secondary font-semibold">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating Action Button for Instant Bottle Scanning */}
      <motion.button
        id="floating-scan-fab"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.9 }}
        onClick={onScanClick}
        className="fixed bottom-24 right-6 z-40 bg-primary text-secondary h-14 w-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(197,160,89,0.45)] border border-primary/30 hover:brightness-105 active:brightness-95 transition-all cursor-pointer"
        aria-label="Scan Bottle"
      >
        <Camera size={26} className="text-secondary stroke-[2.25]" />
      </motion.button>
    </div>
  );
}
