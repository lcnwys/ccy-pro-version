const HIGH_RESOLUTION_ID = 2;

const isHighResolution = (inputData: Record<string, unknown>) =>
  Number(inputData.resolutionRatioId) === HIGH_RESOLUTION_ID;

const isAdvancedSchema = (inputData: Record<string, unknown>) =>
  inputData.schema === 'advanced';

// 根据价格表：
// AI 生图类（基础版 1/2K 为低价档，4K 为高价档；高级版在基础版基础上 +6 次元值）
// 修图类（基础版固定价，高级版 +6 次元值；部分功能 4K 为高价档）

export const getTaskCost = (functionType: string, inputData: Record<string, unknown>): number => {
  const is4K = isHighResolution(inputData);
  const isAdvanced = isAdvancedSchema(inputData);

  // 基础价格表（基础版 1/2K 价格）
  const BASE_PRICES: Record<string, { basic: number; highRes: number }> = {
    'image-generation': { basic: 6, highRes: 12 },      // 4K 12 次元值
    'pattern-extraction': { basic: 7.5, highRes: 15 },   // 4K 15 次元值
    'fission': { basic: 6, highRes: 12 },                // 4K 12 次元值
    'clothing-diagram': { basic: 9, highRes: 18 },       // 4K 18 次元值
    'clothing-upper': { basic: 6, highRes: 12 },         // 4K 12 次元值
    'clothing-wrinkle-removal': { basic: 6, highRes: 12 }, // 4K 12 次元值
    'garment-extractions': { basic: 6, highRes: 12 },    // 按修图类 4K 档
    'intelligent-matting': { basic: 6, highRes: 6 },     // 固定 6 次元值
    'becomes-clear': { basic: 6, highRes: 6 },           // 固定 6 次元值
    'print-generation': { basic: 0.3, highRes: 0.3 },    // 固定 0.3 次元值
    'cut-out-portrait': { basic: 6, highRes: 6 },        // 固定 6 次元值
  };

  const priceConfig = BASE_PRICES[functionType] || { basic: 6, highRes: 6 };

  // 基础版直接返回，高级版 +6 次元值
  const basePrice = is4K ? priceConfig.highRes : priceConfig.basic;
  return isAdvanced ? basePrice + 6 : basePrice;
};

export const getTaskPriceHint = (functionType: string) => {
  switch (functionType) {
    case 'image-generation':
      return '基础版 1/2K 6 次元值，4K 12 次元值；高级版 +6 次元值';
    case 'pattern-extraction':
      return '基础版 1/2K 7.5 次元值，4K 15 次元值；高级版 +6 次元值';
    case 'fission':
      return '基础版 1/2K 6 次元值，4K 12 次元值；高级版 +6 次元值';
    case 'clothing-diagram':
      return '基础版 1/2K 9 次元值，4K 18 次元值；高级版 +6 次元值';
    case 'clothing-upper':
      return '基础版 1/2K 6 次元值，4K 12 次元值；高级版 +6 次元值';
    case 'clothing-wrinkle-removal':
      return '基础版 1/2K 6 次元值，4K 12 次元值；高级版 +6 次元值';
    case 'garment-extractions':
      return '基础版 1/2K 6 次元值，4K 12 次元值；高级版 +6 次元值';
    case 'becomes-clear':
      return '基础版 6 次元值，高级版 12 次元值';
    case 'intelligent-matting':
      return '基础版 6 次元值，高级版 12 次元值';
    case 'print-generation':
      return '固定 0.3 次元值';
    case 'cut-out-portrait':
      return '基础版 6 次元值，高级版 12 次元值';
    default:
      return '提交前按当前参数估算';
  }
};
