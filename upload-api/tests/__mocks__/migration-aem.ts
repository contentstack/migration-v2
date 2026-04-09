import { vi } from 'vitest';

export const validator = vi.fn().mockResolvedValue([true]);
export const contentTypes = vi.fn().mockReturnValue({
  convertAndCreate: vi.fn().mockResolvedValue([]),
});
export const locales = vi.fn().mockReturnValue({
  processAndSave: vi.fn().mockResolvedValue([]),
});

export default {
  validator,
  contentTypes,
  locales
};
