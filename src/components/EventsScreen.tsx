import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Search, Filter, Loader2, X, Ticket, Clock, Share2, Sparkles, CheckCircle, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FEATURED_EVENTS } from '../constants';
import { EventCard } from './Cards';
import { cn } from '../lib/utils';
import { getEvents, getUserTickets } from '../services/supabase';
import { ClubEvent } from '../types';
import PayfastCheckoutModal from './PayfastCheckoutModal';

export default function EventsScreen({ clubId, user }: { clubId?: string | string[]; user?: any }) {
  const [activeTab, setActiveTab] = useState<'explore' | 'tickets'>('explore');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All Events');
  
  const [events, setEvents] = useState<ClubEvent[]>(FEATURED_EVENTS);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Tickets states
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Calendar Integration Helpers
  const handleGoogleCalendar = (tkt: any) => {
    const title = encodeURIComponent(`PROOF Masterclass: ${tkt.event_name}`);
    let dateRaw = tkt.event_date || new Date().toISOString().split('T')[0];
    const baseDate = dateRaw.replace(/[^0-9]/g, '').substring(0, 8);
    const start = `${baseDate}T183000`; // 6:30 PM
    const end = `${baseDate}T213000`; // 9:30 PM
    const details = encodeURIComponent(`Access Ref: #${String(tkt.id).substring(String(tkt.id).length - 8).toUpperCase()}\n\nPlease present this ticket with your QR code at the reception of The Prestige Tasting Suite.`);
    const location = encodeURIComponent("The Prestige Tasting Suite");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIcs = (tkt: any) => {
    const uid = `tkt-${tkt.id}@proof-premium.com`;
    let dateRaw = tkt.event_date || new Date().toISOString().split('T')[0];
    const baseDate = dateRaw.replace(/[^0-9]/g, '').substring(0, 8);
    const start = `${baseDate}T183000`;
    const end = `${baseDate}T213000`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PROOF System//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:PROOF Masterclass: ${tkt.event_name}`,
      `DESCRIPTION:Access Ref: #${String(tkt.id).substring(String(tkt.id).length - 8).toUpperCase()}\\n\\nPlease present this ticket with your QR code at the reception of The Prestige Tasting Suite.`,
      'LOCATION:The Prestige Tasting Suite',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = `${tkt.event_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ticket.ics`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const clubIdKey = Array.isArray(clubId) ? clubId.join(',') : (clubId || 'all');

  const handleReload = async () => {
    try {
      const { data } = await getEvents(clubId);
      if (data) {
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const uId = user?.id || 'demo-user-id';
      const { data } = await getUserTickets(uId);
      if (data) {
        setTickets(data);
      }
    } catch (err) {
      console.error("Failed to fetch user tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Reload events on club change
  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const { data } = await getEvents(clubId);
        if (data) {
          setEvents(data);
        }
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [clubIdKey]);

  // Auto-checkout for invite flows
  useEffect(() => {
    if (!loading && events.length > 0) {
      const targetEventId = localStorage.getItem('auto_checkout_event_id');
      if (targetEventId) {
        const foundEvent = events.find(e => String(e.id) === String(targetEventId));
        if (foundEvent) {
          console.log("[EventsScreen] Auto launching checkout modal for event:", foundEvent);
          setSelectedEvent(foundEvent);
          setIsCheckoutOpen(true);
        }
        localStorage.removeItem('auto_checkout_event_id');
      }
    }
  }, [loading, events]);

  // Load tickets on mount and whenever user changes or tab switch to tickets
  useEffect(() => {
    loadTickets();
  }, [user?.id, activeTab]);

  // Filter events based on active pills
  const filteredEvents = events.filter(e => {
    if (selectedSubCategory === 'All Events') return true;
    if (selectedSubCategory === 'Masterclasses') {
      return e.category?.toLowerCase().includes('master') || e.title?.toLowerCase().includes('master');
    }
    if (selectedSubCategory === 'Rare Pours') {
      return e.category?.toLowerCase().includes('rare') || e.title?.toLowerCase().includes('pour') || e.title?.toLowerCase().includes('rare') || e.description?.toLowerCase().includes('rare');
    }
    if (selectedSubCategory === 'Estate Visits') {
      return e.category?.toLowerCase().includes('visit') || e.title?.toLowerCase().includes('visit') || e.title?.toLowerCase().includes('distillery');
    }
    return true;
  });

  return (
    <div className="flex-1 px-6 pt-6 pb-32">
      <header className="mb-8">
        <span className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase mb-2 block">Cask & Craft</span>
        <h2 className="text-4xl font-serif text-white mb-2">Club Events</h2>
        <p className="text-sm text-white/40 leading-relaxed max-w-sm">
          Refine your palate and passions through our curated masterclasses and exclusive tasting sessions.
        </p>
      </header>

      {/* Persistent View Toggle Selector */}
      <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-8">
        <button 
          onClick={() => setActiveTab('explore')}
          className={cn(
            "flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2",
            activeTab === 'explore' ? "bg-primary text-on-primary shadow-lg" : "text-white/60 hover:text-white"
          )}
        >
          <Calendar size={14} />
          Browse Events
        </button>
        <button 
          onClick={() => setActiveTab('tickets')}
          className={cn(
            "flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative",
            activeTab === 'tickets' ? "bg-primary text-on-primary shadow-lg" : "text-white/60 hover:text-white"
          )}
        >
          <Ticket size={14} />
          My Tickets
          {tickets.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[9px] font-mono bg-secondary text-black rounded-lg">
              {tickets.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'explore' ? (
        <>
          {/* Sub-categories */}
          <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-none">
            {['All Events', 'Masterclasses', 'Rare Pours', 'Estate Visits'].map((cat) => (
              <button 
                key={cat}
                onClick={() => setSelectedSubCategory(cat)}
                className={cn(
                  "flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all border",
                  selectedSubCategory === cat 
                    ? "bg-primary border-primary text-on-primary" 
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Events List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary" />
                <p className="text-xs text-white/40 uppercase tracking-widest">Fetching Event Schedule...</p>
              </div>
            ) : filteredEvents.length > 0 ? (
              filteredEvents.map((event, i) => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  featured={i === 0 && selectedSubCategory === 'All Events'} 
                  onClick={() => setSelectedEvent(event)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Calendar className="text-white/10 mb-4" size={48} />
                <p className="text-white/40 italic">No exclusive events currently scheduled.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* My Tickets tab */
        <div className="space-y-4">
          {loadingTickets ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary" />
              <p className="text-xs text-white/40 uppercase tracking-widest">Fetching Purchased Passes...</p>
            </div>
          ) : tickets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map((tkt) => (
                <div 
                  key={tkt.id} 
                  className="relative bg-surface-container rounded-3xl border border-white/5 overflow-hidden flex flex-col p-6 shadow-xl hover:border-white/10 transition-all group"
                >
                  {/* Left & Right custom ticket notch circles */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-black rounded-r-full border-r border-white/5 z-10" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-black rounded-l-full border-l border-white/5 z-10" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2 items-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">VALID PASS</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/30 uppercase">
                      #{String(tkt.id).substring(String(tkt.id).length - 8).toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-xl font-serif text-white mb-2 group-hover:text-primary transition-colors">
                    {tkt.event_name}
                  </h3>
                  
                  {/* Metadata */}
                  <div className="flex flex-col gap-2 text-xs text-white/50 mb-4 font-mono uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-primary" />
                      <span>
                        {tkt.event_date 
                          ? new Date(tkt.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() 
                          : 'UPCOMING SESSION'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-primary" />
                      <span>THE PRESTIGE TASTING SUITE</span>
                    </div>
                  </div>

                  {/* Dashed line */}
                  <div className="border-t border-dashed border-white/10 my-2" />

                  {/* Barcode / scan mock footer */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="font-mono text-[9px] text-white/20 uppercase tracking-[0.2em] select-none">
                      ||||| ||| || | ||| |||| |
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === tkt.id ? null : tkt.id);
                          }}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-[10px] font-bold flex items-center gap-1.5 transition-all"
                          title="Add to Calendar"
                        >
                          <Calendar size={12} className="text-primary" />
                          <span>Add to Calendar</span>
                        </button>
                        
                        {openDropdownId === tkt.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                              }} 
                            />
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#11161d] border border-white/10 rounded-xl shadow-2xl p-1.5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGoogleCalendar(tkt);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/5 text-xs text-white rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Google Calendar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadIcs(tkt);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/5 text-xs text-white rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                iCal / Outlook File (.ics)
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <button 
                        onClick={() => setSelectedTicket(tkt)}
                        className="px-4 py-2 bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold rounded-xl hover:bg-primary/25 transition-all"
                      >
                        View QR Pass
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border border-white/5 rounded-[2rem] p-8">
              <Ticket className="text-white/15 mb-4 animate-bounce" size={48} />
              <h4 className="text-lg font-serif text-white mb-2">No Active Tickets Found</h4>
              <p className="text-xs text-white/40 max-w-xs mx-auto mb-6">
                You haven't bought any masterclass entry passes yet. Discover elite events to purchase your pass!
              </p>
              <button 
                onClick={() => setActiveTab('explore')}
                className="px-6 py-3 bg-primary text-on-primary text-xs font-bold rounded-2xl active:scale-[0.98] transition-transform"
              >
                Browse Exclusive Events
              </button>
            </div>
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] bg-surface-container rounded-[2rem] border border-white/10 z-[101] overflow-hidden flex flex-col max-w-2xl mx-auto"
            >
              <div className="relative h-[260px] flex-shrink-0 bg-black/40">
                {/* Blurred Background */}
                <img 
                  src={selectedEvent.image || undefined} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" 
                />
                {/* Full Image */}
                <img 
                  src={selectedEvent.image || undefined} 
                  alt={selectedEvent.title} 
                  className="relative w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-60" />
                
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white z-10 hover:bg-black/60 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className="px-3 py-1 bg-primary text-on-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {selectedEvent.category}
                  </span>
                  {selectedEvent.rating && (
                    <span className="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-secondary uppercase tracking-widest">
                      ★ {selectedEvent.rating}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <h3 className="font-serif text-3xl text-white mb-6">
                  {selectedEvent.title}
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <Calendar className="text-secondary mb-2" size={18} />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Date</p>
                    <p className="text-sm text-white font-medium">{selectedEvent.date}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <MapPin className="text-secondary mb-2" size={18} />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Location</p>
                    <p className="text-sm text-white font-medium">{selectedEvent.location}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">About the Event</h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {selectedEvent.description || "Join us for an exclusive journey through the finest selection of rare whiskies. Experience depth of character and complex tasting notes in an intimate setting designed for true connoisseurs."}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">What's Included</h4>
                    <ul className="space-y-2">
                      {['Premium Tasting Flight', 'Curated Charcuterie', 'Tasting Journal', 'Expert Guidance'].map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm text-on-surface-variant">
                          <div className="w-1 h-1 bg-primary rounded-full" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container border-t border-white/10 flex items-center justify-between gap-6">
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">Single Entry</p>
                  <p className="text-2xl font-serif text-white leading-none">
                    {selectedEvent.payfast_price ? `R ${(Number(selectedEvent.payfast_price) || 0).toFixed(2)}` : (selectedEvent.price || 'Complimentary')}
                  </p>
                  {selectedEvent.payfast_quantity !== undefined && selectedEvent.payfast_quantity !== null && (
                    <span className="text-[9px] text-primary block mt-1 font-mono uppercase tracking-wider">
                      {Number(selectedEvent.payfast_quantity) > 0 ? `${selectedEvent.payfast_quantity} tickets remaining` : 'SOLD OUT'}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={selectedEvent.payfast_quantity !== undefined && selectedEvent.payfast_quantity !== null && Number(selectedEvent.payfast_quantity) <= 0}
                  className="flex-1 bg-primary text-on-primary h-14 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:scale-100"
                >
                  <Ticket size={20} />
                  BOOK
                </button>
                <button className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/60">
                  <Share2 size={20} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* IMMERSIVE HOLOGRAPHIC QR PASS DETAIL MODAL */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-[8%] bottom-[8%] bg-[#0A0D10] text-white rounded-[2.5rem] border border-white/10 z-[201] overflow-hidden flex flex-col max-w-md mx-auto shadow-[0_0_50px_rgba(235,182,109,0.15)]"
            >
              {/* Golden Accent top band */}
              <div className="h-2 w-full bg-gradient-to-r from-primary via-[#ffdfb0] to-primary flex-shrink-0" />
              
              <div className="p-6 flex justify-between items-center bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-primary/20 text-primary">
                    <ShieldCheck size={18} />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-primary font-bold uppercase">PROOF SMART PASS</span>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center">
                {/* Event category title */}
                <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-[9px] font-mono uppercase tracking-[0.25em] mb-4">
                  OFFICIAL ACCESS CONCIERGE
                </span>
                
                <h4 className="text-2xl font-serif text-white mb-6 leading-tight">
                  {selectedTicket.event_name}
                </h4>

                {/* Simulated Holographic Scanning Screen */}
                <div className="relative p-6 bg-white/5 border border-white/10 rounded-[2rem] shadow-inner mb-6 flex flex-col items-center justify-center w-64 h-64 bg-gradient-to-br from-[#121820] to-[#0d1218]">
                  {/* Glowing corners */}
                  <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary" />
                  <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary" />
                  <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary" />

                  {/* QR Core simulation */}
                  <div className="w-40 h-40 bg-white p-3 rounded-2xl flex flex-col justify-between items-stretch">
                    {/* Visual custom QR square pattern */}
                    <div className="flex justify-between h-10">
                      <div className="w-10 h-10 bg-black rounded-lg border-2 border-white flex items-center justify-center">
                        <div className="w-5 h-5 bg-white rounded-sm" />
                      </div>
                      <div className="w-12 h-10 flex flex-wrap gap-1 p-0.5">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className={cn("w-2 h-2 rounded-sm", i % 3 === 0 ? "bg-black" : "bg-transparent")} />
                        ))}
                      </div>
                      <div className="w-10 h-10 bg-black rounded-lg border-2 border-white flex items-center justify-center">
                        <div className="w-5 h-5 bg-white rounded-sm" />
                      </div>
                    </div>

                    <div className="flex justify-between h-12 my-1">
                      <div className="w-1/2 flex flex-wrap gap-1 p-0.5">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div key={i} className={cn("w-2 h-2 rounded-sm", (i * i + 3) % 2 === 0 ? "bg-black" : "bg-transparent")} />
                        ))}
                      </div>
                      <div className="w-1/2 flex flex-wrap gap-1 p-0.5 justify-end">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div key={i} className={cn("w-2 h-2 rounded-sm", (i * 7 + 11) % 3 === 0 ? "bg-black" : "bg-transparent")} />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between h-10">
                      <div className="w-10 h-10 bg-black rounded-lg border-2 border-white flex items-center justify-center">
                        <div className="w-5 h-5 bg-white rounded-sm" />
                      </div>
                      <div className="w-12 h-10 flex flex-wrap gap-1 p-0.5">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className={cn("w-2 h-2 rounded-sm", i % 4 === 1 ? "bg-black" : "bg-transparent")} />
                        ))}
                      </div>
                      <div className="w-10 h-10 flex flex-wrap gap-1.5 p-1 justify-end items-end">
                        <div className="w-4 h-4 bg-black rounded-md" />
                        <div className="w-2 h-2 bg-black rounded-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Access Status bar */}
                  <span className="absolute bottom-6 font-mono text-[9px] text-[#ffb77d] tracking-widest animate-pulse">
                    ● ENTRANCE AUTHENTICATOR SCANNER
                  </span>
                </div>

                {/* Sub-text info */}
                <div className="space-y-1 mb-2">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">Access Reference</p>
                  <p className="text-sm font-mono text-white">
                    {(selectedTicket.id && String(selectedTicket.id).toUpperCase()) || 'MOCKED-REF-CODE'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-6 bg-white/5 border border-white/5 p-4 rounded-2xl text-left">
                  <div>
                    <span className="text-[9px] text-white/30 uppercase block font-mono">ADMITTANCE</span>
                    <span className="text-xs text-white font-serif">1x Single Pass</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/30 uppercase block font-mono">HOLDER SIGNATURE</span>
                    <span className="text-xs text-white truncate text-ellipsis block max-w-[120px]" title={user?.email || "Fine Member"}>
                      {user?.email ? user.email.split('@')[0] : "FINE MEMBER"}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-white/5">
                    <span className="text-[9px] text-white/30 uppercase block font-mono">GATE TIMING</span>
                    <span className="text-xs text-white font-serif">
                      {selectedTicket.event_date ? new Date(selectedTicket.event_date).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}).toUpperCase() : 'UPCOMING'} (18:30)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-6 bg-white/5 border-t border-white/5 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleGoogleCalendar(selectedTicket)}
                    className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Calendar size={14} className="text-primary" />
                    Google Calendar
                  </button>
                  <button 
                    onClick={() => handleDownloadIcs(selectedTicket)}
                    className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Sparkles size={14} className="text-secondary" />
                    Download iCal
                  </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 h-12 bg-primary hover:bg-[#ffa75e] text-black rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    Print QR Pass
                  </button>
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="px-6 h-12 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-bold text-xs transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Payfast Secure Checkout Modal */}
      <PayfastCheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={selectedEvent}
        itemType="event"
        onSuccess={(updatedVal) => {
          setIsCheckoutOpen(false);
          setSelectedEvent(null);
          handleReload();
          loadTickets(); // Refresh tickets instantly upon active purchase
        }}
      />
    </div>
  );
}
