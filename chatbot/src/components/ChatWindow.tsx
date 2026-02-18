"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@/types";
import MessageBubble from "./MessageBubble";
import PropertyCard from "./PropertyCard";
import TransactionTable from "./TransactionTable";
import PriceChart from "./PriceChart";
import ChatInput from "./ChatInput";

const SUGGESTED_QUESTIONS = [
  "What's the average price of a 2-bed apartment in Dubai Marina?",
  "Show me the cheapest villas available in Arabian Ranches",
  "How have prices changed in Downtown Dubai over the last 3 years?",
  "Find listings in JVC that are below market value",
  "Compare Business Bay vs JLT for 1-bed investment",
];

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolData, setToolData] = useState<
    Record<string, Array<{ tool: string; input: unknown; result: unknown }>>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API error: ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.toolResults) {
        setToolData((prev) => ({
          ...prev,
          [assistantMessage.id]: data.toolResults,
        }));
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderToolResults = (messageId: string) => {
    const results = toolData[messageId];
    if (!results) return null;

    return results.map((tr, i) => {
      const data = tr.result as Record<string, unknown>;

      if (tr.tool === "query_transactions") {
        const txns = Array.isArray(data) ? data : (data as { results?: unknown[] }).results || [];
        if (txns.length > 0) {
          return <TransactionTable key={i} transactions={txns.slice(0, 10)} />;
        }
      }

      if (tr.tool === "query_listings" || tr.tool === "search_undervalued") {
        const listings = Array.isArray(data) ? data : (data as { results?: unknown[] }).results || [];
        if (listings.length > 0) {
          return (
            <div key={i} className="grid gap-2 my-2">
              {(listings as Record<string, unknown>[]).slice(0, 6).map((l, j) => (
                <PropertyCard key={j} listing={l} />
              ))}
            </div>
          );
        }
      }

      if (tr.tool === "get_price_trend") {
        const trendData = Array.isArray(data) ? data : [];
        if (trendData.length > 0) {
          return (
            <PriceChart
              key={i}
              data={trendData as Array<{ period: string; avg_price: number; transaction_count: number }>}
            />
          );
        }
      }

      return null;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold text-zinc-100">
            Dubai Real Estate Chatbot
          </h1>
          <p className="text-xs text-zinc-500">
            DLD transactions + PropertyFinder listings — powered by Claude
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <h2 className="text-xl font-semibold text-zinc-200 mb-2">
                Dubai Real Estate Market Assistant
              </h2>
              <p className="text-sm text-zinc-500 mb-8 max-w-md mx-auto">
                Ask me anything about Dubai property prices, market trends,
                or current listings. I combine DLD transaction data with
                PropertyFinder listings.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:border-orange-600 hover:text-orange-400 transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.role === "assistant" && renderToolResults(msg.id)}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-400">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
                {" "}Analyzing market data...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
