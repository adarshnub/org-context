import type { z } from "zod";

export type ToolExecution = {
  durationMs: number;
  error?: string;
  input: unknown;
  name: string;
  output?: unknown;
  status: "completed" | "failed";
};

export type ToolDefinition<TSchema extends z.ZodType> = {
  description: string;
  execute: (input: z.infer<TSchema>) => Promise<unknown> | unknown;
  inputSchema: TSchema;
  name: string;
};

export type ToolRequest = {
  input: unknown;
  reason?: string;
  tool: string;
};
