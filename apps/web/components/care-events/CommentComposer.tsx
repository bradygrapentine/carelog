"use client";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
 onSubmit: (body: string) => Promise<void> | void;
 disabled?: boolean;
};

export function CommentComposer({ onSubmit, disabled }: Props) {
 const [body, setBody] = useState("");
 const [busy, setBusy] = useState(false);

 const trimmed = body.trim();
 const overLimit = body.length > 4000;
 const canSubmit = !busy && !disabled && trimmed.length > 0 && !overLimit;
 const showCounter = body.length >= 3500;

 return (
 <form
 className="flex flex-col gap-2 pt-2"
 onSubmit={async (e) => {
 e.preventDefault();
 if (!canSubmit) return;
 setBusy(true);
 try {
 await onSubmit(trimmed);
 setBody("");
 } finally {
 setBusy(false);
 }
 }}
 >
 <label className="sr-only" htmlFor="comment-body">
 Add a comment
 </label>
 <Textarea
 id="comment-body"
 placeholder="Add a comment…"
 value={body}
 onChange={(e) => setBody(e.target.value)}
 maxLength={4000}
 className="min-h-20"
 />
 <div className="flex justify-between items-center">
 <span
 className={`text-xs ${
 overLimit
 ? "text-[var(--color-danger)]"
 : "text-[var(--color-muted)]"
 }`}
 >
 {showCounter ? `${body.length}/4000` : ""}
 </span>
 <Button type="submit" size="sm" disabled={!canSubmit}>
 {busy ? "Posting…" : "Post"}
 </Button>
 </div>
 </form>
 );
}
