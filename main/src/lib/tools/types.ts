import type { z } from "zod";

export type ToolExecution = {
  durationMs: number;
  error?: string;
  input: unknown;
  name: string;
  output?: unknown;
  status: "completed" | "failed";
};

export type ToolExecutionContext = {
  workspaceId: string;
};

export type ToolDefinition<TSchema extends z.ZodType> = {
  description: string;
  execute: (
    input: z.infer<TSchema>,
    context: ToolExecutionContext,
  ) => Promise<unknown> | unknown;
  inputSchema: TSchema;
  name: string;
};

export type ToolRequest = {
  input: unknown;
  reason?: string;
  tool: string;
};
