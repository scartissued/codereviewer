import { App } from '@octokit/app';
import { env } from '../config/env.js';
import {
  LOG_ANALYSIS_ERROR_PREFIX,
  LOG_GITHUB_AUTHENTICATED_PREFIX,
  LOG_GITHUB_EVENT_ERROR_PREFIX,
  LOG_PR_OPENED_WEBHOOK,
  LOG_PR_SYNCHRONIZE_WEBHOOK,
  LOG_SYNC_PR_ERROR,
  LOG_UNKNOWN_ACCOUNT,
  WEBHOOK_EVENT_INSTALLATION_CREATED,
  WEBHOOK_EVENT_PULL_REQUEST_OPENED,
  WEBHOOK_EVENT_PULL_REQUEST_SYNCHRONIZE,
} from '../constants/github.constants.js';
import {
  handlePullRequestEvent,
} from './review.service.js';
import { PullRequestPayload } from '../types/review.types.js';
import { PullRequestEventType } from '../constants/review.constants.js';

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
  console.log(`${LOG_GITHUB_AUTHENTICATED_PREFIX} '${data.name}'`);

  githubApp.webhooks.on(WEBHOOK_EVENT_INSTALLATION_CREATED, ({ payload }) => {
    const { installation, sender } = payload;
    const account = installation.account;
    const accountName =
      account && 'login' in account ? account.login : LOG_UNKNOWN_ACCOUNT;
    console.log(
      `App installed by ${sender.login} (installation ${installation.id}) ` +
      `on ${accountName}`,
    );
  });


  githubApp.webhooks.on(WEBHOOK_EVENT_PULL_REQUEST_SYNCHRONIZE, ({ octokit, payload }) => {
    console.log(LOG_PR_SYNCHRONIZE_WEBHOOK);

    void handlePullRequestEvent({
      octokit,
      payload: payload as PullRequestPayload,
      event: PullRequestEventType.Synchronize,
    }).catch((error: unknown) => {
      console.error(LOG_SYNC_PR_ERROR, error);
    });
  });

  githubApp.webhooks.on(WEBHOOK_EVENT_PULL_REQUEST_OPENED, ({ octokit, payload }) => {
    const { pull_request, repository } = payload;
    console.log(LOG_PR_OPENED_WEBHOOK);
    console.log(
      `PR #${pull_request.number} opened on ${repository.owner.login}/${repository.name} by ${pull_request.user.login}`,
    );

    // Run heavy work in the background so webhook acknowledgement is fast.
    void handlePullRequestEvent({
      octokit,
      payload: payload as PullRequestPayload,
      event: PullRequestEventType.Opened,
    }).catch((error: unknown) => {
      console.error(
        `${LOG_ANALYSIS_ERROR_PREFIX} pr=${payload.pull_request.number}`,
        error,
      );
    });
  });

  githubApp.webhooks.onError((error) => {
    if (error.name === 'AggregateError') {
      console.error(`${LOG_GITHUB_EVENT_ERROR_PREFIX} ${error.event}`);
      return;
    }
    console.error(error);
  });

  return githubApp;
}
