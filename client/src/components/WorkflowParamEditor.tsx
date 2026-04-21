import type { WorkflowStep } from '@/types';

interface WorkflowParamEditorProps {
  steps: WorkflowStep[];
  values: Record<string, Record<string, unknown>>;
  onChange: (stepKey: string, params: Record<string, unknown>) => void;
}

const FUNCTION_META: Record<string, { label: string; hint: string; commonParams: string[] }> = {
  'pattern-extraction': {
    label: '印花提取',
    hint: '提取可复用的花型或素材主体',
    commonParams: ['referenceImageId', 'schema', 'aspectRatioId', 'resolutionRatioId', 'isPatternCompleted'],
  },
  fission: {
    label: '印花裂变',
    hint: '基于上一步结果做批量变化',
    commonParams: ['referenceImageId', 'schema', 'similarity', 'resolutionRatioId', 'aspectRatioId'],
  },
  'cut-out-portrait': {
    label: '抠头像',
    hint: '低风险的人像抠图步骤',
    commonParams: ['referenceImageId', 'schema'],
  },
  'intelligent-matting': {
    label: '智能抠图',
    hint: '做边缘与主体抠图清洗',
    commonParams: ['referenceImageId', 'schema', 'smooth'],
  },
  'becomes-clear': {
    label: 'AI 变清晰',
    hint: '对素材做预增强',
    commonParams: ['referenceImageId', 'schema', 'primaryId'],
  },
  'print-generation': {
    label: '印刷图',
    hint: '生成适合印刷的高质量图像',
    commonParams: ['referenceImageId', 'dpi', 'imageWidth', 'imageHeight'],
  },
  'image-generation': {
    label: 'AI 生图',
    hint: '根据提示词生成图像',
    commonParams: ['prompt', 'aspectRatioId', 'resolutionRatioId'],
  },
  'clothing-upper': {
    label: '服装上身',
    hint: '将服装穿到模特身上',
    commonParams: ['topsReferenceImageId', 'bottomsReferenceImageId', 'aspectRatioId', 'resolutionRatioId'],
  },
  'clothing-wrinkle-removal': {
    label: '服装去皱',
    hint: '去除服装褶皱使其平整',
    commonParams: ['referenceImageId', 'schema', 'aspectRatioId', 'resolutionRatioId'],
  },
  'clothing-diagram': {
    label: '3D 服装图',
    hint: '生成服装的 3D 效果图',
    commonParams: ['referenceImageId', 'schema', 'aspectRatioId', 'resolutionRatioId', 'exampleId'],
  },
  'garment-extractions': {
    label: '服装提取',
    hint: '从图片中提取服装',
    commonParams: ['referenceImageId', 'schema', 'backgroundId', 'resolutionRatioId'],
  },
};

interface ParamFieldDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'select' | 'boolean' | 'text';
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  readOnly?: boolean;
}

const PARAM_FIELDS: Record<string, ParamFieldDef[]> = {
  referenceImageId: [
    { key: 'referenceImageId', label: '参考图 ID', type: 'string', required: true, placeholder: '{{item.fileId}} 或 {{prev.generateImageId}}' },
  ],
  schema: [
    { key: 'schema', label: '模式', type: 'select', default: 'basic', options: [{ label: '基础', value: 'basic' }] },
  ],
  resolutionRatioId: [
    { key: 'resolutionRatioId', label: '分辨率', type: 'select', default: 0, options: [{ label: '1K', value: 0 }, { label: '2K', value: 1 }, { label: '4K', value: 2 }] },
  ],
  isPatternCompleted: [
    { key: 'isPatternCompleted', label: '是否完整提取', type: 'select', default: 0, options: [{ label: '否', value: 0 }, { label: '是', value: 1 }] },
  ],
  similarity: [
    { key: 'similarity', label: '相似度', type: 'number', default: 0.8, placeholder: '0.01-1 之间', hint: '控制输出与原图的相似程度' },
  ],
  aspectRatioId: [
    { key: 'aspectRatioId', label: '比例', type: 'select', default: 0, options: [{ label: '1:1', value: 0 }], hint: '基础版仅支持 1:1' },
  ],
  dpi: [
    { key: 'dpi', label: 'DPI', type: 'number', default: 300, placeholder: '0-1200', hint: '印刷精度，推荐 300' },
  ],
  imageWidth: [
    { key: 'imageWidth', label: '图片宽度', type: 'text', default: '{{prev.imageWidth}}', placeholder: '原图尺寸', readOnly: true, hint: '自动使用上一步输出尺寸' },
  ],
  imageHeight: [
    { key: 'imageHeight', label: '图片高度', type: 'text', default: '{{prev.imageHeight}}', placeholder: '原图尺寸', readOnly: true, hint: '自动使用上一步输出尺寸' },
  ],
  primaryId: [
    { key: 'primaryId', label: '主体类型', type: 'select', default: 1, options: [{ label: '人物', value: 1 }, { label: '物体', value: 2 }] },
  ],
  smooth: [
    { key: 'smooth', label: '平滑度', type: 'number', default: 0, placeholder: '0-10', hint: '边缘平滑处理程度' },
  ],
  prompt: [
    { key: 'prompt', label: '提示词', type: 'string', placeholder: '描述你想要的图像...', hint: 'AI 生图的文本描述' },
  ],
  topsReferenceImageId: [
    { key: 'topsReferenceImageId', label: '上装参考图', type: 'string', placeholder: '{{item.fileId}} 或 {{prev.generateImageId}}' },
  ],
  bottomsReferenceImageId: [
    { key: 'bottomsReferenceImageId', label: '下装参考图', type: 'string', placeholder: '{{item.fileId}} 或 {{prev.generateImageId}}' },
  ],
  backgroundId: [
    { key: 'backgroundId', label: '背景类型', type: 'select', default: 1, options: [{ label: '背景 1', value: 1 }, { label: '背景 2', value: 2 }] },
  ],
  exampleId: [
    { key: 'exampleId', label: '示例 ID', type: 'string', placeholder: '可选，使用预设示例' },
  ],
};

export function WorkflowParamEditor({ steps, values, onChange }: WorkflowParamEditorProps) {
  const updateStepParam = (stepKey: string, paramKey: string, value: unknown) => {
    const currentParams = values[stepKey] || {};
    const newParams = { ...currentParams, [paramKey]: value };
    onChange(stepKey, newParams);
  };

  const getParamValue = (stepKey: string, paramKey: string, defaultValue?: unknown) => {
    const stepParams = values[stepKey] || {};
    if (paramKey in stepParams) {
      return stepParams[paramKey];
    }
    return defaultValue;
  };

  const renderField = (stepKey: string, field: ParamFieldDef) => {
    let value = getParamValue(stepKey, field.key, field.default);
    // 印刷图尺寸的只读字段，模板字符串显示为"原图尺寸"
    if (field.readOnly && (value === '{{prev.imageWidth}}' || value === '{{prev.imageHeight}}')) {
      value = '原图尺寸';
    }

    switch (field.type) {
      case 'select':
        return (
          <select
            value={String(value)}
            onChange={(e) => {
              const numValue = Number(e.target.value);
              updateStepParam(stepKey, field.key, isNaN(numValue) ? e.target.value : numValue);
            }}
            className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-2.5 text-sm text-white focus:border-[#e97b45] focus:outline-none"
          >
            {field.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        if (field.readOnly) {
          return (
            <div>
              <input
                type="text"
                value={String(value || '')}
                readOnly
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
              {field.hint && <div className="mt-1 text-xs text-slate-500">{field.hint}</div>}
            </div>
          );
        }
        return (
          <div>
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => {
                const val = e.target.value;
                // 如果是模板字符串，保留原样；否则转换为数字
                if (val.startsWith('{{') && val.endsWith('}}')) {
                  updateStepParam(stepKey, field.key, val);
                } else {
                  const numVal = Number(val);
                  updateStepParam(stepKey, field.key, isNaN(numVal) ? '' : numVal);
                }
              }}
              placeholder={field.placeholder}
              className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#e97b45] focus:outline-none"
            />
            {field.hint && <div className="mt-1 text-xs text-slate-500">{field.hint}</div>}
          </div>
        );

      case 'boolean':
        return (
          <button
            type="button"
            onClick={() => updateStepParam(stepKey, field.key, !value)}
            className={`h-6 w-11 rounded-full transition ${value ? 'bg-[#e97b45]' : 'bg-slate-600'}`}
          >
            <div className={`h-5 w-5 rounded-full bg-white transition ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        );

      default:
        return (
          <div>
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => updateStepParam(stepKey, field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#e97b45] focus:outline-none"
            />
            {field.hint && <div className="mt-1 text-xs text-slate-500">{field.hint}</div>}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {steps.map((step, stepIndex) => {
        const funcMeta = FUNCTION_META[step.functionType];
        // stepParams 保留供后续扩展使用

        // 获取该功能类型的所有参数字段
        const allFields = funcMeta?.commonParams?.flatMap((paramKey) => PARAM_FIELDS[paramKey] || []) || [];

        return (
          <div key={step.key} className="rounded-2xl border border-white/10 bg-[#111827] p-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Step {stepIndex + 1}</div>
                <div className="mt-1 font-medium text-white">{step.name || funcMeta?.label || step.functionType}</div>
                {funcMeta?.hint && <div className="mt-1 text-xs text-slate-400">{funcMeta.hint}</div>}
              </div>
              <div className="rounded-xl bg-[#e97b45]/15 px-2.5 py-1 text-xs font-medium text-[#e97b45]">
                {funcMeta?.label || step.functionType}
              </div>
            </div>

            <div className="space-y-3">
              {allFields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm text-slate-400">
                    {field.label}
                    {field.required && <span className="ml-1 text-[#e97b45]">*</span>}
                  </label>
                  {renderField(step.key, field)}
                </div>
              ))}

              {allFields.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-3 text-center text-sm text-slate-500">
                  该步骤暂无可配置参数
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
