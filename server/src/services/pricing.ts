import type { FunctionType } from './types.js';

const HIGH_RESOLUTION_ID = 2;

const isHighResolution = (inputData: Record<string, unknown>) =>
  Number(inputData.resolutionRatioId) === HIGH_RESOLUTION_ID;

export const getTaskCost = (functionType: FunctionType, inputData: Record<string, unknown>): number => {
  switch (functionType) {
    case 'image-generation':
      return isHighResolution(inputData) ? 12 : 6;
    case 'pattern-extraction':
      return isHighResolution(inputData) ? 15 : 7.5;
    case 'fission':
      return isHighResolution(inputData) ? 12 : 6;
    case 'clothing-diagram':
      return isHighResolution(inputData) ? 18 : 9;
    case 'clothing-upper':
      return isHighResolution(inputData) ? 12 : 6;
    case 'clothing-wrinkle-removal':
      return isHighResolution(inputData) ? 12 : 6;
    case 'becomes-clear':
      return 6;
    case 'print-generation':
      return 0.3;
    case 'cut-out-portrait':
      return 6;
    case 'intelligent-matting':
      return 6;
    case 'garment-extractions':
      return 6;
    case 'file-upload':
      return 0;
    default:
      return 6;
  }
};
