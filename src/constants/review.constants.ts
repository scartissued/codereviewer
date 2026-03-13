export const REVIEW_FILES_ROUTE = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';
export const REVIEW_GET_PULL_ROUTE = 'GET /repos/{owner}/{repo}/pulls/{pull_number}';
export const REVIEW_MODEL = 'alibaba/qwen3-next-80b-a3b-thinking';
export const REVIEW_TEMPERATURE = 0.1;
export const REVIEW_MAX_OUTPUT_TOKENS = 10000;
export const REVIEW_TIMEOUT_MS = 90_000;
export const MIN_PR_TEXT_LENGTH = 1;
export const REVIEW_UPDATE_PULL_ROUTE = 'PATCH /repos/{owner}/{repo}/pulls/{pull_number}';
export const REVIEW_CREATE_REVIEW_ROUTE = 'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews';
export const REVIEW_EVENT_COMMENT = 'COMMENT';

export enum ReviewSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export const REVIEW_PARSE_ERROR_MESSAGE = 'Invalid LLM JSON structure';
export const REVIEW_EMPTY_RESPONSE_PREFIX = 'Empty LLM response for pr=';

export const REVIEW_LOG_FILES_PREFIX = '[analysis:files]';
export const REVIEW_LOG_SKIP_PREFIX = '[analysis:skip]';
export const REVIEW_LOG_DIFF_PREFIX = '[analysis:diff]';
export const REVIEW_LOG_LLM_PREFIX = '[analysis:llm]';
export const REVIEW_LOG_PARSE_ERROR_PREFIX = '[analysis:parse-error]';
export const REVIEW_LOG_REVIEW_SUBMIT_PREFIX = '[analysis:review-submit]';

export enum PullRequestEventType {
  Opened = 'pull_request.opened',
  Synchronize = 'pull_request.synchronize',
}

export const REVIEW_PROMPT_TEMPLATE = `You are a senior code reviewer.
Return ONLY valid JSON, no markdown, no code fences, no explanation.
JSON schema:
{
  "summary": string[],
  "reviewFindings": [
    {
      "severity": "low" | "medium" | "high",
      "file": string,
      "line": number | null,
      "message": string,
      "suggestion": string
    }
  ]
}
Rules:
- "summary" must be neutral and descriptive only:
  what changed, why, and scope/impact.
- Do NOT include critique, recommendations in "summary".
- Keep summary to 2-5 concise bullets.
- Return at most 10 review findings in "reviewFindings".
- If no issues, return "reviewFindings": [].
DIFF:
`;
