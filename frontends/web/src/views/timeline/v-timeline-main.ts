import { activateDrag, draggable } from '@dom-native/draggable';
import { BaseViewElement } from 'common/v-base.js';
import { customElement, html, OnEvent, onEvent } from 'dom-native';


const TIMELINE_MAIN_HTML = html`
	<header>
	<h1>Timelines</h1>
	</header>
	<section class="content">
		<div class="sandbox">
			<tm-timeline>
			
				<tm-play>
					<d-ico name="ico-t-down" class="tm-head"></d-ico>
					<tm-bar>
					<tm-zone></tm-zone>
					</tm-bar>
					
				</tm-play>
				
				<tm-zoom>
					<d-ico name="ico-t-down" class="tm-head"></d-ico>
					<tm-bar class="active"></tm-bar>
				</tm-zoom>
				
				<div class="spacer"></div>

				<tm-layer>
					<tm-header>Layer A</tm-header>
					<tm-body>
						<tm-item label="annotation item" type="span" start="12:003" end="14:004"></tm-item>
						<tm-item label="annotation item" type="point" start="15:450"></tm-item>
					</tm-body>
				</tm-layer>

			</tm-timeline>
		</div>
	</section>
`;

@customElement('v-timeline-main')
export class TimelineMainView extends BaseViewElement {

	//// key elements
	get tmZoomEl():HTMLElement { return this.cacheFirst('tm-zoom')! };
	get tmZoomHeadEl():HTMLElement { return this.cacheFirst('tm-zoom .tm-head')! };
	get tmZoomZoneEl():HTMLElement { return this.cacheFirst('tm-zone')! };
	get tmPlayEl():HTMLElement { return this.cacheFirst('tm-play')! };
	get tmPlayHeadEl():HTMLElement { return this.cacheFirst('tm-play .tm-head')! };


	@onEvent('pointerdown', 'tm-play tm-zone')
	onTmMarkerPointerDown(evt: PointerEvent & OnEvent) {
		const tmZoneEl = evt.selectTarget;

		const tmZoomRec = this.tmZoomEl;
		const tmZoneRec = tmZoneEl.getBoundingClientRect();
		activateDrag(tmZoneEl, evt, {
			drag: 'none',
			onDrag: (evt) => {
				const pointerEvent = evt.detail.pointerEvent;
			}
		});


	}

	async init() {
		const content = document.importNode(TIMELINE_MAIN_HTML, true);
		this.replaceChildren(content);
	}

	postDisplay() {
		draggable(this, 'tm-zone', {
			constraints: {
				container: 'tm-bar',
				y: false,
				hitbox: 'box'
			}
		});
		draggable(this, '.tm-head', {
			constraints: {
				container: 'tm-play, tm-zoom',
				y: false,
				hitbox: 'center'
			}
		});
	}
}

