// SPDX-License-Identifier: BSD-2-Clause
/**
 * Every error this SDK throws is an {@link OureaError}. Catch the subclass
 * you care about with `instanceof`, or switch on {@link OureaError.category}.
 *
 * @module
 */

/**
 * The error categories of the Ourea API contract (BEHAVIOR.md section 8),
 * plus `unknown` for an HTTP error whose code and status map to none of them.
 */
export type ErrorCategory =
  | 'authentication'
  | 'permission'
  | 'not_found'
  | 'invalid_request'
  | 'outside_coverage'
  | 'rate_limited'
  | 'unavailable'
  | 'connection'
  | 'usage'
  | 'unknown';

/** The base class of every error the SDK throws. */
export class OureaError extends Error {
  /** Which kind of failure this is. Stable across releases. */
  readonly category: ErrorCategory;

  constructor(category: ErrorCategory, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.category = category;
    this.name = new.target.name;
  }
}

/** Fields every HTTP error response carries. */
export interface ApiErrorDetails {
  /** HTTP status code. */
  readonly status: number;
  /**
   * The API's error code (`OUTSIDE_COVERAGE`, `PRO_REQUIRED`, ...), kept
   * verbatim even when this SDK version does not know it. `undefined` when the
   * body was not the API's JSON error shape.
   */
  readonly code: string | undefined;
  /** The server's `X-Request-Id`, for support requests. */
  readonly requestId: string | undefined;
  /** Seconds the server asked us to wait (`Retry-After`), when it sent one. */
  readonly retryAfter: number | undefined;
}

/**
 * The API answered with a non-2xx status. The subclasses below narrow it by
 * category; a plain `ApiError` has category `unknown`.
 */
export class ApiError extends OureaError implements ApiErrorDetails {
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(category: ErrorCategory, message: string, details: ApiErrorDetails) {
    super(category, message);
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.retryAfter = details.retryAfter;
  }
}

/** The API key is missing where required, invalid, or revoked (401). */
export class AuthenticationError extends ApiError {}

/** The key is valid but its plan does not allow this (403, e.g. `PRO_REQUIRED`). */
export class PermissionError extends ApiError {}

/** No such location, run, station or report (404, 410). */
export class NotFoundError extends ApiError {}

/** The server rejected the request's parameters (400). */
export class InvalidRequestError extends ApiError {}

/** The coordinates are outside the forecast domain (`OUTSIDE_COVERAGE`). */
export class OutsideCoverageError extends ApiError {}

/**
 * Over a rate budget (429). {@link ApiError.retryAfter} says how long to wait.
 * The SDK has already retried when the wait was 60 s or less.
 */
export class RateLimitError extends ApiError {}

/** The server could not answer right now (5xx). The SDK retried 502/503/504. */
export class UnavailableError extends ApiError {}

/** No HTTP response at all: DNS, TLS, connection reset, or the per-attempt timeout. */
export class ConnectionError extends OureaError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('connection', message, options);
  }
}

/**
 * The SDK refused the call before sending anything: an invalid probability
 * term, an unserved quantile pair, a malformed location, and so on.
 */
export class UsageError extends OureaError {
  constructor(message: string) {
    super('usage', message);
  }
}

const CODE_CATEGORIES: ReadonlyMap<string, ErrorCategory> = new Map(
  Object.entries({
    INVALID_API_KEY: 'authentication',
    UNAUTHORIZED: 'authentication',
    PRO_REQUIRED: 'permission',
    FORBIDDEN: 'permission',
    LOCATION_NOT_FOUND: 'not_found',
    MODEL_RUN_NOT_FOUND: 'not_found',
    NOT_FOUND: 'not_found',
    GONE: 'not_found',
    BAD_REQUEST: 'invalid_request',
    INVALID_COORDINATES: 'invalid_request',
    INVALID_ELEVATION: 'invalid_request',
    INVALID_MAX_HOURS: 'invalid_request',
    ELEVATION_REQUIRED: 'invalid_request',
    AMBIGUOUS: 'invalid_request',
    FEELS_LIKE_UNAVAILABLE: 'invalid_request',
    OUTSIDE_COVERAGE: 'outside_coverage',
    TOO_MANY_REQUESTS: 'rate_limited',
    FORECAST_UNAVAILABLE: 'unavailable',
    TIMEOUT: 'unavailable',
    INTERNAL_ERROR: 'unavailable',
    DATABASE_ERROR: 'unavailable',
  } satisfies Record<string, ErrorCategory>),
);

function categoryFor(status: number, code: string | undefined): ErrorCategory {
  const byCode = code === undefined ? undefined : CODE_CATEGORIES.get(code);
  if (byCode !== undefined) return byCode;
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (status === 404 || status === 410) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status <= 599) return 'unavailable';
  return 'unknown';
}

const ERROR_CLASSES: Readonly<
  Record<
    ErrorCategory,
    new (category: ErrorCategory, message: string, details: ApiErrorDetails) => ApiError
  >
> = {
  authentication: AuthenticationError,
  permission: PermissionError,
  not_found: NotFoundError,
  invalid_request: InvalidRequestError,
  outside_coverage: OutsideCoverageError,
  rate_limited: RateLimitError,
  unavailable: UnavailableError,
  connection: ApiError,
  usage: ApiError,
  unknown: ApiError,
};

/** @internal Builds the typed error for an HTTP error response. */
export function apiErrorFrom(
  status: number,
  code: string | undefined,
  message: string,
  requestId: string | undefined,
  retryAfter: number | undefined,
): ApiError {
  const category = categoryFor(status, code);
  const text = code === undefined ? `HTTP ${String(status)}: ${message}` : `${code}: ${message}`;
  // eslint-disable-next-line security/detect-object-injection -- category is an ErrorCategory, not input
  return new ERROR_CLASSES[category](category, text, { status, code, requestId, retryAfter });
}
