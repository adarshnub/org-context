import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cohereApiKey = Deno.env.get("COHERE_API_KEY") ?? "";
const cohereEmbedModel = Deno.env.get("COHERE_EMBED_MODEL") ?? "embed-v4.0";

type WebhookPayload = {
  record?: {
    body?: string;
    channel_id?: string;
    id?: string;
    workspace_id?: string;
  };
};

Deno.serve(async (request) => {
  let payload: WebhookPayload | null = null;

  try {
    console.log("[embed-chat-message] request received", {
      cohereApiKeyConfigured: Boolean(cohereApiKey),
      cohereEmbedModel,
      method: request.method,
      serviceRoleConfigured: Boolean(supabaseServiceRoleKey),
      supabaseUrlConfigured: Boolean(supabaseUrl),
    });

    payload = (await request.json()) as WebhookPayload;
    const record = payload.record;

    console.log("[embed-chat-message] payload parsed", {
      channelId: record?.channel_id,
      hasBody: Boolean(record?.body),
      messageId: record?.id,
      workspaceId: record?.workspace_id,
    });

    if (!record?.id || !record.body || !record.workspace_id || !record.channel_id) {
      console.error("[embed-chat-message] missing record payload", payload);

      return new Response(JSON.stringify({ error: "Missing record payload." }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const embedResponse = await fetch("https://api.cohere.com/v2/embed", {
      body: JSON.stringify({
        embedding_types: ["float"],
        input_type: "search_document",
        inputs: [
          {
            content: [{ text: record.body, type: "text" }],
          },
        ],
        model: cohereEmbedModel,
      }),
      headers: {
        Authorization: `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();

      throw new Error(
        `Cohere embed failed with status ${embedResponse.status}: ${errorText}`,
      );
    }

    const embedJson = await embedResponse.json();
    const embedding = embedJson?.embeddings?.float?.[0];

    if (!embedding) {
      throw new Error("No embedding returned from Cohere.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const upsertResult = await supabase.from("chat_message_embeddings").upsert(
      {
        channel_id: record.channel_id,
        embedding,
        message_id: record.id,
        model: cohereEmbedModel,
        provider: "cohere",
        workspace_id: record.workspace_id,
      },
      {
        onConflict: "message_id",
      },
    );

    if (upsertResult.error) {
      throw new Error(upsertResult.error.message);
    }

    const updateResult = await supabase
      .from("chat_messages")
      .update({ embedding_status: "completed" })
      .eq("id", record.id);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    console.log("[embed-chat-message] embedding saved", {
      dimensions: embedding.length,
      messageId: record.id,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[embed-chat-message] failed", {
      error: error instanceof Error ? error.message : error,
      messageId: payload?.record?.id,
    });

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    try {
      const recordId = payload?.record?.id;

      if (recordId) {
        const updateResult = await supabase
          .from("chat_messages")
          .update({ embedding_status: "failed" })
          .eq("id", recordId);

        if (updateResult.error) {
          console.error("[embed-chat-message] failed to mark message failed", {
            error: updateResult.error.message,
            messageId: recordId,
          });
        }
      }
    } catch {
      // Ignore best-effort failure bookkeeping here.
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown embed failure.",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
