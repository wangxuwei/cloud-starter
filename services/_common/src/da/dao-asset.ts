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
import { knexQuery } from "./db.js";

const ERROR = symbolDic(
	"ASSET_UPLOAD_FAIL_NO_ORGID",
	"ASSET_UPLOAD_FAIL_NO_PROJECTID",
	"ASSET_UPLOAD_FAIL_NO_WKSID"
);

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

	/**
	 * Load org, wks, and project UUIDs for a given asset ID
	 * @param utx User context
	 * @param assetId Asset ID
	 * @returns Object containing orgUuid, wksUuid, and projectUuid
	 */
	private async getOrgWksProjectUuid(
		utx: UserContext,
		assetId: number
	): Promise<{ orgUuid: string; wksUuid: string; projectUuid: string }> {
		const { query } = await knexQuery({ utx, tableName: "asset" });

		const result = await query
			.select({
				orgUuid: "org.uuid",
				wksUuid: "wks.uuid",
				projectUuid: "project.uuid",
			})
			.join("project", "asset.projectId", "project.id")
			.join("wks", "project.wksId", "wks.id")
			.join("org", "wks.orgId", "org.id")
			.where("asset.id", assetId)
			.first();

		if (!result) {
			throw new Error(
				`Cannot find org, wks, and project UUIDs for asset ${assetId}`
			);
		}

		return result as { orgUuid: string; wksUuid: string; projectUuid: string };
	}

	async createWithFile(
		utx: UserContext,
		data: Partial<Asset> & { file: File }
	): Promise<number> {
		const orgId = utx.orgId;

		if (orgId == null) {
			throw new Err(ERROR.ASSET_UPLOAD_FAIL_NO_ORGID);
		}

		const file = data.file;
		const coreStore = await getCoreBucket();

		const srcName = file.originalFilename!;
		const name = srcName; // at start same name
		const type = getAssetType(name);
		const projectId = data.projectId;

		if (projectId == null) {
			throw new Err(ERROR.ASSET_UPLOAD_FAIL_NO_PROJECTID);
		}

		const assetId = await this.create(utx, { srcName, name, type, projectId });
		const asset = await this.get(utx, assetId);

		// Load org, wks, and project UUIDs in a single query
		const { orgUuid, wksUuid, projectUuid } = await this.getOrgWksProjectUuid(
			utx,
			assetId
		);

		// Update folderPath format to include orgs, wkss, and project
		const folderPath = `orgs/${orgUuid}/wkss/${wksUuid}/project/${projectUuid}/assets/${asset.uuid}/`;
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
