import { App } from '@octokit/app';
import { env } from '../config/env.js';
import { generateText } from 'ai';

type PullRequestPayload = {
  action: string;
  repository: { owner: { login: string }; name: string };
  pull_request: { number: number; user: { login: string } };
};

async function runPullRequestAnalysis(
  octokit: { request: (route: string, params: Record<string, unknown>) => Promise<{ data: Array<{ filename: string; patch?: string }> }> },
  payload: PullRequestPayload,
): Promise<void> {
  const { pull_request, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;

  console.log(
    `[analysis:start] action=${payload.action} pr=${prNumber} repo=${owner}/${repo}`,
  );

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

  const { text } = await generateText({
    model: 'openai/gpt-5',
    prompt,
    temperature: 0.1,
    maxOutputTokens: 1200,
    abortSignal: AbortSignal.timeout(25_000),
  });

  console.log(`[analysis:done] pr=${prNumber}`);
  console.log(text);
}

export async function createGitHubApp() {
  const githubApp = new App({
    appId: env.githubAppId,
    privateKey: env.githubPrivateKey,
    oauth: {
      clientId: env.githubClientId,
      clientSecret: env.githubClientSecret,
      redirectUrl: env.githubRedirectUrl,
    },
    webhooks: {
      secret: env.githubWebhookSecret,
    },
  });

  const { data } = await githubApp.octokit.request('/app');
  console.log(`GitHub App authenticated as '${data.name}'`);

  githubApp.webhooks.on('installation.created', ({ payload }) => {
    const { installation, sender } = payload;
    const account = installation.account;
    const accountName =
      account && 'login' in account ? account.login : 'unknown account';
    console.log(
      `App installed by ${sender.login} (installation ${installation.id}) ` +
      `on ${accountName}`,
    );
  });

  githubApp.webhooks.on('pull_request', ({ payload }) => {
    console.log(
      `[pull_request] action=${payload.action} #${payload.pull_request.number}`,
    );
  });

  githubApp.webhooks.on('push', ({ payload }) => {
    console.log(
      `[push] ${payload.repository.full_name} by ${payload.pusher.name}`,
    );
  });

  githubApp.webhooks.on('pull_request.synchronize', ({ payload }) => {
    console.log(
      `[pull_request] action=${payload.action} #${payload.pull_request.number}`,
    );
  });

  githubApp.webhooks.on('pull_request.edited', ({ payload }) => {
    console.log(`[pull_request] action=${payload.action} #${payload.pull_request.number}`);
  });

  githubApp.webhooks.on('pull_request.opened', ({ octokit, payload }) => {
    const { pull_request, repository } = payload;
    console.log(
      `PR #${pull_request.number} opened on ${repository.owner.login}/${repository.name} by ${pull_request.user.login}`,
    );

    // Run heavy work in the background so webhook acknowledgement is fast.
    void runPullRequestAnalysis(
      octokit as {
        request: (
          route: string,
          params: Record<string, unknown>,
        ) => Promise<{ data: Array<{ filename: string; patch?: string }> }>;
      },
      payload as PullRequestPayload,
    ).catch((error: unknown) => {
      console.error(
        `[analysis:error] pr=${payload.pull_request.number}`,
        error,
      );
    });
  });

  githubApp.webhooks.onAny(({ id, name, payload }) => {
    const action = typeof payload === 'object' && payload && 'action' in payload
      ? (payload as { action?: string }).action
      : undefined;

    console.log(`[webhook] id=${id} name=${name} action=${action ?? 'n/a'}`);
  });

  githubApp.webhooks.onError((error) => {
    if (error.name === 'AggregateError') {
      console.error(`Error processing request: ${error.event}`);
      return;
    }
    console.error(error);
  });

  return githubApp;
}
