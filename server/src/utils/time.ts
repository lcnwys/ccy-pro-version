/**
 * 获取北京时间（UTC+8）格式化的时间字符串
 * 格式：HH:MM:SS.sss
 */
export const getBeijingTime = (): string => {
  return new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

/**
 * 获取北京时间 ISO 格式
 * 用于数据库存储
 */
export const getBeijingISO = (): string => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utc + 3600000 * 8);
  return beijingTime.toISOString();
};
