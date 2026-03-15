import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  submitPullRequestReview,
  submitReviewFailureComment,
  updatePRSummary,
} from '@/helpers/review/github.js';
import { ReviewLabel, ReviewSeverity } from '@/constants/review.constants.js';
import type { OctokitLike, ReviewPayload } from '@/types/review.types.js';

const createOctokitMock = (
  requestImpl: (
    route: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown }>,
): OctokitLike => ({
  request: requestImpl,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('review github helpers', () => {
  it('patches the PR body when the body is empty', async () => {
    const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
    const octokit = createOctokitMock(async (route, params) => {
      calls.push({ route, params });
      return { data: {} };
    });

    await updatePRSummary({
      octokit,
      owner: 'npcsid',
      repo: 'codereviewer',
      prNumber: 13,
      body: '',
      summary: ['Adds graceful timeout comments'],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.route).toBe('PATCH /repos/{owner}/{repo}/pulls/{pull_number}');
    expect(calls[0]?.params.body).toBe(
      '## Summary\n- Adds graceful timeout comments',
    );
  });

  it('posts summary and inline comments as a PR review', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
    const octokit = createOctokitMock(async (route, params) => {
      calls.push({ route, params });

      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
        return { data: { head: { sha: 'abc123' } } };
      }

      return { data: {} };
    });

    const reviewPayload: ReviewPayload = {
      summary: ['Adds bounded diff handling', 'Posts failure comments on timeouts'],
      reviewFindings: [
        {
          label: ReviewLabel.Warning,
          severity: ReviewSeverity.Medium,
          file: 'src/services/review.service.ts',
          line: 52,
          message: 'This branch still sends the full diff to the model.',
          suggestion: 'Apply chunking before deep review mode.',
        },
      ],
    };

    await submitPullRequestReview({
      octokit,
      owner: 'npcsid',
      repo: 'codereviewer',
      prNumber: 13,
      reviewPayload,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.route).toBe(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
    );
    expect(calls[1]?.params.comments).toEqual([
      {
        path: 'src/services/review.service.ts',
        line: 52,
        side: 'RIGHT',
        body: 'warning: This branch still sends the full diff to the model.\n\nSuggestion: Apply chunking before deep review mode.',
      },
    ]);
    expect(String(calls[1]?.params.body)).toMatch(/## PR Review/);
  });

  it('posts a plain PR conversation comment on review failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
    const octokit = createOctokitMock(async (route, params) => {
      calls.push({ route, params });
      return { data: {} };
    });

    await submitReviewFailureComment({
      octokit,
      owner: 'npcsid',
      repo: 'codereviewer',
      prNumber: 13,
      body: 'Nitpickrr timed out while reviewing this PR.',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.route).toBe(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
    );
    expect(calls[0]?.params.issue_number).toBe(13);
  });
});
