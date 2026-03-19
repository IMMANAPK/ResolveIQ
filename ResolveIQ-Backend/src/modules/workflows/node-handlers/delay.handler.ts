import { NodeHandler } from './index';

export const delayHandler: NodeHandler = async ({ config }) => {
  const minutes = Number(config.minutes) || 0;
  const delayMs = minutes * 60 * 1000;
  return { delayMs };
};
