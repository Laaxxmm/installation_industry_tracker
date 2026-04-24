"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { Icon } from "@/components/sab/Icon";
import { SAB } from "@/components/sab/tokens";

// Slide-in right panel, 400px, streaming chat from POST /api/ai/chat.
// Closes on overlay click or ESC. One panel instance per page — mounted by
// AIAssistantLauncher.

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIAssistantPanel({ open, onClose }: AIAssistantPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, stop } =
    useChat({ api: "/api/ai/chat" });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,18,14,.35)",
        zIndex: 80,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100vw, 420px)",
          background: SAB.card,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-18px 0 36px rgba(0,0,0,.18)",
          borderLeft: `1px solid ${SAB.rule}`,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${SAB.rule}`,
          }}
        >
          <div>
            <div
              className="sab-eyebrow"
              style={{ fontSize: 10, color: SAB.ink3, letterSpacing: "0.08em" }}
            >
              SAB ASSISTANT
            </div>
            <div
              style={{
                fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: SAB.ink,
                letterSpacing: "-0.01em",
              }}
            >
              Ask about invoices, projects, service
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            style={{
              background: "transparent",
              border: `1px solid ${SAB.rule}`,
              borderRadius: 4,
              padding: 6,
              cursor: "pointer",
              color: SAB.ink3,
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 13,
            lineHeight: 1.55,
            color: SAB.ink,
            fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: SAB.ink3, fontSize: 12 }}>
              Try asking &ldquo;Show unpaid PROGRESS invoices older than 45 days&rdquo; or
              &ldquo;AMC visits scheduled this week&rdquo;.
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {isLoading && (
            <div style={{ color: SAB.ink3, fontSize: 11, fontStyle: "italic" }}>
              Thinking…
            </div>
          )}
          {error && (
            <div
              style={{
                background: SAB.alertWash,
                color: SAB.alert,
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {error.message}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: `1px solid ${SAB.rule}`,
            padding: 12,
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isLoading) handleSubmit();
              }
            }}
            placeholder="Ask a question…"
            rows={2}
            style={{
              flex: 1,
              resize: "none",
              padding: "8px 10px",
              border: `1px solid ${SAB.rule}`,
              borderRadius: 4,
              fontSize: 13,
              fontFamily: "inherit",
              color: SAB.ink,
              background: SAB.paperAlt,
              outline: "none",
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              style={{
                background: SAB.ink,
                color: "#fff",
                border: `1px solid ${SAB.ink}`,
                borderRadius: 4,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                background: input.trim() ? SAB.accent : SAB.ink4,
                color: "#fff",
                border: `1px solid ${input.trim() ? SAB.accent : SAB.ink4}`,
                borderRadius: 4,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                cursor: input.trim() ? "pointer" : "not-allowed",
              }}
            >
              Send
            </button>
          )}
        </form>
        <div
          style={{
            padding: "6px 14px 10px",
            fontSize: 10,
            color: SAB.ink4,
            letterSpacing: "0.04em",
          }}
        >
          Read-only preview · answers are grounded in live data
        </div>
      </aside>
    </div>
  );
}

interface BubbleMessage {
  id: string;
  role: string;
  content: string;
  toolInvocations?: Array<{ toolName: string; state: string }>;
}

function ChatBubble({ message }: { message: BubbleMessage }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "88%",
          padding: "8px 12px",
          borderRadius: 6,
          background: isUser ? SAB.accentWash : SAB.paperAlt,
          border: `1px solid ${isUser ? SAB.accent : SAB.rule}`,
          color: SAB.ink,
          fontSize: 13,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div
            style={{
              fontSize: 10,
              color: SAB.ink3,
              marginBottom: 4,
              letterSpacing: "0.04em",
            }}
          >
            {message.toolInvocations.map((t, i) => (
              <span key={i} style={{ marginRight: 6 }}>
                ⚙ {t.toolName}
              </span>
            ))}
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}
