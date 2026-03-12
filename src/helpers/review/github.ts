import {
  MIN_PR_TEXT_LENGTH,
  REVIEW_CREATE_REVIEW_ROUTE,
  REVIEW_EVENT_COMMENT,
  REVIEW_GET_PULL_ROUTE,
  REVIEW_LOG_REVIEW_SUBMIT_PREFIX,
  REVIEW_UPDATE_PULL_ROUTE,
} from '../../constants/review.constants.js';
import {
  OctokitLike,
  PullRequestHeadResponse,
  ReviewComment,
  ReviewFinding,
  ReviewPayload,
} from '../../types/review.types.js';

const hasMeaningfulText = (value: string | null | undefined): boolean =>
  (value?.trim().length ?? 0) > MIN_PR_TEXT_LENGTH;

export const updatePRSummary = async (input: {
  octokit: OctokitLike;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
  summary: string[];
}): Promise<void> => {
  const { octokit, owner, repo, prNumber, body, summary } = input;

  if (hasMeaningfulText(body)) {
    return;
  }

  const generatedBody = summary.length
    ? `## Summary\n${summary.map((line) => `- ${line}`).join('\n')}`
    : '## Summary\n- Automated PR summary not available.';

  const patchPayload: Record<string, unknown> = {
    owner,
    repo,
    pull_number: prNumber,
    body: generatedBody,
  };

  try {
    await octokit.request(REVIEW_UPDATE_PULL_ROUTE, patchPayload);
  } catch (error) {
    console.error('Error updating PR:', error);
  }
};

const buildReviewBody = (reviewPayload: ReviewPayload): string => {
  const summary = reviewPayload.summary.length
    ? reviewPayload.summary.map((line) => `- ${line}`).join('\n')
    : ' No summary provided.';
  const findings = reviewPayload.reviewFindings.length
    ? reviewPayload.reviewFindings.map((finding) =>
      ` [${finding.severity}] ${finding.file}:${finding.line ?? 'n/a'}  ${finding.message}`,
    ).join('\n')
    : ' No review findings.';

  return `## PR Review\n\n### Summary\n${summary}\n\n### Findings\n${findings}`;
};

// Convert model findings into GitHub inline review comments.
// We only keep findings that can be anchored to a concrete file+line;
// everything else is still preserved in the top-level review summary body.
const toInlineComments = (reviewFindings: ReviewFinding[]): ReviewComment[] =>
  reviewFindings
    .filter((finding) => finding.file && typeof finding.line === 'number')
    .map((finding) => ({
      path: finding.file,
      line: finding.line as number,
      // In GitHub PR diffs, RIGHT means the changed/new code side (the PR head revision).
      // Bots typically comment on RIGHT because findings target code introduced/modified by the PR.
      side: 'RIGHT' as const,
      body: `[${finding.severity}] ${finding.message}\n\nSuggestion: ${finding.suggestion}`,
    }));

export const submitPullRequestReview = async (input: {
  octokit: OctokitLike;
  owner: string;
  repo: string;
  prNumber: number;
  reviewPayload: ReviewPayload;
}): Promise<void> => {
  const { octokit, owner, repo, prNumber, reviewPayload } = input;

  const { data: prData } = await octokit.request(REVIEW_GET_PULL_ROUTE, {
    owner,
    repo,
    pull_number: prNumber,
  });
  // GitHub review creation expects commit_id to anchor comments against a specific PR head commit.
  // If head SHA is unavailable, submitting the review can fail or attach to an invalid context.
  const headSha = (prData as PullRequestHeadResponse)?.head?.sha;
  if (!headSha) {
    console.warn(
      `${REVIEW_LOG_REVIEW_SUBMIT_PREFIX} pr=${prNumber} skip reason=no_head_sha`,
    );
    return;
  }

  const comments = toInlineComments(reviewPayload.reviewFindings);
  const body = buildReviewBody(reviewPayload);
  // a bot should not block a PR i believe so the event shouldn't be 'request changes' even if review highlights the same
  const event = REVIEW_EVENT_COMMENT;

  try {
    await octokit.request(REVIEW_CREATE_REVIEW_ROUTE, {
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event,
      body,
      comments,
    });
    console.log(
      `${REVIEW_LOG_REVIEW_SUBMIT_PREFIX} pr=${prNumber} inlineComments=${comments.length} event=${event}`,
    );
  } catch (error) {
    // If inline positions are stale/invalid, retry without inline comments so the bot still posts a review.
    console.warn(
      `${REVIEW_LOG_REVIEW_SUBMIT_PREFIX} pr=${prNumber} inline_failed=true fallback=summary_only`,
      error,
    );
    await octokit.request(REVIEW_CREATE_REVIEW_ROUTE, {
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event: REVIEW_EVENT_COMMENT,
      body,
      comments: [],
    });
  }
};
