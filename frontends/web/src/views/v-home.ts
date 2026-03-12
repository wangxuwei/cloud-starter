import { position } from "@dom-native/draggable";
import { BaseViewElement } from "common/v-base.js";
import { orgDco } from "dcos";
import {
  append,
  cherryChild,
  closest,
  customElement,
  elem,
  first,
  frag,
  html,
  on,
  OnEvent,
  onEvent,
  onHub,
} from "dom-native";
import { Org } from "shared/entities.js";
import { asNum } from "utils-min";

const HOME_HTML = html`
  <header><h1>Organizations</h1></header>
  <section>
    <div class="card org-add">
      <c-ico src="#ico-add"></c-ico>
      <h3>Add New Organization</h3>
    </div>
  </section>
`;

@customElement("v-home")
export class orgListView extends BaseViewElement {
  //#region    ---------- Events----------
  @onEvent("click", ".org-add")
  clickAddOrg() {
    const dialogEl = append(document.body, elem("dg-org-add"));
    on(dialogEl, "ORG_ADD", (evt) => {
      orgDco.create(evt.detail);
    });
  }

  // Note: since .card is a <a> tag, prevent following on click on .show-menu (must bind to click)
  @onEvent("click", "a .show-menu")
  onShowClick(evt: MouseEvent & OnEvent) {
    evt.preventDefault();
    evt.cancelBubble = true;
  }

  @onEvent("pointerup", ".show-menu")
  onCardShowMenuUp(evt: PointerEvent & OnEvent) {
    if (first("#org-card-menu") == null) {
      const [menu] = append(
        document.body,
        `
			<c-menu id='org-card-menu'>
			<li class="do-delete">Delete</li>
			</c-menu>`
      );

      position(menu, evt.selectTarget, { at: "bottom", align: "right" });

      const cardEl = closest(evt.selectTarget, '[data-type="Org"]');
      on(menu, "pointerup", ".do-delete", async (evt) => {
        const id = asNum(cardEl?.getAttribute("data-id"));
        if (id == null) {
          throw new Error(
            `UI ERROR - cannot find data-type Case data-id on element ${cardEl}`
          );
        }
        await orgDco.delete(id);
      });
    }
  }
  //#endregion ---------- /Events----------

  //#region    ---------- Hub Events ----------
  @onHub("dcoHub", "org", "create,update,delete")
  async onOrgChange() {
    const orgList = await orgDco.list();
    this.refresh(orgList);
  }
  //#endregion ---------- /Hub Events----------

  async init() {
    super.init();

    // BEST-PRATICE: init() should always attempt to draw the empty state without async when possible
    //               Here we do this with `this.refresh([])` which will
    this.refresh([]); // this will execute in sync as it will not do any server request

    // Now that this element has rendered its empty state, call this.refresh() will will initiate
    // an async data fetching and therefore will execute later.
    this.refresh();
  }

  async refresh(orgList?: Org[]) {
    // if no orgList, then, fetch the new list
    if (orgList == null) {
      orgList = await orgDco.list();
    }

    // create the content from header and org list
    const content = frag(orgList, (org) => {
      const innerContent = html`
        <header>
          <h2>${org.name}</h2>
          <c-ico src="#ico-more" class="show-menu"></c-ico>
        </header>
      `;

      const item = elem("a", {
        class: "card org",
        "data-type": "Org",
        "data-id": org.id,
        href: `/${org.id}`,
      });
      item.replaceChildren(document.importNode(innerContent, true));
      return item;
    });

    const mainContent = document.importNode(HOME_HTML, true);
    const sectionEl = cherryChild(mainContent, "section");
    sectionEl.append(content);
    this.replaceChildren(mainContent);
  }
}
