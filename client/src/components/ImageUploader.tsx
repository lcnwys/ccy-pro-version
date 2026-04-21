import { useRef, useState } from 'react';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  multiple?: boolean;
}

export function ImageUploader({ onUpload, multiple = false }: ImageUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    selectedFiles.forEach(onUpload);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    setFiles(droppedFiles);
    droppedFiles.forEach(onUpload);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <div
        className="upload-dash border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-cyan-50 hover:border-cyan-300 transition-all"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="space-y-3">
          <svg className="w-16 h-16 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-slate-700 font-medium">点击或拖拽上传图片</p>
            <p className="text-slate-500 text-sm mt-1">支持 JPG、PNG、WebP 格式，最大 5MB</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            return (
              <div
                key={index}
                className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm"
              >
                {/* 缩略图 */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-full w-full object-cover"
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)}</div>
                </div>

                {/* 删除按钮 */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                  title="删除"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
