import { generateText } from 'ai';

type PullRequestFile = { filename: string; patch?: string };

type OctokitLike = {
  request: (
    route: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: PullRequestFile[] }>;
};

export type PullRequestPayload = {
  action: string;
  repository: { owner: { login: string }; name: string };
  pull_request: { number: number; user: { login: string } };
};

export enum PullRequestEventType {
  Opened = 'pull_request.opened',
  Synchronize = 'pull_request.synchronize',
}

type GenerateTextFn = (options: {
  model: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
}) => Promise<{ text: string }>;

const MAX_PATCH_CHARS_PER_FILE = 6_000;
const MAX_PATCH_CHARS_TOTAL = 24_000;
const SKIPPED_FILE_PATTERNS = [
  /\.min\./i,
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /^dist\//i,
  /^build\//i,
] as const;

const shouldSkipFile = (filename: string): boolean =>
  SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(filename));

function buildBoundedDiff(files: PullRequestFile[]): {
  diffText: string;
  includedFiles: number;
  skippedFiles: number;
  truncatedFiles: number;
  totalPatchChars: number;
} {
  const sections: string[] = [];
  let totalChars = 0;
  let includedFiles = 0;
  let skippedFiles = 0;
  let truncatedFiles = 0;

  for (const file of files) {
    if (!file.patch) {
      skippedFiles += 1;
      continue;
    }

    if (shouldSkipFile(file.filename)) {
      skippedFiles += 1;
      continue;
    }

    if (totalChars >= MAX_PATCH_CHARS_TOTAL) {
      skippedFiles += 1;
      continue;
    }

    let patch = file.patch;
    if (patch.length > MAX_PATCH_CHARS_PER_FILE) {
      patch = `${patch.slice(0, MAX_PATCH_CHARS_PER_FILE)}\n... [truncated]`;
      truncatedFiles += 1;
    }

    const remaining = MAX_PATCH_CHARS_TOTAL - totalChars;
    if (patch.length > remaining) {
      patch = `${patch.slice(0, remaining)}\n... [truncated by total limit]`;
      truncatedFiles += 1;
    }

    sections.push(`File: ${file.filename}\n${patch}`);
    totalChars += patch.length;
    includedFiles += 1;
  }

  return {
    diffText: sections.join('\n\n'),
    includedFiles,
    skippedFiles,
    truncatedFiles,
    totalPatchChars: totalChars,
  };
}

export async function runPullRequestAnalysis(
  octokit: OctokitLike,
  payload: PullRequestPayload,
  generateTextFn: GenerateTextFn = generateText,
): Promise<void> {
  const { pull_request, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;

  const { data: files } = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
    { owner, repo, pull_number: prNumber },
  );

  console.log(
    `[analysis:files] pr=${prNumber} changed=${files.length}`,
    files.map((f) => f.filename),
  );

  const {
    diffText,
    includedFiles,
    skippedFiles,
    truncatedFiles,
    totalPatchChars,
  } = buildBoundedDiff(files);

  console.log(
    `[analysis:diff] pr=${prNumber} included=${includedFiles} skipped=${skippedFiles} truncated=${truncatedFiles} totalPatchChars=${totalPatchChars}`,
  );

  const truncationNote =
    skippedFiles > 0 || truncatedFiles > 0
      ? '\nNote: Partial diff provided due to size/filter limits.'
      : '';

  const prompt = `Review this PR diff and return:
      - summary
      - findings (severity, file, line, message, suggestion)
      DIFF: ${diffText}${truncationNote}`;

  const { text } = await generateTextFn({
    model: 'openai/gpt-5',
    prompt,
    temperature: 0.1,
    maxOutputTokens: 4000,
    abortSignal: AbortSignal.timeout(60_000),
  });

  console.log(`LLM response length=${text.length}`);
}

export async function handlePullRequestEvent(input: {
  octokit: OctokitLike;
  payload: PullRequestPayload;
  event: PullRequestEventType;
}): Promise<void> {
  const { octokit, payload, event } = input;
  console.log(
    `[review:event] ${event} action=${payload.action} #${payload.pull_request.number}`,
  );

  await runPullRequestAnalysis(octokit, payload);
}
