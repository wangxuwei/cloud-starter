# Dialog Best Practices

This document outlines the coding standards and best practices for TypeScript dialog components (`dg-*.ts`) and PostCSS styles (`dg-*.pcss`) in the frontend.

## TypeScript Dialogs (`dg-*.ts`)

### Naming Conventions

#### Class Names
- **Class name**: Use PascalCase, starting with `Dg` prefix
  - Example: `DgOrgAdd`, `DgWksAdd`, `DgProjectAdd`
- **Custom element**: Use kebab-case with `dg-` prefix
  - Example: `@customElement('dg-org-add')`, `@customElement('dg-wks-add')`

#### Methods and Handlers
- **Event handlers**: camelCase, starting with action or event type
  - Example: `doOk()`, `doCancel()`

### File Structure and Ordering

Organize class members in the following order:

1. **CSS Styles** - Component-specific styles as constant
2. **HTML Template** - Template literal for dialog content (if using `html` pattern)
3. **Custom Element Decorator** - At the top, immediately after imports
4. **Constructor** - Initialize styles and super
5. **Region: Events** - `@onEvent` decorated methods
6. **Lifecycle Methods** - `init()`, `postDisplay()`
7. **Private Methods** - Other internal methods

#### Example Structure

```typescript
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

const EXAMPLE_ADD_HTML = html`
    <div slot="title">Add Example</div>
    <div class="dialog-content">
        <d-input label="name" name="name"></d-input>
    </div>
    <button slot="footer" class="do-cancel">CANCEL</button>
    <button slot="footer" class="do-ok medium">OK</button>
`;

@customElement('dg-example-add')
export class DgExampleAdd extends DgDialog {

    constructor() {
        super();
        adoptStyleSheets(this, _compCss);
    }

    //#region    ---------- Events ----------
    @onEvent('pointerup', '.do-ok')
    doOk() {
        super.doOk();
        const detail = pull(this);
        trigger(this, 'EXAMPLE_ADD', { detail });
    }
    //#endregion ---------- /Events ----------

    init() {
        this.replaceChildren(document.importNode(EXAMPLE_ADD_HTML, true));
    }

    postDisplay() {
        first(this, 'd-input')?.focus();
    }
}
```

### Extending DgDialog

All dialogs must extend the base `DgDialog` class:

```typescript
import { DgDialog } from '../dialog/dg-dialog.js';

@customElement('dg-example-add')
export class DgExampleAdd extends DgDialog {
    // implementation
}
```

### Using Slots

Dialogs use slots to structure content into three main sections:

#### Title Slot
Contains the dialog title, displayed in the header:

```typescript
<div slot="title">Add Organization</div>
```

#### Content Slot (implicit)
The main dialog body with form inputs. Use a wrapper with `dialog-content` class:

```typescript
<div class="dialog-content">
    <d-input label="name" name="name"></d-input>
    <d-input label="description" name="description"></d-input>
</div>
```

#### Footer Slot
Contains action buttons, typically Cancel and OK:

```typescript
<button slot="footer" class="do-cancel">CANCEL</button>
<button slot="footer" class="do-ok medium">OK</button>
```

### Content Styling

Use the `::slotted()` selector in component CSS to style the dialog content:

```typescript
const _compCss = css`
    ::slotted(.dialog-content) {
        display: grid;
        grid-auto-flow: row;
        grid-auto-rows: min-content;
        grid-gap: 1rem;
    }
`;
```

This ensures proper spacing and layout for form inputs within the content area.

### Event Handling

#### OK Button Handler
Use the standard `.do-ok` button class. Call `super.doOk()` first, then extract form data and trigger custom event:

```typescript
@onEvent('pointerup', '.do-ok')
doOk() {
    super.doOk();
    const detail = pull(this);
    trigger(this, 'ORG_ADD', { detail });
}
```

Key points:
- Use `@onEvent` decorator with `'pointerup'` event and `.do-ok` selector
- Always call `super.doOk()` first to close the dialog
- Use `pull(this)` to extract form data from inputs
- Trigger custom event with entity-specific name (e.g., `ORG_ADD`, `WKS_ADD`)

#### Cancel Button
The `.do-cancel` button automatically closes the dialog via base class behavior. No handler needed unless custom cancel logic is required.

### Event Naming Convention

When triggering events on dialog completion, use uppercase entity names with `_ADD` suffix:

- `ORG_ADD` for organization creation
- `WKS_ADD` for workspace creation
- `PROJECT_ADD` for project creation
- `EXAMPLE_ADD` for example entity creation

### Lifecycle Methods

#### init()
Set up the dialog HTML structure using `html` template literal with `document.importNode()`:

```typescript
init() {
    this.replaceChildren(document.importNode(EXAMPLE_ADD_HTML, true));
}
```

#### postDisplay()
Called after dialog is displayed. Use to focus the first input:

```typescript
postDisplay() {
    first(this, 'd-input')?.focus();
}
```

### HTML Template Pattern

Define dialog content as an `html` template literal constant at the top of the file:

```typescript
const EXAMPLE_ADD_HTML = html`
    <div slot="title">Add Example</div>
    <div class="dialog-content">
        <d-input label="name" name="name"></d-input>
    </div>
    <button slot="footer" class="do-cancel">CANCEL</button>
    <button slot="footer" class="do-ok medium">OK</button>
`;
```

Then use `document.importNode()` in `init()` to create a clean clone:

```typescript
init() {
    this.replaceChildren(document.importNode(EXAMPLE_ADD_HTML, true));
}
```

Benefits:
- Template literals provide syntax highlighting and better editor support
- Content is defined once and can be reused
- `document.importNode()` creates a clean clone without modifying the template

### How Other Views Use Dialogs

Other views create and append dialog elements, then listen for completion events:

```typescript
import { append, elem, on } from 'dom-native';

@customElement('v-example')
export class ExampleView extends BaseViewElement {

    @onEvent('click', '.example-add')
    clickAddExample() {
        // Create dialog element using elem helper
        const dlg = append(document.body, elem('dg-example-add'));
        
        // Listen for completion event
        on(dlg, 'EXAMPLE_ADD', async (evt) => {
            const { detail } = evt;
            // Process the form data (e.g., create entity via API)
            await exampleDco.create(detail);
            // Refresh view if needed
            this.refresh();
        });
    }
}
```

Key steps:
1. Create dialog element using `elem('dg-example-add')` and `append()`
2. Listen for custom event with entity-specific name
3. Process the `detail` object containing form data
4. Append dialog to `document.body` to display it
5. Dialog auto-removes itself after closing

### Import Organization

Order imports:

1. `dom-native` utilities (adoptStyleSheets, css, customElement, etc.)
2. Base dialog class
3. Utility functions (assign, etc.)

```typescript
import { adoptStyleSheets, css, customElement, first, html, onEvent, pull, trigger } from 'dom-native';
import { DgDialog } from '../dialog/dg-dialog.js';
const { assign } = Object;
```

## PostCSS Dialogs (`dg-*.pcss`)

### Element Selectors
- Use kebab-case matching the custom element name
- Selector name should match the element tag name

```pcss
dg-org-add {
    // styles
}

dg-wks-add {
    // styles
}
```

### Content Styling

Use `::slotted()` to style the dialog content wrapper:

```pcss
dg-example-add {
    ::slotted(.dialog-content) {
        display: grid;
        grid-auto-flow: row;
        grid-auto-rows: min-content;
        grid-gap: 1rem;
        padding: 1rem 0;
    }
}
```

Properties to include:
- `display: grid` for proper layout
- `grid-auto-flow: row` to stack elements vertically
- `grid-auto-rows: min-content` to size rows to content
- `grid-gap` for consistent spacing between inputs
- Optional padding for visual separation

### Form Input Styling

Ensure form inputs within dialog content are properly styled:

```pcss
dg-example-add {
    ::slotted(.dialog-content) {
        d-input {
            width: 100%;
        }
    }
}
```

## Common Patterns

### Simple Add Dialog
Basic pattern for adding entities:

```typescript
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

const EXAMPLE_ADD_HTML = html`
    <div slot="title">Add Example</div>
    <div class="dialog-content">
        <d-input label="name" name="name"></d-input>
    </div>
    <button slot="footer" class="do-cancel">CANCEL</button>
    <button slot="footer" class="do-ok medium">OK</button>
`;

@customElement('dg-example-add')
export class DgExampleAdd extends DgDialog {

    constructor() {
        super();
        adoptStyleSheets(this, _compCss);
    }

    @onEvent('pointerup', '.do-ok')
    doOk() {
        super.doOk();
        const detail = pull(this);
        trigger(this, 'EXAMPLE_ADD', { detail });
    }

    init() {
        this.replaceChildren(document.importNode(EXAMPLE_ADD_HTML, true));
    }

    postDisplay() {
        first(this, 'd-input')?.focus();
    }
}
```

### Multiple Input Dialog
For dialogs with multiple form inputs:

```typescript
const EXAMPLE_ADD_HTML = html`
    <div slot="title">Add Example</div>
    <div class="dialog-content">
        <d-input label="name" name="name"></d-input>
        <d-input label="description" name="description"></d-input>
        <d-input label="tags" name="tags"></d-input>
    </div>
    <button slot="footer" class="do-cancel">CANCEL</button>
    <button slot="footer" class="do-ok medium">OK</button>
`;
```

### View Integration Example
Complete example of a view using a dialog:

```typescript
import { append, customElement, elem, frag, html, on, onEvent } from 'dom-native';
import { BaseViewElement } from 'common/v-base.js';
import { exampleDco } from 'dcos';

const PROJECTS_HTML = html`
    <header>
        <h1>Projects</h1>
        <button class="project-add medium">Add Project</button>
    </header>
    <section class="content"></section>
`;

@customElement('v-projects')
export class ProjectsView extends BaseViewElement {

    get contentEl() { return this.cacheFirst('.content')! }

    @onEvent('click', '.project-add')
    clickAddProject() {
        const dlg = append(document.body, elem('dg-project-add'));
        
        on(dlg, 'PROJECT_ADD', async (evt) => {
            const { detail } = evt;
            await projectDco.create(detail);
            this.refresh();
        });
    }

    async init() {
        super.init();
        this.innerHTML = document.importNode(PROJECTS_HTML, true).textContent!;
        this.refresh();
    }

    async refresh() {
        const projects = await projectDco.list();
        this.contentEl.replaceChildren(frag(projects, p => 
            elem('div', { class: 'card', 'data-id': p.id, $: { textContent: p.name } })
        ));
    }
}
```

## Summary Checklist

### TypeScript
- [ ] Class name starts with `Dg` prefix
- [ ] Custom element uses kebab-case with `dg-` prefix
- [ ] Extends `DgDialog` base class
- [ ] Uses slots: `title`, content (implicit), `footer`
- [ ] Content uses `.dialog-content` wrapper class
- [ ] Footer has `.do-cancel` and `.do-ok` buttons
- [ ] `doOk()` calls `super.doOk()` first
- [ ] Uses `pull(this)` to extract form data
- [ ] Triggers custom event with uppercase entity name
- [ ] `postDisplay()` focuses first input
- [ ] Content defined as `html` template literal constant
- [ ] `init()` uses `document.importNode()` with template

### PostCSS
- [ ] Element selector matches custom element name
- [ ] Content uses grid layout with proper spacing
- [ ] Form inputs properly styled within content

### View Integration
- [ ] Creates dialog element with `elem()` and `append()`
- [ ] Listens for entity-specific completion event
- [ ] Processes `detail` object from event
- [ ] Appends dialog to `document.body`
- [ ] Refreshes view after successful creation
