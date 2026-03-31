import { position } from "@dom-native/draggable";
import { BaseViewElement } from "common/v-base.js";
import { assetDco } from "dcos";
import {
	append,
	cherryChild,
	closest,
	customElement,
	elem,
	first,
	frag,
	getAttr,
	html,
	on,
	onEvent,
	OnEvent,
	onHub,
} from "dom-native";
import { asNum } from "utils-min";
import { wksListView } from "./v-wks";

const IMAGES_HTML = html`
	<header>
		<h1>Images</h1>
	</header>
	<section class="content">
		<div class="card-add asset-add">
			<d-ico name="ico-add"></d-ico>
			<h3>Add Image</h3>
		</div>
	</section>
`;

@customElement("v-images")
export class ImageView extends BaseViewElement {
	//// Key Elements
	get contentEl(): BaseViewElement {
		return this;
	} // for now the contentEl is this element
	get assetAddEl(): HTMLElement {
		return this.cacheFirst(".asset-add")!;
	}

	//// properties
	get projectId() {
		return asNum(getAttr(closest(this, "v-project-main")!, "project-id"));
	}
	get orgId() {
		return (<wksListView>this.closest("v-wks"))?.orgId;
	}

	//#region    ---------- Element Events ----------
	@onEvent("dragenter,dragover", ".asset-add")
	enableDrop(evt: DragEvent) {
		evt.preventDefault();
	}

	@onEvent("drop", ".asset-add")
	async viewAdd(evt: DragEvent & OnEvent) {
		evt.preventDefault();
		evt.stopPropagation();
		const file = evt.dataTransfer?.files?.[0];
		if (file != null) {
			await assetDco.create({ file, projectId: this.projectId });
		}
	}

	@onEvent("pointerup", ".show-menu")
	onCardShowMenuUp(evt: PointerEvent & OnEvent) {
		if (first("#image-card-menu") == null) {
			const [menu] = append(
				document.body,
				`
			<c-menu id='image-card-menu'>
			<li class="do-delete">Delete</li>
			</c-menu>`
			);

			position(menu, evt.selectTarget, { at: "bottom", align: "right" });

			const cardEl = closest(evt.selectTarget, '[data-type="Asset"]');
			on(menu, "pointerup", ".do-delete", async (evt) => {
				const id = asNum(cardEl?.getAttribute("data-id"));
				if (id == null) {
					throw new Error(
						`UI ERROR - cannot find data-type Asset data-id on element ${cardEl}`
					);
				}
				await assetDco.delete(id);
			});
		}
	}
	//#endregion ---------- /Element Events ----------

	//#region    ---------- Data Event ----------
	@onHub("dcoHub", "asset", "create,update,delete")
	onAssetChange() {
		this.refresh();
	}

	//#endregion ---------- /Data Event ----------
	async init() {
		// then initial render
		this.refresh();
	}

	async refresh() {
		const projectId = this.projectId;
		const assetList = await assetDco.listImageAssets(projectId!);
		const content = frag(assetList, (m) => {
			const itemContentEl = html`
			<header>
			<h2>${m.name}</h2>
			<c-ico src="#ico-more" class="show-menu"></c-ico>
			</header>
			<section>
				<img src="${m.url}"></img>
			</section>
		`;
			const item = elem("div", {
				class: "card",
				"data-id": m.id,
				"data-type": "Asset",
			});
			item.replaceChildren(document.importNode(itemContentEl, true));
			return item;
		});

		const mainContent = document.importNode(IMAGES_HTML, true);
		const sectionEl = cherryChild(mainContent, "section");
		sectionEl.append(content);
		this.replaceChildren(mainContent);
	}
}
