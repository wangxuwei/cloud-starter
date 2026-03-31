import { Asset, AssetResolution, AssetType } from "#shared/entities.js";
import { File } from "formidable"; // from koa-body
import * as Path from "path";
import { CORE_STORE_CDN_BASE_URL, CORE_STORE_ROOT_DIR } from "../conf.js";
import { Err } from "../error.js";
import { getAppQueue } from "../queue.js";
import { getCoreBucket } from "../store.js";
import { UserContext } from "../user-context.js";
import { getMimeType, symbolDic } from "../utils.js";
import { OrgScopedDao } from "./dao-org-scoped.js";

const ERROR = symbolDic("ASSET_UPLOAD_FAIL_NO_ORGID");

export class AssetDao extends OrgScopedDao<Asset, number> {
	constructor() {
		super({ table: "asset", stamped: true });
	}

	//#region    ---------- Data Entity Processing Override ----------
	parseRecord(dbRec: any): Asset {
		dbRec.url = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${
			dbRec.folderPath
		}${dbRec.name ?? dbRec.srcName}`;
		if (dbRec.sd) {
			dbRec.sdUrl = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${
				dbRec.folderPath
			}${getResMp4Name(dbRec.name, dbRec.sd)}`;
		}
		return dbRec as Asset;
	}
	//#endregion ---------- /Data Entity Processing Override ----------

	/** Override the baseDao.create to require 'type' and 'name' */
	async create(
		utx: UserContext,
		data: Partial<Asset> & Pick<Asset, "type" | "name">
	): Promise<number> {
		return super.create(utx, data);
	}

	//#region    ---------- Asset Specific Methods ----------
	async createWithFile(
		utx: UserContext,
		data: Partial<Asset> & { file: File }
	): Promise<number> {
		// NOTE: Needed to avoid cyclic issues in some cases which makes the AssetDao undefined in export. Investigate if cleaner alternative.
		const { orgDao } = await import("./daos.js");

		const orgId = utx.orgId;

		if (orgId == null) {
			throw new Err(ERROR.ASSET_UPLOAD_FAIL_NO_ORGID);
		}

		const file = data.file;
		const coreStore = await getCoreBucket();

		const org = await orgDao.get(utx, orgId);
		const srcName = file.originalFilename!;
		const name = srcName; // at start same name
		const type = getAssetType(name);
		const projectId = data.projectId;

		const assetId = await this.create(utx, { srcName, name, type, projectId });
		const asset = await this.get(utx, assetId);
		const folderPath = `org/${org.uuid}/assets/${asset.uuid}/`;
		await coreStore.upload(
			file.filepath,
			CORE_STORE_ROOT_DIR + folderPath + srcName
		);
		await this.update(utx, assetId, { folderPath });

		const assetMimeType = getMimeType(name);
		if (assetMimeType.startsWith("video")) {
			getAppQueue("AssetNew").add({
				type: "AssetNew",
				orgId,
				assetId: assetId,
				assetMimeType,
			});
		}
		return assetId;
	}
	//#endregion ---------- /Asset Specific Methods ----------
}

export function getResMp4Name(fileName: string, res: AssetResolution) {
	return Path.parse(fileName).name + `-${res}.mp4`;
}

export function getAudioName(fileName: string) {
	return Path.parse(fileName).name + `-audio.mp3`;
}

export function getAudioTextName(fileName: string) {
	return Path.parse(fileName).name + `-audio-text.txt`;
}

export function getAssetType(fileName: string): AssetType {
	const mimeType = getMimeType(fileName);
	const [type, subType] = mimeType.split("/");
	if (type == "image" || type == "video") {
		return type;
	} else {
		throw new Error(
			`File ${fileName} is not of type image or video but ${mimeType}`
		);
	}
}
