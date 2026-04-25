"use client";

import { Bot, Radio, Send, Sparkles } from "lucide-react";
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
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const [submitting, setSubmitting] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.userId, member.fullName);
    });
    map.set(currentUserId, currentUserName);
    return map;
  }, [currentUserId, currentUserName, members]);

  const normalizeRealtimeRow = useMemo(() => {
    return (row: Record<string, unknown>): PendingMessage | null => {
      if (
        String(row.workspace_id) !== workspaceId ||
        String(row.channel_id) !== channelId
      ) {
        console.warn("[org-context:chat.realtime.ignored]", {
          channelId,
          row,
          workspaceId,
        });

        return null;
      }

      const senderId = typeof row.sender_id === "string" ? row.sender_id : null;

      return {
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
        senderId,
        senderName:
          (senderId && memberNameMap.get(senderId)) ||
          (senderId ? "Workspace member" : "Org Context"),
        workspaceId: String(row.workspace_id),
      };
    };
  }, [channelId, memberNameMap, workspaceId]);

  useEffect(() => {
    console.log("[org-context:chat.realtime.subscribe]", {
      channelId,
      workspaceId,
    });

    const channel = supabase
      .channel(`workspace-${workspaceId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `workspace_id=eq.${workspaceId}`,
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          console.log("[org-context:chat.realtime.insert]", payload.new);

          const nextMessage = normalizeRealtimeRow(
            payload.new as Record<string, unknown>,
          );

          if (!nextMessage) {
            return;
          }

          setMessages((current) => {
            if (current.some((message) => message.id === nextMessage.id)) {
              return current;
            }

            return [...current, nextMessage];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `workspace_id=eq.${workspaceId}`,
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          console.log("[org-context:chat.realtime.update]", payload.new);

          const nextMessage = normalizeRealtimeRow(
            payload.new as Record<string, unknown>,
          );

          if (!nextMessage) {
            return;
          }

          setMessages((current) =>
            current.map((message) =>
              message.id === nextMessage.id
                ? { ...message, ...nextMessage, pending: false }
                : message,
            ),
          );
        },
      )
      .subscribe((status, error) => {
        console.log("[org-context:chat.realtime.status]", {
          error,
          status,
          channelId,
          workspaceId,
        });

        setRealtimeStatus(status.toLowerCase());

        if (error) {
          setError(`Realtime subscription failed: ${error.message}`);
        }
      });

    return () => {
      console.log("[org-context:chat.realtime.unsubscribe]", {
        channelId,
        workspaceId,
      });
      void supabase.removeChannel(channel);
    };
  }, [channelId, normalizeRealtimeRow, supabase, workspaceId]);

  async function sendMessage() {
    const text = input.trim();

    if (!text) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInput("");

    const tempId = `temp-${crypto.randomUUID()}`;
    const isAsk = text.startsWith("/ask ");
    const optimistic: PendingMessage = {
      body: text,
      channelId,
      citations: [],
      commandName: isAsk ? "ask" : null,
      createdAt: new Date().toISOString(),
      embeddingStatus: "pending",
      id: tempId,
      messageType: isAsk ? "command" : "user",
      pending: true,
      senderId: currentUserId,
      senderName: currentUserName,
      workspaceId,
    };

    setMessages((current) => [...current, optimistic]);

    const endpoint = isAsk ? "/api/chat/ask" : "/api/chat/send";

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
      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
              <Radio size={18} />
            </span>
            <div>
              <p className="eyebrow">General channel</p>
              <h2 className="text-lg font-bold text-[var(--ink)]">
                Live workspace memory
              </h2>
            </div>
          </div>
          <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            {members.length} members / realtime {realtimeStatus}
          </span>
        </div>

        <div className="grid max-h-[34rem] min-h-[24rem] gap-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-[var(--line)] bg-white/45 p-8 text-center">
              <div>
                <Sparkles className="mx-auto text-[var(--teal)]" size={28} />
                <p className="mt-3 text-sm font-bold text-[var(--ink)]">
                  This workspace is ready.
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Send the first message or ask a question with `/ask`.
                </p>
              </div>
            </div>
          ) : null}

          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const assistant = message.messageType === "assistant";
            const command = message.messageType === "command";
            const bubble = assistant
              ? "border-lime-200 bg-lime-50 text-slate-800"
              : command
                ? "border-teal-200 bg-teal-50 text-slate-800"
                : mine
                  ? "ml-auto border-[#13201d] bg-[#13201d] text-white"
                  : "border-[var(--line)] bg-white text-slate-800";

            return (
              <article
                className={`animate-rise max-w-[min(46rem,92%)] rounded-lg border p-4 ${bubble} ${
                  message.pending ? "opacity-70" : ""
                }`}
                key={message.id}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 font-bold">
                    {assistant ? <Bot size={14} /> : null}
                    {message.senderName}
                  </span>
                  <span className={mine && !assistant ? "text-white/70" : "text-slate-500"}>
                    {message.pending ? "Sending..." : formatTimestamp(message.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                {message.citations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-black/10 pt-3">
                    {message.citations.map((citation) => (
                      <span
                        className="rounded-md bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600"
                        key={`${message.id}-${citation.messageId}`}
                      >
                        Source {citation.messageId.slice(0, 8)} /{" "}
                        {citation.similarity.toFixed(3)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface p-4">
        <label className="grid gap-3" htmlFor="chat-input">
          <span className="eyebrow">Message</span>
          <textarea
            className="field min-h-24 resize-y"
            id="chat-input"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Share an update or use /ask What did we decide about launch?"
            value={input}
          />
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              `/ask` searches this workspace channel only.
            </p>
          )}
          <button
            className="btn-primary"
            disabled={submitting}
            onClick={() => void sendMessage()}
            type="button"
          >
            {submitting ? "Sending..." : "Send"}
            <Send size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
