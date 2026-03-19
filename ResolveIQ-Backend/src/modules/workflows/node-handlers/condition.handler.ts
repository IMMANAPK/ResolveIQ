import { NodeHandler } from './index';

export const conditionHandler: NodeHandler = async ({ config, complaint, runContext }) => {
  const fieldStr = config.field as string;
  const op = config.op as string;
  const value = config.value;

  let actualValue: any;
  if (fieldStr.startsWith('complaint.')) {
    const key = fieldStr.replace('complaint.', '') as keyof typeof complaint;
    actualValue = complaint[key];
  } else {
    actualValue = runContext[fieldStr];
  }

  let conditionResult = false;
  switch (op) {
    case 'eq': conditionResult = actualValue === value; break;
    case 'neq': conditionResult = actualValue !== value; break;
    case 'gt': conditionResult = Number(actualValue) > Number(value); break;
    case 'lt': conditionResult = Number(actualValue) < Number(value); break;
    case 'contains': conditionResult = String(actualValue).includes(String(value)); break;
  }

  return { conditionResult };
};
