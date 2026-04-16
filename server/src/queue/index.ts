import { config } from '../config/index.js';
import type { FunctionType } from '../services/types.js';

type Job = {
  taskId: number;
  functionType: FunctionType;
  inputData: Record<string, unknown>;
};

type ProcessorFn = (job: Job) => Promise<void>;

class MemoryQueue {
  private queue: Job[] = [];
  private processing = false;
  private processor: ProcessorFn | null = null;
  private running = 0;

  setProcessor(processor: ProcessorFn) {
    this.processor = processor;
  }

  add(job: Job) {
    this.queue.push(job);
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing || !this.processor) return;
    this.processing = true;

    while (this.queue.length > 0 && this.running < config.queue.concurrency) {
      const job = this.queue.shift();
      if (job) {
        this.running++;
        this.processor(job)
          .catch(console.error)
          .finally(() => {
            this.running--;
            this.processQueue();
          });
      }
    }

    this.processing = false;
  }
}

export const queue = new MemoryQueue();
export default queue;
