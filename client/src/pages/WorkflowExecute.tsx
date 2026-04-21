import { useState } from 'react';
import { apiClient } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { ResourcePicker, type SelectedResource } from '@/components/ResourcePicker';
import { WorkflowRunTracker } from '@/components/WorkflowRunTracker';
import type { WorkflowRecord, WorkflowRunRecord } from '@/types';

interface WorkflowExecuteProps {
  workflow: WorkflowRecord;
  onBack: () => void;
}

export function WorkflowExecute({ workflow, onBack }: WorkflowExecuteProps) {
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResourcesSelected = (resources: SelectedResource[]) => {
    setSelectedResources(resources);
    setShowResourcePicker(false);
  };

  const buildItems = (): Array<Record<string, unknown>> => {
    return selectedResources.map((resource) => ({
      fileId: resource.fileId,
      fileName: resource.fileName,
      referenceImageId: resource.fileId,
    }));
  };

  const handleExecute = async () => {
    setSubmitting(true);
    setNotice(null);

    try {
      const items = buildItems();

      const response = await apiClient.runWorkflow(workflow.id, {
        items,
        concurrency,
        teamId: user?.team_id || undefined,
        dryRun,
      });

      const run = response.data.data as { id: number };
      setRunId(run.id);
      setExecuting(true);
      setNotice({ type: 'success', message: dryRun ? '调试任务已创建（未消耗额度）' : '工作流任务已提交' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      setNotice({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecutionComplete = () => {
    setExecuting(false);
  };

  const getStepEstimate = () => {
    return workflow.steps.length;
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* 执行中的追踪器 */}
      {executing && runId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="h-[90vh] w-full max-w-5xl overflow-auto rounded-[32px] border border-white/10 bg-[#151515] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium tracking-[0.2em] text-[#e97b45]">执行中</div>
                <h3 className="text-xl font-semibold text-white">{workflow.name}</h3>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
              >
                关闭
              </button>
            </div>
            <WorkflowRunTracker runId={runId} onComplete={handleExecutionComplete} onClose={onBack} />
          </div>
        </div>
      )}

      {/* 资源选择器 */}
      <ResourcePicker
        isOpen={showResourcePicker}
        onClose={() => setShowResourcePicker(false)}
        onConfirm={handleResourcesSelected}
        teamId={user?.team_id || undefined}
        mode="batch"
      />

      {/* 头部 */}
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[#050816] text-white shadow-2xl">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/5"
              >
                ← 返回
              </button>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-orange-300">执行工作流</div>
                <h2 className="mt-1 text-2xl font-semibold">{workflow.name}</h2>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-400">
                步骤：<span className="text-white">{workflow.steps.length}</span> | 预估消耗：
                <span className="text-[#e97b45]">{getStepEstimate()} 次元值/项</span>
              </div>
            </div>
          </div>
        </div>

        {/* 步骤指示器 */}
        <div className="border-b border-white/5 bg-[#1f1f1f] px-6 py-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                step >= 1 ? 'bg-[#e97b45] text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              1
            </div>
            <div className="flex-1 text-sm">
              <div className="font-medium text-white">选择素材</div>
              <div className="text-xs text-slate-400">上传或从素材库选择图片</div>
            </div>
            <div className="h-px w-16 bg-slate-700" />
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                step >= 2 ? 'bg-[#e97b45] text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              2
            </div>
            <div className="flex-1 text-sm">
              <div className="font-medium text-white">确认执行</div>
              <div className="text-xs text-slate-400">检查设置并开始执行</div>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-medium text-white">选择输入素材</h3>
                <p className="mt-2 text-sm text-slate-400">
                  支持批量上传图片或从素材库选择，每张图片将独立执行完整的工作流。
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setShowResourcePicker(true)}
                    className="rounded-2xl border border-dashed border-[#e97b45]/60 bg-[#e97b45]/5 px-6 py-12 text-sm font-medium text-[#e97b45] transition hover:border-[#e97b45] hover:bg-[#e97b45]/10"
                  >
                    {selectedResources.length > 0
                      ? `已选择 ${selectedResources.length} 张图片，点击修改`
                      : '点击选择图片 / 拖拽上传'}
                  </button>
                </div>

                {selectedResources.length > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-4 lg:grid-cols-6">
                    {selectedResources.map((resource) => (
                      <div
                        key={resource.id}
                        className="overflow-hidden rounded-xl border border-white/10 bg-[#111]"
                      >
                        <div className="aspect-square">
                          <img
                            src={resource.previewUrl}
                            alt={resource.fileName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-2">
                          <div className="truncate text-xs text-slate-300">{resource.fileName}</div>
                          <div className="mt-1 text-[10px] text-slate-500">{resource.fileId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={selectedResources.length === 0}
                  onClick={() => setStep(2)}
                  className="rounded-2xl bg-[#e97b45] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#f08f61] disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  下一步：确认执行
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-medium text-white">确认执行设置</h3>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-white/10 bg-[#111] p-4">
                    <div className="text-sm font-medium text-slate-300">输入素材</div>
                    <div className="mt-3 flex gap-2">
                      {selectedResources.slice(0, 10).map((resource) => (
                        <div key={resource.id} className="h-16 w-16 overflow-hidden rounded-lg bg-[#000]">
                          <img
                            src={resource.previewUrl}
                            alt={resource.fileName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                      {selectedResources.length > 10 && (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-700 text-sm text-slate-300">
                          +{selectedResources.length - 10}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">共 {selectedResources.length} 张图片</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#111] p-4">
                    <div className="text-sm font-medium text-slate-300">工作流步骤</div>
                    <div className="mt-3 space-y-2">
                      {workflow.steps.map((step, index) => (
                        <div key={step.key} className="flex items-center justify-between rounded-lg bg-[#1a1a1a] px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e97b45]/20 text-xs font-medium text-[#e97b45]">
                              {index + 1}
                            </div>
                            <span className="text-sm text-white">{step.name}</span>
                          </div>
                          <div className="text-xs text-slate-500">{step.functionType}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-[#111] p-4">
                      <label className="text-sm font-medium text-slate-300">并发数</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={concurrency}
                        onChange={(e) => setConcurrency(Number(e.target.value) || 1)}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#e97b45] focus:outline-none"
                      />
                      <div className="mt-1 text-xs text-slate-500">同时处理的图片数量</div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#111] p-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dryRun}
                          onChange={(e) => setDryRun(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-[#e97b45] focus:ring-[#e97b45] focus:ring-offset-0"
                        />
                        <span className="text-sm font-medium text-slate-300">调试模式</span>
                      </label>
                      <div className="mt-2 text-xs text-slate-500">
                        开启后不消耗额度，生成模拟结果
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-2xl border border-white/10 px-6 py-3 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  上一步
                </button>
                <button
                  type="button"
                  disabled={submitting || executing}
                  onClick={handleExecute}
                  className="rounded-2xl bg-[#e97b45] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#f08f61] disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  {submitting ? '提交中...' : executing ? '执行中...' : '开始执行'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
