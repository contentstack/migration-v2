import { describe, it, expect, vi, afterEach } from 'vitest';
import { BatchProcessor, processBatches } from '../../../src/utils/batch-processor.utils.js';

describe('batch-processor.utils', () => {
  afterEach(() => {
    delete (globalThis as unknown as { gc?: () => void }).gc;
  });

  describe('BatchProcessor', () => {
    it('should process all items in correct batch sizes', async () => {
      const processor = new BatchProcessor<number>({
        batchSize: 2,
        concurrency: 2,
        delayBetweenBatches: 0,
      });

      const items = [1, 2, 3, 4, 5];
      const results = await processor.processBatches(
        items,
        async (item) => item * 2
      );

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle empty arrays', async () => {
      const processor = new BatchProcessor<number>({
        batchSize: 5,
        concurrency: 2,
        delayBetweenBatches: 0,
      });

      const results = await processor.processBatches([], async (item) => item);
      expect(results).toEqual([]);
    });

    it('should respect concurrency limit', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const processor = new BatchProcessor<number>({
        batchSize: 10,
        concurrency: 2,
        delayBetweenBatches: 0,
      });

      const items = [1, 2, 3, 4];
      await processor.processBatches(items, async (item) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
        return item;
      });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should call onBatchComplete callback', async () => {
      const processor = new BatchProcessor<number>({
        batchSize: 2,
        concurrency: 2,
        delayBetweenBatches: 0,
      });

      const callback = vi.fn();
      await processor.processBatches(
        [1, 2, 3, 4],
        async (item) => item,
        callback
      );

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(1, 2, [1, 2]);
      expect(callback).toHaveBeenCalledWith(2, 2, [3, 4]);
    });

    it('should apply delay between batches', async () => {
      const processor = new BatchProcessor<number>({
        batchSize: 1,
        concurrency: 1,
        delayBetweenBatches: 50,
      });

      const start = Date.now();
      await processor.processBatches([1, 2, 3], async (item) => item);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(80);
    });

    it('calls global.gc when available after each batch', async () => {
      const gc = vi.fn();
      (globalThis as unknown as { gc: () => void }).gc = gc;
      const processor = new BatchProcessor<number>({
        batchSize: 1,
        concurrency: 1,
        delayBetweenBatches: 0,
      });
      await processor.processBatches([1, 2], async (item) => item);
      expect(gc).toHaveBeenCalled();
    });
  });

  describe('processBatches utility function', () => {
    it('should process items using the utility function', async () => {
      const results = await processBatches(
        [1, 2, 3],
        async (item) => item * 3,
        { batchSize: 2, concurrency: 1, delayBetweenBatches: 0 }
      );

      expect(results).toEqual([3, 6, 9]);
    });
  });
});
