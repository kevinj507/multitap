import { describe, it, expect, vi } from 'vitest';
import { createPool } from '../src/db.js';

// A dropped idle connection must not end the process. The pool emits
// 'error' for it; without a listener Node treats that as fatal — the crash
// loop of 2026-11-06, when the platform re-provisioned the production
// database under the running app.
describe('the query pool survives a dropped idle connection', () => {
  it('handles the pool\'s error event instead of letting it end the process', async () => {
    const pool = createPool('postgresql://nobody@127.0.0.1:1/unused');
    try {
      expect(pool.listenerCount('error')).toBe(1);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
      expect(spy).toHaveBeenCalledWith('[db] idle connection dropped:', 'terminating connection due to administrator command');
      spy.mockRestore();
    } finally {
      await pool.end();
    }
  });
});
