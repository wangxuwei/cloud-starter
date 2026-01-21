import { position } from '@dom-native/draggable';
import { getRouteOrgId, pathAsNum, pathAt } from 'common/route';
import { BaseViewElement } from 'common/v-base.js';
import { orgDco, projectDco, wksDco } from 'dcos';
import { append, closest, customElement, elem, first, getAttr, on, OnEvent, onEvent, onHub } from 'dom-native';
import { Org, Wks } from 'shared/entities';
import { Project } from 'shared/entities.js';
import { asNum } from 'utils-min';

@customElement('v-project')
export class projectListView extends BaseViewElement {

	//// properties
	get wksId() { return asNum(getAttr(this, 'wks-id')) }

	//#region    ---------- Events---------- 
	@onEvent('click', '.project-add')
	clickAddProject() {
		const dialogEl = append(document.body, elem('dg-project-add'));
		on(dialogEl, 'PROJECT_ADD', (evt) => {
			projectDco.create({...evt.detail, wksId: this.wksId});
		});
	}

	// Note: since .card is a <a> tag, prevent following on click on .show-menu (must bind to click)
	@onEvent('click', 'a .show-menu')
	onShowClick(evt: MouseEvent & OnEvent) {
		evt.preventDefault();
		evt.cancelBubble = true;
	}

	@onEvent('pointerup', '.show-menu')
	onCardShowMenuUp(evt: PointerEvent & OnEvent) {

		if (first('#project-card-menu') == null) {

			const [menu] = append(document.body, `
			<c-menu id='project-card-menu'>
			<li class="do-delete">Delete</li>
			</c-menu>`);

			position(menu, evt.selectTarget, { at: 'bottom', align: 'right' });

			const cardEl = closest(evt.selectTarget, '[data-type="Project"]');
			on(menu, 'pointerup', '.do-delete', async (evt) => {
				const id = asNum(cardEl?.getAttribute('data-id'));
				if (id == null) {
					throw new Error(`UI ERROR - cannot find data-type Case data-id on element ${cardEl}`);
				}
				await projectDco.remove(id);
			})
		}
	}
	//#endregion ---------- /Events---------- 

	//#region    ---------- Hub Events ---------- 
	@onHub('dcoHub', 'Project', 'create, update, remove')
	async onProjectChange() {
		this.refresh(true);
	}

	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}
	//#endregion ---------- /Hub Events ---------- 


	async init() {
		super.init();
		this.refresh();
	}

	async refresh(force?:boolean) {
		if ((this.hasPathChanged(2) || force) && pathAt(1)) {
			const projectId = pathAsNum(2);
			if(!projectId || force){
				const wks = await wksDco.get(this.wksId!);
				const org = await orgDco.get(wks.orgId!);
				const projectList = await projectDco.list({matching: {wksId: this.wksId!}});
				this.innerHTML = _render(org, wks, projectList);
			}else{
				this.innerHTML = `<v-project-main project-id='${projectId}'></v-project-main>`;
			}
		}
	}
}

//// HTMLs

function _render(org:Org, wks: Wks, projectList: Project[] = []) {
	let html = `
	<div class="breadcrumbs">
		<a href="/">Organizations</a>
		<span class="sep">/</span>
		<a href="/${org.id}">${org.name}</a>
		<span class="sep">/</span>
		<span>${wks.name}</span>
	</div>
	<header><h1>Projects</h1></header>
	<section>
		<div class="card project-add">
			<c-ico src="#ico-add"></c-ico>
			<h3>Add New Project</h3>
		</div>
	`;
	const orgId = getRouteOrgId();
	for (const p of projectList) {
		html += `	<a class="card project" data-type="Project" data-id="${p.id}" href="/${orgId}/${wks.id}/${p.id}">
		<header>
			<h2>${p.name}</h2>
			<c-ico src="#ico-more" class="show-menu"></c-ico>
		</header>
	</a>	`
	};

	html += `</section>`;

	return html;

}