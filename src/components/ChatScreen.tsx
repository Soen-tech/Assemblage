import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, MessageSquare, User as UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, User } from '../types';
import { cn } from '../lib/utils';
import { getSommelierResponse } from '../services/gemini';

interface ChatScreenProps {
  user?: User | null;
  onTeaserLimit: () => void;
}

export default function ChatScreen({ user, onTeaserLimit }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Good evening, Connoisseur. I am STEVE, your concierge, trained on the heritage of the Highlands and the precision of the glass. How may I assist your palate tonight?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getChatCount = () => {
    try {
      return parseInt(localStorage.getItem('proof_guest_chats_count') || '0', 10);
    } catch {
      return 0;
    }
  };

  const incrementChatCount = () => {
    try {
      const current = getChatCount();
      localStorage.setItem('proof_guest_chats_count', String(current + 1));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (user?.role === 'guest') {
      if (getChatCount() >= 3) {
        onTeaserLimit();
        return;
      }
    }
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    if (user?.role === 'guest') {
      incrementChatCount();
    }

    try {
      const response = await getSommelierResponse(messages, input);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || "I'm having trouble connecting to the cellar. Perhaps a dram of water?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-4 md:scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex flex-col gap-6">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white border",
                  msg.role === 'assistant' ? "bg-secondary/20 border-secondary/30" : "bg-primary/20 border-primary/30"
                )}>
                  {msg.role === 'assistant' ? <MessageSquare size={20} className="text-secondary" /> : <UserIcon size={20} className="text-primary" />}
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase">
                      {msg.role === 'assistant' ? 'STEVE' : 'CONNOISSEUR'}
                    </span>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'assistant' ? "bg-surface-container-high border border-white/5" : "bg-primary/20 border border-primary/30 text-white"
                  )}>
                    <div className="prose prose-invert prose-p:leading-relaxed prose-strong:text-primary max-w-none">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-white/30 uppercase px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-6 py-6 border-t border-white/5 bg-surface-container-lowest/50 backdrop-blur-md pb-32">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          {["Recommend a Peaty Scotch", "Explain \"Angels' Share\"", "Gift ideas for $200"].map((hint) => (
            <button 
              key={hint}
              onClick={() => setInput(hint)}
              className="flex-shrink-0 px-4 py-2 rounded-full glass text-xs font-bold text-on-surface-variant hover:text-white transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
        
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <button className="text-white/40 hover:text-primary transition-colors">
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your Concierge..."
            className="w-full bg-surface-container-high h-14 pl-12 pr-14 rounded-2xl border border-white/5 outline-none focus:border-primary/50 transition-all text-sm group-hover:bg-surface-container-highest"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90",
              isLoading ? "bg-white/5 cursor-not-allowed" : "bg-primary/20 hover:bg-primary/30 text-primary"
            )}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
