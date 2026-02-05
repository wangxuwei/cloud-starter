import { ASR_MODEL } from '#common/conf.js';
import { getAsrService, parseServiceName } from './model-impl/index.js';

export async function transcribeToText(audioFilePath: string): Promise<string> {
  const model = ASR_MODEL;
  if (!model) {
    throw new Error('No specific model provided');
  }

  const serviceName = parseServiceName(model);
  const transcribeFunction = getAsrService(serviceName);

  return transcribeFunction(audioFilePath, model);
}
