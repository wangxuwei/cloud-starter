import { position } from '@dom-native/draggable';
import { getRouteOrgId, pathAt } from 'common/route.js';
import { logoff, UserContext } from 'common/user-ctx.js';
import { BaseViewElement } from 'common/v-base.js';
import { append, customElement, elem, first, html, on, onEvent, onHub, push } from 'dom-native';
import { isNotEmpty } from 'utils-min';

const defaultPath = "";

const tagNameByPath: { [name: string]: string } = {
	"": 'v-home',
	"_spec": 'v-spec-main',
};

const MAIN_HTML = html`
	<header>
		<d-ico name="ico-menu">menu</d-ico>
		<a href='/'><h3>CLOUD BIGAPP</h3></a>
		<aside class="toogle-user-menu">
			<c-ico>user</c-ico>
			<div class="dx dx-name">Some name</div>
		</aside>
	</header>

	<main>
	</main>
	<div class="__version__">${window.__version__}</div>
`;


@customElement('v-main')
export class MainView extends BaseViewElement {
	private _userContext?: UserContext;


	//// Key elements
	private get mainEl():HTMLElement { return first(this, 'main')! };
	private get headerAsideEl():HTMLElement { return first(this, 'header aside')! }

	//#region    ---------- Data Setters ---------- 
	set userContext(v: UserContext) {
		this._userContext = v;
		push(this.headerAsideEl, { name: this._userContext.name });
	}
	//#endregion ---------- /Data Setters ---------- 


	//#region    ---------- Element & Hub Events ---------- 
	@onEvent('pointerup', '.toogle-user-menu')
	showMenu(evt: PointerEvent) {
		const menuId = 'user-menu-123';
		if (first(`#user-menu-123`) == null) {

			const menu = append(document.body, elem('c-menu', { id: 'user-menu-123', $: {
				children: [
					elem('li', { class: 'do-logoff', $: { textContent: 'Logoff' } })
				]
			}}));

			position(menu, this.headerAsideEl, { at: 'bottom', align: 'right' });

			on(menu, 'pointerup', 'li.do-logoff', async (evt) => {
				await logoff();
				window.location.href = '/';
			});
		}
	}


	@onHub('routeHub', 'CHANGE')
	routChange() {
		this.refresh()
	}
	//#endregion ---------- /Element & Hub Events ----------

	init() {
		super.init();
		const content = document.importNode(MAIN_HTML, true);
		this.replaceChildren(content);
		this.refresh();
	}

	refresh() {
		if (this.hasPathChanged(0)) {
			// first, try to get the orgId from the route, and if valid, then, show v-org-main
			const orgId = getRouteOrgId();
			const newPath = pathAt(0);

			if (newPath != null && orgId != null) {
				this.mainEl.replaceChildren(elem('v-wks', { 'org-id': orgId }));
			}
			else {
				const name = isNotEmpty(newPath) ? newPath : '';

				const tagName = tagNameByPath[name];
				this.mainEl.replaceChildren(elem(tagName));
			}
		}

	}

}
