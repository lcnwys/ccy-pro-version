import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ImageUploader } from '@/components/ImageUploader';
import { BatchUploader } from '@/components/BatchUploader';
import { TaskProgress } from '@/components/TaskProgress';
import { TaskTable } from '@/components/TaskTable';
import { TeamSelector } from '@/components/TeamSelector';
import { MaterialPicker } from '@/components/MaterialPicker';
import { PrintImageCropper } from '@/components/PrintImageCropper';
import { apiClient } from '@/api';
import type { MaterialAsset, TaskRecord } from '@/types';
import { getTaskCost, getTaskPriceHint } from '@/utils/pricing';

const FUNCTION_CONFIG: Record<string, {
  name: string;
  description: string;
  fields: FormField[];
  requiresImage: boolean;
  supportsReferenceImage?: boolean;
}> = {
  'image-generation': {
    name: 'AI 生图',
    description: '根据提示词生成高质量图片（支持参考图）',
    requiresImage: false,
    supportsReferenceImage: true,
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
    ],
  },
  'pattern-extraction': {
    name: '印花提取',
    description: '从图片中提取印花图案',
    requiresImage: true,
    fields: [
      { name: 'schema', label: '模式', type: 'select', required: true, options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
      { name: 'prompt', label: '提示词', type: 'textarea', required: false, placeholder: '描述要提取的印花...' },
      { name: 'aspectRatioId', label: '图片比例', type: 'select', required: true, options: [
        { value: 0, label: '1:1' }
      ], default: 0, hint: '基础版仅支持 1:1' },
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
    requiresImage: false,
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
  hint?: string;
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
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialAsset | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  // AI 生图参考图片支持
  const [referenceMaterial, setReferenceMaterial] = useState<MaterialAsset | null>(null);
  const [referenceMaterialPickerOpen, setReferenceMaterialPickerOpen] = useState(false);
  // 服装上身专用的上装/下装图片选择
  const [selectedTopsMaterial, setSelectedTopsMaterial] = useState<MaterialAsset | null>(null);
  const [selectedBottomsMaterial, setSelectedBottomsMaterial] = useState<MaterialAsset | null>(null);
  const [topsMaterialPickerOpen, setTopsMaterialPickerOpen] = useState(false);
  const [bottomsMaterialPickerOpen, setBottomsMaterialPickerOpen] = useState(false);

  // 打印图裁剪相关状态
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [hasCropped, setHasCropped] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<'free' | 'original' | '1:1' | '4:3' | '3:4' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'>('free');

  const config = type ? FUNCTION_CONFIG[type] : null;
  const taskCost = type ? getTaskCost(type, formData) : 0;
  const taskPriceHint = type ? getTaskPriceHint(type) : '';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
  }, [type, config]);

  // 当选择素材时，自动填充图片尺寸（仅用于 print-generation）
  useEffect(() => {
    if (type === 'print-generation' && selectedMaterial && selectedMaterial.image_width && selectedMaterial.image_height) {
      setFormData(prev => ({
        ...prev,
        imageWidth: selectedMaterial.image_width!,
        imageHeight: selectedMaterial.image_height!,
      }));
    }
  }, [selectedMaterial, type]);

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

  // Auto-refresh polling for history tasks when there are pending/processing tasks
  useEffect(() => {
    if (!type || historyTasks.length === 0) return;

    const hasActiveTasks = historyTasks.some(t => t.status === 'pending' || t.status === 'processing');
    if (!hasActiveTasks) return;

    const fetchUpdatedTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          functionType: type,
          limit: '8',
          scope: user?.role === 'super_admin' ? (selectedTeamId ? 'team' : 'platform') : user?.is_team_admin ? 'team' : 'mine',
        });

        if (selectedTeamId) {
          params.append('teamId', String(selectedTeamId));
        }

        const response = await fetch(`${API_BASE}/tasks?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          const updatedTasks = data.data.tasks || [];
          // Only update if there are actual changes
          setHistoryTasks(prev => {
            const prevIds = new Set(prev.map((t: TaskRecord) => t.id));
            const hasNewTasks = updatedTasks.some((t: TaskRecord) => !prevIds.has(t.id));
            const hasStatusChanges = updatedTasks.some((t: TaskRecord) => {
              const prevTask = prev.find((pt) => pt.id === t.id);
              return prevTask && prevTask.status !== t.status;
            });
            if (hasNewTasks || hasStatusChanges) {
              return updatedTasks;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Failed to fetch updated tasks:', error);
      }
    };

    // Poll every 3 seconds when there are active tasks
    const intervalId = setInterval(fetchUpdatedTasks, 3000);

    // Initial fetch after 1.5 seconds
    const timeoutId = setTimeout(fetchUpdatedTasks, 1500);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [API_BASE, selectedTeamId, type, user, historyTasks.length]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const prependHistoryTasks = async (taskIds: number[]) => {
    try {
      const taskResponses = await Promise.all(taskIds.map((taskId) => apiClient.getTask(taskId)));
      const fetchedTasks = taskResponses
        .map((response) => response.data.data as TaskRecord)
        .filter((task) => task.function_type === type);

      if (fetchedTasks.length === 0) return;

      setHistoryTasks((current) => {
        const next = [...fetchedTasks, ...current];
        const seen = new Set<number>();
        return next.filter((task) => {
          if (seen.has(task.id)) return false;
          seen.add(task.id);
          return true;
        }).slice(0, 8);
      });
    } catch (error) {
      console.error('Failed to prepend history tasks:', error);
    }
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
        // 检查是否选择了素材（支持本地上传或素材库选择）
        if (config?.requiresImage && selectedFiles.length === 0 && !selectedMaterial) {
          alert('请至少选择一张图片');
          return;
        }

        // 服装上身功能需要检查上装或下装至少选择一个
        if (type === 'clothing-upper') {
          if (!selectedTopsMaterial && !selectedBottomsMaterial) {
            alert('请至少选择上装或下装其中一张图片');
            return;
          }
        }

        let inputData = { ...formData };

        // 如果是打印图，添加裁剪区域参数
        if (type === 'print-generation') {
          // 先处理图片
          if (selectedMaterial) {
            // 从素材库选择
            if (selectedMaterial.source_type === 'upload') {
              inputData.referenceImageId = selectedMaterial.file_id;
            } else if (selectedMaterial.result_url) {
              inputData.referenceImageUrl = selectedMaterial.result_url;
            } else {
              inputData.referenceImageUrl = `${API_BASE}/files/download/${selectedMaterial.local_file}`;
            }
            await apiClient.markMaterialUsed(selectedMaterial.id);

            // 使用素材库的图片尺寸
            if (!inputData.imageWidth && selectedMaterial.image_width) {
              inputData.imageWidth = selectedMaterial.image_width;
            }
            if (!inputData.imageHeight && selectedMaterial.image_height) {
              inputData.imageHeight = selectedMaterial.image_height;
            }
          } else if (selectedFiles.length > 0) {
            // 本地上传
            const uploadRes = await apiClient.uploadFile(selectedFiles[0], selectedTeamId);
            inputData.referenceImageId = uploadRes.data.data.fileId;

            // 使用上传返回的图片尺寸
            if (!inputData.imageWidth && uploadRes.data.data.imageWidth) {
              inputData.imageWidth = uploadRes.data.data.imageWidth;
            }
            if (!inputData.imageHeight && uploadRes.data.data.imageHeight) {
              inputData.imageHeight = uploadRes.data.data.imageHeight;
            }
          }
        } else if (type === 'clothing-upper') {
          // 服装上身功能：处理上装和下装图片
          if (selectedTopsMaterial) {
            if (selectedTopsMaterial.source_type === 'upload') {
              inputData.topsReferenceImageId = selectedTopsMaterial.file_id;
            } else if (selectedTopsMaterial.result_url) {
              inputData.topsReferenceImageUrl = selectedTopsMaterial.result_url;
            } else {
              inputData.topsReferenceImageUrl = `${API_BASE}/files/download/${selectedTopsMaterial.local_file}`;
            }
            await apiClient.markMaterialUsed(selectedTopsMaterial.id);
          }
          if (selectedBottomsMaterial) {
            if (selectedBottomsMaterial.source_type === 'upload') {
              inputData.bottomsReferenceImageId = selectedBottomsMaterial.file_id;
            } else if (selectedBottomsMaterial.result_url) {
              inputData.bottomsReferenceImageUrl = selectedBottomsMaterial.result_url;
            } else {
              inputData.bottomsReferenceImageUrl = `${API_BASE}/files/download/${selectedBottomsMaterial.local_file}`;
            }
            await apiClient.markMaterialUsed(selectedBottomsMaterial.id);
          }
        } else if (config?.supportsReferenceImage) {
          // AI 生图等支持参考图片的功能
          if (referenceMaterial) {
            if (referenceMaterial.source_type === 'upload') {
              inputData.referenceImageId = referenceMaterial.file_id;
            } else if (referenceMaterial.result_url) {
              inputData.referenceImageUrl = referenceMaterial.result_url;
            } else {
              inputData.referenceImageUrl = `${API_BASE}/files/download/${referenceMaterial.local_file}`;
            }
            await apiClient.markMaterialUsed(referenceMaterial.id);
          }
        } else {
          // 其他功能
          if (config?.requiresImage) {
            if (selectedMaterial) {
              if (selectedMaterial.source_type === 'upload') {
                inputData.referenceImageId = selectedMaterial.file_id;
              } else if (selectedMaterial.result_url) {
                inputData.referenceImageUrl = selectedMaterial.result_url;
              } else {
                inputData.referenceImageUrl = `${API_BASE}/files/download/${selectedMaterial.local_file}`;
              }
              await apiClient.markMaterialUsed(selectedMaterial.id);
            } else if (selectedFiles.length > 0) {
              const uploadRes = await apiClient.uploadFile(selectedFiles[0], selectedTeamId);
              inputData.referenceImageId = uploadRes.data.data.fileId;
            }
          }
        }

        const taskRes = await apiClient.createSingleTask(type, inputData, selectedTeamId);
        await prependHistoryTasks([taskRes.data.data.taskId]);
        setBatchId(taskRes.data.data.batchId);
      } else {
        // 批量处理
        if (selectedFiles.length === 0) {
          alert('请选择至少一张图片');
          return;
        }

        const items = await Promise.all(
          selectedFiles.map(async (file) => {
            const uploadRes = await apiClient.uploadFile(file, selectedTeamId);
            const itemInputData: Record<string, unknown> = {
              ...formData,
              referenceImageId: uploadRes.data.data.fileId,
            };
            // 印刷图需要添加图片尺寸
            if (type === 'print-generation') {
              if (uploadRes.data.data.imageWidth) {
                itemInputData.imageWidth = uploadRes.data.data.imageWidth;
              }
              if (uploadRes.data.data.imageHeight) {
                itemInputData.imageHeight = uploadRes.data.data.imageHeight;
              }
            }
            return { inputData: itemInputData };
          })
        );
        const res = await apiClient.createBatchTask(type, items, selectedTeamId);
        await prependHistoryTasks(res.data.data.taskIds || []);
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
    <div className="w-full space-y-4 sm:space-y-6">
      <section className="w-full rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur sm:rounded-[32px] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-700">Function Workspace</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">{config.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{config.description}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
            当前页会保留该功能的历史任务和批量批次
          </div>
        </div>
      </section>

      {batchId && <TaskProgress batchId={batchId} />}

      <div className="grid gap-4 lg:grid-cols-[1fr,1fr] xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-4 sm:space-y-6">
            {/* Team Selector and Balance */}
            <div className="w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
                <h3 className="text-base font-semibold text-gray-800 sm:text-lg">团队和额度</h3>
                <div className="text-right text-xs text-gray-500 sm:text-sm">
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
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                当前可用额度：<span className="font-semibold text-slate-900">{userBalance}</span>
              </div>
            </div>

            {/* Mode Switch */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm sm:rounded-2xl sm:p-1">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all sm:px-6 sm:py-2.5 ${
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
                } ${type === 'clothing-upper' ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (type !== 'clothing-upper') {
                    setMode('batch');
                  }
                }}
                disabled={type === 'clothing-upper'}
              >
                批量处理
                {type === 'clothing-upper' && ' (暂不支持)'}
              </button>
            </div>

            {/* Image Uploader */}
            {config.requiresImage && (
              <div className="w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-gray-800 sm:text-lg">素材输入</h3>
                  {mode === 'single' && (
                    <button
                      type="button"
                      onClick={() => setMaterialPickerOpen(true)}
                      className="rounded-xl border border-[#e97b45]/40 px-4 py-2 text-sm font-medium text-[#d96b35] transition hover:bg-[#fff3ed]"
                    >
                      从素材库选择
                    </button>
                  )}
                </div>

                {mode === 'single' && selectedMaterial && (
                  <div className="mb-4 rounded-[18px] border border-[#f0c8b4] bg-[#fff7f3] p-3 sm:rounded-[22px] sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{selectedMaterial.original_name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          素材 ID: {selectedMaterial.file_id}
                          {selectedMaterial.image_width && selectedMaterial.image_height && (
                            <span className="ml-2">尺寸：{selectedMaterial.image_width} × {selectedMaterial.image_height} px</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMaterial(null);
                          setCropArea({ x: 0, y: 0, w: 0, h: 0 });
                          setHasCropped(false);
                        }}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-white"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                )}

                {/* 打印图裁剪按钮 */}
                {type === 'print-generation' && mode === 'single' && (selectedMaterial || selectedFiles.length > 0) && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setHasCropped(false);
                        setCropArea({ x: 0, y: 0, w: 0, h: 0 }); // 重置裁剪框，让组件重新初始化
                        setCropModalOpen(true);
                      }}
                      className="w-full py-3 border-2 border-dashed border-cyan-300 rounded-xl text-cyan-700 font-medium hover:bg-cyan-50 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      裁剪图片区域
                    </button>
                    {hasCropped && cropArea.w > 0 && (
                      <div className="mt-3 text-sm text-cyan-600 text-center">
                        已设置裁剪：X={Math.round(cropArea.x)} Y={Math.round(cropArea.y)} W={Math.round(cropArea.w)} H={Math.round(cropArea.h)}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'batch' ? (
                  <BatchUploader onFilesReady={setSelectedFiles} />
                ) : (
                  <ImageUploader
                    onUpload={(file) => {
                      setSelectedMaterial(null);
                      setSelectedFiles([file]);
                    }}
                  />
                )}
              </div>
            )}

            {/* Form Fields */}
            <div className="w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-3 sm:text-lg sm:mb-4">参数设置</h3>

              {/* AI 生图参考图片选择器 */}
              {type === 'image-generation' && config?.supportsReferenceImage && (
                <div className="mb-4 rounded-xl border border-slate-200 p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    参考图片 <span className="text-xs text-slate-400">(可选)</span>
                  </label>
                  {referenceMaterial ? (
                    <div className="space-y-2">
                      <div className="aspect-square w-32 overflow-hidden rounded-lg bg-slate-100">
                        <img
                          src={referenceMaterial.result_url || `${API_BASE}/files/download/${referenceMaterial.local_file}`}
                          alt="参考图"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setReferenceMaterialPickerOpen(true)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          更换
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReferenceMaterial(null);
                          }}
                          className="flex-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReferenceMaterialPickerOpen(true)}
                      className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      从素材库选择参考图
                    </button>
                  )}
                </div>
              )}

              {/* 服装上身专用的上装/下装图片选择器 */}
              {type === 'clothing-upper' && (
                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* 上装选择 */}
                  <div className="rounded-xl border border-slate-200 p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      上装参考图 <span className="text-red-500">*</span>
                    </label>
                    {selectedTopsMaterial ? (
                      <div className="space-y-2">
                        <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                          <img
                            src={selectedTopsMaterial.result_url || `${API_BASE}/files/download/${selectedTopsMaterial.local_file}`}
                            alt="上装"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setTopsMaterialPickerOpen(true)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            更换
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTopsMaterial(null);
                              handleFieldChange('topsReferenceImageId', '');
                            }}
                            className="flex-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTopsMaterialPickerOpen(true)}
                        className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600"
                      >
                        选择上装图片
                      </button>
                    )}
                  </div>

                  {/* 下装选择 */}
                  <div className="rounded-xl border border-slate-200 p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      下装参考图 <span className="text-red-500">*</span>
                    </label>
                    {selectedBottomsMaterial ? (
                      <div className="space-y-2">
                        <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                          <img
                            src={selectedBottomsMaterial.result_url || `${API_BASE}/files/download/${selectedBottomsMaterial.local_file}`}
                            alt="下装"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setBottomsMaterialPickerOpen(true)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            更换
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBottomsMaterial(null);
                              handleFieldChange('bottomsReferenceImageId', '');
                            }}
                            className="flex-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBottomsMaterialPickerOpen(true)}
                        className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600"
                      >
                        选择下装图片
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
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
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:px-8 sm:py-3"
                onClick={handleSubmit}
                disabled={submitting || (config.requiresImage && mode === 'batch' && selectedFiles.length === 0) || (config.requiresImage && mode === 'single' && selectedFiles.length === 0 && !selectedMaterial) || (type === 'clothing-upper' && mode === 'single' && !selectedTopsMaterial && !selectedBottomsMaterial)}
              >
                {submitting ? '处理中...' : '开始处理'}
              </button>
            </div>
        </div>

        <aside className="space-y-4 sm:space-y-6">
          <section className="w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">该功能历史任务</h3>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  可直接回看该功能的任务提交记录、批次进度和参数摘要。
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                最近 8 条
              </div>
            </div>

            <div className="mt-5">
              {historyLoading ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-500 sm:rounded-2xl sm:px-4 sm:py-10 sm:text-sm">
                  正在加载历史任务...
                </div>
              ) : (
                <TaskTable
                  tasks={historyTasks}
                  showUser={user?.role === 'super_admin' || Boolean(user?.is_team_admin)}
                  emptyText="当前功能还没有历史任务"
                  apiBase={API_BASE}
                />
              )}
            </div>
          </section>
        </aside>
      </div>

      <MaterialPicker
        isOpen={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        teamId={selectedTeamId}
        onConfirm={(material) => {
          setSelectedMaterial(material);
          setSelectedFiles([]);
          setCropArea({ x: 0, y: 0, w: 0, h: 0 });
          setHasCropped(false);
          setCropAspectRatio('free');
          setMaterialPickerOpen(false);
        }}
      />

      {/* 上装选择器 */}
      <MaterialPicker
        isOpen={topsMaterialPickerOpen}
        onClose={() => setTopsMaterialPickerOpen(false)}
        teamId={selectedTeamId}
        onConfirm={(material) => {
          setSelectedTopsMaterial(material);
          handleFieldChange('topsReferenceImageId', material.file_id);
          setTopsMaterialPickerOpen(false);
        }}
      />

      {/* 下装选择器 */}
      <MaterialPicker
        isOpen={bottomsMaterialPickerOpen}
        onClose={() => setBottomsMaterialPickerOpen(false)}
        teamId={selectedTeamId}
        onConfirm={(material) => {
          setSelectedBottomsMaterial(material);
          handleFieldChange('bottomsReferenceImageId', material.file_id);
          setBottomsMaterialPickerOpen(false);
        }}
      />

      {/* 参考图片选择器 (AI 生图) */}
      <MaterialPicker
        isOpen={referenceMaterialPickerOpen}
        onClose={() => setReferenceMaterialPickerOpen(false)}
        teamId={selectedTeamId}
        onConfirm={(material) => {
          setReferenceMaterial(material);
          setReferenceMaterialPickerOpen(false);
        }}
      />

      {/* 裁剪弹窗 */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-sm font-medium tracking-[0.2em] text-cyan-700">CROP TOOL</div>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">裁剪图片区域</h3>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={cropAspectRatio}
                  onChange={(e) => setCropAspectRatio(e.target.value as typeof cropAspectRatio)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="free">自由裁剪</option>
                  <option value="original">原比例</option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                  <option value="4:5">4:5</option>
                  <option value="5:4">5:4</option>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                  <option value="21:9">21:9</option>
                </select>
                <button
                  type="button"
                  onClick={() => setCropModalOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-100 p-6">
              <PrintImageCropper
                onImageSelect={(image) => {
                  // 初始化表单的宽高字段
                  if (image.width && image.height) {
                    setFormData(prev => ({
                      ...prev,
                      imageWidth: image.width,
                      imageHeight: image.height,
                    }));
                  }
                }}
                onCropChange={(crop) => {
                  setCropArea(crop);
                }}
                existingImageUrl={
                  selectedMaterial
                    ? (selectedMaterial.result_url || `${API_BASE}/files/download/${selectedMaterial.local_file}`)
                    : (selectedFiles.length > 0 ? URL.createObjectURL(selectedFiles[0]) : '')
                }
                aspectRatio={cropAspectRatio}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setCropArea({ x: 0, y: 0, w: 0, h: 0 });
                  setHasCropped(false);
                  setCropAspectRatio('free');
                  setCropModalOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                取消裁剪
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasCropped(true); // 标记用户已进行裁剪
                  setCropModalOpen(false);
                }}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700"
              >
                确认裁剪
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
