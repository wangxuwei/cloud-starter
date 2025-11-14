import { pathAt } from 'common/route.js';
import { BaseViewElement } from 'common/v-base.js';
import { all, append, className, customElement, elem, getAttr, onHub } from 'dom-native';
import { asNum } from 'utils-min';

const subViews: any = {
	'images': 'v-images',
	'videos': 'v-videos',
	'timelines': 'v-timeline-main'
}
@customElement('v-project-main')
export class ProjectMainView extends BaseViewElement {

	//// properties
	get projectId() { return asNum(getAttr(this, 'project-id')) }

	//#region    ---------- Element & Hub Events ---------- 
	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}
	//#endregion ---------- /Element & Hub Events ----------

	//#endregion ---------- /Data Event ---------- 
	async init() {
		// then initial render
		this.innerHTML = _render(this.projectId);
		this.refresh();
	}

	async refresh() {

		if (this.hasPathChanged(3)) {
			const newPath = pathAt(3) ?? 'videos';
			if (newPath) {
				all(this, ':scope > *')[1]?.remove();
				append(this, className(elem(subViews[newPath]), { screen: true }));
			}
		}


	}


}


function _render(projectId: number | null) {
	return `<v-nav></v-nav>`
}
