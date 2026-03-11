import { generateText } from 'ai';
import {
  REVIEW_EMPTY_RESPONSE_PREFIX,
  REVIEW_FILES_ROUTE,
  REVIEW_LOG_DIFF_PREFIX,
  REVIEW_LOG_EVENT_PREFIX,
  REVIEW_LOG_FILES_PREFIX,
  REVIEW_LOG_LLM_PREFIX,
  REVIEW_LOG_PARSE_ERROR_PREFIX,
  REVIEW_LOG_RESULT_PREFIX,
  REVIEW_LOG_SKIP_PREFIX,
  REVIEW_MAX_OUTPUT_TOKENS,
  REVIEW_MODEL,
  REVIEW_PARSE_ERROR_MESSAGE,
  REVIEW_PROMPT_TEMPLATE,
  ReviewSeverity,
  REVIEW_TEMPERATURE,
  REVIEW_TIMEOUT_MS,
} from '../constants/review.constants.js';

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

type ReviewFinding = {
  severity: ReviewSeverity;
  file: string;
  line: number | null;
  message: string;
  suggestion: string;
};

type ReviewPayload = {
  summary: string[];
  findings: ReviewFinding[];
};

const parseReviewPayload = (raw: string): ReviewPayload => {
  const parsed = JSON.parse(raw) as Partial<ReviewPayload>;
  if (!parsed || !Array.isArray(parsed.summary) || !Array.isArray(parsed.findings)) {
    throw new Error(REVIEW_PARSE_ERROR_MESSAGE);
  }

  return {
    summary: parsed.summary.map((item) => String(item)),
    findings: parsed.findings.map((item) => {
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
): Promise<void> {
  const { pull_request, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;

  const { data: files } = await octokit.request(
    REVIEW_FILES_ROUTE,
    { owner, repo, pull_number: prNumber },
  );


  const diffText = files
    .filter((f) => f.patch)
    .map((f) => `File: ${f.filename}\n${f.patch}`)
    .join('\n\n');

  if (!diffText.trim()) {
    console.warn(`${REVIEW_LOG_SKIP_PREFIX} pr=${prNumber} no textual patch content`);
    return;
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
    `${REVIEW_LOG_LLM_PREFIX} pr=${prNumber} textLength=${trimmedText.length} finishReason=${String(result.finishReason ?? 'n/a')} inputTokens=${result.usage?.inputTokens ?? 0} outputTokens=${result.usage?.outputTokens ?? 0} reasoningTokens=${result.usage?.reasoningTokens ?? 0}`,
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

  console.log(
    `${REVIEW_LOG_RESULT_PREFIX} pr=${prNumber} summaryCount=${reviewPayload.summary.length} findingsCount=${reviewPayload.findings.length}`,
  );
}

export async function handlePullRequestEvent(input: {
  octokit: OctokitLike;
  payload: PullRequestPayload;
  event: PullRequestEventType;
}): Promise<void> {
  const { octokit, payload, event } = input;
  console.log(
    `${REVIEW_LOG_EVENT_PREFIX} ${event} action=${payload.action} #${payload.pull_request.number}`,
  );

  await runPullRequestAnalysis(octokit, payload);
}
