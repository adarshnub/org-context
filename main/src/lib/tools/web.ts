import dns from "node:dns/promises";
import net from "node:net";

import { z } from "zod";

const webInputSchema = z.object({
  url: z.url().max(2000),
});

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    const [first, second] = parts;

    return (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();

    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return true;
}

function extractReadableText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return {
    content: withoutNoise.slice(0, 6000),
    title: title.replace(/\s+/g, " ").trim().slice(0, 200),
  };
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not supported.");
  }

  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) {
    throw new Error("Local URLs are not supported.");
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("Private or local network addresses are not supported.");
  }
}

export const webFetchTool = {
  description:
    "Fetch a public web page by URL and return its title plus a readable text excerpt.",
  async execute(input: z.infer<typeof webInputSchema>) {
    let url = new URL(input.url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      let response: Response | null = null;

      for (let redirects = 0; redirects <= 3; redirects += 1) {
        await assertPublicUrl(url);
        response = await fetch(url, {
          headers: {
            "User-Agent": "OrgContextBot/1.0",
          },
          redirect: "manual",
          signal: controller.signal,
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) {
          break;
        }

        const location = response.headers.get("location");

        if (!location) {
          throw new Error("Redirect response did not include a location.");
        }

        url = new URL(location, url);
      }

      if (!response) {
        throw new Error("No response was returned.");
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        throw new Error("Too many redirects.");
      }

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}.`);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        throw new Error(`Unsupported content type: ${contentType || "unknown"}.`);
      }

      const raw = (await response.text()).slice(0, 100_000);
      const parsed = contentType.includes("text/html")
        ? extractReadableText(raw)
        : { content: raw.replace(/\s+/g, " ").trim().slice(0, 6000), title: "" };

      return {
        content: parsed.content,
        title: parsed.title || url.hostname,
        url: response.url,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
  inputSchema: webInputSchema,
  name: "web.fetchPage" as const,
};
