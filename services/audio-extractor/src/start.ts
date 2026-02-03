import { __version__, CORE_STORE_ROOT_DIR } from '#common/conf.js';
import { getAudioName } from '#common/da/dao-media.js';
import { mediaDao } from '#common/da/daos.js';
import { getAppQueue, getJobQueue } from '#common/queue.js';
import { existFile, getCoreBucket } from '#common/store.js';
import { getSysContext } from '#common/user-context.js';
import { execa } from 'execa';
import { mkdir } from 'fs/promises';
import * as Path from 'path';
import { split } from 'utils-min';
import { v4 as newUuid } from 'uuid';
import { Worker } from 'worker_threads';


// for execa
const { stdout, stderr } = process;
const execaOpts = Object.freeze({ stdout, stderr });



start();

async function start() {
	console.log(`--> audio-extractor (${__version__}) - starting  ->> 445`);

	new Worker('./dist/services/audio-extractor/src/wkr-bridge-media-audio.js');

	const mediaAudioMp4Queue = getAppQueue('MediaAudioMp4');

	const vidAudioJobQueue = getJobQueue('VidAudioJob');

	const vidTextJobQueue = getJobQueue('VidTextJob');

	for (; ;) {
		const entry = await vidAudioJobQueue.nextJob();
		let ffmpegResult: any = null;

		try {
			const { orgId, mediaId } = entry.data;

			const sysUtx = await getSysContext({ orgId });
			const media = await mediaDao.get(sysUtx, mediaId);

			const mediaName = media.name;

			const remoteOrginalFile = CORE_STORE_ROOT_DIR + media.folderPath + mediaName;

			const audioName = getAudioName(mediaName);
			const remoteAudioFile = CORE_STORE_ROOT_DIR + media.folderPath + audioName;

			const coreStore = await getCoreBucket();

			if (!(await existFile(coreStore, remoteAudioFile))) {
				const tempDir = `temp/${newUuid()}/`;
				await mkdir(tempDir, { recursive: true });

				const localOriginalFile = Path.join(tempDir, mediaName);
				const localAudioFile = Path.join(tempDir, audioName);

				await coreStore.download(remoteOrginalFile, localOriginalFile);

				ffmpegResult = await execa('ffmpeg', split(`-i ${localOriginalFile} -vn -acodec libmp3lame -ab 128k -f mp3 -y ${localAudioFile}`, ' '));

				await coreStore.upload(localAudioFile, remoteAudioFile);

				await mediaAudioMp4Queue.add({ type: 'MediaAudioMp4', mediaId, orgId });
			}

			await vidTextJobQueue.add({ type: 'VidTextJob', orgId, mediaId });

			await vidAudioJobQueue.done(entry);

		} catch (ex) {
			const msg = `ERROR - audio-extractor  ${ex} (ffmepg error: ${ffmpegResult?.stderr}) (skip and go next) - cause: ${ex}`;
			await vidAudioJobQueue.fail(entry, new Error(msg));
			console.log(msg, ex);
		}

	}


}

