import { Media, MediaResolution, MediaType } from '#shared/entities.js';
import { File } from 'formidable'; // from koa-body
import * as Path from 'path';
import { CORE_STORE_CDN_BASE_URL, CORE_STORE_ROOT_DIR } from '../conf.js';
import { Err } from '../error.js';
import { getAppQueue } from '../queue.js';
import { getCoreBucket } from '../store.js';
import { UserContext } from '../user-context.js';
import { getMimeType, symbolDic } from '../utils.js';
import { OrgScopedDao } from './dao-org-scoped.js';

const ERROR = symbolDic(
	'MEDIA_UPLOAD_FAIL_NO_ORGID',
)

export class MediaDao extends OrgScopedDao<Media, number> {

	constructor() { super({ table: 'media', stamped: true }) }

	//#region    ---------- Data Entity Processing Override ---------- 
	parseRecord(dbRec: any): Media {
		dbRec.url = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${dbRec.folderPath}${dbRec.name ?? dbRec.srcName}`;
		if (dbRec.sd) {
			dbRec.sdUrl = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${dbRec.folderPath}${getResMp4Name(dbRec.name, dbRec.sd)}`;
		}
		return dbRec as Media;
	}
	//#endregion ---------- /Data Entity Processing Override ---------- 

	/** Override the baseDao.create to require 'type' and 'name' */
	async create(utx: UserContext, data: Partial<Media> & Pick<Media, 'type' | 'name'>): Promise<number> {
		return super.create(utx, data);
	}

	//#region    ---------- Media Specific Methods ---------- 
	async createWithFile(utx: UserContext, data: Partial<Media> & { file: File }): Promise<number> {
		// NOTE: Needed to avoid cyclic issues in some cases which makes the MediaDao undefined in export. Investigate if cleaner alternative.
		const { orgDao } = await import('./daos.js');

		const orgId = utx.orgId;

		if (orgId == null) {
			throw new Err(ERROR.MEDIA_UPLOAD_FAIL_NO_ORGID);
		}

		// TODO: For now, ignore any other data properties (infer all from name);
		const file = data.file;
		const coreStore = await getCoreBucket();

		const org = await orgDao.get(utx, orgId);
		const srcName = file.originalFilename!;
		const name = srcName; // at start same name
		const type = getMediaType(name);
		const projectId = data.projectId;

		const mediaId = await this.create(utx, { srcName, name, type, projectId });
		const media = await this.get(utx, mediaId);
		const folderPath = `org/${org.uuid}/medias/${media.uuid}/`;
		await coreStore.upload(file.filepath, CORE_STORE_ROOT_DIR + folderPath + srcName);
		await this.update(utx, mediaId, { folderPath });

		const mediaMimeType = getMimeType(name);
		getAppQueue('MediaNew').add({
			type: 'MediaNew',
			orgId,
			mediaId,
			mediaMimeType
		});
		return mediaId;
	}
	//#endregion ---------- /Media Specific Methods ---------- 
}

export function getResMp4Name(fileName: string, res: MediaResolution) {
	return Path.parse(fileName).name + `-${res}.mp4`;
}

export function getMediaType(fileName: string): MediaType {
	const mimeType = getMimeType(fileName);
	const [type, subType] = mimeType.split('/');
	if (type == 'image' || type == 'video') {
		return type;
	} else {
		throw new Error(`File ${fileName} is not of type image or video but ${mimeType}`);
	}

}