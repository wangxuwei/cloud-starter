import { position } from '@dom-native/draggable';
import { getRouteOrgId, pathAsNum, pathAt } from 'common/route';
import { BaseViewElement } from 'common/v-base.js';
import { orgDco, wksDco } from 'dcos';
import { append, closest, customElement, elem, first, frag, getAttr, html, on, OnEvent, onEvent, onHub } from 'dom-native';
import { asNum } from 'utils-min';

const WKS_HTML = html`
	<div class="breadcrumbs">
		<a href="/">Organizations</a>
		<span class="sep">/</span>
		<span> </span>
	</div>
	<header><h1>Workspaces</h1></header>
	<section>
		<div class="card wks-add">
			<c-ico src="#ico-add"></c-ico>
			<h3>Add New Workspace</h3>
		</div>
	</section>
`;

@customElement('v-wks')
export class wksListView extends BaseViewElement {

	//// properties
	get orgId() { return asNum(getAttr(this, 'org-id')) }

	//#region    ---------- Events---------- 
	@onEvent('click', '.wks-add')
	clickAddWks() {
		const dialogEl = append(document.body, elem('dg-wks-add'));
		on(dialogEl, 'WKS_ADD', (evt) => {
			wksDco.create(evt.detail);
		});
	}

	// Note: since .card is a <a> tag, prevent following on click on .show-menu (must bind to click)
	@onEvent('click', 'a.wks .show-menu')
	onShowClick(evt: MouseEvent & OnEvent) {
		evt.preventDefault();
		evt.cancelBubble = true;
	}

	@onEvent('pointerup', 'a.wks .show-menu')
	onCardShowMenuUp(evt: PointerEvent & OnEvent) {

		if (first('#wks-card-menu') == null) {

			const [menu] = append(document.body, `
			<c-menu id='wks-card-menu'>
			<li class="do-delete">Delete</li>
			</c-menu>`);

			position(menu, evt.selectTarget, { at: 'bottom', align: 'right' });

			const cardEl = closest(evt.selectTarget, '[data-type="Wks"]');
			on(menu, 'pointerup', '.do-delete', async (evt) => {
				const id = asNum(cardEl?.getAttribute('data-id'));
				if (id == null) {
					throw new Error(`UI ERROR - cannot find data-type Case data-id on element ${cardEl}`);
				}
				await wksDco.delete(id);
			})
		}
	}
	//#endregion ---------- /Events---------- 

	//#region    ---------- Hub Events ---------- 
	@onHub('dcoHub', 'wks', 'create, update, delete')
	async onWksChange() {
		this.refresh(true);
	}

	@onHub('routeHub', 'CHANGE')
	routeChange() {
		this.refresh();
	}

	//#endregion ---------- /Hub Events---------- 


	async init() {
		super.init();
		this.refresh();
	}

	async refresh(force?:boolean) {
		if ((this.hasPathChanged(1) || force) && pathAt(0)) {
			const wksId = pathAsNum(1);
			if(!wksId || force){
				const org = await orgDco.get(this.orgId!);
				const wksList = await wksDco.list({filters: {orgId: this.orgId!}});

				// create the content from header and wks list
				const content = document.importNode(WKS_HTML, true);
				
				// update breadcrumb span for org name
				const breadcrumbOrgSpan = first(content, '.breadcrumbs span:nth-child(3)')!;
				breadcrumbOrgSpan.textContent = org.name;
				
				// create wks cards
				const sectionEl = first(content, 'section')!;
				const orgId = getRouteOrgId();
				const wksFrag = frag(wksList, p => {
					const innerContent = html`
						<header>
							<h2>${p.name}</h2>
							<c-ico src="#ico-more" class="show-menu"></c-ico>
						</header>
					`;

					const item = elem('a', { class: 'card wks', 'data-type': 'Wks', 'data-id': p.id, href: `/${orgId}/${p.id}`});
					item.replaceChildren(document.importNode(innerContent, true));
					return item;
				});
				
				sectionEl.appendChild(wksFrag);
				this.replaceChildren(content);
			}else{
				this.replaceChildren(elem('v-project', { 'wks-id': wksId }));
			}
		}
	}
}
