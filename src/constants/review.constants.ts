export const REVIEW_FILES_ROUTE = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';
export const REVIEW_MODEL = 'openai/gpt-5';
export const REVIEW_TEMPERATURE = 0.1;
export const REVIEW_MAX_OUTPUT_TOKENS = 3000;
export const REVIEW_TIMEOUT_MS = 60_000;

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
export const REVIEW_LOG_RESULT_PREFIX = '[analysis:result]';
export const REVIEW_LOG_EVENT_PREFIX = '[review:event]';

export const REVIEW_PROMPT_TEMPLATE = `You are a senior code reviewer.
Return ONLY valid JSON, no markdown, no code fences, no explanation.
JSON schema:
{
  "summary": string[],
  "findings": [
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
- Keep summary to 2-5 concise bullets.
- Return at most 10 findings.
- If no issues, return "findings": [].
DIFF:
`;
