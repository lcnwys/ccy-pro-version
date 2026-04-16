import { taskRepository } from '../database/repositories/taskRepository.js';
import { chcyaiService } from '../services/chcyaiService.js';
import type { FunctionType } from '../services/types.js';

const LOG_PREFIX = '[任务队列]';

export const createProcessor = () => {
  return async (job: { taskId: number; functionType: FunctionType; inputData: Record<string, unknown> }) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`${LOG_PREFIX} [${timestamp}] 开始处理任务 taskId=${job.taskId} type=${job.functionType}`);

    try {
      // 更新状态为 processing
      await taskRepository.updateStatus(job.taskId, 'processing');
      console.log(`${LOG_PREFIX} [${timestamp}] 任务状态更新为 processing taskId=${job.taskId}`);

      // 调用创次元 API
      console.log(`${LOG_PREFIX} [${timestamp}] 调用创次元 API taskId=${job.taskId}`);
      const result = await chcyaiService.execute(job.functionType, job.inputData);

      // 更新状态为 success
      await taskRepository.updateStatus(job.taskId, 'success', result as unknown as Record<string, unknown>);
      console.log(`${LOG_PREFIX} [${timestamp}] 任务完成 taskId=${job.taskId} status=success`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_PREFIX} [${timestamp}] 任务失败 taskId=${job.taskId} error=${errorMsg}`);

      // 更新状态为 failed
      await taskRepository.updateStatus(
        job.taskId,
        'failed',
        undefined,
        errorMsg
      );
    }
  };
};
