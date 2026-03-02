/**
 * ASURite ID format: alphanumeric, 2–20 characters.
 * Shared so it can be tested and used by AuthContext and forms.
 */
const ASURITE_REGEX = /^[a-zA-Z0-9]+$/;

export function validateAsuriteId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 20 && ASURITE_REGEX.test(trimmed);
}
