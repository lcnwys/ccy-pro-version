import { taskRepository } from '../database/repositories/taskRepository.js';
import { chcyaiService } from '../services/chcyaiService.js';
import { createMaterial } from '../services/materialService.js';
import { query } from '../database/index.js';
import { getBeijingTime } from '../utils/time.js';
import type { FunctionType } from '../services/types.js';
import { tosService } from '../services/tosService.js';

const LOG_PREFIX = '[任务队列]';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractSubmittedTaskId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['taskId', 'requestId', 'id']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }
  return null;
};

const waitForTaskResult = async (functionType: FunctionType, taskOriginId: string) => {
  let lastResult: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const result = await chcyaiService.queryResult(functionType, taskOriginId) as Record<string, unknown>;
    lastResult = result;
    const orderStatus = result.orderStatus;

    if (orderStatus === 'EXECUTE_SUCCESS') {
      let tempUrl: string | null = typeof result.tempUrl === 'string' ? result.tempUrl : null;

      if (!tempUrl) {
        try {
          tempUrl = await chcyaiService.getTempUrl(functionType, taskOriginId);
        } catch (error) {
          console.warn(`${LOG_PREFIX} 获取临时 URL 失败 taskOriginId=${taskOriginId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        ...result,
        taskId: taskOriginId,
        tempUrl,
      };
    }

    if (orderStatus === 'EXECUTE_ERROR') {
      throw new Error(`上游任务执行失败 taskId=${taskOriginId}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`轮询超时，任务仍未完成 taskId=${taskOriginId} lastStatus=${String(lastResult?.orderStatus || 'UNKNOWN')}`);
};

export const createProcessor = () => {
  return async (job: { taskId: number; functionType: FunctionType; inputData: Record<string, unknown> }) => {
    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] 开始处理任务 taskId=${job.taskId} type=${job.functionType}`);

    try {
      // 更新状态为 processing
      await taskRepository.updateStatus(job.taskId, 'processing');
      console.log(`${LOG_PREFIX} [${timestamp}] 任务状态更新为 processing taskId=${job.taskId}`);

      // 调用创次元 API
      console.log(`${LOG_PREFIX} [${timestamp}] 调用创次元 API taskId=${job.taskId}`);
      const submitResult = await chcyaiService.execute(job.functionType, job.inputData) as unknown;
      const taskOriginId = extractSubmittedTaskId(submitResult);

      if (!taskOriginId) {
        throw new Error('上游返回中未获取到 taskId，无法继续轮询结果');
      }

      await taskRepository.setOriginTaskId(job.taskId, taskOriginId);
      console.log(`${LOG_PREFIX} [${timestamp}] 已记录上游任务号 taskId=${job.taskId} originTaskId=${taskOriginId}`);

      const result = await waitForTaskResult(job.functionType, taskOriginId);

      // 将临时 URL 持久化到 TOS
      let persistentUrl: string | null = null;
      if (typeof result.tempUrl === 'string') {
        persistentUrl = await chcyaiService.persistResultToTos(result.tempUrl, job.functionType, taskOriginId);
      }

      // 使用持久化 URL（如果成功），否则降级使用临时 URL
      const finalResultUrl = persistentUrl || (typeof result.tempUrl === 'string' ? result.tempUrl : null);

      // 更新状态为 success
      await taskRepository.updateStatus(
        job.taskId,
        'success',
        result as Record<string, unknown>,
        undefined,
        { resultUrl: finalResultUrl }
      );

      // 将生成的图片保存到 materials 表
      try {
        const taskInfo = query('SELECT * FROM tasks WHERE id = ?', [job.taskId]) as Array<Record<string, unknown>>;
        if (taskInfo.length > 0) {
          const task = taskInfo[0];
          const outputData = task.output_data ? JSON.parse(String(task.output_data)) : {};
          const tempUrl = outputData.tempUrl as string | undefined;

          if (tempUrl) {
            // 从 tempUrl 提取文件名（仅用于本地存储引用）
            const localFilename = `generated-${job.taskId}-${Date.now()}.jpg`;

            // 获取图片尺寸（通过创次元 API 查询结果）
            let imageWidth: number | null = null;
            let imageHeight: number | null = null;
            try {
              const queryResult = await chcyaiService.queryResult(job.functionType, taskOriginId) as Record<string, unknown>;
              if (queryResult.width && queryResult.height) {
                imageWidth = queryResult.width as number;
                imageHeight = queryResult.height as number;
              }
            } catch (e) {
              console.warn(`${LOG_PREFIX} [${getBeijingTime()}] 获取生成图片尺寸失败：${e instanceof Error ? e.message : 'Unknown'}`);
            }

            createMaterial({
              userId: task.user_id as number,
              teamId: task.team_id as number,
              fileId: `TASK_${taskOriginId}`, // 标记这是 taskId，不是 fileId
              localFile: localFilename,
              originalName: `${task.function_type as string}-result-${task.task_id_origin || job.taskId}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: 0,
              sourceType: 'generated',
              taskId: job.taskId,
              resultUrl: finalResultUrl, // 存储持久化 URL
              imageWidth,
              imageHeight,
            });

            console.log(`${LOG_PREFIX} [${getBeijingTime()}] 生成图片已保存到素材库 materialId=${task.task_id_origin} size=${imageWidth ? `${imageWidth}x${imageHeight}` : 'N/A'} persistent=${!!persistentUrl}`);
          }
        }
      } catch (materialError) {
        console.warn(`${LOG_PREFIX} [${getBeijingTime()}] 保存生成图片到素材库失败：${materialError instanceof Error ? materialError.message : 'Unknown error'}`);
      }

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
