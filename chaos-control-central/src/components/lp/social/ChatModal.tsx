import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Circle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { appStore, type ChatMessage, type NearbySmoker } from "@/lib/app-store";

interface ChatModalProps {
  open: boolean;
  user: NearbySmoker | null;
  messages: ChatMessage[];
  typing: boolean;
  onClose: () => void;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatModal({ open, user, messages, typing, onClose }: ChatModalProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, open]);

  if (!user) {
    return null;
  }

  const sendMessage = () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    appStore.addMessage(user.id, "me", text);
    setDraft("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] bg-background/95 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative flex h-[100dvh] min-h-0 flex-col bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(15,23,42,0.04),transparent_22%)]"
          >
            <div className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-b border-foreground/10 px-4 py-4">
              <button onClick={onClose} className="rounded-full border border-foreground/10 bg-card p-2 text-foreground shadow-sm">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground font-bold text-primary-foreground shadow-sm">
                {user.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{user.username}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Circle className={`h-2.5 w-2.5 fill-current ${user.online ? "text-neon-green" : "text-neon-red"}`} />
                  {user.online ? "Online" : "Off-grid for a second"}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-5 pb-28">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[82%] ${message.sender === "me" ? "ml-auto" : "mr-auto"}`}
                >
                  <div
                    className={
                      message.sender === "me"
                        ? "rounded-[1.6rem] rounded-br-md border border-foreground/10 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm"
                        : "glass rounded-[1.6rem] rounded-bl-md border border-foreground/10 px-4 py-3 text-sm text-foreground"
                    }
                  >
                    {message.text}
                  </div>
                  <div className={`mt-1 text-[10px] font-mono text-muted-foreground ${message.sender === "me" ? "text-right" : "text-left"}`}>
                    {formatTime(message.timestamp)}
                  </div>
                </motion.div>
              ))}

              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mr-auto max-w-[40%]">
                  <div className="glass flex items-center gap-1 rounded-[1.6rem] rounded-bl-md border border-neon-cyan/20 px-4 py-3">
                    {[0, 1, 2].map((dot) => (
                <motion.span
                        key={dot}
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                        transition={{ duration: 0.9, delay: dot * 0.15, repeat: Infinity }}
                        className="h-2 w-2 rounded-full bg-foreground"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="glass-strong sticky bottom-0 z-20 border-t border-foreground/10 bg-card/95 px-4 py-4 backdrop-blur-md">
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Say something unstable..."
                  rows={1}
                  className="min-h-[52px] flex-1 resize-none rounded-2xl border border-foreground/10 bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={sendMessage}
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_34px_rgba(15,23,42,0.16)]"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
