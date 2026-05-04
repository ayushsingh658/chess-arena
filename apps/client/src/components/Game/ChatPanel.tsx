import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare, Hash } from 'lucide-react';

export function ChatPanel() {
  const [content, setContent] = useState('');
  const { messages, sendChat } = useGameStore();
  const { user } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendChat(content);
    setContent('');
  };

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden border-white/5">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-accent-cyan" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Live Chat</h3>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-[10px] text-success font-bold uppercase tracking-widest">
          Live
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/10"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-8">
            <Hash size={32} className="mb-2" />
            <p className="text-xs font-medium text-text-muted italic">No messages yet. Say hello to your opponent!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.id;
            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  {!isMe && <span className="text-[10px] font-bold text-accent-cyan uppercase tracking-wider">{msg.senderName}</span>}
                  <span className="text-[9px] text-text-muted">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`
                  max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed
                  ${isMe 
                    ? 'bg-white text-black font-medium rounded-tr-none' 
                    : 'bg-white/5 text-white border border-white/10 rounded-tl-none'
                  }
                `}>
                  {msg.content}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white/[0.02] border-t border-white/5">
        <div className="relative group">
          <input 
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all"
          />
          <button 
            type="submit"
            disabled={!content.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-30 disabled:hover:text-text-muted disabled:hover:bg-white/5 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
