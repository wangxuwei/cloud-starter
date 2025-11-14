import { pathAt } from 'common/route.js';
import { BaseViewElement } from 'common/v-base.js';
import { all, customElement, onHub } from 'dom-native';
import { ProjectMainView } from './v-project-main.js';
import { projectListView } from './v-project.js';
import { wksListView } from './v-wks.js';

const defaultPath = '';

@customElement('v-nav')
export class NavView extends BaseViewElement {

	get projectId() { return (<ProjectMainView>this.closest('v-project-main'))?.projectId }
	get wksId() { return (<projectListView>this.closest('v-project'))?.wksId }
	get orgId() { return (<wksListView>this.closest('v-wks'))?.orgId }

	//#region    ---------- Element & Hub Events ---------- 
	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}
	//#endregion ---------- /Element & Hub Events ---------- 

	init() {
		super.init();
		this.innerHTML = _render(this.orgId, this.wksId, this.projectId);
		this.refresh();
	}

	refresh() {
		const idx = 1; // path ind
		let urlName = pathAt(idx) ?? 'videos';

		for (const a of all(this, 'a')) {
			let href = a.getAttribute('href');
			let linkName = href?.split('/')[idx + 1] ?? ''; // has an extra / at start
			if (linkName === urlName) {
				a.classList.add('sel');
			} else if (a.classList.contains('sel')) {
				a.classList.remove('sel');
			}
		}
	}

}

//// HTML
function _render(orgId: number | null, wksId: number | null, projectId: number | null) {
	return `<a href="/${orgId}/${wksId}/${projectId}/images"><span class='bar'></span><d-ico name="ico-images"></d-ico><label>Images</label></a>
			<a href="/${orgId}/${wksId}/${projectId}/videos"><span class='bar'></span><d-ico name="ico-videos"></d-ico><label>Videos</label></a>
			<a href="/${orgId}/${wksId}/${projectId}/timelines"><span class='bar'></span><d-ico name="ico-videos"></d-ico><label>Timelines</label></a>
			`;
}