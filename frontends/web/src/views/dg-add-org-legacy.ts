import { customElement, html as frag, onEvent, pull, trigger } from 'dom-native';
import { Wks } from 'shared/entities.js';
import { BaseDialog } from '../dialog/dg-base-dialog.js';



@customElement('dg-add-org')
class AddOrgDialog extends BaseDialog {

	//#region    ---------- Element Events ---------- 
	@onEvent('OK')
	onOK() {
		const data = pull(this.contentEl) as Partial<Wks>;
		trigger(this, 'ADD_ORG', { detail: data });
	}
	//#endregion ---------- /Element Events ---------- 

	init() {
		super.init();
		this.title = 'Add Organization';
		this.content = frag('<d-input name="name" label="Organization Name"></d-input>');
		this.footer = { ok: 'Add Organization', cancel: true };
	}

}