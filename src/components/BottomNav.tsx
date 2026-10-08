import { Home, Scan, BookOpen, MessageSquare, Ticket, ShoppingBag, ShieldCheck, Compass } from 'lucide-react';
import { View, UserRole } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

interface BottomNavProps {
  currentView: View;
  userRole?: UserRole;
  onViewChange: (view: View) => void;
}

export default function BottomNav({ currentView, userRole, onViewChange }: BottomNavProps) {
  const baseItems = [
    { id: 'home', icon: Home, label: 'Home' },
    //{ id: 'boutique', icon: ShoppingBag, label: 'Boutique' },
    { id: 'journal', icon: BookOpen, label: 'Journal' },
    { id: 'chat', icon: MessageSquare, label: 'Concierge' },
    { id: 'events', icon: Ticket, label: 'Events' },
    { id: 'explore-clubs', icon: Compass, label: 'Clubs' },
  ];

  const adminItems = (userRole === 'admin' || userRole === 'master_admin') ? [
    { id: 'admin', icon: ShieldCheck, label: 'Manage' }
  ] : [];

  const items = [...baseItems, ...adminItems];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/5 pb-safe z-50">
      <div className="flex justify-around items-center h-20 max-w-lg mx-auto px-4">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors relative px-3 py-2 rounded-2xl",
                isActive ? "text-primary bg-primary/10" : "text-white/40 hover:text-white/60"
              )}
              id={`nav-${item.id}`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[8px] font-semibold uppercase tracking-wider">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute -top-1 w-1 h-1 bg-primary rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
