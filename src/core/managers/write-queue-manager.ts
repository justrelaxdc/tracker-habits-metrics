import type { TFile } from "obsidian";
import { logError } from "../../utils/notifications";

/**
 * Manages write queue per file to prevent race conditions
 * Ensures sequential writes for the same file
 */
export class WriteQueueManager {
  // Map of file path to write queue promise chain
  private writeQueues: Map<string, Promise<void>> = new Map();

  /**
   * Execute write operation sequentially for the same file
   * Multiple writes to the same file will be queued and executed in order
   */
  async executeWrite<T>(
    file: TFile,
    operation: () => Promise<T>
  ): Promise<T> {
    const filePath = file.path;
    const previousPromise = this.writeQueues.get(filePath) || Promise.resolve();

    // Create new promise that chains after previous one
    const newPromise = previousPromise
      .then(async () => {
        try {
          return await operation();
        } catch (error) {
          // Log error but don't break the queue
          logError("WriteQueueManager: operation failed", error);
          throw error;
        } finally {
          // Remove from queue when done
          if (this.writeQueues.get(filePath) === newPromise) {
            this.writeQueues.delete(filePath);
          }
        }
      })
      .catch((error) => {
        // Remove from queue on error
        if (this.writeQueues.get(filePath) === newPromise) {
          this.writeQueues.delete(filePath);
        }
        throw error;
      });

    this.writeQueues.set(filePath, newPromise);
    return newPromise;
  }

  /**
   * Clear all write queues (for plugin unload)
   */
  clear(): void {
    this.writeQueues.clear();
  }

  /**
   * Get current queue size for a file
   */
  getQueueSize(filePath: string): number {
    return this.writeQueues.has(filePath) ? 1 : 0;
  }
}

