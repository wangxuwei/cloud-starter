/////////////////////
// The agent service is primarely designed to run administative task, and therefore does not do anything
// in the start process. However, as some point, it could listen to redis stream and/or pub/sub to do some
// administrative task ask well.
////

import { CORE_STORE_ROOT_DIR, __version__ } from "#common/conf.js";
import { getResMp4Name } from "#common/da/dao-asset.js";
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
	console.log(`--> vid-scaler (${__version__}) - starting`);

	new Worker("./dist/services/vid-scaler/src/wkr-bridge-asset-mp4.js");

	const assetScaledMp4Queue = getAppQueue("AssetScaledMp4");

	const vidScalerJobQueue = getJobQueue("VidScalerJob");

	for (;;) {
		const entry = await vidScalerJobQueue.nextJob();
		let ffmpegResult: any = null;

		try {
			const { orgId, assetId, res } = entry.data;

			const sysUtx = await getSysContext({ orgId });
			const asset = await assetDao.get(sysUtx, assetId);

			const assetName = ASSET_NAME + ".mp4";

			const remoteOrginalFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + assetName;

			// will return something like 'file-480p30.mp4' if name is 'file'
			const scaledName = getResMp4Name(assetName, res);
			const remoteScaledFile =
				CORE_STORE_ROOT_DIR + asset.folderPath + scaledName;

			const coreStore = await getCoreBucket();

			// if not already done, then, we update it.
			if (!(await existFile(coreStore, remoteScaledFile))) {
				const tempDir = `temp/${newUuid()}/`;
				await mkdir(tempDir, { recursive: true });

				const localOriginalFile = Path.join(tempDir, assetName);
				const localScaledFile = Path.join(tempDir, scaledName);

				await coreStore.download(remoteOrginalFile, localOriginalFile);

				// FIXME: extract height and fps from scaledOptions string
				const h = 480;
				const fps = 30;

				// ffmpeg -i vid-02.mp4 -vcodec libx264 -crf 23 -vf fps=30,scale=-2:480 -y vid-02-480p30.mp4
				// Note: crf 0-51, 23 being default. 17-18 close to lossless
				// Note: scale -2, to avoid getting (width cannot divide by 2), see https://stackoverflow.com/a/29582287/686724
				ffmpegResult = await execa(
					"ffmpeg",
					split(
						`-i ${localOriginalFile}  -vcodec libx264 -crf 23 -vf fps=${fps},scale=-2:${h} -y ${localScaledFile}`,
						" "
					)
				);

				await coreStore.upload(localScaledFile, remoteScaledFile);
			}

			// update the sd if not present
			// TODO: later probably check if this new processed is the lowest resolution
			if (asset.sd != res) {
				await assetDao.update(sysUtx, assetId, { sd: res });
			}

			await vidScalerJobQueue.done(entry);

			// if asset is a video, trigger audio extraction
			if (asset.type == "video") {
				// send the data event
				await assetScaledMp4Queue.add({
					type: "AssetScaledMp4",
					assetId,
					orgId,
					res,
				});
			}
		} catch (ex) {
			const msg = `ERROR - vid-scaler  ${ex} (ffmepg error: ${ffmpegResult?.stderr}) (skip and go next) - cause: ${ex}`;
			await vidScalerJobQueue.fail(entry, new Error(msg));
			console.log(msg, ex);
		}
	}
}
