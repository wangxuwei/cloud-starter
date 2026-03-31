import {
	assertEvent,
	getAppQueue,
	getJobQueue,
	VidInitJob,
} from "#common/queue.js";

main();

async function main() {
	// the read stream to bridge from
	const assetNewQueue = getAppQueue("AssetNew");

	// the write stream to bridge to
	const vidInitQueue = getJobQueue("VidInitJob");

	const streamGroup = "VidInitJobBridge";

	for (;;) {
		const entry = await assetNewQueue.next(streamGroup);
		assertEvent("AssetNew", entry.data);
		const { orgId, assetId, assetMimeType } = entry.data;
		if (assetMimeType.startsWith("video")) {
			const vidInitTodo: VidInitJob = { type: "VidInitJob", orgId, assetId };
			await vidInitQueue.add(vidInitTodo);
		}

		// acknowledge this stream entry for this group (i.e., mark it as completed, remove from the redis stream group pending)
		await assetNewQueue.ack(streamGroup, entry.id);
	}
}
