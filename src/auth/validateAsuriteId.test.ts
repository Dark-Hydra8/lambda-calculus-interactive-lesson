import { validateAsuriteId } from './validateAsuriteId';

describe('validateAsuriteId', () => {
  it('accepts 2–20 alphanumeric characters', () => {
    expect(validateAsuriteId('ab')).toBe(true);
    expect(validateAsuriteId('jsmith42')).toBe(true);
    expect(validateAsuriteId('a1b2c3d4e5')).toBe(true);
    expect(validateAsuriteId('AbCdEfGhIjKlMnOpQrSt')).toBe(true); // 20 chars
  });

  it('rejects empty or single character', () => {
    expect(validateAsuriteId('')).toBe(false);
    expect(validateAsuriteId('a')).toBe(false);
    expect(validateAsuriteId(' ')).toBe(false);
  });

  it('rejects over 20 characters', () => {
    expect(validateAsuriteId('a'.repeat(21))).toBe(false);
  });

  it('rejects non-alphanumeric characters', () => {
    expect(validateAsuriteId('john.doe')).toBe(false);
    expect(validateAsuriteId('john-doe')).toBe(false);
    expect(validateAsuriteId('john doe')).toBe(false);
    expect(validateAsuriteId('john@asu')).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(validateAsuriteId('  ab  ')).toBe(true);
    expect(validateAsuriteId('  a  ')).toBe(false); // after trim, "a" is 1 char
  });
});
