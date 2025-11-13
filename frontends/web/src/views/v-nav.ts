import { pathAt } from 'common/route.js';
import { BaseViewElement } from 'common/v-base.js';
import { all, customElement, onHub } from 'dom-native';
import { OrgMainView } from './v-org-main.js';

const defaultPath = '';

@customElement('v-nav')
export class NavView extends BaseViewElement {

	get orgId() { return (<OrgMainView>this.closest('v-org-main'))?.orgId }

	//#region    ---------- Element & Hub Events ---------- 
	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}
	//#endregion ---------- /Element & Hub Events ---------- 

	init() {
		super.init();
		this.innerHTML = _render(this.orgId);
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
function _render(orgId: number | null) {
	return `<a href="/${orgId}/images"><span class='bar'></span><d-ico name="ico-images"></d-ico><label>Images</label></a>
			<a href="/${orgId}/videos"><span class='bar'></span><d-ico name="ico-videos"></d-ico><label>Videos</label></a>
			<a href="/${orgId}/timelines"><span class='bar'></span><d-ico name="ico-videos"></d-ico><label>Timelines</label></a>
			`;
}