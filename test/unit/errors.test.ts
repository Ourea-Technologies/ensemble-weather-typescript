// SPDX-License-Identifier: BSD-2-Clause
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AuthenticationError,
  InvalidRequestError,
  NotFoundError,
  OureaError,
  OutsideCoverageError,
  PermissionError,
  RateLimitError,
  UnavailableError,
} from '../../src/index.js';
import { apiErrorFrom } from '../../src/errors.js';

describe('error mapping (BEHAVIOR.md section 8)', () => {
  it.each([
    ['INVALID_API_KEY', 401, AuthenticationError, 'authentication'],
    ['UNAUTHORIZED', 401, AuthenticationError, 'authentication'],
    ['PRO_REQUIRED', 403, PermissionError, 'permission'],
    ['LOCATION_NOT_FOUND', 404, NotFoundError, 'not_found'],
    ['NOT_FOUND', 404, NotFoundError, 'not_found'],
    ['BAD_REQUEST', 400, InvalidRequestError, 'invalid_request'],
    ['INVALID_COORDINATES', 400, InvalidRequestError, 'invalid_request'],
    ['INVALID_ELEVATION', 400, InvalidRequestError, 'invalid_request'],
    ['ELEVATION_REQUIRED', 400, InvalidRequestError, 'invalid_request'],
    ['OUTSIDE_COVERAGE', 404, OutsideCoverageError, 'outside_coverage'],
    ['OUTSIDE_COVERAGE', 400, OutsideCoverageError, 'outside_coverage'],
    ['TOO_MANY_REQUESTS', 429, RateLimitError, 'rate_limited'],
    ['FORECAST_UNAVAILABLE', 503, UnavailableError, 'unavailable'],
    ['TIMEOUT', 504, UnavailableError, 'unavailable'],
    ['INTERNAL_ERROR', 500, UnavailableError, 'unavailable'],
    ['DATABASE_ERROR', 500, UnavailableError, 'unavailable'],
    ['AUTH_UNAVAILABLE', 503, UnavailableError, 'unavailable'],
  ] as const)('%s (%s) is %s', (code, status, cls, category) => {
    const e = apiErrorFrom(status, code, 'm', 'req-1', undefined);
    expect(e).toBeInstanceOf(cls);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(OureaError);
    expect(e).toBeInstanceOf(Error);
    expect(e.category).toBe(category);
    expect(e.code).toBe(code);
    expect(e.status).toBe(status);
    expect(e.requestId).toBe('req-1');
    expect(e.name).toBe(cls.name);
    expect(e.message).toBe(`${code}: m`);
  });

  it.each([
    [400, InvalidRequestError],
    [401, AuthenticationError],
    [403, PermissionError],
    [404, NotFoundError],
    [410, NotFoundError],
    [429, RateLimitError],
    [500, UnavailableError],
    [599, UnavailableError],
  ] as const)('an unknown code falls back to the status %s', (status, cls) => {
    const e = apiErrorFrom(status, 'SOMETHING_NEW', 'm', undefined, undefined);
    expect(e).toBeInstanceOf(cls);
    expect(e.code).toBe('SOMETHING_NEW');
  });

  it.each([
    ['FORBIDDEN', 403, PermissionError],
    ['GONE', 410, NotFoundError],
    ['AMBIGUOUS', 400, InvalidRequestError],
  ] as const)('a retired code (%s) keeps its string and maps by status', (code, status, cls) => {
    const e = apiErrorFrom(status, code, 'm', undefined, undefined);
    expect(e).toBeInstanceOf(cls);
    expect(e.code).toBe(code);
  });

  it('carries doc_url and param', () => {
    const e = apiErrorFrom(400, 'BAD_REQUEST', 'm', 'r', undefined, {
      docUrl: 'https://docs.oureawx.com/features/errors/#bad_request',
      param: 'prob',
    });
    expect(e.docUrl).toBe('https://docs.oureawx.com/features/errors/#bad_request');
    expect(e.param).toBe('prob');
  });

  it('a status with no category is a plain ApiError of category unknown', () => {
    const e = apiErrorFrom(418, undefined, 'teapot', undefined, undefined);
    expect(e.constructor).toBe(ApiError);
    expect(e.category).toBe('unknown');
    expect(e.message).toBe('HTTP 418: teapot');
  });
});
