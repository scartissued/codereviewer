import { describe, expect, it } from 'vitest';

import { ReviewLabel, ReviewSeverity } from '@/constants/review.constants.js';
import { parseReviewPayload } from '@/helpers/review/parser.js';

describe('parseReviewPayload', () => {
  it('keeps valid labels and severity', () => {
    const payload = parseReviewPayload(
      JSON.stringify({
        summary: ['Adds bounded diff handling'],
        reviewFindings: [
          {
            label: ReviewLabel.Warning,
            severity: ReviewSeverity.Medium,
            file: 'src/services/review.service.ts',
            line: 42,
            message: 'This can still grow large on huge PRs.',
            suggestion: 'Add chunking before the model call.',
          },
        ],
      }),
    );

    expect(payload.summary).toEqual(['Adds bounded diff handling']);
    expect(payload.reviewFindings[0]?.label).toBe(ReviewLabel.Warning);
    expect(payload.reviewFindings[0]?.severity).toBe(ReviewSeverity.Medium);
  });

  it('derives a safe label when the model returns an invalid one', () => {
    const payload = parseReviewPayload(
      JSON.stringify({
        summary: ['Adds timeout fallback comment'],
        reviewFindings: [
          {
            label: 'unexpected',
            severity: ReviewSeverity.High,
            file: 'src/helpers/review/github.ts',
            line: 17,
            message: 'Review submission can fail without head SHA.',
            suggestion: 'Skip review creation when head SHA is missing.',
          },
        ],
      }),
    );

    expect(payload.reviewFindings[0]?.label).toBe(ReviewLabel.Issue);
    expect(payload.reviewFindings[0]?.severity).toBe(ReviewSeverity.High);
  });

  it('accepts the legacy findings key', () => {
    const payload = parseReviewPayload(
      JSON.stringify({
        summary: ['Backwards compatible payload'],
        findings: [
          {
            severity: ReviewSeverity.Low,
            file: 'src/helpers/review/parser.ts',
            line: null,
            message: 'Optional cleanup.',
            suggestion: 'No action required.',
          },
        ],
      }),
    );

    expect(payload.reviewFindings).toHaveLength(1);
    expect(payload.reviewFindings[0]?.label).toBe(ReviewLabel.Nit);
  });

  it('throws on invalid structure', () => {
    expect(() =>
      parseReviewPayload(JSON.stringify({ summary: 'wrong-shape' })),
    ).toThrow(/Invalid LLM JSON structure/);
  });
});
