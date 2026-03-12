import { generateText } from 'ai';
import {
  PullRequestEventType,
  REVIEW_EMPTY_RESPONSE_PREFIX,
  REVIEW_FILES_ROUTE,
  REVIEW_LOG_LLM_PREFIX,
  REVIEW_LOG_PARSE_ERROR_PREFIX,
  REVIEW_LOG_SKIP_PREFIX,
  REVIEW_MAX_OUTPUT_TOKENS,
  REVIEW_MODEL,
  REVIEW_PROMPT_TEMPLATE,
  REVIEW_TEMPERATURE,
  REVIEW_TIMEOUT_MS,
} from '../constants/review.constants.js';
import {
  submitPullRequestReview,
  updatePRSummary,
} from '../helpers/review/github.js';
import { parseReviewPayload } from '../helpers/review/parser.js';
import {
  OctokitLike,
  PullRequestFile,
  PullRequestPayload,
  ReviewPayload,
} from '../types/review.types.js';

export type { PullRequestPayload } from '../types/review.types.js';

export async function runPullRequestAnalysis(
  octokit: OctokitLike,
  payload: PullRequestPayload,
): Promise<ReviewPayload | null> {
  const { pull_request, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;

  const { data } = await octokit.request(REVIEW_FILES_ROUTE, {
    owner,
    repo,
    pull_number: prNumber,
  });
  const files = Array.isArray(data) ? (data as PullRequestFile[]) : [];

  const prTitle = pull_request.title ?? '';
  const prBody = pull_request.body ?? '';

  console.log(
    `[analysis:pr] pr=${prNumber} titleLength=${prTitle.length} bodyLength=${prBody.length}`,
  );

  const diffText = files
    .filter((f) => f.patch)
    .map((f) => `File: ${f.filename}\n${f.patch}`)
    .join('\n\n');

  if (!diffText.trim()) {
    console.warn(`${REVIEW_LOG_SKIP_PREFIX} pr=${prNumber} no textual patch content`);
    return null;
  }

  const prompt = `${REVIEW_PROMPT_TEMPLATE}${diffText}`;

  const result = await generateText({
    model: REVIEW_MODEL,
    prompt,
    temperature: REVIEW_TEMPERATURE,
    maxOutputTokens: REVIEW_MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
  });

  const trimmedText = result.text.trim();
  console.log(
    `${REVIEW_LOG_LLM_PREFIX} pr=${prNumber} textLength=${trimmedText.length} finishReason=${String(result.finishReason ?? 'n/a')} inputTokens=${result.usage?.inputTokens ?? 0} outputTokens=${result.usage?.outputTokens ?? 0} reasoningTokens=${result.usage?.outputTokenDetails.reasoningTokens ?? 0}`,
  );

  if (!trimmedText) {
    throw new Error(`${REVIEW_EMPTY_RESPONSE_PREFIX}${prNumber}`);
  }

  let reviewPayload: ReviewPayload;
  try {
    reviewPayload = parseReviewPayload(trimmedText);
  } catch (error) {
    console.error(
      `${REVIEW_LOG_PARSE_ERROR_PREFIX} pr=${prNumber} sample=${trimmedText.slice(0, 300)}`,
      error,
    );
    throw error;
  }

  await updatePRSummary({
    octokit,
    owner,
    repo,
    prNumber,
    body: prBody,
    summary: reviewPayload.summary,
  });

  await submitPullRequestReview({
    octokit,
    owner,
    repo,
    prNumber,
    reviewPayload,
  });

  return reviewPayload;
}

export async function handlePullRequestEvent(input: {
  octokit: OctokitLike;
  payload: PullRequestPayload;
  event: PullRequestEventType;
}): Promise<ReviewPayload | null> {
  const { octokit, payload } = input;

  return runPullRequestAnalysis(octokit, payload);
}
