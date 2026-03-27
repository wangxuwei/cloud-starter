import { __version__, CORE_STORE_ROOT_DIR } from '#common/conf.js';
import { getAudioName, getAudioTextName } from '#common/da/dao-media.js';
import { mediaDao } from '#common/da/daos.js';
import { getAppQueue, getJobQueue } from '#common/queue.js';
import { existFile, getCoreBucket } from '#common/store.js';
import { getSysContext } from '#common/user-context.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import * as Path from 'path';
import { v7 as newUuid } from 'uuid';
import { Worker } from 'worker_threads';
import { transcribeToText } from './asr/transcribe.js';

start();

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
