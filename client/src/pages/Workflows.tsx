import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { getTaskCost } from '@/utils/pricing';
import type { WorkflowRecord, WorkflowRunRecord, WorkflowStep } from '@/types';
import { WorkflowExecute } from './WorkflowExecute';
import { WorkflowVisualEditor } from '@/components/WorkflowVisualEditor';
import { StepParamForm } from '@/components/StepParamForm';

type TemplateSource = 'official' | 'team';
type PageMode = 'center' | 'preview' | 'execute';

interface OfficialTemplate {
  id: string;
  source: 'official';
  name: string;
  description: string;
  category: string;
  badge: string;
  previewNote: string;
  steps: WorkflowStep[];
}

interface TeamTemplateEntry {
  id: string;
  source: 'team';
  workflow: WorkflowRecord;
  category: string;
}

type TemplateEntry = OfficialTemplate | TeamTemplateEntry;

const cloneSteps = (steps: WorkflowStep[]) => JSON.parse(JSON.stringify(steps)) as WorkflowStep[];

const FUNCTION_META: Record<string, { label: string; hint: string }> = {
  'pattern-extraction': { label: '印花提取', hint: '提取可复用的花型或素材主体。' },
  fission: { label: '印花裂变', hint: '基于上一步结果做批量变化。' },
  'cut-out-portrait': { label: '抠头像', hint: '低风险的人像抠图步骤。' },
  'intelligent-matting': { label: '智能抠图', hint: '做边缘与主体抠图清洗。' },
  'becomes-clear': { label: 'AI 变清晰', hint: '对素材做预增强。' },
  'print-generation': { label: '印刷图', hint: '低成本测试很适合放进工作流。' },
  'image-generation': { label: 'AI 生图', hint: '更适合放在链路后段。' },
};

const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-dress-fission',
    source: 'official',
    name: '连衣裙印花裂变链路',
    description: '先做印花提取，再裂变出多版跟款素材，适合服饰类跟款打样。',
    category: '服饰',
    badge: '官方',
    previewNote: '当前模板为官方预设，只支持查看结构。需要落到你自己的团队模板后再继续执行。',
    steps: [
      {
        key: 'extract_pattern',
        name: '印花提取',
        functionType: 'pattern-extraction',
        inputTemplate: {
          referenceImageId: '{{item.referenceImageId}}',
          schema: 'basic',
          aspectRatioId: 0,
          resolutionRatioId: 0,
          isPatternCompleted: 0,
        },
      },
      {
        key: 'pattern_fission',
        name: '印花裂变',
        functionType: 'fission',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          schema: 'basic',
          similarity: 0.8,
          resolutionRatioId: 0,
          aspectRatioId: 0,
        },
      },
      {
        key: 'print_asset',
        name: '印刷图',
        functionType: 'print-generation',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          dpi: 300,
          imageWidth: '{{prev.imageWidth}}',
          imageHeight: '{{prev.imageHeight}}',
        },
      },
    ],
  },
  {
    id: 'official-shirt-restore',
    source: 'official',
    name: '长袖衬衫高还原跟款',
    description: '以清晰化和抠图为前置步骤，适合先做素材整理再进行后续生产。',
    category: '服饰',
    badge: '官方',
    previewNote: '当前模板为官方预设，只支持查看结构。需要落到你自己的团队模板后再继续执行。',
    steps: [
      {
        key: 'becomes_clear',
        name: 'AI 变清晰',
        functionType: 'becomes-clear',
        inputTemplate: {
          referenceImageId: '{{item.referenceImageId}}',
          schema: 'basic',
          primaryId: 1,
        },
      },
      {
        key: 'matting',
        name: '智能抠图',
        functionType: 'intelligent-matting',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          schema: 'basic',
          smooth: 0,
        },
      },
      {
        key: 'pattern_extract',
        name: '印花提取',
        functionType: 'pattern-extraction',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          schema: 'basic',
          aspectRatioId: 0,
          resolutionRatioId: 0,
          isPatternCompleted: 0,
        },
      },
    ],
  },
  {
    id: 'official-tshirt-volume',
    source: 'official',
    name: 'T 恤走量低成本链路',
    description: '尽量用低积分能力做前置测试，适合批量烟测和低成本验证。',
    category: '服饰',
    badge: '官方',
    previewNote: '当前模板为官方预设，只支持查看结构。需要落到你自己的团队模板后再继续执行。',
    steps: [
      {
        key: 'portrait_cut',
        name: '抠头像',
        functionType: 'cut-out-portrait',
        inputTemplate: {
          referenceImageId: '{{item.referenceImageId}}',
          schema: 'basic',
        },
      },
      {
        key: 'print_asset',
        name: '印刷图',
        functionType: 'print-generation',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          dpi: 300,
          imageWidth: '{{prev.imageWidth}}',
          imageHeight: '{{prev.imageHeight}}',
        },
      },
    ],
  },
  {
    id: 'official-home-textile',
    source: 'official',
    name: '家纺清洗与印花链路',
    description: '先做素材清洗，再输出适合家纺类的低成本印刷图。',
    category: '家用纺织',
    badge: '官方',
    previewNote: '当前模板为官方预设，只支持查看结构。需要落到你自己的团队模板后再继续执行。',
    steps: [
      {
        key: 'matting',
        name: '智能抠图',
        functionType: 'intelligent-matting',
        inputTemplate: {
          referenceImageId: '{{item.referenceImageId}}',
          schema: 'basic',
          smooth: 0,
        },
      },
      {
        key: 'fission',
        name: '印花裂变',
        functionType: 'fission',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          schema: 'basic',
          similarity: 0.78,
          resolutionRatioId: 0,
          aspectRatioId: 0,
        },
      },
      {
        key: 'print_generation',
        name: '印刷图',
        functionType: 'print-generation',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          dpi: 300,
          imageWidth: '{{prev.imageWidth}}',
          imageHeight: '{{prev.imageHeight}}',
        },
      },
    ],
  },
  {
    id: 'official-phone-case',
    source: 'official',
    name: '手机壳预处理模板',
    description: '强调低成本素材整理，适合给后续商品合成链路做准备。',
    category: '手机壳',
    badge: '官方',
    previewNote: '当前模板为官方预设，只支持查看结构。需要落到你自己的团队模板后再继续执行。',
    steps: [
      {
        key: 'becomes_clear',
        name: 'AI 变清晰',
        functionType: 'becomes-clear',
        inputTemplate: {
          referenceImageId: '{{item.referenceImageId}}',
          schema: 'basic',
          primaryId: 1,
        },
      },
      {
        key: 'pattern_extract',
        name: '印花提取',
        functionType: 'pattern-extraction',
        inputTemplate: {
          referenceImageId: '{{prev.generateImageId}}',
          schema: 'basic',
          aspectRatioId: 0,
          resolutionRatioId: 0,
          isPatternCompleted: 0,
        },
      },
    ],
  },
];

// STARTER_TEMPLATE_STEPS 保留供后续使用

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  running: 'bg-sky-100 text-sky-900',
  partial_success: 'bg-violet-100 text-violet-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
};

const getStepLabel = (step: WorkflowStep) => {
  return step.name || FUNCTION_META[step.functionType]?.label || step.functionType;
};

const getTemplateEstimate = (steps: WorkflowStep[]) => {
  return steps.reduce((sum, step) => sum + getTaskCost(step.functionType, step.inputTemplate), 0);
};

export function Workflows() {
  const { user, loading: authLoading } = useAuth();
  const canManageWorkflows = user?.role === 'super_admin' || Boolean(user?.is_team_admin);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [recentRuns, setRecentRuns] = useState<WorkflowRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pageMode, setPageMode] = useState<PageMode>('center');
  const [activeSource, setActiveSource] = useState<TemplateSource>('official');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<TemplateEntry | null>(null);
  const [executeWorkflow, setExecuteWorkflow] = useState<WorkflowRecord | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'blank' | 'preset'>('preset');
  const [blankName, setBlankName] = useState('我的新工作流');
  const [blankDescription, setBlankDescription] = useState('从空白模板开始搭建你的团队工作流。');
  const [submitting, setSubmitting] = useState(false);
  const [editableWorkflowName, setEditableWorkflowName] = useState('');
  const [editableWorkflowDescription, setEditableWorkflowDescription] = useState('');
  const [editableSteps, setEditableSteps] = useState<WorkflowStep[]>([]);
  const [selectedStepKey, setSelectedStepKey] = useState('');
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotice(null);

      try {
        const [workflowRes, runRes] = await Promise.all([
          apiClient.getWorkflows(),
          apiClient.getWorkflowRuns(),
        ]);

        setWorkflows((workflowRes.data.data || []) as WorkflowRecord[]);
        setRecentRuns((runRes.data.data || []) as WorkflowRunRecord[]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载工作流失败';
        setNotice({ type: 'error', message });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    setActiveCategory('全部');
  }, [activeSource]);

  useEffect(() => {
    if (!authLoading) {
      setActiveSource(canManageWorkflows ? 'team' : 'official');
    }
  }, [authLoading, canManageWorkflows]);

  useEffect(() => {
    if (!previewEntry || previewEntry.source !== 'team') {
      setEditableWorkflowName('');
      setEditableWorkflowDescription('');
      setEditableSteps([]);
      setSelectedStepKey('');
      return;
    }

    const nextSteps = cloneSteps(previewEntry.workflow.steps);
    const firstStep = nextSteps[0];

    setEditableWorkflowName(previewEntry.workflow.name);
    setEditableWorkflowDescription(previewEntry.workflow.description || '');
    setEditableSteps(nextSteps);
    setSelectedStepKey(firstStep?.key || '');
  }, [previewEntry]);

  const officialCategories = useMemo(() => {
    return ['全部', ...Array.from(new Set(OFFICIAL_TEMPLATES.map((item) => item.category)))];
  }, []);

  const teamEntries = useMemo<TeamTemplateEntry[]>(() => {
    return workflows.map((workflow) => ({
      id: `team-${workflow.id}`,
      source: 'team',
      workflow,
      category: '未分组',
    }));
  }, [workflows]);

  const visibleEntries = useMemo<TemplateEntry[]>(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const list = activeSource === 'official' ? OFFICIAL_TEMPLATES : teamEntries;

    return list.filter((entry) => {
      const matchesCategory = activeCategory === '全部' || entry.category === activeCategory;
      const title = entry.source === 'official' ? entry.name : entry.workflow.name;
      const description = entry.source === 'official' ? entry.description : entry.workflow.description || '';
      const matchesKeyword = !keyword || `${title} ${description}`.toLowerCase().includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [activeCategory, activeSource, searchKeyword, teamEntries]);

  const previewSteps = useMemo(() => {
    if (!previewEntry) return [] as WorkflowStep[];
    return previewEntry.source === 'official' ? previewEntry.steps : editableSteps;
  }, [editableSteps, previewEntry]);

  const selectedStep = useMemo(() => {
    return editableSteps.find((step) => step.key === selectedStepKey) || null;
  }, [editableSteps, selectedStepKey]);

  // handleAddStep 保留供后续使用

  const openPreview = (entry: TemplateEntry) => {
    setMenuId(null);
    setPreviewEntry(entry);
    setPageMode('preview');
  };

  const handleUpdateStepParams = (params: Record<string, unknown>) => {
    if (!selectedStepKey) return;
    setEditableSteps((current) =>
      current.map((step) =>
        step.key === selectedStepKey
          ? { ...step, inputTemplate: params }
          : step
      )
    );
  };

  const createTeamWorkflow = async (input: {
    name: string;
    description?: string;
    steps: WorkflowStep[];
  }) => {
    const response = await apiClient.createWorkflow({
      name: input.name,
      description: input.description,
      teamId: user?.team_id || undefined,
      steps: input.steps,
    });

    const workflow = response.data.data as WorkflowRecord;
    setWorkflows((current) => [workflow, ...current]);
    setActiveSource('team');
    setSearchKeyword('');
    setSearchInput('');
    return workflow;
  };

  const handleCreateBlankTemplate = async () => {
    if (!canManageWorkflows) {
      setNotice({ type: 'error', message: '只有团队管理员或超级管理员可以创建模板。' });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const workflow = await createTeamWorkflow({
        name: blankName.trim() || '我的新工作流',
        description: blankDescription.trim(),
        steps: [], // 空白模板，创建后再编辑
      });

      setCreateModalOpen(false);
      setNotice({ type: 'success', message: '空白模板已创建，请继续配置工作流步骤。' });

      // 创建成功后进入编辑模式
      const teamEntry: TeamTemplateEntry = {
        id: `team-${workflow.id}`,
        source: 'team',
        workflow,
        category: '未分组',
      };
      setPreviewEntry(teamEntry);
      setPageMode('preview');
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建空白模板失败';
      setNotice({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFromOfficial = async (template: OfficialTemplate, runAfterCreate = false) => {
    if (!canManageWorkflows) {
      setNotice({ type: 'error', message: '当前账号只能查看官方模板，不能创建副本。' });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const workflow = await createTeamWorkflow({
        name: `${template.name} 副本`,
        description: template.description,
        steps: template.steps,
      });

      setCreateModalOpen(false);
      setNotice({ type: 'success', message: '模板副本已加入团队模板列表。' });

      if (runAfterCreate) {
        setExecuteWorkflow(workflow);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建模板副本失败';
      setNotice({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRunModal = (entry: TemplateEntry) => {
    setMenuId(null);

    if (entry.source === 'official') {
      void handleCreateFromOfficial(entry, true);
      return;
    }

    // 直接进入执行页面
    setExecuteWorkflow(entry.workflow);
  };

  const handleEditWorkflow = (entry: TeamTemplateEntry) => {
    setMenuId(null);
    setPreviewEntry(entry);
    setPageMode('preview');
  };


  const handleSaveWorkflow = async () => {
    if (!previewEntry || previewEntry.source !== 'team') return;

    setSavingWorkflow(true);
    setNotice(null);

    try {
      const response = await apiClient.updateWorkflow(previewEntry.workflow.id, {
        name: editableWorkflowName.trim() || previewEntry.workflow.name,
        description: editableWorkflowDescription.trim(),
        steps: editableSteps,
      });

      const updatedWorkflow = response.data.data as WorkflowRecord;
      setWorkflows((current) => current.map((workflow) => (workflow.id === updatedWorkflow.id ? updatedWorkflow : workflow)));
      setPreviewEntry({
        id: `team-${updatedWorkflow.id}`,
        source: 'team',
        workflow: updatedWorkflow,
        category: '未分组',
      });
      setNotice({ type: 'success', message: '工作流已保存到团队模板。' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存工作流失败';
      setNotice({ type: 'error', message });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const categoryOptions = activeSource === 'official' ? officialCategories : ['全部', '未分组'];

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

        {executeWorkflow ? (
          <WorkflowExecute workflow={executeWorkflow} onBack={() => setExecuteWorkflow(null)} />
        ) : pageMode === 'center' ? (
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-lg">
            <div className="border-b border-slate-200 px-6 py-6 lg:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">Workflow</div>
                  <h2 className="mt-3 text-3xl font-semibold text-slate-900">工作流模板</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    默认先从模板卡片进入。官方模板用于查看预设结构，创建副本后会进入你的团队工作流列表。
                  </p>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[520px] lg:items-end">
                  <div className="flex w-full flex-col gap-3 sm:flex-row">
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="模板名称"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSearchKeyword(searchInput)}
                      className="rounded-2xl border border-cyan-600/60 px-5 py-3 text-sm font-medium text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-50"
                    >
                      查询
                    </button>
                    {canManageWorkflows && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreateMode('preset');
                          setCreateModalOpen(true);
                        }}
                        className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-cyan-500"
                      >
                        新增模板
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveSource('team')}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        activeSource === 'team' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      团队
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSource('official')}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        activeSource === 'official' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      官方
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activeCategory === category
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-6 lg:px-8">
              {loading ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center text-sm text-slate-500">
                  正在加载工作流模板...
                </div>
              ) : visibleEntries.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center">
                  <div className="text-lg font-medium text-slate-900">
                    {activeSource === 'team' ? '暂无团队模板，快去新增吧。' : '当前筛选下没有官方模板。'}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {activeSource === 'team'
                      ? '你可以从空白模板开始，也可以基于官方模板快速创建副本。'
                      : '换个关键词或分类，再看看其他预设链路。'}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  {visibleEntries.map((entry) => {
                    const title = entry.source === 'official' ? entry.name : entry.workflow.name;
                    const description = entry.source === 'official' ? entry.description : entry.workflow.description || '团队自定义模板';
                    const steps = entry.source === 'official' ? entry.steps : entry.workflow.steps;
                    const estimate = getTemplateEstimate(steps);
                    const entryMenuId = entry.id;

                    return (
                      <article
                        key={entry.id}
                        className="relative rounded-[28px] border border-slate-200 bg-white p-5 transition hover:border-cyan-300 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="inline-flex rounded-xl bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                              {entry.source === 'official' ? entry.badge : '团队'}
                            </div>
                            <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{description}</p>
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setMenuId((current) => (current === entryMenuId ? null : entryMenuId))}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              ···
                            </button>

                            {menuId === entryMenuId && (
                              <div className="absolute right-0 top-12 z-20 min-w-[160px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => openPreview(entry)}
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                >
                                  查看
                                </button>
                                {entry.source === 'team' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleEditWorkflow(entry)}
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    >
                                      编辑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRunModal(entry)}
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-600 transition hover:bg-slate-50"
                                    >
                                      运行
                                    </button>
                                  </>
                                )}
                                {entry.source === 'official' && canManageWorkflows && (
                                  <button
                                    type="button"
                                    onClick={() => void handleCreateFromOfficial(entry)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                  >
                                    创建副本
                                  </button>
                                )}
                                {entry.source === 'official' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRunModal(entry)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-600 transition hover:bg-slate-50"
                                  >
                                    运行（创建副本）
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {steps.map((step) => (
                            <span key={`${entry.id}-${step.key}`} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                              {getStepLabel(step)}
                            </span>
                          ))}
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                          <span>{steps.length} 个步骤</span>
                          <span>预估消耗 {estimate} 次元值 / item</span>
                          <span>{entry.source === 'team' ? `已运行 ${entry.workflow.run_count || 0} 次` : entry.category}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-5 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">最近运行</div>
                  <div className="mt-1 text-xs text-slate-500">入口页只保留一小块运行概况，不把运行明细铺满整个页面。</div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {recentRuns.slice(0, 3).map((run) => (
                    <div key={run.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{run.workflow_name || `工作流 #${run.workflow_id}`}</div>
                      <div className="mt-1 text-xs text-slate-500">批次 {run.run_batch_id}</div>
                      <div className="mt-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[run.status] || 'bg-slate-100 text-slate-700'}`}>
                          {run.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : previewEntry ? (
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-lg">
            <div className="border-b border-slate-200 px-6 py-5 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPageMode('center');
                      setPreviewEntry(null);
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    返回模板中心
                  </button>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">
                      {previewEntry.source === 'official' ? '官方模板预览' : '团队模板预览'}
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                      {previewEntry.source === 'official' ? previewEntry.name : previewEntry.workflow.name}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {previewEntry.source === 'official' && canManageWorkflows && (
                    <button
                      type="button"
                      onClick={() => void handleCreateFromOfficial(previewEntry)}
                      className="rounded-2xl border border-cyan-600/60 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50"
                    >
                      创建副本
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenRunModal(previewEntry)}
                    className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
                  >
                    新建任务
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {previewEntry?.source === 'official'
                  ? previewEntry.previewNote
                  : '拖拽排序步骤，点击功能类型添加新步骤，直接编辑参数无需手写 JSON。'}
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="relative h-[720px] overflow-auto border-b border-slate-200 xl:border-b-0 xl:border-r bg-slate-50">
                {previewEntry?.source === 'team' ? (
                  <WorkflowVisualEditor
                    steps={editableSteps}
                    onChange={setEditableSteps}
                    selectedStepKey={selectedStepKey}
                    onSelectStep={setSelectedStepKey}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    官方模板仅支持查看
                  </div>
                )}
              </div>

              <aside className="space-y-6 px-6 py-6">
                <div>
                  <div className="text-sm font-medium text-slate-900">模板说明</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {previewEntry.source === 'official'
                      ? previewEntry.description
                      : previewEntry.workflow.description || '团队模板说明暂未填写。'}
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">模板概况</div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">模板来源</span>
                      <span className="font-medium text-slate-900">{previewEntry.source === 'official' ? '官方预设' : '团队模板'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">步骤数量</span>
                      <span className="font-medium text-slate-900">{previewSteps.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">预估单 item 消耗</span>
                      <span className="font-medium text-slate-900">{getTemplateEstimate(previewSteps)}</span>
                    </div>
                    {previewEntry.source === 'team' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">累计运行</span>
                        <span className="font-medium text-slate-900">{previewEntry.workflow.run_count || 0}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">
                    {previewEntry.source === 'official' ? '步骤清单' : '节点配置'}
                  </div>
                  <div className="mt-4 space-y-3">
                    {previewEntry.source === 'official' ? previewSteps.map((step, index) => (
                      <div key={step.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Step {index + 1}</div>
                        <div className="mt-2 font-medium text-slate-900">{getStepLabel(step)}</div>
                        <div className="mt-2 text-xs leading-5 text-slate-500">{FUNCTION_META[step.functionType]?.hint || step.functionType}</div>
                      </div>
                    )) : (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm text-slate-600">模板名称</label>
                          <input
                            value={editableWorkflowName}
                            onChange={(event) => setEditableWorkflowName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm text-slate-600">模板说明</label>
                          <textarea
                            value={editableWorkflowDescription}
                            onChange={(event) => setEditableWorkflowDescription(event.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                          />
                        </div>

                        {selectedStep ? (
                          <>
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                              <div className="text-sm font-medium text-cyan-800">
                                已选中：{selectedStep.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {FUNCTION_META[selectedStep.functionType]?.label || selectedStep.functionType}
                              </div>
                            </div>
                            <div className="mt-4">
                              <StepParamForm
                                step={selectedStep}
                                value={selectedStep.inputTemplate}
                                onChange={handleUpdateStepParams}
                                index={editableSteps.findIndex((s) => s.key === selectedStepKey)}
                              />
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() => void handleSaveWorkflow()}
                                disabled={savingWorkflow}
                                className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-600/50"
                              >
                                {savingWorkflow ? '保存中...' : '保存工作流'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                            点击左侧步骤卡片，在右侧编辑参数
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">New Workflow</div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">新增工作流模板</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  关闭
                </button>
              </div>

              <div className="grid max-h-[calc(90vh-88px)] gap-0 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="border-r border-slate-200 bg-slate-50 p-4">
                  <button
                    type="button"
                    onClick={() => setCreateMode('blank')}
                    className={`w-full rounded-2xl px-4 py-4 text-left text-sm transition ${
                      createMode === 'blank' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    新建空白模板
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('preset')}
                    className={`mt-3 w-full rounded-2xl px-4 py-4 text-left text-sm transition ${
                      createMode === 'preset' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    热门工作流
                  </button>
                </aside>

                <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-6">
                  {createMode === 'blank' ? (
                    <div className="mx-auto max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6">
                      <div className="text-sm font-medium text-slate-900">空白模板将带一个起始步骤，后续再继续扩展。</div>
                      <div className="mt-6 space-y-4">
                        <div>
                          <label className="mb-2 block text-sm text-slate-600">模板名称</label>
                          <input
                            value={blankName}
                            onChange={(event) => setBlankName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm text-slate-600">模板说明</label>
                          <textarea
                            value={blankDescription}
                            onChange={(event) => setBlankDescription(event.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none"
                          />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                          初始步骤：<span className="font-medium text-slate-900">印花提取</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCreateBlankTemplate()}
                          disabled={submitting}
                          className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-600/50"
                        >
                          {submitting ? '创建中...' : '创建空白模板'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap gap-3">
                        {officialCategories.filter((category) => category !== '全部').map((category) => (
                          <span key={category} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                            {category}
                          </span>
                        ))}
                      </div>
                      <div className="mt-6 grid gap-4 xl:grid-cols-2">
                        {OFFICIAL_TEMPLATES.map((template) => (
                          <article key={template.id} className="rounded-[28px] border border-slate-200 bg-white p-5">
                            <div className="inline-flex rounded-xl bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                              官方
                            </div>
                            <h4 className="mt-3 text-lg font-semibold text-slate-900">{template.name}</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {template.steps.map((step) => (
                                <span key={step.key} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                                  {getStepLabel(step)}
                                </span>
                              ))}
                            </div>
                            <div className="mt-5 flex items-center justify-between">
                              <div className="text-xs text-slate-500">预估消耗 {getTemplateEstimate(template.steps)} 次元值 / item</div>
                              <button
                                type="button"
                                onClick={() => void handleCreateFromOfficial(template)}
                                disabled={submitting}
                                className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-600/50"
                              >
                                以此新建模板
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
  );
}
