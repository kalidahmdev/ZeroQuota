import { vi, beforeEach, afterEach } from 'vitest';
import * as sinon from 'sinon';

beforeEach(() => {
  // Global setup if needed
});

afterEach(() => {
  sinon.restore();
  vi.restoreAllMocks();
});
