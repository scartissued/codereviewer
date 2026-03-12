import { ReviewSeverity } from '../constants/review.constants.js';

export type PullRequestFile = { filename: string; patch?: string };

export type OctokitLike = {
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

export type ReviewFinding = {
  severity: ReviewSeverity;
  file: string;
  line: number | null;
  message: string;
  suggestion: string;
};

export type ReviewPayload = {
  summary: string[];
  reviewFindings: ReviewFinding[];
};

export type PullRequestHeadResponse = { head?: { sha?: string } };

export type ReviewComment = {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
};
