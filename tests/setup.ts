// Global Vitest setup shared by every test file.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library only auto-cleans when Vitest globals are enabled; do it explicitly
// so components from one test never leak into the next.
afterEach(() => cleanup());
