import { adoptStyleSheets, css, customElement, first, html, onEvent, pull, trigger } from 'dom-native';
import { DgDialog } from '../dialog/dg-dialog.js';


const _compCss = css`
	::slotted(.dialog-content) {
		display: grid;
		grid-auto-flow: row;
		grid-auto-rows: min-content; 
		grid-gap: 1rem;
	}
`;

const PROJECT_ADD_HTML = html`
	<div slot="title">Add Project!!</div>

	<div class="dialog-content">
		<d-input label="name" name="name"> </d-input>
	</div>
	
	<button slot="footer" class="do-cancel">CANCEL</button>
	<button slot="footer" class="do-ok medium">OK</button>
`;


@customElement('dg-project-add')
export class DgProjectAdd extends DgDialog {

	constructor() {
		super();
		adoptStyleSheets(this, _compCss);
	}

	@onEvent('pointerup', '.do-ok')
	doOk() {
		super.doOk();
		const detail = pull(this);
		trigger(this, 'PROJECT_ADD', { detail });
	}


	init() {
		// add the content to be slotted
		this.replaceChildren(document.importNode(PROJECT_ADD_HTML, true));
	}

	postDisplay() {
		first(this, 'd-input')?.focus();
	}
}
