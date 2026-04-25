"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatTimestamp } from "@/lib/utils";
import type { ChatMessage, WorkspaceMember } from "@/lib/types";

type PendingMessage = ChatMessage & {
  pending?: boolean;
};

export function ChatRoom({
  channelId,
  currentUserId,
  currentUserName,
  initialMessages,
  members,
  workspaceId,
}: {
  channelId: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: ChatMessage[];
  members: WorkspaceMember[];
  workspaceId: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.userId, member.fullName);
    });
    map.set(currentUserId, currentUserName);
    return map;
  }, [currentUserId, currentUserName, members]);

  useEffect(() => {
    console.log("[org-context:chat.realtime.subscribe]", {
      channelId,
      workspaceId,
    });

    const supabase = createClient();
    const channel = supabase
      .channel(`workspace-${workspaceId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `channel_id=eq.${channelId}`,
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          console.log("[org-context:chat.realtime.insert]", payload.new);

          const row = payload.new as Record<string, unknown>;
          const nextMessage: PendingMessage = {
            body: String(row.body ?? ""),
            channelId: String(row.channel_id),
            citations: Array.isArray(row.citations)
              ? (row.citations as ChatMessage["citations"])
              : [],
            commandName:
              typeof row.command_name === "string" ? row.command_name : null,
            createdAt: String(row.created_at),
            embeddingStatus: row.embedding_status as ChatMessage["embeddingStatus"],
            id: String(row.id),
            messageType: row.message_type as ChatMessage["messageType"],
            senderId: typeof row.sender_id === "string" ? row.sender_id : null,
            senderName:
              (typeof row.sender_id === "string" &&
                memberNameMap.get(String(row.sender_id))) ||
              "Org Context",
            workspaceId: String(row.workspace_id),
          };

          setMessages((current) => {
            if (current.some((message) => message.id === nextMessage.id)) {
              return current;
            }

            return [...current, nextMessage];
          });
        },
      )
      .subscribe();

    return () => {
      console.log("[org-context:chat.realtime.unsubscribe]", {
        channelId,
        workspaceId,
      });
      void supabase.removeChannel(channel);
    };
  }, [channelId, memberNameMap, workspaceId]);

  async function sendMessage() {
    const text = input.trim();

    if (!text) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInput("");

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: PendingMessage = {
      body: text,
      channelId,
      citations: [],
      commandName: text.startsWith("/ask ") ? "ask" : null,
      createdAt: new Date().toISOString(),
      embeddingStatus: "pending",
      id: tempId,
      messageType: text.startsWith("/ask ") ? "command" : "user",
      pending: true,
      senderId: currentUserId,
      senderName: currentUserName,
      workspaceId,
    };

    setMessages((current) => [...current, optimistic]);

    const endpoint = text.startsWith("/ask ") ? "/api/chat/ask" : "/api/chat/send";

    try {
      console.log("[org-context:chat.send.start]", {
        channelId,
        endpoint,
        text,
        workspaceId,
      });

      const response = await fetch(endpoint, {
        body: JSON.stringify({
          channelId,
          text,
          workspaceId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as {
        assistant?: ChatMessage;
        error?: string;
        message?: ChatMessage;
      };

      console.log("[org-context:chat.send.response]", {
        ok: response.ok,
        payload,
        status: response.status,
      });

      if (!response.ok) {
        throw new Error(payload.error ?? "Message send failed.");
      }

      setMessages((current) => {
        const withoutTemp = current.filter((message) => message.id !== tempId);
        const next = [...withoutTemp];

        if (payload.message && !next.some((message) => message.id === payload.message?.id)) {
          next.push(payload.message);
        }

        if (
          payload.assistant &&
          !next.some((message) => message.id === payload.assistant?.id)
        ) {
          next.push(payload.assistant);
        }

        return next;
      });
    } catch (caughtError) {
      console.error("[org-context:chat.send.error]", caughtError);

      setMessages((current) => current.filter((message) => message.id !== tempId));
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Message send failed.",
      );
      setInput(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[2rem] border border-black/10 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              General channel
            </p>
            <h2 className="font-mono text-sm text-slate-800">
              Realtime team context and `/ask`
            </h2>
          </div>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            {members.length} members
          </div>
        </div>

        <div className="grid max-h-[30rem] gap-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              This workspace is ready for its first message.
            </div>
          ) : null}

          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const accent =
              message.messageType === "assistant"
                ? "bg-amber-50 border-amber-200"
                : message.messageType === "command"
                  ? "bg-sky-50 border-sky-200"
                  : mine
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 border-slate-200";

            return (
              <article
                className={`rounded-3xl border px-4 py-3 ${accent}`}
                key={message.id}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    {message.senderName}
                  </span>
                  <span className={mine ? "text-white/70" : "text-slate-500"}>
                    {formatTimestamp(message.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                {message.citations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.citations.map((citation) => (
                      <span
                        className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
                        key={`${message.id}-${citation.messageId}`}
                      >
                        Source {citation.messageId.slice(0, 8)} ·{" "}
                        {citation.similarity.toFixed(3)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-[2rem] border border-black/10 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
          htmlFor="chat-input"
        >
          Message workspace
        </label>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            className="min-h-28 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            id="chat-input"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Share an update or use /ask What did we decide about launch?"
            value={input}
          />
          <button
            className="rounded-[1.5rem] bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            onClick={() => void sendMessage()}
            type="button"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
