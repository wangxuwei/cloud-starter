import { __version__, CORE_STORE_ROOT_DIR } from "#common/conf.js";
import { getAudioName, getAudioTextName } from "#common/da/dao-asset.js";
import { assetDao } from "#common/da/daos.js";
import { getAppQueue, getJobQueue } from "#common/queue.js";
import { existFile, getCoreBucket } from "#common/store.js";
import { getSysContext } from "#common/user-context.js";
import { ASSET_NAME } from "#shared/entities.js";
import { mkdir, rm, writeFile } from "fs/promises";
import * as Path from "path";
import { v7 as newUuid } from "uuid";
import { Worker } from "worker_threads";
import { transcribeToText } from "./asr/transcribe.js";

start();

async function start() {
	console.log(`--> audio-texter (${__version__}) - starting  ->> 445`);

	new Worker("./dist/services/audio-texter/src/wkr-bridge-asset-text.js");

	const assetTextQueue = getAppQueue("AssetText");

	const vidTextJobQueue = getJobQueue("VidTextJob");

	for (;;) {
		const entry = await vidTextJobQueue.nextJob();
		let transcriptionResult: any = null;

		try {
			const { orgId, assetId } = entry.data;

			const sysUtx = await getSysContext({ orgId });
			const asset = await assetDao.get(sysUtx, assetId);

			const assetName = ASSET_NAME + ".mp4";

			const audioName = getAudioName(assetName);
			const remoteAudioFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + audioName;

			const textName = getAudioTextName(assetName);
			const remoteTextFile = CORE_STORE_ROOT_DIR + asset.folderPath + textName;

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

				await assetTextQueue.add({ type: "AssetText", assetId, orgId });

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
