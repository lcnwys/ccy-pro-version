import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api';
import type { MaterialAsset } from '@/types';

interface ResourcePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (files: SelectedResource[]) => void;
  teamId?: number;
  mode?: 'single' | 'batch';
}

export interface SelectedResource {
  id: number;
  fileId: string;
  fileName: string;
  previewUrl: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function ResourcePicker({ isOpen, onClose, onConfirm, teamId, mode = 'batch' }: ResourcePickerProps) {
  const [materials, setMaterials] = useState<MaterialAsset[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'upload' | 'generated'>('all');

  const allSelected = useMemo<SelectedResource[]>(
    () =>
      materials
        .filter((item) => selectedIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          fileId: item.file_id,
          fileName: item.original_name,
          previewUrl: `${API_BASE}/files/download/${item.local_file}`,
        })),
    [materials, selectedIds]
  );

  const fetchMaterials = async (nextKeyword = keyword) => {
    setLoading(true);
    try {
      const params: { keyword?: string; teamId?: number; limit?: number; sourceType?: 'upload' | 'generated' } = {
        keyword: nextKeyword || undefined,
        teamId,
        limit: 80,
      };
      if (sourceTypeFilter !== 'all') {
        params.sourceType = sourceTypeFilter;
      }
      const response = await apiClient.getMaterials(params);
      setMaterials(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void fetchMaterials('');
    setKeyword('');
    setSelectedIds([]);
    setSourceTypeFilter('all');
  }, [isOpen, teamId]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await apiClient.uploadFile(file, teamId);
      }
      await fetchMaterials();
    } catch (error) {
      console.error('Failed to upload material:', error);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const toggleSelect = (id: number) => {
    if (mode === 'single') {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const handleConfirm = () => {
    onConfirm(allSelected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#151515] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
          <div>
            <div className="text-sm font-medium tracking-[0.2em] text-[#e97b45]">资源选择</div>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {mode === 'single' ? '选择单张素材' : '选择批量输入'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            关闭
          </button>
        </div>

        <div className="border-b border-white/5 bg-[#1f1f1f] px-8 py-4">
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#e97b45] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#f08f61]">
                <span>{uploading ? '上传中...' : mode === 'single' ? '上传图片' : '批量上传'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple={mode === 'batch'}
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
              <div className="mt-3 text-xs text-slate-400">
                上传后自动刷新素材库，点击选取
              </div>
            </div>

            {/* 来源类型筛选 */}
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-400">来源：</div>
              <button
                type="button"
                onClick={() => { setSourceTypeFilter('all'); void fetchMaterials(); }}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  sourceTypeFilter === 'all'
                    ? 'bg-[#e97b45] text-white'
                    : 'border border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => { setSourceTypeFilter('upload'); void fetchMaterials(); }}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  sourceTypeFilter === 'upload'
                    ? 'bg-[#e97b45] text-white'
                    : 'border border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                上传
              </button>
              <button
                type="button"
                onClick={() => { setSourceTypeFilter('generated'); void fetchMaterials(); }}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  sourceTypeFilter === 'generated'
                    ? 'bg-[#e97b45] text-white'
                    : 'border border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                生成
              </button>
            </div>

            <div className="flex min-w-[240px] flex-1 items-center gap-3">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="按名称或 fileId 搜索"
                className="h-12 w-full rounded-xl border border-white/10 bg-[#141414] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#e97b45]"
              />
              <button
                type="button"
                onClick={() => void fetchMaterials()}
                className="h-12 rounded-xl border border-[#e97b45]/60 px-5 text-sm font-medium text-[#f1a07c] transition hover:bg-[#e97b45]/10"
              >
                查询
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">正在加载素材...</div>
          ) : materials.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">
              素材库为空，请上传图片开始
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {materials.map((material) => {
                const previewUrl = `${API_BASE}/files/download/${material.local_file}`;
                const selected = selectedIds.includes(material.id);

                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => toggleSelect(material.id)}
                    className={`overflow-hidden rounded-[22px] border text-left transition ${
                      selected
                        ? 'border-[#e97b45] bg-[#241913] shadow-[0_0_0_1px_rgba(233,123,69,0.25)]'
                        : 'border-white/5 bg-[#222] hover:border-white/15'
                    }`}
                  >
                    <div className="aspect-square bg-[#181818] p-3">
                      <img
                        src={previewUrl}
                        alt={material.original_name}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    </div>
                    <div className="space-y-2 px-3 pb-3 pt-2">
                      <div className="line-clamp-1 text-sm font-medium text-white">{material.original_name}</div>
                      <div className="text-xs text-slate-400">ID: {material.file_id}</div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{material.team_name || '个人素材'}</span>
                        <span>使用 {material.usage_count} 次</span>
                      </div>
                    </div>
                    {selected && mode === 'batch' && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#e97b45] text-white">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-8 py-4">
          <div className="text-sm text-slate-400">
            {allSelected.length === 0
              ? '请选择图片'
              : `已选 ${allSelected.length} 张${mode === 'single' ? '' : '图片'}`}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              disabled={allSelected.length === 0}
              onClick={handleConfirm}
              className="rounded-xl bg-[#e97b45] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#f08f61] disabled:cursor-not-allowed disabled:bg-[#6c4a3a]"
            >
              {allSelected.length === 0 ? '请选择图片' : `确认选取 (${allSelected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
