/////////////////////
// The vid-init job service is reponsible to inialize the asset video to make sure it has everything needed for further service.
// - make sure it has a main .mp4 (if not .mp4, then, transcode and change name)
// - trigger the data event
////

import { CORE_STORE_ROOT_DIR, __version__ } from "#common/conf.js";
import { assetDao } from "#common/da/daos.js";
import { getAppQueue, getJobQueue } from "#common/queue.js";
import { existFile, getCoreBucket } from "#common/store.js";
import { getSysContext } from "#common/user-context.js";
import { ASSET_NAME } from "#shared/entities.js";
import { execa } from "execa";
import { mkdir } from "fs/promises";
import { lookup } from "mime-types";
import * as Path from "path";
import { split } from "utils-min";
import { v7 as newUuid } from "uuid";
import { Worker } from "worker_threads";

// for execa
const { stdout, stderr } = process;
const execaOpts = Object.freeze({ stdout, stderr });

start();

async function start() {
	console.log(`--> vid-init (${__version__}) - starting`);

	new Worker("./dist/services/vid-init/src/wkr-bridge-asset-new.js");

	const assetMainMp4Queue = getAppQueue("AssetMainMp4");

	const vidInitJobQueue = getJobQueue("VidInitJob");

	for (;;) {
		const entry = await vidInitJobQueue.nextJob();

		const { orgId, assetId } = entry.data;

		try {
			const sysUtx = await getSysContext({ orgId });
			const asset = await assetDao.get(sysUtx, assetId);

			// if the asset.name is not mp4, then, transcode
			// FIXME: needs to suport other video types
			const assetName = asset.name;
			const assetType = lookup(assetName) || "unknown";
			const mp4Name = ASSET_NAME + ".mp4";
			const remoteSrcFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + asset.srcName;
			const remoteMp4File = CORE_STORE_ROOT_DIR + asset.folderPath + mp4Name;

			const coreStore = await getCoreBucket();
			if (assetType != "video/mp4") {
				const tempDir = `temp/${newUuid()}/`;
				const tempSrcFile = Path.join(tempDir, assetName);
				const tempMp4File = Path.join(tempDir, mp4Name);

				if (!(await existFile(coreStore, remoteMp4File))) {
					await mkdir(tempDir, { recursive: true });
					await coreStore.download(remoteSrcFile, tempSrcFile);

					//ffmpeg -i input.mp4 -vcodec libx264 -crf 20 output.mp4
					await execa(
						"ffmpeg",
						split(
							`-i ${tempSrcFile}  -vcodec libx264 -crf 20 ${tempMp4File}`,
							" "
						)
					);
					await coreStore.upload(tempMp4File, remoteMp4File);
				}
				await assetDao.update(sysUtx, assetId, { name: mp4Name });
			} else {
				await coreStore.copy(remoteSrcFile, remoteMp4File);
			}

			//// Send the Data Event AssetMainMp4
			// NOTE: Even if the data was already mp4, then, we still send the event AssetMainMp4 for other to pickup
			const assetAfterUpdate = await assetDao.get(sysUtx, assetId);
			if (assetAfterUpdate.name.endsWith(".mp4")) {
				await assetMainMp4Queue.add({ type: "AssetMainMp4", orgId, assetId });
			}

			await vidInitJobQueue.done(entry);
		} catch (ex) {
			const msg = `ERROR - vid-init - Cannot process asset ${assetId} - cause: ${ex} `;
			await vidInitJobQueue.fail(entry, new Error(msg));
			console.log(msg);
		}
	}
}
