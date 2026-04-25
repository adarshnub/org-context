import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cohereApiKey = Deno.env.get("COHERE_API_KEY") ?? "";
const cohereEmbedModel = Deno.env.get("COHERE_EMBED_MODEL") ?? "embed-v4.0";
const tokenSecret = Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY") ?? "";
const maxFiles = Number.parseInt(Deno.env.get("REPO_INDEX_MAX_FILES") ?? "0", 10);
const maxFileBytes = Number.parseInt(
  Deno.env.get("REPO_INDEX_MAX_FILE_BYTES") ?? "200000",
  10,
);
const maxChunksPerSync = Number.parseInt(
  Deno.env.get("REPO_INDEX_MAX_CHUNKS_PER_SYNC") ?? "0",
  10,
);
const chunkMaxChars = 3600;

type SyncJob = {
  cursor?: Record<string, unknown>;
  id: string;
  repository_id: string;
  trigger_type: "manual" | "hourly" | "continuation";
  workspace_id: string;
};

type DirectSyncRequest = {
  repositoryId?: string;
  requestedBy?: string | null;
  triggerType?: "manual" | "hourly";
  workspaceId?: string;
};

type Repository = {
  branch: string;
  encrypted_access_token: string | null;
  github_owner: string;
  github_repo: string;
  id: string;
  last_indexed_commit_sha: string | null;
  workspace_id: string;
};

type GitTreeEntry = {
  path: string;
  sha: string;
  size?: number;
  type: string;
};

type CompareFile = {
  filename: string;
  previous_filename?: string;
  sha?: string;
  status: string;
};

type WorkItem = {
  path: string;
  previousPath?: string;
  sha?: string;
  size?: number;
  status: "added" | "modified" | "renamed" | "removed";
};

type Chunk = {
  content: string;
  contentHash: string;
  contentPreview: string;
  endLine: number;
  index: number;
  startLine: number;
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function assertNoSupabaseError(error: { message?: string } | null, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message ?? "Supabase operation failed."}`);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function readJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(padded)) as { role?: string };
  } catch {
    return null;
  }
}

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (serviceRoleKey && token === serviceRoleKey) {
    return true;
  }

  return readJwtPayload(token)?.role === "service_role";
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function decryptToken(value: string | null) {
  if (!value) {
    return null;
  }

  const [version, iv, tag, encrypted] = value.split(":");

  if (version !== "v1" || !iv || !tag || !encrypted || !tokenSecret) {
    throw new Error("GitHub token is not decryptable.");
  }

  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tokenSecret),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const cipherBytes = base64ToBytes(encrypted);
  const tagBytes = base64ToBytes(tag);
  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes);
  combined.set(tagBytes, cipherBytes.length);
  const decrypted = await crypto.subtle.decrypt(
    {
      iv: base64ToBytes(iv),
      name: "AES-GCM",
    },
    key,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest<T>(path: string, token: string | null) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "org-context-github-indexer",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 403 && errorText.toLowerCase().includes("rate limit")) {
      throw new Error(
        `GitHub API rate limit exceeded. Token configured: ${
          token ? "yes" : "no"
        }. Add or update a GitHub token on this repository connection and sync again. GitHub said: ${errorText}`,
      );
    }

    throw new Error(`GitHub request failed ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

async function resolveBranchHead(repository: Repository, token: string | null) {
  const branch = await githubRequest<{
    commit?: { sha?: string };
  }>(
    `/repos/${repository.github_owner}/${repository.github_repo}/branches/${encodeURIComponent(
      repository.branch,
    )}`,
    token,
  );
  const sha = branch.commit?.sha;

  if (!sha) {
    throw new Error("GitHub branch response did not include a commit SHA.");
  }

  return sha;
}

async function listTree(repository: Repository, ref: string, token: string | null) {
  const tree = await githubRequest<{
    tree?: GitTreeEntry[];
    truncated?: boolean;
  }>(
    `/repos/${repository.github_owner}/${repository.github_repo}/git/trees/${encodeURIComponent(
      ref,
    )}?recursive=1`,
    token,
  );

  if (tree.truncated) {
    console.warn("[github-sync-repo] tree truncated by GitHub API", {
      repositoryId: repository.id,
    });
  }

  return (tree.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function compareCommits(
  repository: Repository,
  base: string,
  head: string,
  token: string | null,
) {
  const comparison = await githubRequest<{
    files?: CompareFile[];
  }>(
    `/repos/${repository.github_owner}/${repository.github_repo}/compare/${base}...${head}`,
    token,
  );

  return (comparison.files ?? [])
    .map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename,
      sha: file.sha,
      status: file.status === "removed" ? "removed" : file.status === "renamed" ? "renamed" : "modified",
    }) satisfies WorkItem)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function isSecretPath(path: string) {
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() ?? lower;

  return (
    name.startsWith(".env") ||
    name.endsWith(".pem") ||
    name.endsWith(".key") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx") ||
    lower.includes("/.ssh/") ||
    lower.includes("secret") ||
    lower.includes("credentials") ||
    lower.includes("id_rsa")
  );
}

function isBinaryExtension(path: string) {
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|tgz|mp4|mov|mp3|woff|woff2|ttf|eot|wasm|exe|dll|bin)$/i.test(
    path,
  );
}

function isLikelyText(value: string) {
  if (value.includes("\u0000")) {
    return false;
  }

  const sample = value.slice(0, 4000);
  const printable = [...sample].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32;
  }).length;

  return sample.length === 0 || printable / sample.length > 0.85;
}

function shouldSkipPath(path: string, size = 0) {
  if (size > maxFileBytes) {
    return "file too large";
  }

  if (isSecretPath(path)) {
    return "secret-like path";
  }

  if (isBinaryExtension(path)) {
    return "binary extension";
  }

  return null;
}

function guessLanguage(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  return extension && extension !== path ? extension : null;
}

async function fetchBlobContent(
  repository: Repository,
  item: WorkItem,
  ref: string,
  token: string | null,
) {
  if (item.sha) {
    const blob = await githubRequest<{
      content?: string;
      encoding?: string;
      size?: number;
    }>(
      `/repos/${repository.github_owner}/${repository.github_repo}/git/blobs/${item.sha}`,
      token,
    );

    if (blob.encoding !== "base64" || !blob.content) {
      throw new Error(`Blob ${item.path} was not base64 encoded.`);
    }

    return {
      blobSha: item.sha,
      content: new TextDecoder().decode(
        base64ToBytes(blob.content.replace(/\n/g, "")),
      ),
      size: blob.size ?? item.size ?? 0,
    };
  }

  const file = await githubRequest<{
    content?: string;
    encoding?: string;
    sha?: string;
    size?: number;
  }>(
    `/repos/${repository.github_owner}/${repository.github_repo}/contents/${encodePath(
      item.path,
    )}?ref=${encodeURIComponent(ref)}`,
    token,
  );

  if (file.encoding !== "base64" || !file.content || !file.sha) {
    throw new Error(`File ${item.path} was not returned as base64 content.`);
  }

  return {
    blobSha: file.sha,
    content: new TextDecoder().decode(base64ToBytes(file.content.replace(/\n/g, ""))),
    size: file.size ?? item.size ?? 0,
  };
}

async function hashText(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function chunkContent(content: string) {
  const lines = content.split(/\r?\n/);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let startLine = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const nextLine = lines[index];
    const nextContent = [...current, nextLine].join("\n");

    if (nextContent.length > chunkMaxChars && current.length > 0) {
      const chunkText = current.join("\n");
      chunks.push({
        content: chunkText,
        contentHash: await hashText(chunkText),
        contentPreview: chunkText.slice(0, 500),
        endLine: index,
        index: chunks.length,
        startLine,
      });
      current = [nextLine];
      startLine = index + 1;
    } else {
      current.push(nextLine);
    }
  }

  if (current.length > 0) {
    const chunkText = current.join("\n");
    chunks.push({
      content: chunkText,
      contentHash: await hashText(chunkText),
      contentPreview: chunkText.slice(0, 500),
      endLine: lines.length,
      index: chunks.length,
      startLine,
    });
  }

  return chunks;
}

async function embedChunks(path: string, chunks: Chunk[]) {
  if (chunks.length === 0) {
    return [];
  }

  const response = await fetch("https://api.cohere.com/v2/embed", {
    body: JSON.stringify({
      embedding_types: ["float"],
      input_type: "search_document",
      inputs: chunks.map((chunk) => ({
        content: [
          {
            text: `${path}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`,
            type: "text",
          },
        ],
      })),
      model: cohereEmbedModel,
    }),
    headers: {
      Authorization: `Bearer ${cohereApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Cohere embed failed ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const embeddings = payload?.embeddings?.float;

  if (!Array.isArray(embeddings)) {
    throw new Error("Cohere did not return float embeddings for code chunks.");
  }

  return embeddings as number[][];
}

async function markRemoved(repository: Repository, path: string) {
  const { data: file } = await supabase
    .from("repository_files")
    .select("id")
    .eq("repository_id", repository.id)
    .eq("path", path)
    .maybeSingle();

  if (file?.id) {
    await supabase.from("repository_code_chunks").delete().eq("file_id", file.id);
  }

  await supabase
    .from("repository_files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("repository_id", repository.id)
    .eq("path", path);
}

async function indexFile(repository: Repository, item: WorkItem, targetSha: string, token: string | null) {
  const skipReason = shouldSkipPath(item.path, item.size ?? 0);

  if (skipReason) {
    return { indexed: false, skipped: skipReason, chunks: 0 };
  }

  const blob = await fetchBlobContent(repository, item, targetSha, token);
  const contentSkipReason = shouldSkipPath(item.path, blob.size);

  if (contentSkipReason) {
    return { indexed: false, skipped: contentSkipReason, chunks: 0 };
  }

  if (!isLikelyText(blob.content)) {
    return { indexed: false, skipped: "not text", chunks: 0 };
  }

  const chunks = await chunkContent(blob.content);

  if (chunks.length === 0) {
    return { indexed: false, skipped: "empty file", chunks: 0 };
  }

  const { data: file, error: fileError } = await supabase
    .from("repository_files")
    .upsert(
      {
        blob_sha: blob.blobSha,
        deleted_at: null,
        indexed_commit_sha: targetSha,
        language: guessLanguage(item.path),
        path: item.path,
        repository_id: repository.id,
        size: blob.size,
        updated_at: new Date().toISOString(),
        workspace_id: repository.workspace_id,
      },
      {
        onConflict: "repository_id,path",
      },
    )
    .select("id")
    .single();

  if (fileError || !file) {
    throw new Error(fileError?.message ?? `Could not upsert ${item.path}.`);
  }

  await supabase.from("repository_code_chunks").delete().eq("file_id", file.id);

  const embeddings = await embedChunks(item.path, chunks);
  const { data: chunkRows, error: chunkError } = await supabase
    .from("repository_code_chunks")
    .insert(
      chunks.map((chunk) => ({
        chunk_index: chunk.index,
        content: chunk.content,
        content_hash: chunk.contentHash,
        content_preview: chunk.contentPreview,
        end_line: chunk.endLine,
        file_id: file.id,
        path: item.path,
        repository_id: repository.id,
        start_line: chunk.startLine,
        workspace_id: repository.workspace_id,
      })),
    )
    .select("id, chunk_index");

  if (chunkError || !chunkRows) {
    throw new Error(chunkError?.message ?? `Could not insert chunks for ${item.path}.`);
  }

  const { error: embeddingError } = await supabase
    .from("repository_code_embeddings")
    .insert(
      chunkRows.map((chunkRow) => ({
        chunk_id: chunkRow.id,
        embedding: embeddings[chunkRow.chunk_index],
        model: cohereEmbedModel,
        provider: "cohere",
        repository_id: repository.id,
        workspace_id: repository.workspace_id,
      })),
    );

  if (embeddingError) {
    throw new Error(embeddingError.message);
  }

  return { indexed: true, skipped: null, chunks: chunks.length };
}

async function loadJobFromRequest(jobId: string) {
  const { data: job, error } = await supabase
    .from("repository_sync_jobs")
    .update({
      attempt_count: 1,
      started_at: new Date().toISOString(),
      status: "running",
    })
    .eq("id", jobId)
    .select("id, repository_id, workspace_id, trigger_type, cursor")
    .single();

  if (error || !job) {
    throw new Error(error?.message ?? "Sync job not found.");
  }

  return job as SyncJob;
}

async function createDirectJob(body: DirectSyncRequest) {
  if (!body.repositoryId || !body.workspaceId) {
    throw new Error("Direct repository sync requires repositoryId and workspaceId.");
  }

  const startedAt = new Date().toISOString();
  const { data: job, error } = await supabase
    .from("repository_sync_jobs")
    .insert({
      attempt_count: 1,
      repository_id: body.repositoryId,
      requested_by: body.requestedBy ?? null,
      started_at: startedAt,
      status: "running",
      trigger_type: body.triggerType ?? "manual",
      workspace_id: body.workspaceId,
    })
    .select("id, repository_id, workspace_id, trigger_type, cursor")
    .single();

  if (error || !job) {
    throw new Error(error?.message ?? "Could not create direct repository sync job.");
  }

  const { error: repositoryStatusError } = await supabase
    .from("workspace_repositories")
    .update({
      last_sync_job_id: job.id,
      sync_status: "running",
    })
    .eq("id", body.repositoryId)
    .eq("workspace_id", body.workspaceId);

  assertNoSupabaseError(
    repositoryStatusError,
    "Could not mark repository sync as running",
  );

  return job as SyncJob;
}

async function claimNextJob() {
  const { data, error } = await supabase.rpc("claim_next_repository_sync_job");

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as SyncJob | null;
}

async function processJob(job: SyncJob) {
  const { data: repository, error: repositoryError } = await supabase
    .from("workspace_repositories")
    .select(
      "id, workspace_id, github_owner, github_repo, branch, encrypted_access_token, last_indexed_commit_sha",
    )
    .eq("id", job.repository_id)
    .single();

  if (repositoryError || !repository) {
    throw new Error(repositoryError?.message ?? "Repository connection not found.");
  }

  const repo = repository as Repository;
  const token = await decryptToken(repo.encrypted_access_token);

  console.log("[github-sync-repo] repository loaded", {
    branch: repo.branch,
    hasToken: Boolean(token),
    repository: `${repo.github_owner}/${repo.github_repo}`,
    repositoryId: repo.id,
  });

  const cursor = job.cursor ?? {};
  const targetSha =
    typeof cursor.targetSha === "string"
      ? cursor.targetSha
      : await resolveBranchHead(repo, token);
  const previousSha =
    typeof cursor.previousSha === "string"
      ? cursor.previousSha
      : repo.last_indexed_commit_sha;
  const offset = typeof cursor.offset === "number" ? cursor.offset : 0;
  const fullSync = !previousSha;
  const workItems: WorkItem[] = fullSync
    ? (await listTree(repo, targetSha, token)).map((entry) => ({
        path: entry.path,
        sha: entry.sha,
        size: entry.size,
        status: "modified",
      }))
    : await compareCommits(repo, previousSha, targetSha, token);

  let processedFileCount = 0;
  let skippedFileCount = 0;
  let chunkCount = 0;
  const logs: Array<Record<string, unknown>> = [];
  let index = offset;

  for (; index < workItems.length; index += 1) {
    if (
      (maxFiles > 0 && processedFileCount >= maxFiles) ||
      (maxChunksPerSync > 0 && chunkCount >= maxChunksPerSync)
    ) {
      break;
    }

    const item = workItems[index];

    try {
      if (item.status === "removed") {
        await markRemoved(repo, item.path);
        processedFileCount += 1;
        continue;
      }

      if (item.previousPath && item.previousPath !== item.path) {
        await markRemoved(repo, item.previousPath);
      }

      const result = await indexFile(repo, item, targetSha, token);

      if (result.indexed) {
        processedFileCount += 1;
        chunkCount += result.chunks;
      } else {
        skippedFileCount += 1;
        logs.push({ path: item.path, reason: result.skipped });
      }
    } catch (error) {
      skippedFileCount += 1;
      logs.push({
        error: error instanceof Error ? error.message : String(error),
        path: item.path,
      });
    }
  }

  const hasMore = index < workItems.length;
  const status = hasMore ? "partial" : "completed";
  const completedAt = new Date().toISOString();

  const { error: jobUpdateError } = await supabase
    .from("repository_sync_jobs")
    .update({
      chunk_count: chunkCount,
      completed_at: completedAt,
      cursor: {
        offset: index,
        previousSha,
        targetSha,
      },
      logs,
      processed_file_count: processedFileCount,
      skipped_file_count: skippedFileCount,
      status,
      target_commit_sha: targetSha,
    })
    .eq("id", job.id);

  assertNoSupabaseError(jobUpdateError, "Could not update repository sync job");

  const { error: repositoryUpdateError } = await supabase
    .from("workspace_repositories")
    .update({
      last_indexed_commit_sha: hasMore ? repo.last_indexed_commit_sha : targetSha,
      last_synced_at: completedAt,
      sync_status: status,
    })
    .eq("id", repo.id);

  assertNoSupabaseError(
    repositoryUpdateError,
    "Could not update repository sync status",
  );

  if (hasMore) {
    const { error: continuationError } = await supabase.from("repository_sync_jobs").insert({
      cursor: {
        offset: index,
        previousSha,
        targetSha,
      },
      repository_id: repo.id,
      trigger_type: "continuation",
      workspace_id: repo.workspace_id,
    });

    assertNoSupabaseError(
      continuationError,
      "Could not enqueue repository sync continuation",
    );
  }

  return {
    chunkCount,
    hasMore,
    processedFileCount,
    skippedFileCount,
    status,
    totalFiles: workItems.length,
  };
}

Deno.serve(async (request) => {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let job: SyncJob | null = null;

  try {
    const body = await request.json().catch(() => ({})) as DirectSyncRequest & {
      jobId?: string;
    };

    if (body.repositoryId || body.workspaceId) {
      job = await createDirectJob(body);
    } else {
      job = body.jobId ? await loadJobFromRequest(body.jobId) : await claimNextJob();
    }

    if (!job) {
      return json({ ok: true, status: "no_job" });
    }

    const result = await processJob(job);

    return json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure.";

    if (job) {
      await supabase
        .from("repository_sync_jobs")
        .update({
          completed_at: new Date().toISOString(),
          error: message,
          status: "failed",
        })
        .eq("id", job.id);

      await supabase
        .from("workspace_repositories")
        .update({ sync_status: "failed" })
        .eq("id", job.repository_id);
    }

    console.error("[github-sync-repo] failed", {
      error: message,
      jobId: job?.id,
    });

    return json({ error: message }, 500);
  }
});
