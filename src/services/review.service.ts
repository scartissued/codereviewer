import { generateText } from 'ai';
import {
  MIN_PR_TEXT_LENGTH,
  PullRequestEventType,
  REVIEW_EMPTY_RESPONSE_PREFIX,
  REVIEW_FILES_ROUTE,
  REVIEW_LOG_LLM_PREFIX,
  REVIEW_LOG_PARSE_ERROR_PREFIX,
  REVIEW_LOG_SKIP_PREFIX,
  REVIEW_MAX_OUTPUT_TOKENS,
  REVIEW_MODEL,
  REVIEW_PARSE_ERROR_MESSAGE,
  REVIEW_PROMPT_TEMPLATE,
  ReviewSeverity,
  REVIEW_TEMPERATURE,
  REVIEW_TIMEOUT_MS,
  REVIEW_UPDATE_PULL_ROUTE,
} from '../constants/review.constants.js';

type PullRequestFile = { filename: string; patch?: string };

type OctokitLike = {
  request: (
    route: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
};

export type PullRequestPayload = {
  action: string;
  repository: { owner: { login: string }; name: string };
  pull_request: {
    number: number;
    user: { login: string };
    title?: string;
    body?: string | null;
  };
};

type ReviewFinding = {
  severity: ReviewSeverity;
  file: string;
  line: number | null;
  message: string;
  suggestion: string;
};

type ReviewPayload = {
  summary: string[];
  reviewFindings: ReviewFinding[];
};

const hasMeaningfulText = (value: string | null | undefined): boolean =>
  (value?.trim().length ?? 0) > MIN_PR_TEXT_LENGTH;

const updatePRSummary = async (input: {
  octokit: OctokitLike;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
  summary: string[];
}): Promise<void> => {
  const { octokit, owner, repo, prNumber, body, summary } = input;

  const bodyExists = hasMeaningfulText(body);
  if (bodyExists) {
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

const parseReviewPayload = (raw: string): ReviewPayload => {
  const parsed = JSON.parse(raw) as {
    summary?: unknown;
    reviewFindings?: unknown;
    findings?: unknown;
  };
  const findingsSource = Array.isArray(parsed?.reviewFindings)
    ? parsed.reviewFindings
    : Array.isArray(parsed?.findings)
      ? parsed.findings
      : undefined;

  if (!parsed || !Array.isArray(parsed.summary) || !Array.isArray(findingsSource)) {
    throw new Error(REVIEW_PARSE_ERROR_MESSAGE);
  }

  return {
    summary: parsed.summary.map((item) => String(item)),
    reviewFindings: findingsSource.map((item) => {
      const finding = item as Partial<ReviewFinding>;
      return {
        severity:
          finding.severity === ReviewSeverity.High ||
          finding.severity === ReviewSeverity.Medium ||
          finding.severity === ReviewSeverity.Low
            ? finding.severity
            : ReviewSeverity.Low,
        file: String(finding.file ?? ''),
        line: typeof finding.line === 'number' ? finding.line : null,
        message: String(finding.message ?? ''),
        suggestion: String(finding.suggestion ?? ''),
      };
    }),
  };
};

export async function runPullRequestAnalysis(
  octokit: OctokitLike,
  payload: PullRequestPayload,
): Promise<ReviewPayload | null> {
  const { pull_request, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;

  const { data } = await octokit.request(
    REVIEW_FILES_ROUTE,
    { owner, repo, pull_number: prNumber},
  );
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

  let reviewPayload = null
  try {
    reviewPayload = parseReviewPayload(trimmedText);
    await updatePRSummary({
      octokit,
      owner,
      repo,
      prNumber,
      body: prBody,
      summary: reviewPayload.summary,
    });
    return reviewPayload
  } catch (error) {
    console.error(
      `${REVIEW_LOG_PARSE_ERROR_PREFIX} pr=${prNumber} sample=${trimmedText.slice(0, 300)}`,
      error,
    );
    throw error;
  }
}

export async function handlePullRequestEvent(input: {
  octokit: OctokitLike;
  payload: PullRequestPayload;
  event: PullRequestEventType;
}): Promise<ReviewPayload | null> {
  const { octokit, payload } = input;

  const reviewData = await runPullRequestAnalysis(octokit, payload);
  return reviewData
}
