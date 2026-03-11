import { App } from '@octokit/app';
import { env } from '../config/env.js';
import {
  handlePullRequestEvent,
  PullRequestPayload,
  PullRequestEventType,
} from './review.service.js';

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


  githubApp.webhooks.on('pull_request.synchronize', ({ octokit, payload }) => {
    console.log('PR synchronize webhook')

    void handlePullRequestEvent({
      octokit,
      payload: payload as PullRequestPayload,
      event: PullRequestEventType.Synchronize,
    }).catch((error: unknown) => {
      console.error(
        'Error while synchronizing PR',
        error,
      );
    });
  });

  githubApp.webhooks.on('pull_request.opened', ({ octokit, payload }) => {
    const { pull_request, repository } = payload;
    console.log('PR opened webhook')
    console.log(
      `PR #${pull_request.number} opened on ${repository.owner.login}/${repository.name} by ${pull_request.user.login}`,
    );

    console.log('random console for diff')

    // Run heavy work in the background so webhook acknowledgement is fast.
    void handlePullRequestEvent({
      octokit,
      payload: payload as PullRequestPayload,
      event: PullRequestEventType.Opened,
    }).catch((error: unknown) => {
      console.error(
        `[analysis:error] pr=${payload.pull_request.number}`,
        error,
      );
    });
  });

  githubApp.webhooks.onError((error) => {
    console.log('ON ANY error webhook')
    if (error.name === 'AggregateError') {
      console.error(`Error processing request: ${error.event}`);
      return;
    }
    console.error(error);
  });

  return githubApp;
}
