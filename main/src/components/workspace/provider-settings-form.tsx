"use client";

import { Bot } from "lucide-react";
import { useState, useTransition } from "react";

import { updateWorkspaceProviderInlineAction } from "@/app/actions/workspace";
import type { AnswerProvider } from "@/lib/types";

export function ProviderSettingsForm({
  initialProvider,
  workspaceId,
}: {
  initialProvider: AnswerProvider;
  workspaceId: string;
}) {
  const [provider, setProvider] = useState<AnswerProvider>(initialProvider);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-5 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          setError(null);
          setMessage(null);

          const result = await updateWorkspaceProviderInlineAction(workspaceId, formData);

          if (!result.ok) {
            setError(result.error);
            return;
          }

          setProvider(result.provider);
          setMessage(`Saved provider: ${result.provider}.`);
        });
      }}
    >
      <label className="grid gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
          <Bot size={16} />
          `/ask` model
        </span>
        <select
          className="field"
          disabled={pending}
          name="provider"
          onChange={(event) => {
            setProvider(event.target.value as AnswerProvider);
          }}
          value={provider}
        >
          <option value="cohere">Cohere</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      <button className="btn-secondary" disabled={pending} type="submit">
        {pending ? "Saving..." : "Save provider"}
      </button>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
