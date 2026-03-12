import {
  REVIEW_PARSE_ERROR_MESSAGE,
  ReviewSeverity,
} from '../../constants/review.constants.js';
import { ReviewFinding, ReviewPayload } from '../../types/review.types.js';

export const parseReviewPayload = (raw: string): ReviewPayload => {
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
