import { ASR_API_KEY } from '#common/conf.js';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import fetch from "node-fetch";
import { getAudioDuration, transcribeAudio } from '../audio-splitter.js';

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';

interface GlmTranscriptionResponse {
  text: string;
}

export async function transcribeWithGlm(filePath: string, model: string): Promise<string> {
  const apiKey = ASR_API_KEY;
  if (!apiKey) {
    throw new Error('ASR_API_KEY environment variable is required for GLM service');
  }

  const duration = await getAudioDuration(filePath);
  const verifyDuration = Math.floor(duration);
  
  const chunks = await transcribeAudio(filePath, verifyDuration);
  
  const transcriptions = await Promise.all(
    chunks.map(chunk => transcribeWithApi(chunk, model, apiKey))
  );
    
  return transcriptions.join(' ');
}

async function transcribeWithApi(chunk:string, model:string, apiKey:string,){
    const formData = new FormData();
    formData.append('model', model);
    formData.append('file', await fileFromPath(chunk));

    const response = await fetch(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM ASR API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as GlmTranscriptionResponse;
    let transcription = result.text || '';
    let filterTranscription = transcription.endsWith("...") ? transcription.slice(0, transcription.length - 3): transcription;

    return filterTranscription;
}
