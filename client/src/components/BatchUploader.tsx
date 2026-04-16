import { useState } from 'react';
import { ImageUploader } from './ImageUploader';

interface BatchUploaderProps {
  onFilesReady: (files: File[]) => void;
}

export function BatchUploader({ onFilesReady }: BatchUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleUpload = (file: File) => {
    setUploadedFiles(prev => [...prev, file]);
    onFilesReady([...uploadedFiles, file]);
  };

  const handleRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onFilesReady(newFiles);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">批量上传</h3>
        <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          已选择 {uploadedFiles.length} 张图片
        </span>
      </div>

      <ImageUploader onUpload={handleUpload} multiple />

      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-full h-full object-cover rounded-lg shadow-sm"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-colors opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center py-1 rounded-b-lg truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
