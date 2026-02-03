import { assertEvent, getAppQueue, getJobQueue, VidTextJob } from '#common/queue.js';


main();

async function main() {

	const mediaAudioMp4Queue = getAppQueue('MediaAudioMp4');

	const vidTextTodoQueue = getJobQueue('VidTextJob');

	const streamGroup = 'audio-texter-bgrp';

	for (; ;) {
		const entry = await mediaAudioMp4Queue.next(streamGroup);
		console.log(entry);
		
		assertEvent('MediaAudioMp4', entry.data);

		const { orgId, mediaId } = entry.data;


		const vidTextTodo: VidTextJob = { type: 'VidTextJob', orgId, mediaId };
		await vidTextTodoQueue.add(vidTextTodo);


		await mediaAudioMp4Queue.ack(streamGroup, entry.id);
	}
}
