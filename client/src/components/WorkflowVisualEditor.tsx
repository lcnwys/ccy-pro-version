import { useState } from 'react';
import type { WorkflowStep } from '@/types';

interface WorkflowVisualEditorProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  selectedStepKey?: string;
  onSelectStep?: (stepKey: string) => void;
}

const AVAILABLE_FUNCTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'pattern-extraction', label: '印花提取', hint: '提取可复用的花型或素材主体' },
  { value: 'fission', label: '印花裂变', hint: '基于上一步结果做批量变化' },
  { value: 'cut-out-portrait', label: '抠头像', hint: '低风险的人像抠图步骤' },
  { value: 'intelligent-matting', label: '智能抠图', hint: '做边缘与主体抠图清洗' },
  { value: 'becomes-clear', label: 'AI 变清晰', hint: '对素材做预增强' },
  { value: 'print-generation', label: '印刷图', hint: '生成适合印刷的高质量图像' },
  { value: 'image-generation', label: 'AI 生图', hint: '根据提示词生成图像' },
  { value: 'clothing-upper', label: '服装上身', hint: '将服装穿到模特身上' },
  { value: 'clothing-wrinkle-removal', label: '服装去皱', hint: '去除服装褶皱' },
  { value: 'clothing-diagram', label: '3D 服装图', hint: '生成服装的 3D 效果图' },
  { value: 'garment-extractions', label: '服装提取', hint: '从图片中提取服装' },
];

const generateStepKey = (functionType: string, index: number) => {
  const prefix = functionType.split('-')[0];
  return `${prefix}_${index}`;
};

const generateStepName = (functionType: string) => {
  const func = AVAILABLE_FUNCTIONS.find((f) => f.value === functionType);
  return func?.label || functionType;
};

// 需要参考图的功能类型
const NEEDS_REFERENCE_IMAGE = new Set([
  'pattern-extraction', 'fission', 'print-generation', 'becomes-clear',
  'intelligent-matting', 'cut-out-portrait', 'clothing-wrinkle-removal',
  'clothing-diagram', 'garment-extractions',
]);

const createDefaultInputTemplate = (functionType: string, isFirstChild: boolean): Record<string, unknown> => {
  const baseTemplate: Record<string, unknown> = {
    schema: 'basic',
  };

  // 自动设置参考图：第一个步骤引用 item，后续步骤引用上一步结果
  if (NEEDS_REFERENCE_IMAGE.has(functionType)) {
    if (isFirstChild) {
      baseTemplate.referenceImageId = '{{item.referenceImageId}}';
      baseTemplate.referenceImageUrl = '{{item.referenceImageUrl}}';
    } else {
      baseTemplate.referenceImageId = '{{prev.generateImageId}}';
    }
  }

  switch (functionType) {
    case 'pattern-extraction':
      baseTemplate.schema = 'basic';
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      baseTemplate.isPatternCompleted = 0;
      break;
    case 'fission':
      baseTemplate.similarity = 0.8;
      baseTemplate.resolutionRatioId = 0;
      baseTemplate.aspectRatioId = 0;
      break;
    case 'print-generation':
      baseTemplate.dpi = 300;
      baseTemplate.imageWidth = '{{prev.imageWidth}}';
      baseTemplate.imageHeight = '{{prev.imageHeight}}';
      break;
    case 'becomes-clear':
      baseTemplate.primaryId = 1;
      break;
    case 'intelligent-matting':
      baseTemplate.smooth = 0;
      break;
    case 'image-generation':
      baseTemplate.prompt = '';
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      break;
    case 'clothing-upper':
      baseTemplate.prompt = '';
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      break;
    case 'clothing-wrinkle-removal':
      baseTemplate.prompt = '';
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      break;
    case 'clothing-diagram':
      baseTemplate.prompt = '';
      baseTemplate.exampleId = '';
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      break;
    case 'garment-extractions':
      baseTemplate.prompt = '';
      baseTemplate.backgroundId = 1;
      baseTemplate.aspectRatioId = 0;
      baseTemplate.resolutionRatioId = 0;
      break;
    case 'cut-out-portrait':
      break;
    default:
      break;
  }

  return baseTemplate;
};

export function WorkflowVisualEditor({ steps, onChange, selectedStepKey, onSelectStep }: WorkflowVisualEditorProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 起始节点（固定，不能删除或移动）
  const startNode = {
    id: 'start',
    name: '选择图片',
    description: '从素材库选择或上传图片作为输入',
    isStart: true,
  };

  const handleAddStep = (functionType: string) => {
    const newStep: WorkflowStep = {
      key: generateStepKey(functionType, steps.length),
      name: generateStepName(functionType),
      functionType: functionType as any,
      inputTemplate: createDefaultInputTemplate(functionType, steps.length === 0),
    };
    onChange([...steps, newStep]);
    setShowAddMenu(false);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    onChange(newSteps);
  };

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    const newSteps = [...steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    onChange(newSteps);
  };

  const handleUpdateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const newSteps = steps.map((step, i) =>
      i === index ? { ...step, ...updates } : step
    );
    onChange(newSteps);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    handleMoveStep(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4 p-6">
      {/* 起始节点（固定） */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-slate-900">{startNode.name}</div>
            <div className="text-xs text-slate-500">{startNode.description}</div>
          </div>
        </div>
      </div>

      {/* 步骤列表 */}
      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          暂无步骤，请点击下方「添加步骤」按钮开始构建工作流
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isSelected = selectedStepKey === step.key;
            return (
              <div
                key={step.key}
                draggable
                onClick={() => onSelectStep?.(step.key)}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group relative rounded-2xl border border-slate-200 bg-white p-4 transition cursor-pointer ${
                  draggedIndex === index
                    ? 'border-cyan-500 opacity-50'
                    : isSelected
                    ? 'border-cyan-500 bg-cyan-50'
                    : 'hover:border-cyan-400'
                }`}
              >
                {/* 拖拽指示器 */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 cursor-move text-slate-400 opacity-0 transition group-hover:opacity-100">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                <div className="ml-8">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-sm font-semibold text-cyan-700">
                        {index + 1}
                      </div>
                      <div>
                        <input
                          value={step.name}
                          onChange={(e) => handleUpdateStep(index, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg bg-transparent px-2 py-1 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="步骤名称"
                        />
                        <div className="mt-0.5 text-xs text-slate-500">
                          {AVAILABLE_FUNCTIONS.find((f) => f.value === step.functionType)?.label || step.functionType}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (index > 0) handleMoveStep(index, index - 1);
                        }}
                        disabled={index === 0}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        title="上移"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (index < steps.length - 1) handleMoveStep(index, index + 1);
                        }}
                        disabled={index === steps.length - 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        title="下移"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStep(index);
                        }}
                        className="rounded-lg border border-rose-300 p-1.5 text-rose-500 transition hover:bg-rose-50"
                        title="删除步骤"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 添加步骤按钮 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-50 px-6 py-4 text-sm font-medium text-cyan-700 transition hover:border-cyan-400 hover:bg-cyan-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加步骤
        </button>

        {showAddMenu && (
          <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="grid gap-1">
              {AVAILABLE_FUNCTIONS.map((func) => (
                <button
                  key={func.value}
                  type="button"
                  onClick={() => handleAddStep(func.value)}
                  className="flex items-start gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-semibold text-cyan-700">
                    {func.label[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{func.label}</div>
                    <div className="text-xs text-slate-500">{func.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
