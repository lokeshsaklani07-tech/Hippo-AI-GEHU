"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Bot, Globe, ExternalLink, Bell } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; url: string }[];
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "assistant", 
      content: "Greeting student. I am Hippo, your GEHU AI assistant. How can I facilitate your academic journey today?" 
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alertText, setAlertText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Fetch live alerts
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/alerts");
        const data = await res.json();
        if (data.hasAlert) {
          setAlertText(data.alert);
        }
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // check every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, { role: "user", content: userMessage }].map(({ role, content }) => ({ role, content }))
        }),
      });

      const data = await response.json();
      
      if (data.content) {
        setMessages((prev) => [...prev, { 
          role: "assistant", 
          content: data.content,
          citations: data.citations
        }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen relative overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between pl-16 pr-6 md:px-8 border-b border-white/5 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full bg-hippo-primary",
            isLoading && "animate-ping"
          )} />
          <span className="text-sm font-medium tracking-widest text-white/60">SYSTEM STATUS: ACTIVE</span>
        </div>
        
        {/* Notification Bell */}
        <div className="relative group flex items-center">
          <div className={cn(
            "p-2 rounded-full transition-all duration-500",
            alertText ? "bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-white/5 text-white/40"
          )}>
            <Bell className={cn("w-5 h-5", alertText && "animate-pulse")} />
          </div>
          {alertText && (
            <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-xl glass-card border border-red-500/30 text-xs text-white/90 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <span className="font-bold text-red-400 mb-1 block">LIVE EXAM ALERT</span>
              {alertText}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 md:p-12 md:pb-48 pb-40 space-y-8"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-4xl",
                m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border overflow-hidden",
                m.role === "assistant" 
                  ? "bg-hippo-primary/10 border-hippo-primary/30 text-hippo-primary shadow-neon" 
                  : "bg-white/5 border-white/10 text-white"
              )}>
                {m.role === "assistant" ? (
                  <img 
                    src="/images/hippo-bot.png" 
                    alt="Bot" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://ui-avatars.com/api/?name=H&background=3b82f6&color=fff";
                    }}
                  />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>

              <div className={cn(
                "p-5 rounded-2xl text-sm leading-relaxed",
                m.role === "assistant" 
                  ? "glass-card text-white/90" 
                  : "bg-hippo-primary/20 border border-hippo-primary/30 text-white"
              )}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>
                    {m.content}
                  </ReactMarkdown>
                </div>

                {m.citations && m.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-hippo-primary">
                      <Globe className="w-3 h-3" />
                      SOURCES
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.citations.map((cite, cIdx) => (
                        <a 
                          key={cIdx}
                          href={cite.url} 
                          target="_blank" 
                          className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[10px] text-white/60 transition-colors"
                        >
                          {cite.title.slice(0, 30)}...
                          <ExternalLink className="w-2 h-2" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-hippo-primary/10 border border-hippo-primary/30 text-hippo-primary animate-pulse overflow-hidden">
               <img 
                src="/images/hippo-bot.png" 
                alt="Bot" 
                className="w-full h-full object-cover opacity-50"
              />
            </div>
            <div className="glass-card p-4 rounded-2xl flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-hippo-primary rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-hippo-primary rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-hippo-primary rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/80 to-transparent">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-hippo-primary to-hippo-secondary rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center glass-card rounded-2xl p-2 pl-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Hippo about GEHU, subjects, or news..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/30 py-3"
            />
            <button
              disabled={isLoading}
              className="p-3 bg-hippo-primary hover:bg-hippo-accent text-white rounded-xl shadow-neon transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
