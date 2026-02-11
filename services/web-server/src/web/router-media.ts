// <origin src="https://raw.githubusercontent.com/BriteSnow/cloud-starter/master/services/web-server/src/web/router-auth-google-oauth.ts" />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { mediaDao } from '#common/da/daos.js';
import { Err } from '#common/error.js';
import { symbolDic } from '#common/utils.js';
import { ApiKtx, AppRouter, routePost, success } from '#common/web/koa-utils.js';


// Module Error Code
const ERROR = symbolDic(
	'FILE_NOT_FOUND'
)


class MediaRouter extends AppRouter {

	@routePost('/upload-media')
	async create(ktx: ApiKtx) {
		const utx = ktx.state.utx;
		const body = ktx.request.body as any;
		const projectId = body?.projectId;
		// ctx.router available
		const file = ktx.request.files?.file; // 'file' is the formData name for the first file
		if (file && !(file instanceof Array)) {
			const id = await mediaDao.createWithFile(utx, { file, projectId });
			const media = await mediaDao.get(utx, id);
			return success(media);
		} else {
			throw new Err(ERROR.FILE_NOT_FOUND, `Cannot create media, file not found`);
		}
	}

}

export default function apiRouter(prefix?: string) { return new MediaRouter(prefix) };