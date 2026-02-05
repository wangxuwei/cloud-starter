import { execa } from 'execa';
import { ensureDir } from 'fs-extra';
import { rm } from 'fs/promises';
import * as Path from 'path';

export async function transcribeAudio(audioFilePath: string, duration: number, chunkDuration = 10): Promise<string[]> {
  const outputDir = Path.join(Path.dirname(audioFilePath), "chunks");
  await ensureDir(outputDir);

  try {
    const chunkPaths: string[] = [];
    const numChunks = Math.ceil(duration / chunkDuration);
    for (let i = 0; i < numChunks; i++) {
      const chunkPath = Path.join(outputDir, `chunk-${i}.mp3`);
      await execa('ffmpeg', [
        '-i', audioFilePath,
        '-ss', `${i * chunkDuration}`,
        '-t', `${chunkDuration}`,
        '-c:a', 'libmp3lame',
        '-ar', '16000',
        '-b:a', '64k',
        '-ac', '1',
        '-y',
        chunkPath
      ]);
      chunkPaths.push(chunkPath);
    }
  
    return chunkPaths;
  } catch (error) {
    await rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}

export async function getAudioDuration(inputPath: string): Promise<number> {
	const result = await execa('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		inputPath
	]);
	return parseFloat(result.stdout.trim());
}
