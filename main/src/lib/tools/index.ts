import { mathTool } from "@/lib/tools/math";
import type { ToolExecution, ToolRequest } from "@/lib/tools/types";
import { webFetchTool } from "@/lib/tools/web";
import type { ToolName } from "@/lib/types";

export const DEFAULT_ENABLED_TOOLS: ToolName[] = ["math.calculate", "web.fetchPage"];

const registry = {
  "math.calculate": mathTool,
  "web.fetchPage": webFetchTool,
} as const;

type RegisteredTool = (typeof registry)[ToolName];

export function getAllTools() {
  return Object.values(registry) as RegisteredTool[];
}

export function normalizeEnabledTools(value: unknown): ToolName[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ENABLED_TOOLS;
  }

  const names = value.filter((name): name is ToolName => {
    return typeof name === "string" && name in registry;
  });

  return [...new Set(names)];
}

export function describeTools(toolNames: string[]) {
  return toolNames
    .filter((name): name is ToolName => name in registry)
    .map((name) => {
      const tool = registry[name];

      return {
        description: tool.description,
        inputSchema: String(tool.inputSchema),
        name: tool.name,
      };
    });
}

export async function executeToolRequests(
  requests: ToolRequest[],
  enabledTools: string[],
) {
  const enabled = new Set(enabledTools);
  const executions: ToolExecution[] = [];

  for (const request of requests.slice(0, 3)) {
    const startedAt = Date.now();
    const tool = registry[request.tool as ToolName];

    if (!tool || !enabled.has(request.tool)) {
      executions.push({
        durationMs: Date.now() - startedAt,
        error: `Tool is not enabled or does not exist: ${request.tool}`,
        input: request.input,
        name: request.tool,
        status: "failed",
      });
      continue;
    }

    const parsed = tool.inputSchema.safeParse(request.input);

    if (!parsed.success) {
      executions.push({
        durationMs: Date.now() - startedAt,
        error: parsed.error.message,
        input: request.input,
        name: request.tool,
        status: "failed",
      });
      continue;
    }

    try {
      const output = await tool.execute(parsed.data as never);

      executions.push({
        durationMs: Date.now() - startedAt,
        input: parsed.data,
        name: request.tool,
        output,
        status: "completed",
      });
    } catch (error) {
      executions.push({
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Tool execution failed.",
        input: parsed.data,
        name: request.tool,
        status: "failed",
      });
    }
  }

  return executions;
}
