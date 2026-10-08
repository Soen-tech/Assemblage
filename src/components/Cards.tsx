import { motion } from 'framer-motion';
import { Share2, ShoppingCart, BookOpen } from 'lucide-react';
import { Whisky, ClubEvent } from '../types';
import { cn } from '../lib/utils';

export function WhiskyCard({ whisky, onClick }: { whisky: Whisky; onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex-shrink-0 w-64 bg-surface-container rounded-3xl overflow-hidden border border-white/5 cursor-pointer"
      id={`whisky-card-${whisky.id}`}
    >
      <div className="aspect-[4/5] relative overflow-hidden">
        <img 
          src={whisky.image || undefined} 
          alt={whisky.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">{whisky.region}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />
      </div>
      
      <div className="p-5 relative">
        <h3 className="font-serif text-lg font-medium text-white group-hover:text-primary transition-colors leading-tight">
          {whisky.name}
        </h3>
        <p className="text-sm text-on-surface-variant line-clamp-1 mt-1 mb-4 leading-relaxed italic opacity-80">
          {whisky.description}
        </p>
        
        <div className="flex flex-wrap gap-1.5">
          {whisky.tastingNotes.slice(0, 3).map((note) => (
            <span 
              key={note}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-on-surface/60 uppercase tracking-tighter"
            >
              {note}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function EventCard({ event, featured = false, onClick }: { event: ClubEvent; featured?: boolean; onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "relative rounded-3xl overflow-hidden border border-white/5 cursor-pointer group",
        featured ? "h-96" : "h-64"
      )}
      id={`event-card-${event.id}`}
    >
      <img 
        src={event.image || undefined} 
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="mb-0.5">
          <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest leading-none">
            {event.category}
          </span>
        </div>
        
        <h3 className={cn("text-headline-md text-white leading-tight mb-4 transition-colors group-hover:text-primary")}>
          {event.title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-white/40 uppercase tracking-[0.12em] font-bold">
            <p>{event.date} • {event.location}</p>
          </div>
          <button className="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-xl text-[10px] font-extrabold transition-all active:scale-95 leading-none uppercase tracking-widest">
            {event.price}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
