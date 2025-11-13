import { pathAt } from 'common/route.js';
import { BaseViewElement } from 'common/v-base.js';
import { all, append, className, customElement, elem, getAttr, onHub } from 'dom-native';
import { asNum } from 'utils-min';

export const t = 123;

const subViews: any = {
	'images': 'v-images',
	'videos': 'v-videos',
	'timelines': 'v-timeline-main'
}
@customElement('v-org-main')
export class OrgMainView extends BaseViewElement {

	//// properties
	get orgId() { return asNum(getAttr(this, 'org-id')) }

	//#region    ---------- Element & Hub Events ---------- 
	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}
	//#endregion ---------- /Element & Hub Events ----------

	//#endregion ---------- /Data Event ---------- 
	async init() {
		// then initial render
		this.innerHTML = _render(this.orgId);
		this.refresh();
	}

	async refresh() {

		if (this.hasPathChanged(1)) {
			const newPath = pathAt(1) ?? 'videos';
			if (newPath) {
				all(this, ':scope > *')[1]?.remove();
				append(this, className(elem(subViews[newPath]), { screen: true }));
			}
		}


	}


}


function _render(orgId: number | null) {
	return `<v-nav></v-nav>`
}
