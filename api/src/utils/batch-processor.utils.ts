/**
 * Batch Processor Utility
 * Handles large datasets by processing them in smaller batches to prevent resource exhaustion
 */

export interface BatchProcessorOptions {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches?: number;
}

export class BatchProcessor<T> {
  private options: BatchProcessorOptions;

  constructor(options: BatchProcessorOptions) {
    this.options = {
      delayBetweenBatches: 100, // Default 100ms delay
      ...options,
    };
  }

  /**
   * Process large array in batches to prevent resource exhaustion
   */
  async processBatches<R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onBatchComplete?: (
      batchIndex: number,
      totalBatches: number,
      results: R[]
    ) => void
  ): Promise<R[]> {
    const { batchSize, concurrency, delayBetweenBatches } = this.options;
    const totalBatches = Math.ceil(items.length / batchSize);
    const allResults: R[] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, items.length);
      const batch = items.slice(startIndex, endIndex);

      // Process batch with controlled concurrency
      const batchResults = await this.processBatchWithConcurrency(
        batch,
        processor,
        concurrency
      );
      allResults.push(...batchResults);

      // Callback for batch completion
      if (onBatchComplete) {
        onBatchComplete(batchIndex + 1, totalBatches, batchResults);
      }

      // Delay between batches to allow file handles to close
      if (
        batchIndex < totalBatches - 1 &&
        delayBetweenBatches &&
        delayBetweenBatches > 0
      ) {
        await this.delay(delayBetweenBatches);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    return allResults;
  }

  /**
   * Process a single batch with controlled concurrency
   */
  private async processBatchWithConcurrency<R>(
    batch: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkPromises = chunk.map(processor);
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Quick utility function for batch processing
 */
export async function processBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchProcessorOptions,
  onBatchComplete?: (
    batchIndex: number,
    totalBatches: number,
    results: R[]
  ) => void
): Promise<R[]> {
  const batchProcessor = new BatchProcessor<T>(options);
  return batchProcessor.processBatches(items, processor, onBatchComplete);
}

export default BatchProcessor;
