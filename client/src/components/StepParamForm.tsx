import type { WorkflowStep } from '@/types';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'range' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  default?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
}

const FUNCTION_FIELDS: Record<string, FormField[]> = {
  'image-generation': [
    { name: 'prompt', label: '提示词', type: 'textarea', required: true, placeholder: '描述你想要生成的图片...' },
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'print-generation': [
    { name: 'dpi', label: 'DPI', type: 'number', min: 0, max: 1200, default: 300 },
    { name: 'imageWidth', label: '图片宽度', type: 'text', default: '{{prev.imageWidth}}', placeholder: '原图尺寸', readOnly: true },
    { name: 'imageHeight', label: '图片高度', type: 'text', default: '{{prev.imageHeight}}', placeholder: '原图尺寸', readOnly: true },
  ],
  'pattern-extraction': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述要提取的印花...' },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }
    ], default: 0, hint: '基础版仅支持 1:1 比例' },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
    { name: 'isPatternCompleted', label: '是否补全', type: 'select', options: [
      { value: 0, label: '不补全' }, { value: 1, label: '补全' }
    ], default: 0 },
  ],
  'fission': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述裂变效果...' },
    { name: 'similarity', label: '相似度', type: 'range', min: 0.01, max: 1, step: 0.01, default: 0.8 },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'becomes-clear': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'primaryId', label: '主体类型', type: 'select', options: [
      { value: 1, label: '通用' }, { value: 2, label: '人像' }
    ], default: 1 },
  ],
  'clothing-upper': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述上身效果...' },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'clothing-wrinkle-removal': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述去皱效果...' },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'cut-out-portrait': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
  ],
  'clothing-diagram': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述 3D 效果...' },
    { name: 'exampleId', label: '示例 ID', type: 'text', placeholder: '可选' },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'garment-extractions': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述要提取的服装...' },
    { name: 'backgroundId', label: '背景类型', type: 'select', options: [
      { value: 1, label: '黑色' }, { value: 2, label: '白色' }
    ], default: 1 },
    { name: 'aspectRatioId', label: '图片比例', type: 'select', options: [
      { value: 0, label: '1:1' }, { value: 1, label: '4:3' }, { value: 2, label: '3:4' },
      { value: 3, label: '4:5' }, { value: 4, label: '5:4' }, { value: 5, label: '9:16' },
      { value: 6, label: '16:9' }, { value: 7, label: '21:9' }
    ], default: 0 },
    { name: 'resolutionRatioId', label: '分辨率', type: 'select', options: [
      { value: 0, label: '1K' }, { value: 1, label: '2K' }, { value: 2, label: '4K' }
    ], default: 0 },
  ],
  'intelligent-matting': [
    { name: 'schema', label: '模式', type: 'select', options: [{ value: 'basic', label: '基础' }, { value: 'advanced', label: '高阶' }], default: 'basic' },
    { name: 'smooth', label: '平滑度', type: 'range', min: 0, max: 10, step: 1, default: 0 },
  ],
};

interface StepParamFormProps {
  step: WorkflowStep;
  value: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  index: number;
}

export function StepParamForm({ step, value, onChange, index }: StepParamFormProps) {
  const fields = FUNCTION_FIELDS[step.functionType] || [];

  const handleChange = (fieldName: string, fieldValue: unknown) => {
    // 印刷图尺寸的只读字段，显示"原图尺寸"但实际保存模板字符串
    let actualValue = fieldValue;
    if (fieldValue === '原图尺寸' || fieldValue === '') {
      if (fieldName === 'imageWidth') actualValue = '{{prev.imageWidth}}';
      if (fieldName === 'imageHeight') actualValue = '{{prev.imageHeight}}';
    }
    onChange({ ...value, [fieldName]: actualValue });
  };

  if (fields.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-500">该步骤无需配置参数</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">参数配置</div>
        <div className="text-xs text-slate-500">
          第 {index + 1} 步 · {step.name}
        </div>
      </div>

      <div className="space-y-4">
        {fields.map((field) => {
          let fieldValue = value[field.name] ?? field.default ?? '';
          // 印刷图尺寸的只读字段，模板字符串显示为"原图尺寸"
          if (field.readOnly && (fieldValue === '{{prev.imageWidth}}' || fieldValue === '{{prev.imageHeight}}')) {
            fieldValue = '原图尺寸';
          }

          return (
            <div key={field.name}>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                {field.label}
                {field.required && <span className="ml-1 text-rose-500">*</span>}
              </label>

              {field.type === 'textarea' && (
                <textarea
                  value={String(fieldValue)}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                />
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  value={String(fieldValue)}
                  onChange={field.readOnly ? undefined : (e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  readOnly={field.readOnly}
                  className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none ${
                    field.readOnly
                      ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                      : 'text-slate-900 placeholder:text-slate-400 focus:border-cyan-500'
                  }`}
                />
              )}

              {field.type === 'number' && (
                <input
                  type="text"
                  value={String(fieldValue)}
                  onChange={(e) => {
                    const val = e.target.value;
                    // 如果是模板字符串，保留原样；否则转换为数字
                    if (val.startsWith('{{') && val.endsWith('}}')) {
                      handleChange(field.name, val);
                    } else {
                      const numVal = Number(val);
                      handleChange(field.name, isNaN(numVal) ? 0 : numVal);
                    }
                  }}
                  min={field.min}
                  max={field.max}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                />
              )}

              {field.type === 'select' && (
                <select
                  value={String(fieldValue)}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange(field.name, isNaN(Number(val)) ? val : Number(val));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                >
                  {field.options?.map((opt) => (
                    <option key={String(opt.value)} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'range' && (
                <div>
                  <div className="flex items-center justify-between">
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={String(fieldValue)}
                      onChange={(e) => handleChange(field.name, Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="ml-3 w-16 text-right text-xs text-cyan-700">
                      {typeof fieldValue === 'number' ? fieldValue.toFixed(2) : fieldValue}
                    </span>
                  </div>
                </div>
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(fieldValue)}
                    onChange={(e) => handleChange(field.name, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-slate-700">启用</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { FUNCTION_FIELDS };
