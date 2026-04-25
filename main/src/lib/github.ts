import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { getGitHubTokenEncryptionKey } from "@/lib/env";

export type ParsedGitHubRepo = {
  owner: string;
  repo: string;
  url: string;
};

function base64UrlToRepoPath(url: URL) {
  const parts = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error("GitHub repository URL must include owner and repo.");
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}

export function parseGitHubRepoUrl(input: string): ParsedGitHubRepo {
  const value = input.trim();
  const normalized = value.startsWith("git@github.com:")
    ? value.replace("git@github.com:", "https://github.com/")
    : value;
  const url = new URL(normalized);

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported in v1.");
  }

  const { owner, repo } = base64UrlToRepoPath(url);

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

export function encryptGitHubToken(token: string) {
  const key = createHash("sha256").update(getGitHubTokenEncryptionKey()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}
