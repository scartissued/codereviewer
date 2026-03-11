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

  const diffText = files
    .filter((f) => f.patch)
    .map((f) => `File: ${f.filename}\n${f.patch}`)
    .join('\n\n');

  const prompt = `Review this PR diff and return:
      - summary
      - findings (severity, file, line, message, suggestion)
      DIFF: ${diffText}`;

  const { text } = await generateTextFn({
    model: 'openai/gpt-5',
    prompt,
    temperature: 0.1,
    maxOutputTokens: 1200,
    abortSignal: AbortSignal.timeout(60_000),
  });

  console.log(text);
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
