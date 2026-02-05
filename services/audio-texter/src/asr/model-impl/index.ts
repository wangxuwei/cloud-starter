import { transcribeWithGlm } from './glm.js';

export type TranscribeFunction = (filePath: string, model: string) => Promise<string>;

const services: Record<string, TranscribeFunction> = {};

export function registerAsrService(name: string, service: TranscribeFunction): void {
  services[name] = service;
}

export function getAsrService(name: string): TranscribeFunction {
  const service = services[name];
  if (!service) {
    throw new Error(`ASR service not found: ${name}`);
  }
  return service;
}

export function parseServiceName(model: string): string {
  const parts = model.split('-');
  return parts[0].toUpperCase();
}

registerAsrService('GLM', transcribeWithGlm);