"use client";

import type { ChatMessage } from "@/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatContent(content: string): string {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-orange-600 text-white"
            : "bg-zinc-800 text-zinc-100 border border-zinc-700"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none [&_strong]:text-orange-400 [&_br]:my-1"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
        )}
      </div>
    </div>
  );
}
