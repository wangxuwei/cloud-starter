import { position } from '@dom-native/draggable';
import { getRouteOrgId, pathAsNum, pathAt } from 'common/route';
import { BaseViewElement } from 'common/v-base.js';
import { orgDco, projectDco, wksDco } from 'dcos';
import { append, closest, customElement, elem, first, frag, getAttr, html, on, OnEvent, onEvent, onHub } from 'dom-native';
import { asNum } from 'utils-min';

const PROJECT_HTML = html`
	<div class="breadcrumbs">
		<a href="/">Organizations</a>
		<span class="sep">/</span>
		<a href=""> </a>
		<span class="sep">/</span>
		<span> </span>
	</div>
	<header><h1>Projects</h1></header>
	<section>
		<div class="card project-add">
			<c-ico src="#ico-add"></c-ico>
			<h3>Add New Project</h3>
		</div>
	</section>
`;

const PROJECT_MAIN_HTML = html`
	<v-project-main></v-project-main>
`;

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
				await projectDco.delete(id);
			})
		}
	}
	//#endregion ---------- /Events---------- 

	//#region    ---------- Hub Events ---------- 
	@onHub('dcoHub', 'project', 'create, update, delete')
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
				const projectList = await projectDco.list({filters: {wksId: this.wksId!}});
				
				// create the content with breadcrumbs and project list
				const content = document.importNode(PROJECT_HTML, true);
				
				// update breadcrumb org link and text
				const breadcrumbOrgLink = first(content, '.breadcrumbs a:nth-child(1)')!;
				breadcrumbOrgLink.setAttribute('href', `/${org.id}`);
				breadcrumbOrgLink.textContent = org.name;
				
				// update breadcrumb span for wks name
				const breadcrumbWksSpan = first(content, '.breadcrumbs span:nth-child(4)')!;
				breadcrumbWksSpan.textContent = wks.name;
				
				// create project cards
				const sectionEl = first(content, 'section')!;
				const orgId = getRouteOrgId();

				const projectFrag = frag(projectList, p => {
					const innerContent = html`
						<header>
							<h2>${p.name}</h2>
							<c-ico src="#ico-more" class="show-menu"></c-ico>
						</header>
					`;

					const item = elem('a', { class: 'card project', 'data-type': 'Project', 'data-id': p.id, href: `/${orgId}/${wks.id}/${p.id}`});
					item.replaceChildren(document.importNode(innerContent, true));
					return item;
				});
				
				sectionEl.appendChild(projectFrag);
				this.replaceChildren(content);
			}else{
				const content = document.importNode(PROJECT_MAIN_HTML, true);
				const projectMainEl = first(content, 'v-project-main')!;
				projectMainEl.setAttribute('project-id', String(projectId));
				this.replaceChildren(content);
			}
		}
	}
}
