import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiClient } from '@/api';
import { TaskTable } from '@/components/TaskTable';
import { useAuth } from '@/contexts/AuthContext';
import { getTaskCost, getTaskPriceHint } from '@/utils/pricing';
import type { TaskRecord, WorkflowRecord, WorkflowRunRecord, WorkflowStep } from '@/types';

type FieldType = 'text' | 'number' | 'select' | 'textarea';

interface StepFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

interface StepPreset {
  label: string;
  tone: string;
  hint: string;
  fields: StepFieldConfig[];
}

interface StepCard {
  key: string;
  name: string;
  functionType: string;
  sourceMode: 'item' | 'prev';
  config: Record<string, string>;
  advancedOpen: boolean;
  advancedJson: string;
}

interface FocusedField {
  stepIndex: number;
  fieldKey: string;
  target: 'config' | 'advanced';
}

interface WorkflowCanvasNodeData extends Record<string, unknown> {
  title: string;
  subtitle: string;
  hint: string;
  cost: number;
  active: boolean;
}

const DEFAULT_RUN_ITEMS = `[
  {
    "referenceImageId": "你的上游 generateImageId 或 fileId"
  }
]`;

const STEP_PRESETS: Record<string, StepPreset> = {
  'pattern-extraction': {
    label: '印花提取',
    tone: 'from-amber-100 via-orange-50 to-white',
    hint: '适合作为清洗入口，把原始图先提成后续可复用素材。',
    fields: [
      { key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] },
      { key: 'resolutionRatioId', label: '清晰度', type: 'select', options: [{ value: '0', label: '1K' }, { value: '1', label: '2K' }, { value: '2', label: '4K' }] },
      { key: 'isPatternCompleted', label: '是否补全', type: 'select', options: [{ value: '0', label: '不补全' }, { value: '1', label: '补全' }] },
      { key: 'prompt', label: '补充提示', type: 'textarea', placeholder: '可选' },
    ],
  },
  fission: {
    label: '印花裂变',
    tone: 'from-cyan-100 via-sky-50 to-white',
    hint: '典型第二步。直接吃上一步的 generateImageId，做低成本批量裂变。',
    fields: [
      { key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] },
      { key: 'similarity', label: '相似度', type: 'number', placeholder: '0.8' },
      { key: 'resolutionRatioId', label: '清晰度', type: 'select', options: [{ value: '0', label: '1K' }, { value: '1', label: '2K' }, { value: '2', label: '4K' }] },
      { key: 'aspectRatioId', label: '画幅', type: 'select', options: [{ value: '0', label: '1:1' }, { value: '1', label: '4:3' }, { value: '2', label: '3:4' }, { value: '3', label: '4:5' }] },
      { key: 'prompt', label: '风格提示', type: 'textarea', placeholder: '可选' },
    ],
  },
  'cut-out-portrait': {
    label: '抠头像',
    tone: 'from-rose-100 via-pink-50 to-white',
    hint: '适合做低风险烟测，也适合作为人物资产清洗步骤。',
    fields: [{ key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] }],
  },
  'intelligent-matting': {
    label: '智能抠图',
    tone: 'from-emerald-100 via-green-50 to-white',
    hint: '适合做边缘处理与素材抠图。',
    fields: [
      { key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] },
      { key: 'smooth', label: '平滑度', type: 'number', placeholder: '0' },
    ],
  },
  'becomes-clear': {
    label: 'AI 变清晰',
    tone: 'from-violet-100 via-fuchsia-50 to-white',
    hint: '适合在生成前做素材增强。',
    fields: [
      { key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] },
      { key: 'primaryId', label: '主体', type: 'select', options: [{ value: '1', label: '通用' }, { value: '2', label: '人像' }] },
    ],
  },
  'print-generation': {
    label: '印刷图',
    tone: 'from-slate-200 via-slate-50 to-white',
    hint: '单价最低，适合用来做低成本工作流测试。',
    fields: [
      { key: 'dpi', label: 'DPI', type: 'number', placeholder: '300' },
      { key: 'imageWidth', label: '宽度', type: 'number', placeholder: '1024' },
      { key: 'imageHeight', label: '高度', type: 'number', placeholder: '1024' },
    ],
  },
  'image-generation': {
    label: 'AI 生图',
    tone: 'from-indigo-100 via-blue-50 to-white',
    hint: '成本更高，建议放在链路后段。',
    fields: [
      { key: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高级' }] },
      { key: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述你要生成的图' },
      { key: 'resolutionRatioId', label: '清晰度', type: 'select', options: [{ value: '0', label: '1K' }, { value: '1', label: '2K' }, { value: '2', label: '4K' }] },
      { key: 'aspectRatioId', label: '画幅', type: 'select', options: [{ value: '0', label: '1:1' }, { value: '1', label: '4:3' }, { value: '2', label: '3:4' }, { value: '3', label: '4:5' }] },
    ],
  },
};

const FUNCTION_OPTIONS = Object.entries(STEP_PRESETS).map(([value, preset]) => ({ value, label: preset.label }));

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  running: 'bg-sky-100 text-sky-900',
  partial_success: 'bg-violet-100 text-violet-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
};

const VARIABLE_TOKENS = [
  { label: '批量输入图 ID', value: '{{item.referenceImageId}}', hint: '首步常用' },
  { label: '上一图输出 ID', value: '{{prev.generateImageId}}', hint: '串联后续步骤' },
  { label: '当前批次号', value: '{{run.batchId}}', hint: '用于命名或追踪' },
];

const parseJson = <T,>(value: string, fallback: T) => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getDefaultConfig = (functionType: string): Record<string, string> => {
  switch (functionType) {
    case 'pattern-extraction':
      return { schema: 'basic', resolutionRatioId: '0', isPatternCompleted: '0', prompt: '' };
    case 'fission':
      return { schema: 'basic', similarity: '0.8', resolutionRatioId: '0', aspectRatioId: '0', prompt: '' };
    case 'cut-out-portrait':
      return { schema: 'basic' };
    case 'intelligent-matting':
      return { schema: 'basic', smooth: '0' };
    case 'becomes-clear':
      return { schema: 'basic', primaryId: '1' };
    case 'print-generation':
      return { dpi: '300', imageWidth: '1024', imageHeight: '1024' };
    case 'image-generation':
      return { schema: 'basic', prompt: '', resolutionRatioId: '0', aspectRatioId: '0' };
    default:
      return {};
  }
};

const createStepCard = (index: number, functionType = 'pattern-extraction'): StepCard => ({
  key: `step_${index + 1}`,
  name: STEP_PRESETS[functionType]?.label || `步骤 ${index + 1}`,
  functionType,
  sourceMode: index === 0 ? 'item' : 'prev',
  config: getDefaultConfig(functionType),
  advancedOpen: false,
  advancedJson: JSON.stringify({}, null, 2),
});

const normalizeValue = (value: string) => {
  if (value === '') return undefined;
  if (!Number.isNaN(Number(value)) && value.trim() !== '') return Number(value);
  return value;
};

const buildTemplateFromCard = (step: StepCard) => {
  const baseReference = step.sourceMode === 'item'
    ? { referenceImageId: '{{item.referenceImageId}}' }
    : { referenceImageId: '{{prev.generateImageId}}' };

  const fields = Object.fromEntries(
    Object.entries(step.config)
      .map(([key, value]) => [key, normalizeValue(value)])
      .filter(([, value]) => value !== undefined)
  );

  return {
    ...baseReference,
    ...fields,
    ...parseJson<Record<string, unknown>>(step.advancedJson, {}),
  };
};

function WorkflowCanvasNode({ data }: NodeProps<Node<WorkflowCanvasNodeData>>) {
  return (
    <div className={`min-w-[240px] rounded-[24px] border px-4 py-4 shadow-lg transition ${data.active ? 'border-cyan-500 bg-slate-950 text-white' : 'border-slate-700 bg-[#171717] text-slate-100'}`}>
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-cyan-300 !bg-cyan-500" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{data.subtitle}</div>
          <div className="mt-2 text-base font-semibold">{data.title}</div>
          <div className="mt-2 text-xs leading-5 text-slate-400">{data.hint}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${data.active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-300'}`}>
          {data.cost}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{data.active ? '当前选中' : '点击配置'}</span>
        <span>configure</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-cyan-300 !bg-cyan-500" />
    </div>
  );
}

const nodeTypes = {
  workflowNode: WorkflowCanvasNode,
};

export function Workflows() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageWorkflows = user?.role === 'super_admin' || Boolean(user?.is_team_admin);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<number | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | ''>(() => {
    const value = searchParams.get('workflowId');
    return value ? Number(value) : '';
  });
  const [name, setName] = useState('低成本批处理链路');
  const [description, setDescription] = useState('先做低成本清洗，再做后续可复用的 generateImageId 裂变链路。');
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>(() => user?.role === 'super_admin' ? '' : user?.team_id ?? '');
  const [runTeamId, setRunTeamId] = useState<number | ''>(() => user?.role === 'super_admin' ? '' : user?.team_id ?? '');
  const [concurrency, setConcurrency] = useState(2);
  const [runItemsText, setRunItemsText] = useState(DEFAULT_RUN_ITEMS);
  const [error, setError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<number | null>(() => {
    const value = searchParams.get('runId');
    return value ? Number(value) : null;
  });
  const [selectedRunTasks, setSelectedRunTasks] = useState<TaskRecord[]>([]);
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [steps, setSteps] = useState<StepCard[]>([
    createStepCard(0, 'pattern-extraction'),
    createStepCard(1, 'fission'),
  ]);

  const teamOptions = useMemo(() => user?.teams || [], [user?.teams]);
  const selectedWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === selectedWorkflowId), [selectedWorkflowId, workflows]);
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) || null, [runs, selectedRunId]);
  const selectedStep = steps[selectedStepIndex] || null;
  const parsedRunResults = useMemo(() => parseJson<Array<Record<string, unknown>>>(selectedRun?.results_json || '[]', []), [selectedRun?.results_json]);
  const estimatedStepCosts = useMemo(() => steps.map((step) => getTaskCost(step.functionType, buildTemplateFromCard(step))), [steps]);
  const estimatedWorkflowCost = estimatedStepCosts.reduce((sum, cost) => sum + cost, 0);
  const flowNodes = useMemo<Node<WorkflowCanvasNodeData>[]>(() => (
    steps.map((step, index) => ({
      id: step.key || `step-${index + 1}`,
      type: 'workflowNode',
      position: { x: 120 + index * 320, y: 120 + (index % 2) * 40 },
      draggable: true,
      data: {
        title: step.name,
        subtitle: STEP_PRESETS[step.functionType]?.label || step.functionType,
        hint: step.sourceMode === 'item' ? '输入来自批量 item' : '输入来自上一节点输出',
        cost: estimatedStepCosts[index] || 0,
        active: selectedStepIndex === index,
      },
    }))
  ), [estimatedStepCosts, selectedStepIndex, steps]);
  const flowEdges = useMemo<Edge[]>(() => (
    steps.slice(0, -1).map((step, index) => ({
      id: `edge-${step.key}-${steps[index + 1]?.key}`,
      source: step.key || `step-${index + 1}`,
      target: steps[index + 1]?.key || `step-${index + 2}`,
      type: 'smoothstep',
      animated: true,
      label: index === 0 ? 'item -> node' : 'prev.generateImageId',
      style: { stroke: '#fb923c', strokeWidth: 2 },
      labelStyle: { fill: '#cbd5e1', fontSize: 12 },
    }))
  ), [steps]);

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedWorkflowId !== '') params.set('workflowId', String(selectedWorkflowId));
    if (selectedRunId) params.set('runId', String(selectedRunId));
    setSearchParams(params, { replace: true });
  }, [selectedWorkflowId, selectedRunId, setSearchParams]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRunTasks([]);
      return;
    }

    void fetchRunTasks(selectedRunId);
  }, [selectedRunId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [workflowRes, runRes] = await Promise.all([
        apiClient.getWorkflows(),
        apiClient.getWorkflowRuns(),
      ]);

      const workflowList = workflowRes.data.data as WorkflowRecord[];
      const runList = runRes.data.data as WorkflowRunRecord[];
      setWorkflows(workflowList);
      setRuns(runList);

      if (!selectedWorkflowId && workflowList.length > 0) {
        setSelectedWorkflowId(workflowList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载工作流失败');
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (index: number, updater: (step: StepCard) => StepCard) => {
    setSteps((current) => current.map((step, currentIndex) => currentIndex === index ? updater(step) : step));
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= steps.length) return;

    setSteps((current) => {
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setSelectedStepIndex(toIndex);
  };

  const insertVariableToken = (token: string) => {
    if (!focusedField) return;

    if (focusedField.target === 'advanced') {
      updateStep(focusedField.stepIndex, (current) => ({
        ...current,
        advancedJson: `${current.advancedJson}${current.advancedJson.endsWith('\n') ? '' : '\n'}${token}`,
      }));
      return;
    }

    updateStep(focusedField.stepIndex, (current) => ({
      ...current,
      config: {
        ...current.config,
        [focusedField.fieldKey]: `${current.config[focusedField.fieldKey] || ''}${token}`,
      },
    }));
  };

  const handleCreateWorkflow = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payloadSteps: WorkflowStep[] = steps.map((step, index) => ({
        key: step.key || `step_${index + 1}`,
        name: step.name || STEP_PRESETS[step.functionType]?.label || `步骤 ${index + 1}`,
        functionType: step.functionType,
        inputTemplate: buildTemplateFromCard(step),
      }));

      const response = await apiClient.createWorkflow({
        name,
        description,
        teamId: selectedTeamId === '' ? undefined : selectedTeamId,
        steps: payloadSteps,
      });

      const workflow = response.data.data as WorkflowRecord;
      setSelectedWorkflowId(workflow.id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建工作流失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!selectedWorkflowId) {
      setError('请先选择一个工作流');
      return;
    }

    setRunningWorkflowId(selectedWorkflowId);
    setError('');

    try {
      const items = parseJson<Array<Record<string, unknown>>>(runItemsText, []);
      await apiClient.runWorkflow(selectedWorkflowId, {
        items,
        concurrency,
        teamId: runTeamId === '' ? undefined : runTeamId,
      });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行工作流失败');
    } finally {
      setRunningWorkflowId(null);
    }
  };

  const fetchRunTasks = async (runId: number) => {
    setSelectedRunLoading(true);
    try {
      const response = await apiClient.getTasks({
        workflowRunId: runId,
        scope: user?.role === 'super_admin' ? 'platform' : user?.is_team_admin ? 'team' : 'mine',
        teamId: user?.role === 'super_admin' ? undefined : user?.team_id || undefined,
        limit: 100,
        page: 1,
      });

      setSelectedRunTasks(response.data.data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch workflow run tasks:', err);
      setSelectedRunTasks([]);
    } finally {
      setSelectedRunLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">Workflow Studio</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">低代码工作流画布</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              这一版把工作流从“手写 JSON”改成了卡片式步骤流。每一步都是独立配置卡，像 `n8n / dify` 那样顺着链路排开，
              先做低代码体验，再继续往可视化拖拽推进。
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <div>单条链路预估消耗：{estimatedWorkflowCost} 次元值 / item</div>
            <div className="mt-2">建议烟测优先用 `印刷图 / 抠头像 / 裂变` 这类低风险能力。</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-5 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">工作流卡片编辑器</h3>
              <p className="mt-1 text-sm text-slate-500">每一步是独立卡片，配置来源、参数、成本提示，再保存为正式 workflow。</p>
            </div>
            {canManageWorkflows && (
              <button
                onClick={() => setSteps((current) => {
                  const next = [...current, createStepCard(current.length, 'fission')];
                  setSelectedStepIndex(next.length - 1);
                  return next;
                })}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                新增卡片
              </button>
            )}
          </div>

          {!canManageWorkflows && (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              当前账号可以执行和查看工作流，但只有团队管理员或超级管理员可以创建新工作流。
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">工作流名称</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">归属团队</label>
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value ? Number(event.target.value) : '')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {user?.role === 'super_admin' && <option value="">平台模式</option>}
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">工作流描述</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            />
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-[#111315] p-5 text-white shadow-inner">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">画布区</div>
                <div className="mt-1 text-xs text-slate-400">自由拖动画布视角，点击节点后在右侧配置。主视图不再展开全部参数。</div>
              </div>
              <div className="text-xs text-slate-400">XYFlow Canvas</div>
            </div>
            <div className="h-[620px] overflow-hidden rounded-[22px] border border-slate-800 bg-[#0b0d10]">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  fitView
                  nodesDraggable={canManageWorkflows}
                  nodesConnectable={false}
                  elementsSelectable
                  onNodeClick={(_event, node) => {
                    const nodeIndex = steps.findIndex((step, index) => (step.key || `step-${index + 1}`) === node.id);
                    if (nodeIndex >= 0) setSelectedStepIndex(nodeIndex);
                  }}
                  onNodeDragStop={(_event, node) => {
                    const sorted = [...flowNodes]
                      .map((currentNode, index) => ({ id: currentNode.id, x: currentNode.id === node.id ? node.position.x : currentNode.position.x, index }))
                      .sort((a, b) => a.x - b.x);
                    const currentIndex = steps.findIndex((step, index) => (step.key || `step-${index + 1}`) === node.id);
                    const nextIndex = sorted.findIndex((item) => item.id === node.id);
                    if (currentIndex >= 0 && nextIndex >= 0) {
                      moveStep(currentIndex, nextIndex);
                    }
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <MiniMap pannable zoomable nodeColor={(node) => (node.data?.active ? '#06b6d4' : '#334155')} maskColor="rgba(15,23,42,0.35)" />
                  <Controls position="bottom-left" />
                  <Background gap={24} size={1} color="#2f3640" />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </div>

          {canManageWorkflows && (
            <button
              onClick={handleCreateWorkflow}
              disabled={submitting}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '正在保存卡片流...' : '保存工作流'}
            </button>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">参数配置面板</h3>
                <p className="mt-1 text-sm text-slate-500">主画布只看卡片，这里负责细节配置。</p>
              </div>
              {selectedStep && (
                <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                  Step {selectedStepIndex + 1}
                </div>
              )}
            </div>

            {selectedStep && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">卡片名称</label>
                    <input
                      value={selectedStep.name}
                      onChange={(event) => updateStep(selectedStepIndex, (current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">卡片 Key</label>
                    <input
                      value={selectedStep.key}
                      onChange={(event) => updateStep(selectedStepIndex, (current) => ({ ...current, key: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">功能</label>
                    <select
                      value={selectedStep.functionType}
                      onChange={(event) => updateStep(selectedStepIndex, (current) => ({
                        ...current,
                        functionType: event.target.value,
                        name: STEP_PRESETS[event.target.value]?.label || current.name,
                        config: getDefaultConfig(event.target.value),
                      }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {FUNCTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">输入来源</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updateStep(selectedStepIndex, (current) => ({ ...current, sourceMode: 'item' }))}
                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${selectedStep.sourceMode === 'item' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}
                      >
                        批量输入 item
                      </button>
                      <button
                        onClick={() => updateStep(selectedStepIndex, (current) => ({ ...current, sourceMode: 'prev' }))}
                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${selectedStep.sourceMode === 'prev' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}
                      >
                        上一步输出 prev
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">变量插入器</div>
                  <div className="mt-2 text-sm text-slate-600">先点中下面某个文本字段，再点变量，把 token 插进去。</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {VARIABLE_TOKENS.map((token) => (
                      <button
                        key={token.value}
                        onClick={() => insertVariableToken(token.value)}
                        className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left transition hover:bg-cyan-50"
                      >
                        <div className="text-sm font-semibold text-slate-900">{token.label}</div>
                        <div className="mt-1 font-mono text-xs text-cyan-700">{token.value}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {STEP_PRESETS[selectedStep.functionType].fields.map((field) => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{field.label}</label>
                      {field.type === 'select' ? (
                        <select
                          value={selectedStep.config[field.key] || ''}
                          onChange={(event) => updateStep(selectedStepIndex, (current) => ({
                            ...current,
                            config: { ...current.config, [field.key]: event.target.value },
                          }))}
                          onFocus={() => setFocusedField({ stepIndex: selectedStepIndex, fieldKey: field.key, target: 'config' })}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          value={selectedStep.config[field.key] || ''}
                          onChange={(event) => updateStep(selectedStepIndex, (current) => ({
                            ...current,
                            config: { ...current.config, [field.key]: event.target.value },
                          }))}
                          onFocus={() => setFocusedField({ stepIndex: selectedStepIndex, fieldKey: field.key, target: 'config' })}
                          rows={3}
                          placeholder={field.placeholder}
                          className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={selectedStep.config[field.key] || ''}
                          onChange={(event) => updateStep(selectedStepIndex, (current) => ({
                            ...current,
                            config: { ...current.config, [field.key]: event.target.value },
                          }))}
                          onFocus={() => setFocusedField({ stepIndex: selectedStepIndex, fieldKey: field.key, target: 'config' })}
                          placeholder={field.placeholder}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">成本提示</div>
                      <div className="mt-1 text-xs text-slate-500">{getTaskPriceHint(selectedStep.functionType)}</div>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                      预估 {estimatedStepCosts[selectedStepIndex] || 0}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">高级补丁</div>
                      <div className="mt-1 text-xs text-slate-500">这里只保留少量兜底字段，不再占据主画布空间。</div>
                    </div>
                    <button
                      onClick={() => updateStep(selectedStepIndex, (current) => ({ ...current, advancedOpen: !current.advancedOpen }))}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {selectedStep.advancedOpen ? '收起' : '展开'}
                    </button>
                  </div>
                  {selectedStep.advancedOpen && (
                    <textarea
                      value={selectedStep.advancedJson}
                      onChange={(event) => updateStep(selectedStepIndex, (current) => ({ ...current, advancedJson: event.target.value }))}
                      onFocus={() => setFocusedField({ stepIndex: selectedStepIndex, fieldKey: 'advancedJson', target: 'advanced' })}
                      rows={6}
                      className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-900/95 px-4 py-3 font-mono text-xs text-slate-100"
                    />
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">执行工作流</h3>
                <p className="mt-1 text-sm text-slate-500">批量输入建议直接贴 JSON 数组。每个 item 会按步骤串行执行，不同 item 按并发数并行。</p>
              </div>
              <Link to="/tasks" className="text-sm font-semibold text-cyan-700">
                去任务中心
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">选择工作流</label>
                <select
                  value={selectedWorkflowId}
                  onChange={(event) => setSelectedWorkflowId(event.target.value ? Number(event.target.value) : '')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <option value="">请选择</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">执行团队</label>
                <select
                  value={runTeamId}
                  onChange={(event) => setRunTeamId(event.target.value ? Number(event.target.value) : '')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {user?.role === 'super_admin' && <option value="">沿用工作流归属</option>}
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedWorkflow && (
              <div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50/70 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">{selectedWorkflow.name}</div>
                <div className="mt-1 text-slate-600">{selectedWorkflow.description || '无描述'}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedWorkflow.steps.map((step) => (
                    <span key={step.key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-cyan-700">
                      {step.name} · {step.functionType}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">批量输入 JSON</label>
              <textarea
                value={runItemsText}
                onChange={(event) => setRunItemsText(event.target.value)}
                rows={12}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">并发数</label>
              <input
                type="number"
                min={1}
                max={2}
                value={concurrency}
                onChange={(event) => setConcurrency(Number(event.target.value) || 1)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              />
            </div>

            <button
              onClick={handleRunWorkflow}
              disabled={runningWorkflowId !== null}
              className="mt-5 rounded-full bg-cyan-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningWorkflowId ? '正在启动...' : '开始执行'}
            </button>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">工作流清单</h3>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="text-sm text-slate-500">正在加载...</div>
              ) : workflows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  还没有工作流，先创建一个再跑批量。
                </div>
              ) : (
                workflows.map((workflow) => (
                  <article key={workflow.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{workflow.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{workflow.description || '无描述'}</div>
                      </div>
                      <div className="text-xs text-slate-500">{workflow.run_count || 0} 次执行</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {workflow.steps.map((step) => (
                        <span key={step.key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {step.name}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">运行历史</h3>
            <p className="mt-1 text-sm text-slate-500">每个 run 会在任务中心里展开成多条任务，这里先看整体批次进度和状态。</p>
          </div>
          <Link to="/tasks" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            打开任务中心
          </Link>
        </div>
        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">运行</th>
                  <th className="px-4 py-3">工作流</th>
                  <th className="px-4 py-3">团队</th>
                  <th className="px-4 py-3">进度</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">批次</th>
                  <th className="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">暂无运行记录</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className={selectedRunId === run.id ? 'bg-cyan-50/60' : undefined}>
                      <td className="px-4 py-4 font-semibold text-slate-900">#{run.id}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{run.workflow_name || `Workflow ${run.workflow_id}`}</div>
                        <div className="mt-1 text-xs text-slate-500">步骤 {run.total_steps} / 并发 {run.concurrency}</div>
                      </td>
                      <td className="px-4 py-4">{run.team_name || '平台模式'}</td>
                      <td className="px-4 py-4">完成 {run.completed_items} / 失败 {run.failed_items} / 总计 {run.total_items}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[run.status] || 'bg-slate-100 text-slate-800'}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500">{run.run_batch_id.slice(0, 18)}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        <div>{new Date(run.created_at).toLocaleString('zh-CN')}</div>
                        {run.completed_at && <div className="mt-1">结束：{new Date(run.completed_at).toLocaleString('zh-CN')}</div>}
                        <button
                          onClick={() => setSelectedRunId(run.id)}
                          className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          查看明细
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">运行结果明细</h3>
              <p className="mt-1 text-sm text-slate-500">这里看每个 item 的最终输出或失败点，再配合右侧任务列表查每一步参数。</p>
            </div>
            {selectedRun && (
              <Link
                to={`/tasks?workflowRunId=${selectedRun.id}&workflowId=${selectedRun.workflow_id}&scope=${user?.role === 'super_admin' ? 'platform' : user?.is_team_admin ? 'team' : 'mine'}`}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                去任务中心深查
              </Link>
            )}
          </div>
          {!selectedRun ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500">
              选择一条运行记录后，这里会展示批次级结果。
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{selectedRun.workflow_name || `Workflow ${selectedRun.workflow_id}`}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Run #{selectedRun.id} · 总计 {selectedRun.total_items} 条 · 完成 {selectedRun.completed_items} 条 · 失败 {selectedRun.failed_items} 条
                    </div>
                  </div>
                  <Link
                    to={`/tasks?workflowRunId=${selectedRun.id}&workflowId=${selectedRun.workflow_id}&scope=${user?.role === 'super_admin' ? 'platform' : user?.is_team_admin ? 'team' : 'mine'}`}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
                  >
                    在任务中心查看
                  </Link>
                </div>
              </div>

              {parsedRunResults.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500">
                  当前运行还没有写入结果，可能仍在执行中。
                </div>
              ) : (
                parsedRunResults.map((item, index) => (
                  <article key={`${selectedRun.id}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">Item {Number(item.itemIndex ?? index) + 1}</div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[String(item.status)] || 'bg-slate-100 text-slate-800'}`}>
                        {String(item.status)}
                      </span>
                    </div>
                    {'errorMessage' in item && item.errorMessage ? (
                      <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
                        {String(item.errorMessage)}
                      </div>
                    ) : (
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-900/95 px-4 py-4 text-xs leading-6 text-slate-100">
                        {JSON.stringify(item.finalOutput || item, null, 2)}
                      </pre>
                    )}
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">该 Run 拆分出的任务</h3>
              <p className="mt-1 text-sm text-slate-500">逐步看每一步参数、状态、错误和任务详情，便于回溯链路。</p>
            </div>
            {selectedRun && (
              <Link
                to={`/tasks?workflowRunId=${selectedRun.id}&workflowId=${selectedRun.workflow_id}&scope=${user?.role === 'super_admin' ? 'platform' : user?.is_team_admin ? 'team' : 'mine'}`}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                去任务中心
              </Link>
            )}
          </div>

          <div className="mt-5">
            {selectedRunLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                正在加载运行任务...
              </div>
            ) : (
              <TaskTable
                tasks={selectedRunTasks}
                showTeam={user?.role === 'super_admin'}
                showUser={user?.role === 'super_admin' || Boolean(user?.is_team_admin)}
                emptyText="当前运行还没有拆分出任务，或者任务仍在初始化。"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
