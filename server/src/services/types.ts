// API 响应结构
export interface ChcyaiResponse<T> {
  data: T;
  requestId: string;
  status: 'REQUEST_SUCCESS' | 'REQUEST_FAILED';
}

export interface ChcyaiError {
  error: {
    code: string;
    message?: string;
  };
  requestId: string;
  status: 'REQUEST_FAILED';
}

// 功能类型
export type FunctionType =
  | 'image-generation'
  | 'print-generation'
  | 'pattern-extraction'
  | 'fission'
  | 'becomes-clear'
  | 'clothing-upper'
  | 'clothing-wrinkle-removal'
  | 'cut-out-portrait'
  | 'clothing-diagram'
  | 'garment-extractions'
  | 'intelligent-matting'
  | 'file-upload';

// 比例类型
export type AspectRatioId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
// 0: 1:1, 1: 4:3, 2: 3:4, 3: 4:5, 4: 5:4, 5: 9:16, 6: 16:9, 7: 21:9

// 分辨率类型
export type ResolutionRatioId = 0 | 1 | 2;
// 0: 1K, 1: 2K, 2: 4K

// 主体类型
export type PrimaryId = 1 | 2;
// 1: 通用，2: 人像

// 背景类型
export type BackgroundId = 1 | 2;
// 1: 黑色，2: 白色

// 是否补全
export type IsPatternCompleted = 0 | 1;
// 0: 不补全，1: 补全

// 订单状态
export type OrderStatus = 'WAIT' | 'EXECUTE' | 'EXECUTE_SUCCESS' | 'EXECUTE_ERROR';

// 任务结果
export interface TaskResult {
  taskId?: string;
  generateImageId?: string;
  tempUrl?: string;
  base64?: string;
  deductibleAmount?: number;
  orderStatus?: OrderStatus;
  status?: 'WAIT' | 'EXECUTE' | 'EXECUTE_SUCCESS' | 'EXECUTE_ERROR';
}

// 通用参考图参数（三选一）
export interface ReferenceImageParams {
  referenceImageId?: string;
  referenceImageUrl?: string;
  referenceImageBase64?: string;
}

// 多参考图参数
export interface MultiReferenceImageParams {
  referenceImageIdList?: string[];
  referenceImageUrlList?: string[];
  referenceImageBase64List?: string[];
}

// 各功能的输入参数类型

// AI 生图
export interface ImageGenerationParams extends ReferenceImageParams, MultiReferenceImageParams {
  schema?: 'basic' | 'advanced';
  prompt: string;
  aspectRatioId?: AspectRatioId;
  resolutionRatioId: ResolutionRatioId;
  fileName?: string;
}

// 打印图生成
export interface SelectedArea {
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

export interface PrintGenerationParams extends ReferenceImageParams {
  dpi: number; // 0-1200
  selectedArea?: SelectedArea;
  imageHeight: number;
  imageWidth: number;
  fileName?: string;
}

// 印花提取
export interface PatternExtractionParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  resolutionRatioId: ResolutionRatioId;
  isPatternCompleted: IsPatternCompleted;
  fileName?: string;
}

// 图裂变
export interface FissionParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  similarity: number; // 0.01-1
  resolutionRatioId: ResolutionRatioId;
  aspectRatioId: AspectRatioId;
  fileName?: string;
}

// AI 变清晰
export interface BecomesClearParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  primaryId?: PrimaryId;
  fileName?: string;
}

// 服装上身
export interface ClothingUpperParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  aspectRatioId: AspectRatioId;
  resolutionRatioId: ResolutionRatioId;
  fileName?: string;

  // 上装参考（三选一）
  topsReferenceImageId?: string;
  topsReferenceImageUrl?: string;
  topsReferenceImageBase64?: string;

  // 下装参考（三选一）
  bottomsReferenceImageId?: string;
  bottomsReferenceImageUrl?: string;
  bottomsReferenceImageBase64?: string;

  // 自定义模特（三选一，可选）
  customTalentFileId?: string;
  customTalentFileUrl?: string;
  customTalentFileBase64?: string;

  // 场景/姿势参考（三选一，必填其中一项）
  customReferenceImageFileId?: string;
  customReferenceImageFileUrl?: string;
  customReferenceImageFileBase64?: string;
}

// 服装去皱
export interface ClothingWrinkleRemovalParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  aspectRatioId: AspectRatioId;
  resolutionRatioId: ResolutionRatioId;
  fileName?: string;
}

// 扣头像
export interface CutOutPortraitParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  fileName?: string;
}

// 3D 服装图
export interface ClothingDiagramParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  exampleId?: string;
  aspectRatioId: AspectRatioId;
  resolutionRatioId: ResolutionRatioId;
  fileName?: string;
}

// 服装提取
export interface GarmentExtractionsParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  prompt?: string;
  backgroundId: BackgroundId;
  aspectRatioId?: AspectRatioId;
  resolutionRatioId: ResolutionRatioId;
  fileName?: string;
}

// 智能抠图
export interface IntelligentMattingParams extends ReferenceImageParams {
  schema: 'basic' | 'advanced';
  smooth?: number; // 0-10
  fileName?: string;
}

// 统一的输入类型
export type FunctionInputParams =
  | ImageGenerationParams
  | PrintGenerationParams
  | PatternExtractionParams
  | FissionParams
  | BecomesClearParams
  | ClothingUpperParams
  | ClothingWrinkleRemovalParams
  | CutOutPortraitParams
  | ClothingDiagramParams
  | GarmentExtractionsParams
  | IntelligentMattingParams;
