"use client";

import { Bot, LoaderCircle, Radio, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatTimestamp } from "@/lib/utils";
import type { ChatMessage, WorkspaceMember } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PendingMessage = ChatMessage & {
  pending?: boolean;
};

type TypingPayload = {
  channelId: string;
  isTyping: boolean;
  userId: string;
  userName: string;
  workspaceId: string;
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
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingPayload>>({});
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messageFeedRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDoneRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const realtimeChannelName = `workspace-${workspaceId}-${channelId}`;

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.userId, member.fullName);
    });
    map.set(currentUserId, currentUserName);
    return map;
  }, [currentUserId, currentUserName, members]);

  const latestMessageKey = messages.length
    ? `${messages[messages.length - 1]?.id}:${messages.length}`
    : "empty";

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
    const feed = messageFeedRef.current;

    if (!feed || messages.length === 0) {
      return;
    }

    const behavior = initialScrollDoneRef.current ? "smooth" : "auto";

    const frame = window.requestAnimationFrame(() => {
      feed.scrollTo({
        behavior,
        top: feed.scrollHeight,
      });
      initialScrollDoneRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [latestMessageKey, messages.length]);

  useEffect(() => {
    console.log("[org-context:chat.realtime.subscribe]", {
      channelId,
      workspaceId,
    });

    const channel = supabase
      .channel(realtimeChannelName, {
        config: {
          broadcast: {
            self: false,
          },
        },
      })
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as TypingPayload;

        if (
          typing.userId === currentUserId ||
          typing.workspaceId !== workspaceId ||
          typing.channelId !== channelId
        ) {
          return;
        }

        console.log("[org-context:chat.typing.received]", typing);

        setTypingUsers((current) => {
          const next = { ...current };

          if (typing.isTyping) {
            next[typing.userId] = typing;
          } else {
            delete next[typing.userId];
          }

          return next;
        });

        if (typingClearTimersRef.current[typing.userId]) {
          clearTimeout(typingClearTimersRef.current[typing.userId]);
        }

        if (typing.isTyping) {
          typingClearTimersRef.current[typing.userId] = setTimeout(() => {
            setTypingUsers((current) => {
              const next = { ...current };
              delete next[typing.userId];
              return next;
            });
          }, 2500);
        }
      })
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

    channelRef.current = channel;
    const typingClearTimers = typingClearTimersRef.current;

    return () => {
      console.log("[org-context:chat.realtime.unsubscribe]", {
        channelId,
        workspaceId,
      });
      channelRef.current = null;
      void supabase.removeChannel(channel);
      Object.values(typingClearTimers).forEach(clearTimeout);
    };
  }, [
    channelId,
    currentUserId,
    normalizeRealtimeRow,
    realtimeChannelName,
    supabase,
    workspaceId,
  ]);

  async function broadcastTyping(isTyping: boolean) {
    const channel = channelRef.current;

    if (!channel) {
      return;
    }

    await channel.send({
      event: "typing",
      payload: {
        channelId,
        isTyping,
        userId: currentUserId,
        userName: currentUserName,
        workspaceId,
      } satisfies TypingPayload,
      type: "broadcast",
    });
  }

  function handleInputChange(value: string) {
    setInput(value);

    void broadcastTyping(value.trim().length > 0);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      void broadcastTyping(false);
    }, 1200);
  }

  async function sendMessage() {
    const text = input.trim();

    if (!text || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInput("");
    void broadcastTyping(false);

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <section
        aria-busy={submitting}
        className="surface relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {submitting ? <div className="chat-progress-bar" /> : null}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white/70 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-[#13201d] text-white">
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

        <div
          className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5"
          ref={messageFeedRef}
        >
          {messages.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-[var(--line)] bg-white/45 p-8 text-center">
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
                className={`animate-rise max-w-[min(46rem,92%)] self-start rounded-lg border p-4 ${bubble} ${
                  message.pending ? "animate-pulse opacity-80" : ""
                }`}
                key={message.id}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 font-bold">
                    {assistant ? <Bot size={14} /> : null}
                    {message.senderName}
                  </span>
                  <span className={mine && !assistant ? "text-white/70" : "text-slate-500"}>
                    {message.pending ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LoaderCircle className="animate-spin" size={12} />
                        Sending...
                      </span>
                    ) : (
                      formatTimestamp(message.createdAt)
                    )}
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

      <section className="surface shrink-0 p-3">
        <label className="grid gap-2" htmlFor="chat-input">
          <span className="eyebrow">Message</span>
          <textarea
            className="field min-h-16 resize-none disabled:opacity-70"
            disabled={submitting}
            id="chat-input"
            onBlur={() => void broadcastTyping(false)}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Share an update or use /ask What did we decide about launch?"
            rows={2}
            value={input}
          />
        </label>
        {Object.values(typingUsers).length > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--teal)]">
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-[var(--teal)] [animation:pulse-soft_1s_ease-in-out_infinite]" />
              <span className="size-1.5 rounded-full bg-[var(--teal)] [animation:pulse-soft_1s_ease-in-out_120ms_infinite]" />
              <span className="size-1.5 rounded-full bg-[var(--teal)] [animation:pulse-soft_1s_ease-in-out_240ms_infinite]" />
            </span>
            {Object.values(typingUsers)
              .map((user) => user.userName)
              .join(", ")}{" "}
            {Object.values(typingUsers).length === 1 ? "is" : "are"} typing
          </div>
        ) : null}
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
            disabled={submitting || input.trim().length === 0}
            onClick={() => void sendMessage()}
            type="button"
          >
            {submitting ? (
              <>
                Sending
                <LoaderCircle className="animate-spin" size={16} />
              </>
            ) : (
              <>
                Send
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
