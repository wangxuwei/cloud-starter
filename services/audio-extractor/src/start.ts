import { __version__, CORE_STORE_ROOT_DIR } from "#common/conf.js";
import { getAudioName } from "#common/da/dao-asset.js";
import { assetDao } from "#common/da/daos.js";
import { getAppQueue, getJobQueue } from "#common/queue.js";
import { existFile, getCoreBucket } from "#common/store.js";
import { getSysContext } from "#common/user-context.js";
import { ASSET_NAME } from "#shared/entities.js";
import { execa } from "execa";
import { mkdir } from "fs/promises";
import * as Path from "path";
import { split } from "utils-min";
import { v7 as newUuid } from "uuid";
import { Worker } from "worker_threads";

// for execa
const { stdout, stderr } = process;
const execaOpts = Object.freeze({ stdout, stderr });

start();

async function start() {
	console.log(`--> audio-extractor (${__version__}) - starting`);

	new Worker("./dist/services/audio-extractor/src/wkr-bridge-asset-audio.js");

	const assetAudioMp4Queue = getAppQueue("AssetAudioMp4");

	const vidAudioJobQueue = getJobQueue("VidAudioJob");

	const vidTextJobQueue = getJobQueue("VidTextJob");

	for (;;) {
		const entry = await vidAudioJobQueue.nextJob();
		let ffmpegResult: any = null;

		try {
			const { orgId, assetId } = entry.data;

			const sysUtx = await getSysContext({ orgId });
			const asset = await assetDao.get(sysUtx, assetId);

			const assetName = ASSET_NAME + ".mp4";

			const remoteOrginalFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + ASSET_NAME + ".mp4";

			const audioName = getAudioName(assetName);
			const remoteAudioFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + audioName;

			const coreStore = await getCoreBucket();

			if (!(await existFile(coreStore, remoteAudioFile))) {
				const tempDir = `temp/${newUuid()}/`;
				await mkdir(tempDir, { recursive: true });

				const localOriginalFile = Path.join(tempDir, assetName);
				const localAudioFile = Path.join(tempDir, audioName);

				await coreStore.download(remoteOrginalFile, localOriginalFile);

				ffmpegResult = await execa(
					"ffmpeg",
					split(
						`-i ${localOriginalFile} -vn -acodec libmp3lame -ac 1 -ab 128k -ar 16000 -f mp3 -y ${localAudioFile}`,
						" "
					)
				);

				await coreStore.upload(localAudioFile, remoteAudioFile);

				await assetAudioMp4Queue.add({ type: "AssetAudioMp4", assetId, orgId });
			}

			await vidTextJobQueue.add({ type: "VidTextJob", orgId, assetId });

			await vidAudioJobQueue.done(entry);
		} catch (ex) {
			const msg = `ERROR - audio-extractor  ${ex} (ffmepg error: ${ffmpegResult?.stderr}) (skip and go next) - cause: ${ex}`;
			await vidAudioJobQueue.fail(entry, new Error(msg));
			console.log(msg, ex);
		}
	}
}
