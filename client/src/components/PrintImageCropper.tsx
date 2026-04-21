import { useRef, useState, useEffect } from 'react';

interface PrintImageCropperProps {
  onImageSelect: (image: {
    fileId?: string;
    imageUrl?: string;
    width: number;
    height: number;
    localFile?: string;
  }) => void;
  onCropChange: (crop: { x: number; y: number; w: number; h: number }) => void;
  existingImageUrl?: string;
  aspectRatio?: 'free' | 'original' | '1:1' | '4:3' | '3:4' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
}

interface RatioOption {
  label: string;
  value: 'free' | 'original' | '1:1' | '4:3' | '3:4' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  ratio?: number;
}

const RATIO_OPTIONS: RatioOption[] = [
  { label: '自由裁剪', value: 'free' },
  { label: '原比例', value: 'original' },
  { label: '1:1', value: '1:1', ratio: 1 },
  { label: '4:3', value: '4:3', ratio: 4 / 3 },
  { label: '3:4', value: '3:4', ratio: 3 / 4 },
  { label: '4:5', value: '4:5', ratio: 4 / 5 },
  { label: '5:4', value: '5:4', ratio: 5 / 4 },
  { label: '9:16', value: '9:16', ratio: 9 / 16 },
  { label: '16:9', value: '16:9', ratio: 16 / 9 },
  { label: '21:9', value: '21:9', ratio: 21 / 9 },
];

export function PrintImageCropper({ onImageSelect, onCropChange, existingImageUrl, aspectRatio = 'free' }: PrintImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState({ x: 0, y: 0 });
  const [selectedRatio, setSelectedRatio] = useState<RatioOption['value']>('free');
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 获取当前比例的数值
  const getCurrentRatio = () => {
    if (selectedRatio === 'free') return null;
    if (selectedRatio === 'original' && imageDimensions.width > 0) {
      return imageDimensions.width / imageDimensions.height;
    }
    const option = RATIO_OPTIONS.find(o => o.value === selectedRatio);
    return option?.ratio || null;
  };

  // 根据比例调整裁剪区域
  const applyRatioConstraint = (newCrop: { x: number; y: number; w: number; h: number }) => {
    const ratio = getCurrentRatio();
    if (!ratio || newCrop.w === 0 || newCrop.h === 0) return newCrop;

    // 保持比例：根据宽度计算高度
    const targetHeight = newCrop.w / ratio;

    // 如果计算出的高度合理，使用它；否则根据高度计算宽度
    if (targetHeight <= imageDimensions.height && targetHeight > 0) {
      return { ...newCrop, h: targetHeight };
    } else {
      const targetWidth = newCrop.h * ratio;
      return { ...newCrop, w: targetWidth };
    }
  };

  // 显示图片
  useEffect(() => {
    if (existingImageUrl && existingImageUrl !== imageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImageSrc(existingImageUrl);
        setImageDimensions({ width: img.width, height: img.height });
        // 初始化裁剪区域为图片中心的 60% 大小
        const initialRatio = 0.6;
        const initialW = img.width * initialRatio;
        const initialH = img.height * initialRatio;
        const initialX = (img.width - initialW) / 2;
        const initialY = (img.height - initialH) / 2;
        setCropArea({ x: initialX, y: initialY, w: initialW, h: initialH });
        onImageSelect({ width: img.width, height: img.height, imageUrl: existingImageUrl });
      };
      img.src = existingImageUrl;
    }
  }, [existingImageUrl]);

  // 同步外部的比例变化
  useEffect(() => {
    setSelectedRatio(aspectRatio);
  }, [aspectRatio]);

  // 当比例改变时，调整裁剪框
  useEffect(() => {
    if (cropArea.w > 0 && cropArea.h > 0 && imageDimensions.width > 0) {
      const ratio = getCurrentRatio();
      if (ratio) {
        // 保持中心点不变，按新比例调整
        const centerX = cropArea.x + cropArea.w / 2;
        const centerY = cropArea.y + cropArea.h / 2;
        let newW = cropArea.w;
        let newH = cropArea.w / ratio;

        // 如果新高度超出图片，调整宽度
        if (newH > imageDimensions.height) {
          newH = imageDimensions.height;
          newW = newH * ratio;
        }

        setCropArea({
          x: Math.max(0, Math.min(centerX - newW / 2, imageDimensions.width - newW)),
          y: Math.max(0, Math.min(centerY - newH / 2, imageDimensions.height - newH)),
          w: newW,
          h: newH,
        });
      }
    }
  }, [selectedRatio, imageDimensions.width, imageDimensions.height]);

  // 计算显示尺寸（适配容器）
  useEffect(() => {
    if (containerRef.current && imageDimensions.width > 0) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // 计算缩放比例，确保图片完全显示在容器内
      const scaleX = containerWidth / imageDimensions.width;
      const scaleY = containerHeight / imageDimensions.height;
      const scale = Math.min(scaleX, scaleY, 1); // 不超过原图大小

      setDisplaySize({
        width: imageDimensions.width * scale,
        height: imageDimensions.height * scale,
      });
    }
  }, [imageDimensions, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // 通知父组件裁剪区域变化
  useEffect(() => {
    if (cropArea.w > 0 && cropArea.h > 0) {
      onCropChange(cropArea);
    }
  }, [cropArea, onCropChange]);

  // 坐标转换：屏幕坐标 -> 原图坐标
  const toImageCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current || imageDimensions.width === 0) return { x: 0, y: 0 };

    const rect = containerRef.current.getBoundingClientRect();
    const imageLeft = rect.left + (rect.width - displaySize.width) / 2;
    const imageTop = rect.top + (rect.height - displaySize.height) / 2;

    const scaleX = imageDimensions.width / displaySize.width;
    const scaleY = imageDimensions.height / displaySize.height;

    const x = (clientX - imageLeft) * scaleX;
    const y = (clientY - imageTop) * scaleY;

    return { x: Math.max(0, Math.min(x, imageDimensions.width)), y: Math.max(0, Math.min(y, imageDimensions.height)) };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || imageDimensions.width === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = toImageCoords(e.clientX, e.clientY);

    // 检查是否点击在角点上（调整大小）
    const handleSize = 15;
    const corners = {
      'tl': [cropArea.x, cropArea.y],
      'tr': [cropArea.x + cropArea.w, cropArea.y],
      'bl': [cropArea.x, cropArea.y + cropArea.h],
      'br': [cropArea.x + cropArea.w, cropArea.y + cropArea.h],
    };

    for (const [handle, [cx, cy]] of Object.entries(corners)) {
      if (Math.abs(x - cx) < handleSize && Math.abs(y - cy) < handleSize) {
        setResizeHandle(handle);
        return;
      }
    }

    // 检查是否在裁剪框内（拖动）
    if (cropArea.w > 0 && cropArea.h > 0 &&
        x >= cropArea.x && x <= cropArea.x + cropArea.w &&
        y >= cropArea.y && y <= cropArea.y + cropArea.h) {
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    } else {
      // 开始新的选择
      setIsSelecting(true);
      setSelectStart({ x, y });
      setCropArea({ x, y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || imageDimensions.width === 0) return;

    const { x, y } = toImageCoords(e.clientX, e.clientY);

    if (isDragging && cropArea.w > 0 && cropArea.h > 0) {
      // 拖动裁剪框
      const newX = Math.max(0, Math.min(x - dragStart.x, imageDimensions.width - cropArea.w));
      const newY = Math.max(0, Math.min(y - dragStart.y, imageDimensions.height - cropArea.h));
      setCropArea({ ...cropArea, x: newX, y: newY });
    } else if (resizeHandle && cropArea.w > 0 && cropArea.h > 0) {
      // 调整裁剪框大小
      let newCrop = { ...cropArea };

      if (resizeHandle.includes('r')) {
        newCrop.w = Math.max(20, Math.min(x - cropArea.x, imageDimensions.width - cropArea.x));
      }
      if (resizeHandle.includes('l')) {
        const newW = cropArea.w + (cropArea.x - x);
        if (newW > 20 && x < cropArea.x + cropArea.w) {
          newCrop.x = x;
          newCrop.w = newW;
        }
      }
      if (resizeHandle.includes('b')) {
        newCrop.h = Math.max(20, Math.min(y - cropArea.y, imageDimensions.height - cropArea.y));
      }
      if (resizeHandle.includes('t')) {
        const newH = cropArea.h + (cropArea.y - y);
        if (newH > 20 && y < cropArea.y + cropArea.h) {
          newCrop.y = y;
          newCrop.h = newH;
        }
      }

      // 应用比例约束
      newCrop = applyRatioConstraint(newCrop);

      // 确保不超出图片边界
      newCrop.x = Math.max(0, Math.min(newCrop.x, imageDimensions.width - newCrop.w));
      newCrop.y = Math.max(0, Math.min(newCrop.y, imageDimensions.height - newCrop.h));
      newCrop.w = Math.min(newCrop.w, imageDimensions.width - newCrop.x);
      newCrop.h = Math.min(newCrop.h, imageDimensions.height - newCrop.y);

      setCropArea(newCrop);
    } else if (isSelecting) {
      // 拖动选择新区域
      const startX = selectStart.x;
      const startY = selectStart.y;
      let width = x - startX;
      let height = y - startY;

      let newCrop = {
        x: width > 0 ? startX : x,
        y: height > 0 ? startY : y,
        w: Math.abs(width),
        h: Math.abs(height),
      };

      // 应用比例约束
      newCrop = applyRatioConstraint(newCrop);

      // 确保不超出图片边界
      newCrop.x = Math.max(0, Math.min(newCrop.x, imageDimensions.width - newCrop.w));
      newCrop.y = Math.max(0, Math.min(newCrop.y, imageDimensions.height - newCrop.h));
      newCrop.w = Math.min(newCrop.w, imageDimensions.width - newCrop.x);
      newCrop.h = Math.min(newCrop.h, imageDimensions.height - newCrop.y);

      setCropArea(newCrop);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizeHandle(null);
    setIsSelecting(false);
  };

  // 计算图片在容器中的偏移量（居中显示）
  const getImageOffset = () => {
    if (!containerRef.current || displaySize.width === 0) return { offsetX: 0, offsetY: 0 };
    const containerRect = containerRef.current.getBoundingClientRect();
    const offsetX = (containerRect.width - displaySize.width) / 2;
    const offsetY = (containerRect.height - displaySize.height) / 2;
    return { offsetX, offsetY };
  };

  const getHandleStyle = (position: string) => {
    const size = 12;
    const { offsetX, offsetY } = getImageOffset();
    let left = offsetX + (cropArea.x / imageDimensions.width) * displaySize.width;
    let top = offsetY + (cropArea.y / imageDimensions.height) * displaySize.height;

    if (position.includes('r')) left += (cropArea.w / imageDimensions.width) * displaySize.width - size / 2;
    if (position.includes('b')) top += (cropArea.h / imageDimensions.height) * displaySize.height - size / 2;

    return { left, top, width: size, height: size };
  };

  // 计算裁剪框的显示样式
  const cropBoxStyle: React.CSSProperties = {
    left: getImageOffset().offsetX + (cropArea.x / imageDimensions.width) * displaySize.width,
    top: getImageOffset().offsetY + (cropArea.y / imageDimensions.height) * displaySize.height,
    width: (cropArea.w / imageDimensions.width) * displaySize.width,
    height: (cropArea.h / imageDimensions.height) * displaySize.height,
  };

  return (
    <div className="space-y-4">
      {/* 比例选择器 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 cursor-pointer">
          <span>选择图片</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = (event) => {
                const src = event.target?.result as string;
                const img = new Image();
                img.onload = () => {
                  setImageSrc(src);
                  setImageDimensions({ width: img.width, height: img.height });
                  setSelectedRatio('free');
                  onImageSelect({
                    width: img.width,
                    height: img.height,
                    imageUrl: src
                  });
                };
                img.src = src;
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>

        {/* 比例选择下拉框 */}
        {imageDimensions.width > 0 && (
          <select
            value={selectedRatio}
            onChange={(e) => setSelectedRatio(e.target.value as RatioOption['value'])}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {RATIO_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 尺寸信息 */}
      {imageDimensions.width > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-600">
            原图尺寸：<span className="font-medium">{imageDimensions.width}</span> × <span className="font-medium">{imageDimensions.height}</span> px
          </div>
          {cropArea.w > 0 && (
            <div className="text-cyan-600">
              裁剪：<span className="font-medium">{Math.round(cropArea.w)}</span> × <span className="font-medium">{Math.round(cropArea.h)}</span> px
              {selectedRatio !== 'free' && (
                <span className="ml-2 text-slate-500">
                  ({Math.round(cropArea.w / cropArea.h * 100) / 100}:{Math.round(100) / 100})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {imageSrc ? (
        <div
          ref={containerRef}
          className="relative flex items-center justify-center rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
          style={{ height: '60vh', minHeight: '400px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop"
            className="select-none"
            style={{
              width: displaySize.width,
              height: displaySize.height,
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            draggable={false}
          />

          {/* 半透明遮罩 - 四个独立区域覆盖裁剪框外部 */}
          {cropArea.w > 0 && cropArea.h > 0 && (
            <>
              {/* 上方遮罩 */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  right: 0,
                  height: `${(cropArea.y / imageDimensions.height) * 100}%`,
                }}
              />
              {/* 下方遮罩 */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: 0,
                  bottom: 0,
                  right: 0,
                  height: `${((imageDimensions.height - cropArea.y - cropArea.h) / imageDimensions.height) * 100}%`,
                }}
              />
              {/* 左侧遮罩 */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: 0,
                  top: `${(cropArea.y / imageDimensions.height) * 100}%`,
                  width: `${(cropArea.x / imageDimensions.width) * 100}%`,
                  height: `${(cropArea.h / imageDimensions.height) * 100}%`,
                }}
              />
              {/* 右侧遮罩 */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  right: 0,
                  top: `${(cropArea.y / imageDimensions.height) * 100}%`,
                  width: `${((imageDimensions.width - cropArea.x - cropArea.w) / imageDimensions.width) * 100}%`,
                  height: `${(cropArea.h / imageDimensions.height) * 100}%`,
                }}
              />
            </>
          )}

          {/* 裁剪框 */}
          {cropArea.w > 0 && cropArea.h > 0 && (
            <div
              className="absolute border-2 border-white shadow-lg cursor-move"
              style={cropBoxStyle}
            >
              {/* 四角手柄 */}
              <div
                className="absolute bg-cyan-500 rounded-full cursor-nw-resize hover:scale-125 transition border-2 border-white"
                style={getHandleStyle('tl')}
                title="左上角"
              />
              <div
                className="absolute bg-cyan-500 rounded-full cursor-ne-resize hover:scale-125 transition border-2 border-white"
                style={getHandleStyle('tr')}
                title="右上角"
              />
              <div
                className="absolute bg-cyan-500 rounded-full cursor-sw-resize hover:scale-125 transition border-2 border-white"
                style={getHandleStyle('bl')}
                title="左下角"
              />
              <div
                className="absolute bg-cyan-500 rounded-full cursor-se-resize hover:scale-125 transition border-2 border-white"
                style={getHandleStyle('br')}
                title="右下角"
              />
              {/* 四边中点手柄（仅用于视觉提示） */}
              {(() => {
                const { offsetX, offsetY } = getImageOffset();
                const topMidX = offsetX + (cropArea.x / imageDimensions.width) * displaySize.width + (cropArea.w / imageDimensions.width) * displaySize.width / 2 - 6;
                const topMidY = offsetY + (cropArea.y / imageDimensions.height) * displaySize.height - 6;
                const bottomMidY = offsetY + (cropArea.y / imageDimensions.height) * displaySize.height + (cropArea.h / imageDimensions.height) * displaySize.height - 6;
                const leftMidX = offsetX + (cropArea.x / imageDimensions.width) * displaySize.width - 6;
                const leftMidY = offsetY + (cropArea.y / imageDimensions.height) * displaySize.height + (cropArea.h / imageDimensions.height) * displaySize.height / 2 - 6;
                const rightMidX = offsetX + (cropArea.x / imageDimensions.width) * displaySize.width + (cropArea.w / imageDimensions.width) * displaySize.width - 6;
                const rightMidY = offsetY + (cropArea.y / imageDimensions.height) * displaySize.height + (cropArea.h / imageDimensions.height) * displaySize.height / 2 - 6;

                return (
                  <>
                    <div className="absolute bg-cyan-500/50 w-3 h-3 rounded-full border-2 border-white" style={{ left: topMidX, top: topMidY }} />
                    <div className="absolute bg-cyan-500/50 w-3 h-3 rounded-full border-2 border-white" style={{ left: topMidX, top: bottomMidY }} />
                    <div className="absolute bg-cyan-500/50 w-3 h-3 rounded-full border-2 border-white" style={{ left: leftMidX, top: leftMidY }} />
                    <div className="absolute bg-cyan-500/50 w-3 h-3 rounded-full border-2 border-white" style={{ left: rightMidX, top: rightMidY }} />
                  </>
                );
              })()}
            </div>
          )}

          {/* 尺寸信息 */}
          {cropArea.w > 0 && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap">
              裁剪：{Math.round(cropArea.w)} × {Math.round(cropArea.h)} px
            </div>
          )}

          {/* 操作提示 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-xs whitespace-nowrap">
            鼠标拖动选择区域 · 拖动边角调整大小 · 在框内拖动移动位置
            {selectedRatio !== 'free' && ' · 当前锁定比例'}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
          style={{ height: '60vh', minHeight: '400px' }}
        >
          <div className="text-center text-slate-500">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm">请先选择一张图片</p>
          </div>
        </div>
      )}
    </div>
  );
}
