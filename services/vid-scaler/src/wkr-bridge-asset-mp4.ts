import {
	assertEvent,
	getAppQueue,
	getJobQueue,
	VidScalerJob,
} from "#common/queue.js";

main();

async function main() {
	// the read stream to bridge from
	const assetMp4Queue = getAppQueue("AssetMainMp4");

	// the write stream to bridge to
	const vidScalerTodoQueue = getJobQueue("VidScalerJob");

	const streamGroup = "vid-scaler-bgrp";

	for (;;) {
		const entry = await assetMp4Queue.next(streamGroup);
		assertEvent("AssetMainMp4", entry.data);

		const { orgId, assetId } = entry.data;

		const vidScalerTodo: VidScalerJob = {
			type: "VidScalerJob",
			orgId,
			assetId,
			res: "480p30",
		};
		await vidScalerTodoQueue.add(vidScalerTodo);

		// acknowledge this stream entry for this group (i.e., mark it as completed, remove from the redis stream group pending)
		await assetMp4Queue.ack(streamGroup, entry.id);
	}
}
