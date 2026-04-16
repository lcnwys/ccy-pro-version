const HIGH_RESOLUTION_ID = 2;

const isHighResolution = (inputData: Record<string, unknown>) =>
  Number(inputData.resolutionRatioId) === HIGH_RESOLUTION_ID;

export const getTaskCost = (functionType: string, inputData: Record<string, unknown>): number => {
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

export const getTaskPriceHint = (functionType: string) => {
  switch (functionType) {
    case 'image-generation':
      return '1/2K 6 次元值，4K 12 次元值';
    case 'pattern-extraction':
      return '1/2K 7.5 次元值，4K 15 次元值';
    case 'fission':
      return '1/2K 6 次元值，4K 12 次元值';
    case 'clothing-diagram':
      return '1/2K 9 次元值，4K 18 次元值';
    case 'clothing-upper':
      return '1/2K 6 次元值，4K 12 次元值';
    case 'clothing-wrinkle-removal':
      return '1/2K 6 次元值，4K 12 次元值';
    case 'becomes-clear':
      return '固定 6 次元值';
    case 'print-generation':
      return '固定 0.3 次元值';
    case 'cut-out-portrait':
      return '固定 6 次元值';
    case 'intelligent-matting':
      return '固定 6 次元值';
    case 'garment-extractions':
      return '按修图基础档展示';
    default:
      return '提交前按当前参数估算';
  }
};
