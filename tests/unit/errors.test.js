// Feature: search-engine-backend — custom error classes unit tests
import { describe, it, expect } from 'vitest';
import { NotFoundError, ValidationError, InternalError } from '../../src/utils/errors.js';

describe('NotFoundError', () => {
  it('sets statusCode to 404', () => {
    const err = new NotFoundError('not found');
    expect(err.statusCode).toBe(404);
  });

  it('sets code to NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.code).toBe('NOT_FOUND');
  });

  it('sets name to NotFoundError', () => {
    const err = new NotFoundError();
    expect(err.name).toBe('NotFoundError');
  });

  it('is an instance of Error', () => {
    expect(new NotFoundError()).toBeInstanceOf(Error);
  });

  it('uses default message when none provided', () => {
    const err = new NotFoundError();
    expect(err.message).toBeTruthy();
  });

  it('uses provided message', () => {
    const err = new NotFoundError('Document not found');
    expect(err.message).toBe('Document not found');
  });

  it('has a stack trace', () => {
    const err = new NotFoundError();
    expect(err.stack).toBeTruthy();
  });
});

describe('ValidationError', () => {
  it('sets statusCode to 400', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
  });

  it('sets code to VALIDATION_ERROR', () => {
    const err = new ValidationError();
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('sets name to ValidationError', () => {
    const err = new ValidationError();
    expect(err.name).toBe('ValidationError');
  });

  it('is an instance of Error', () => {
    expect(new ValidationError()).toBeInstanceOf(Error);
  });

  it('defaults details to empty array when not provided', () => {
    const err = new ValidationError('fail');
    expect(err.details).toEqual([]);
  });

  it('stores provided details array', () => {
    const details = [
      { field: 'title', message: 'title is required' },
      { field: 'content', message: 'content is required' },
    ];
    const err = new ValidationError('Validation failed', details);
    expect(err.details).toEqual(details);
  });

  it('coerces non-array details to empty array', () => {
    const err = new ValidationError('fail', 'not-an-array');
    expect(err.details).toEqual([]);
  });

  it('has a stack trace', () => {
    const err = new ValidationError();
    expect(err.stack).toBeTruthy();
  });
});

describe('InternalError', () => {
  it('sets statusCode to 500', () => {
    const err = new InternalError('boom');
    expect(err.statusCode).toBe(500);
  });

  it('sets code to INTERNAL_SERVER_ERROR', () => {
    const err = new InternalError();
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('sets name to InternalError', () => {
    const err = new InternalError();
    expect(err.name).toBe('InternalError');
  });

  it('is an instance of Error', () => {
    expect(new InternalError()).toBeInstanceOf(Error);
  });

  it('uses default message when none provided', () => {
    const err = new InternalError();
    expect(err.message).toBeTruthy();
  });

  it('uses provided message', () => {
    const err = new InternalError('ES indexing failed');
    expect(err.message).toBe('ES indexing failed');
  });

  it('has a stack trace', () => {
    const err = new InternalError();
    expect(err.stack).toBeTruthy();
  });
});
