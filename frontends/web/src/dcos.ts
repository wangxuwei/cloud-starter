import { webRequest } from 'common/web-request.js';
import { Media, Org, Project, QueryOptions, Wks } from 'shared/entities.js';
import { BaseDco, dcoHub } from './dco-base.js';


class MediaDao extends BaseDco<Media, QueryOptions<Media>>{
	constructor() { super('media') }

	async create(props: any & { file?: File }): Promise<Media> {
		const file = props.file;
		if (file) {
			const formData = new FormData();
			formData.append('file', file);
			// TODO - needs to change URL
			const webResult = await webRequest('POST', '/api/upload-media', { body: formData });
			const media = (webResult.success) ? webResult.data as Media : null;

			if (media == null) {
				throw new Error(`MediaDao.create could not create the new media for ${file.name}`);
			}

			dcoHub.pub(this.cmd_suffix, 'create', media);
			return media;
		} else {
			return super.create(props);
		}
	}

	async listImages(): Promise<Media[]> {
		return super.list({ matching: { type: 'image' } });
	}

	async listVideos(): Promise<Media[]> {
		return super.list({ matching: { type: 'video' } });
	}
}


export const wksDco = new BaseDco<Wks, QueryOptions<Wks>>('wks');
export const orgDco = new BaseDco<Org, QueryOptions<Org>>('org');
export const projectDco = new BaseDco<Project, QueryOptions<Project>>('project');

export const mediaDco = new MediaDao();