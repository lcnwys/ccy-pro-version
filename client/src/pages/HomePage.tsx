import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api';

const FUNCTION_DESCRIPTIONS: Record<string, string> = {
  'image-generation': '根据提示词生成商品图，适合从创意起稿直接进入生产。',
  'print-generation': '按印刷图场景生成结果，适合低成本批量修图。',
  'pattern-extraction': '从素材中提取印花图案，用于拆解和复用。',
  'fission': '基于参考图做裂变变体，是后续 workflow 的核心入口。',
  'becomes-clear': '做清晰化增强，适合上游素材清理。',
  'clothing-upper': '服装上身模拟，适合模特图内容生产。',
  'clothing-wrinkle-removal': '服装去皱，适合快速修正素材。',
  'cut-out-portrait': '抠头像，适合低风险低成本测试链路。',
  'clothing-diagram': '生成 3D 服装图，适合平台展示页。',
  'garment-extractions': '提取服装主体，适合换背景和复用。',
  'intelligent-matting': '智能抠图，适合大批量清背景任务。',
};

const FUNCTION_BADGES: Record<string, string> = {
  'image-generation': '创意生成',
  'print-generation': '低成本',
  'pattern-extraction': '拆图复用',
  'fission': '批量友好',
  'becomes-clear': '修图增强',
  'clothing-upper': '模特场景',
  'clothing-wrinkle-removal': '修图增强',
  'cut-out-portrait': '低风险测试',
  'clothing-diagram': '展示图',
  'garment-extractions': '服装处理',
  'intelligent-matting': '高频基础',
};

export function HomePage() {
  const [functions, setFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getFunctions()
      .then((res) => setFunctions(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(8,47,73,0.96),_rgba(15,23,42,0.92))] p-8 text-white shadow-2xl">
        <div className="grid gap-8 xl:grid-cols-[1.4fr,0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Workspace</div>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight">
              固定主框架下统一管理功能、任务、团队与后续 Workflow。
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200">
              你要的方向不是再堆孤立页面，而是围绕任务流转来组织整个系统。现在入口、任务中心、团队和平台后台都可以从左侧持续切换，不需要每次靠“返回”找路。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/tasks" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-100">
                打开任务中心
              </Link>
              <Link to="/workflows" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                查看 Workflow 规划
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">目标一</div>
              <div className="mt-3 text-lg font-semibold">每个功能页可见历史任务</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">目标二</div>
              <div className="mt-3 text-lg font-semibold">团队/平台级任务统计汇总</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">目标三</div>
              <div className="mt-3 text-lg font-semibold">为 Workflow 铺路</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Function Catalog</div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">功能入口</h3>
            <p className="mt-2 text-sm text-slate-500">优先围绕任务可见性和可追踪性组织，而不是单页跳转。</p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
            测试建议优先选低成本功能，如印刷图、抠头像、裂变
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">加载功能列表中...</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {functions.map((fn) => (
              <Link
                key={fn.id}
                to={`/function/${fn.id}`}
                className="group rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 transition hover:-translate-y-1 hover:border-cyan-200 hover:bg-white hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">{fn.name}</h4>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-800">
                    {FUNCTION_BADGES[fn.id] || '功能'}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {FUNCTION_DESCRIPTIONS[fn.id] || '进入该功能页查看提交面板、历史任务和批量处理情况。'}
                </p>
                <div className="mt-5 text-sm font-semibold text-slate-900 transition group-hover:text-cyan-700">
                  进入功能页
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
