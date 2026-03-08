import { App } from '@octokit/app';
import { env } from '../config/env.js';

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
  // console.log(`GitHub App authenticated as '${data.name}'`);

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

  githubApp.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
    const { pull_request, repository } = payload;
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    console.log(
      `PR #${prNumber} opened on ${owner}/${repo} by ${pull_request.user.login}`,
    );

    const { data: files } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      { owner, repo, pull_number: prNumber },
    );

    console.log(
      `Changed files (${files.length}):`,
      files.map((f: { filename: string }) => f.filename),
    );

    // TODO: AI logic goes here
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
