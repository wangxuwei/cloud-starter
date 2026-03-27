import { webRequest } from "common/web-request.js";
import { Asset, Org, Project, QueryOptions, Wks } from "shared/entities.js";
import { BaseDco, dcoHub } from "./dco-base.js";

class AssetDco extends BaseDco<Asset, QueryOptions<Asset>> {
	constructor() {
		super("asset");
	}

	async create(props: any & { file?: File }): Promise<Asset> {
		const file = props.file;
		if (file) {
			const formData = new FormData();
			for (const prop in props) {
				formData.append(prop, props[prop]);
			}

			const webResult = await webRequest("POST", "/api/upload-asset", {
				body: formData,
			});
			const asset = webResult.success ? (webResult.data as Asset) : null;

			if (asset == null) {
				throw new Error(
					`AssetDao.create could not create the new asset for ${file.name}`
				);
			}

			dcoHub.pub(this.cmd_suffix, "create", asset);
			return asset;
		} else {
			return super.create(props);
		}
	}

	async listImageAssets(projectId: number): Promise<Asset[]> {
		return super.list({ filters: { type: "image", projectId } });
	}

	async listVideoAssets(projectId: number): Promise<Asset[]> {
		return super.list({ filters: { type: "video", projectId } });
	}
}

export const wksDco = new BaseDco<Wks, QueryOptions<Wks>>("wks");
export const orgDco = new BaseDco<Org, QueryOptions<Org>>("org");
export const projectDco = new BaseDco<Project, QueryOptions<Project>>(
	"project"
);

export const assetDco = new AssetDco();
