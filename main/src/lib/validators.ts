import { z } from "zod";

export const signupSchema = z.object({
  companyName: z.string().min(2, "Company name is required."),
  email: z.email("Enter a valid email address."),
  fullName: z.string().min(2, "Full name is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const workspaceSchema = z.object({
  name: z.string().min(2, "Workspace name is required."),
});

export const inviteSchema = z.object({
  email: z.email("Enter a valid teammate email."),
});

export const providerSchema = z.object({
  provider: z.enum(["cohere", "openai"]),
});

export const toolSettingsSchema = z.object({
  enabledTools: z
    .array(z.enum(["math.calculate", "web.fetchPage"]))
    .default([]),
});

export const githubRepositorySchema = z.object({
  accessToken: z.string().trim().optional(),
  branch: z
    .string()
    .trim()
    .min(1, "Branch is required.")
    .max(200, "Branch is too long.")
    .regex(/^[A-Za-z0-9._/-]+$/, "Branch contains unsupported characters."),
  repoUrl: z.url("Enter a valid GitHub repository URL."),
  syncHourly: z.boolean().default(false),
});

export const repositoryIdSchema = z.object({
  repositoryId: z.uuid(),
});

export const sendMessageSchema = z.object({
  channelId: z.uuid(),
  text: z.string().min(1).max(4000),
  workspaceId: z.uuid(),
});

export const askCommandSchema = sendMessageSchema.extend({
  text: z.string().min(6).max(4000),
});
