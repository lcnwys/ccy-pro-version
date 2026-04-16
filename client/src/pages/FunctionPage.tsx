import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ImageUploader } from '@/components/ImageUploader';
import { BatchUploader } from '@/components/BatchUploader';
import { TaskProgress } from '@/components/TaskProgress';
import { TaskTable } from '@/components/TaskTable';
import { TeamSelector } from '@/components/TeamSelector';
import { apiClient } from '@/api';
import type { TaskRecord } from '@/types';
import { getTaskCost, getTaskPriceHint } from '@/utils/pricing';

const FUNCTION_CONFIG: Record<string, {
  name: string;
  description: string;
  fields: FormField[];
  requiresImage: boolean;
}> = {
  'image-generation': {
    name: 'AI 生图',
    description: '根据提示词生成高质量图片',
    requiresImage: false,
    fields: [
      { name: 'prompt', label: '提示词', type: 'textarea', required: true, placeholder: '描述你想要生成的图片...' },
      { name: 'schema', label: '模式', type: 'select', required: false, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: false, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'print-generation': {
    name: '打印图生成',
    description: '生成适用于打印的高清图片',
    requiresImage: true,
    fields: [
      { name: 'dpi', label: 'DPI', type: 'number', required: true, placeholder: '0-1200', min: 0, max: 1200, default: 300 },
      { name: 'imageWidth', label: '图片宽度 (px)', type: 'number', required: true, default: 1024 },
      { name: 'imageHeight', label: '图片高度 (px)', type: 'number', required: true, default: 1024 },
      { name: 'cropX', label: '裁剪左上角 X', type: 'number', required: false, default: 0 },
      { name: 'cropY', label: '裁剪左上角 Y', type: 'number', required: false, default: 0 },
      { name: 'cropW', label: '裁剪宽度', type: 'number', required: false, default: 0 },
      { name: 'cropH', label: '裁剪高度', type: 'number', required: false, default: 0 },
    ],
  },
  'pattern-extraction': {
    name: '印花提取',
    description: '从图片中提取印花图案',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述要提取的印花...' },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
      { name: 'isPatternCompleted', label: '是否补全', type: 'select', required: true, options: [
        { value: 0, label: '不补全' }, { value: 1, label: '补全' }
      ], default: 0 },
    ],
  },
  'fission': {
    name: '图裂变',
    description: '基于原图生成多张相似图片',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述裂变效果...' },
      { name: 'similarity', label: '相似度', type: 'range', required: true, min: 0.01, max: 1, step: 0.01, default: 0.8 },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: true, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'becomes-clear': {
    name: 'AI 变清晰',
    description: '提升图片清晰度和质量',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'primaryId', label: '主体类型', type: 'select', required: false, options: [
        { value: 1, label: '通用' }, { value: 2, label: '人像' }
      ], default: 1 },
    ],
  },
  'clothing-upper': {
    name: '服装上身',
    description: '将服装穿到模特身上',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述上身效果...' },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: true, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'clothing-wrinkle-removal': {
    name: '服装去皱',
    description: '去除服装图片上的褶皱',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述去皱效果...' },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: true, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'cut-out-portrait': {
    name: '扣头像',
    description: '从图片中抠出人像',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    ],
  },
  'clothing-diagram': {
    name: '3D 服装图',
    description: '生成服装 3D 展示图',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述 3D 效果...' },
      { name: 'exampleId', label: '示例 ID', type: 'text', required: false, placeholder: '可选' },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: true, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'garment-extractions': {
    name: '服装提取',
    description: '从图片中提取服装',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述要提取的服装...' },
      { name: 'backgroundId', label: '背景类型', type: 'select', required: true, options: [
        { value: 1, label: '黑色' }, { value: 2, label: '白色' }
      ], default: 1 },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: false, options: [
        { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
        { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
        { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
      ], default: 0 },
      { name: 'resolutionRatioId', label: '分辨率', type: 'select', required: true, options: [
        { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
      ], default: 0 },
    ],
  },
  'intelligent-matting': {
    name: '智能抠图',
    description: 'AI 智能抠图',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'smooth', label: '平滑度', type: 'range', required: false, min: 0, max: 10, step: 1, default: 0 },
    ],
  },
};

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'range';
  required: boolean;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  default?: string | number;
  min?: number;
  max?: number;
  step?: number;
}

export function FunctionPage() {
  const { type } = useParams<{ type: string }>();
  const { user } = useAuth();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [userBalance, setUserBalance] = useState<number>(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyTasks, setHistoryTasks] = useState<TaskRecord[]>([]);

  const config = type ? FUNCTION_CONFIG[type] : null;
  const taskCost = type ? getTaskCost(type, formData) : 0;
  const taskPriceHint = type ? getTaskPriceHint(type) : '';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    // 初始化表单默认值
    if (config) {
      const defaults: Record<string, unknown> = {};
      config.fields.forEach(field => {
        if (field.default !== undefined) {
          defaults[field.name] = field.default;
        }
      });
      setFormData(defaults);
    }
  }, [type]);

  useEffect(() => {
    if (!type || !user) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          functionType: type,
          limit: '8',
          scope: user.role === 'super_admin' ? (selectedTeamId ? 'team' : 'platform') : user.is_team_admin ? 'team' : 'mine',
        });

        if (selectedTeamId) {
          params.append('teamId', String(selectedTeamId));
        }

        const response = await fetch(`${API_BASE}/tasks?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setHistoryTasks(data.data.tasks || []);
        }
      } catch (error) {
        console.error('Failed to fetch function history:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    void fetchHistory();
  }, [API_BASE, selectedTeamId, type, user, batchId]);

  useEffect(() => {
    if (!selectedTeamId || user?.role === 'super_admin' && !selectedTeamId) {
      return;
    }

    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/budget/user/${selectedTeamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setUserBalance(data.data.available || 0);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    void fetchBalance();
  }, [API_BASE, selectedTeamId, user?.role]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const isSuperAdmin = user?.role === 'super_admin';

    // 非超级管理员必须选择团队
    if (!type || (!selectedTeamId && !isSuperAdmin)) return;

    // 检查额度是否充足（超级管理员跳过）
    const requiredBalance = mode === 'batch' ? taskCost * selectedFiles.length : taskCost;
    if (!isSuperAdmin && userBalance < requiredBalance) {
      alert(`额度不足，当前额度 ${userBalance} 积分，需要 ${requiredBalance} 积分，请联系管理员充值`);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'single') {
        if (config?.requiresImage && selectedFiles.length === 0) {
          alert('请至少选择一张图片');
          return;
        }

        let inputData = { ...formData };

        // 如果需要图片，先上传
        if (config?.requiresImage && selectedFiles.length > 0) {
          const uploadRes = await apiClient.uploadFile(selectedFiles[0]);
          inputData.referenceImageId = uploadRes.data.data.fileId;
        }

        const taskRes = await apiClient.createSingleTask(type, inputData, selectedTeamId);
        setBatchId(taskRes.data.data.batchId);
      } else {
        // 批量处理
        if (selectedFiles.length === 0) {
          alert('请选择至少一张图片');
          return;
        }

        const items = await Promise.all(
          selectedFiles.map(async (file) => {
            const uploadRes = await apiClient.uploadFile(file);
            return {
              inputData: {
                ...formData,
                referenceImageId: uploadRes.data.data.fileId,
              }
            };
          })
        );
        const res = await apiClient.createBatchTask(type, items, selectedTeamId);
        setBatchId(res.data.data.batchId);
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-800">功能不存在</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Function Workspace</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">{config.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{config.description}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
            当前页会保留该功能的历史任务和批量批次
          </div>
        </div>
      </section>

      {batchId && <TaskProgress batchId={batchId} />}

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
            {/* Team Selector and Balance */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">团队和额度</h3>
                <div className="text-right text-sm text-gray-500">
                  <div>
                    本次任务消耗：{taskCost} 次元值{mode === 'batch' && selectedFiles.length > 0 ? ` × ${selectedFiles.length} = ${taskCost * selectedFiles.length} 次元值` : ''}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{taskPriceHint}</div>
                </div>
              </div>
              <TeamSelector
                selectedTeamId={selectedTeamId}
                onTeamChange={(teamId) => {
                  setSelectedTeamId(teamId);
                  // Refresh balance logic can be added here
                }}
              />
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                当前可用额度：<span className="font-semibold text-slate-900">{userBalance}</span>
              </div>
            </div>

            {/* Mode Switch */}
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  mode === 'single'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('single')}
              >
                单图处理
              </button>
              <button
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  mode === 'batch'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setMode('batch')}
              >
                批量处理
              </button>
            </div>

            {/* Image Uploader */}
            {config.requiresImage && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">上传图片</h3>
                {mode === 'batch' ? (
                  <BatchUploader onFilesReady={setSelectedFiles} />
                ) : (
                  <ImageUploader onUpload={(file) => setSelectedFiles([file])} />
                )}
              </div>
            )}

            {/* Form Fields */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">参数设置</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {config.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder={field.placeholder}
                        value={(formData[field.name] as string) || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={(formData[field.name] as string | number) || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'range' ? (
                      <div>
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          className="w-full"
                          value={(formData[field.name] as number) || field.default || 0}
                          onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
                        />
                        <div className="text-sm text-gray-500 mt-1">
                          当前值：{(formData[field.name] as number) || field.default || 0}
                        </div>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={field.placeholder}
                        value={(formData[field.name] as string | number) || ''}
                        onChange={(e) => handleFieldChange(field.name, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={submitting || (config.requiresImage && selectedFiles.length === 0)}
              >
                {submitting ? '处理中...' : '开始处理'}
              </button>
            </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">该功能历史任务</h3>
                <p className="mt-1 text-sm text-slate-500">
                  可直接回看该功能的任务提交记录、批次进度和参数摘要。
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                最近 8 条
              </div>
            </div>

            <div className="mt-5">
              {historyLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  正在加载历史任务...
                </div>
              ) : (
                <TaskTable
                  tasks={historyTasks}
                  showUser={user?.role === 'super_admin' || Boolean(user?.is_team_admin)}
                  showTeam={user?.role === 'super_admin' && !selectedTeamId}
                  emptyText="当前功能还没有历史任务"
                />
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
