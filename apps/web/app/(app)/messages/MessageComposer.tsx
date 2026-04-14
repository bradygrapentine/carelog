"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "../../../lib/trpc";
import { Send } from "lucide-react";

export function MessageComposer({ threadId }: { threadId: string }) {
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = trpc.messages.sendMessage.useMutation({
    onSuccess: () => {
      setBody("");
      textareaRef.current?.focus();
      void utils.messages.getMessages.invalidate({ threadId });
    },
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ threadId, body: trimmed });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
      className="flex gap-2 p-3 border-t border-[var(--color-border)]"
    >
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        aria-label="Message body"
        rows={1}
        className="resize-none flex-1 min-h-[40px] max-h-32"
      />
      <Button
        type="submit"
        disabled={!body.trim() || sendMutation.isPending}
        aria-label="Send message"
        size="sm"
        className="shrink-0 self-end"
      >
        <Send size={16} aria-hidden="true" />
      </Button>
    </form>
  );
}
