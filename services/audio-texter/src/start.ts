import { __version__, ASR_API_KEY, ASR_MODEL, CORE_STORE_ROOT_DIR } from '#common/conf.js';
import { getAudioName, getAudioTextName } from '#common/da/dao-media.js';
import { mediaDao } from '#common/da/daos.js';
import { getAppQueue, getJobQueue } from '#common/queue.js';
import { existFile, getCoreBucket } from '#common/store.js';
import { getSysContext } from '#common/user-context.js';
import { execa } from 'execa';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import { mkdir, rm, writeFile } from 'fs/promises';
import fetch from "node-fetch";
import * as Path from 'path';
import { v4 as newUuid } from 'uuid';
import { Worker } from 'worker_threads';

start();

async function transcribeWithGlm(audioFile:string): Promise<string> {
	if (!ASR_API_KEY) {
		throw new Error('GLM_API_KEY environment variable is not set');
	}

	const file = await fileFromPath(audioFile);
	const form = new FormData();
	form.append('model', ASR_MODEL);
	form.append('file', file);
	
	const response = await fetch('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${ASR_API_KEY}`
		},
		body: form as any
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`GLM API request failed: ${response.status} ${response.statusText} - ${errorText}`);
	}

	const result:any = await response.json();
	return result.text;
}

async function getAudioDuration(inputPath: string): Promise<number> {
	const result = await execa('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		inputPath
	]);
	return parseFloat(result.stdout.trim());
}

async function splitAudioIntoChunks(inputPath: string, outputDir: string, duration:number, chunkDuration: number = 30): Promise<string[]> {
	const chunkPaths: string[] = [];
	const numChunks = Math.ceil(duration / chunkDuration);

	for (let i = 0; i < numChunks; i++) {
		const chunkPath = Path.join(outputDir, `chunk-${i}.mp3`);
		await execa('ffmpeg', [
			'-i', inputPath,
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
}

async function transcribeToText(audioFile: string): Promise<string> {
	const duration = await getAudioDuration(audioFile);

	if (duration <= 10) {
		return await transcribeWithGlm(audioFile);
	}

	const verifyDuration = Math.floor(duration);
	const outputDir = Path.dirname(audioFile);
	const chunkPaths = await splitAudioIntoChunks(audioFile, outputDir, verifyDuration);
	const transcriptions: string[] = [];

	for (const chunkPath of chunkPaths) {
		const transcription = await transcribeWithGlm(chunkPath);
		
		let filterTranscription = transcription.endsWith("...") ? transcription.slice(0, transcription.length - 3): transcription;
		transcriptions.push(filterTranscription);
	}

	return transcriptions.join(' ');
}

async function start() {
	console.log(`--> audio-texter (${__version__}) - starting  ->> 445`);

	new Worker('./dist/services/audio-texter/src/wkr-bridge-media-text.js');

	const mediaTextQueue = getAppQueue('MediaText');

	const vidTextJobQueue = getJobQueue('VidTextJob');

	for (; ;) {
		const entry = await vidTextJobQueue.nextJob();
		let transcriptionResult: any = null;

		try {
			const { orgId, mediaId } = entry.data;

			const sysUtx = await getSysContext({ orgId });
			const media = await mediaDao.get(sysUtx, mediaId);

			const mediaName = media.name;

			const audioName = getAudioName(mediaName);
			const remoteAudioFile = CORE_STORE_ROOT_DIR + media.folderPath + audioName;

			const textName = getAudioTextName(mediaName);
			const remoteTextFile = CORE_STORE_ROOT_DIR + media.folderPath + textName;

			const coreStore = await getCoreBucket();

			if (!(await existFile(coreStore, remoteTextFile))) {
				const tempDir = `temp/${newUuid()}/`;
				await mkdir(tempDir, { recursive: true });

				const localAudioFile = Path.join(tempDir, audioName);
				const localTextFile = Path.join(tempDir, textName);

				await coreStore.download(remoteAudioFile, localAudioFile);

				const transcriptionText = await transcribeToText(localAudioFile);

				transcriptionResult = transcriptionText;

				await writeFile(localTextFile, transcriptionText);

				await coreStore.upload(localTextFile, remoteTextFile);

				await mediaTextQueue.add({ type: 'MediaText', mediaId, orgId });

				await rm(tempDir, { recursive: true, force: true });
			}

			await vidTextJobQueue.done(entry);

		} catch (ex) {
			const msg = `ERROR - audio-texter ${ex} (transcription result: ${transcriptionResult}) (skip and go next) - cause: ${ex}`;
			await vidTextJobQueue.fail(entry, new Error(msg));
			console.log(msg, ex);
		}
	}
}




