import { assertEvent, getAppQueue, getJobQueue, VidAudioJob } from '#common/queue.js';


main();

async function main() {

	const mediaScaledMp4Queue = getAppQueue('MediaScaledMp4');

	const vidAudioTodoQueue = getJobQueue('VidAudioJob');

	const streamGroup = 'audio-extractor-bgrp';

	for (; ;) {
		const entry = await mediaScaledMp4Queue.next(streamGroup);
		assertEvent('MediaScaledMp4', entry.data);

		const { orgId, mediaId } = entry.data;


		const vidAudioTodo: VidAudioJob = { type: 'VidAudioJob', orgId, mediaId };
		await vidAudioTodoQueue.add(vidAudioTodo);


		await mediaScaledMp4Queue.ack(streamGroup, entry.id);
	}
}
