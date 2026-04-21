import { useEffect, useState } from 'react';
import { apiClient } from '@/api';
import type { BatchProgress, Task } from '@/types';

interface TaskProgressProps {
  batchId: string;
  onComplete?: () => void;
}

export function TaskProgress({ batchId, onComplete }: TaskProgressProps) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await apiClient.getBatchProgress(batchId);
        setProgress(res.data.data);
        setLoading(false);

        // 如果未完成，继续轮询
        if (res.data.data.progress < 100 && res.data.data.status !== 'failed') {
          setTimeout(fetchProgress, 2000);
        } else if (onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
        setLoading(false);
      }
    };

    fetchProgress();
  }, [batchId, onComplete]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">加载进度...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-600">无法获取进度</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="text-green-500 font-bold">✓</span>;
      case 'failed':
        return <span className="text-red-500 font-bold">×</span>;
      case 'processing':
        return <span className="text-blue-500 animate-pulse">…</span>;
      case 'pending':
        return <span className="text-yellow-500">○</span>;
      default:
        return <span className="text-gray-400">?</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      {/* Progress Header */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">处理进度</h3>
        <div className="text-4xl font-bold text-blue-600">{progress.progress}%</div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 progress-bar rounded-full"
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
          <div className="text-xs text-green-700 mt-1">完成</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{progress.processing}</div>
          <div className="text-xs text-blue-700 mt-1">处理中</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{progress.pending}</div>
          <div className="text-xs text-yellow-700 mt-1">等待</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
          <div className="text-xs text-red-700 mt-1">失败</div>
        </div>
      </div>

      {/* Task List */}
      <div className="max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {progress.tasks.map((task: Task) => {
            const rawTask = task as Task & Record<string, unknown>;
            const functionName = String(rawTask.functionType ?? rawTask.function_type ?? '');
            const resultUrl = (rawTask.resultUrl ?? rawTask.result_url ?? null) as string | null;
            const errorMessage = (rawTask.errorMessage ?? rawTask.error_message ?? null) as string | null;

            return (
              <div
                key={task.id}
                className={`flex items-center p-3 rounded-lg border ${
                  task.status === 'success' ? 'bg-green-50 border-green-200' :
                  task.status === 'failed' ? 'bg-red-50 border-red-200' :
                  task.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {getStatusIcon(task.status)}
                </div>
                <div className="flex-1 ml-3">
                  <div className="text-sm font-medium text-gray-800">
                    任务 #{task.id} - {functionName}
                  </div>
                  {resultUrl && (
                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      查看结果
                    </a>
                  )}
                </div>
                {errorMessage && (
                  <div className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                    {errorMessage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
