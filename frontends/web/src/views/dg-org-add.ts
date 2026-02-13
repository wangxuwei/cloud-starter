import { adoptStyleSheets, css, customElement, first, html, onEvent, pull, trigger } from 'dom-native';
import { DgDialog } from '../dialog/dg-dialog.js';
const { assign } = Object;


const _compCss = css`
	::slotted(.dialog-content) {
		display: grid;
		grid-auto-flow: row;
		grid-auto-rows: min-content; 
		grid-gap: 1rem;
	}
`;

const ORG_ADD_HTML = html`
	<div slot="title">Add Organization!!</div>

	<div class="dialog-content">
		<d-input label="name" name="name"> </d-input>
	</div>
	
	<button slot="footer" class="do-cancel">CANCEL</button>
	<button slot="footer" class="do-ok medium">OK</button>
`;


@customElement('dg-org-add')
export class DgOrgAdd extends DgDialog {

	constructor() {
		super();
		adoptStyleSheets(this, _compCss);
	}

	@onEvent('pointerup', '.do-ok')
	doOk() {
		super.doOk();
		const detail = pull(this);
		trigger(this, 'ORG_ADD', { detail });
	}

	init() {
		super.init();
		// add the content to be slotted
		this.replaceChildren(document.importNode(ORG_ADD_HTML, true));
	}

	postDisplay() {
		first(this, 'd-input')?.focus();
	}
}


