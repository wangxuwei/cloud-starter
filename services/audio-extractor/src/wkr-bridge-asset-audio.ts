import {
	assertEvent,
	getAppQueue,
	getJobQueue,
	VidAudioJob,
} from "#common/queue.js";

main();

async function main() {
	const assetScaledMp4Queue = getAppQueue("AssetScaledMp4");

	const vidAudioTodoQueue = getJobQueue("VidAudioJob");

	const streamGroup = "audio-extractor-bgrp";

	for (;;) {
		const entry = await assetScaledMp4Queue.next(streamGroup);
		assertEvent("AssetScaledMp4", entry.data);

		const { orgId, assetId } = entry.data;

		const vidAudioTodo: VidAudioJob = { type: "VidAudioJob", orgId, assetId };
		await vidAudioTodoQueue.add(vidAudioTodo);

		await assetScaledMp4Queue.ack(streamGroup, entry.id);
	}
}
