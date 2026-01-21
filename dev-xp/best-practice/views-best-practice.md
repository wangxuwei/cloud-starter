# Views Best Practices

This document outlines the coding standards and best practices for TypeScript view components (`*.ts`) and PostCSS styles (`*.pcss`) in the frontend.

## TypeScript Views (`.ts`)

### Naming Conventions

#### Class Names
- **Class name**: Use PascalCase, typically ending with `View` or descriptive type
  - Example: `OrgListView`, `ImageView`, `WksListView`
- **Custom element**: Use kebab-case with `v-` prefix
  - Example: `@customElement('v-home')`, `@customElement('v-images')`

#### Variables and Properties
- **Private variables**: camelCase with underscore prefix or private keyword
  - Example: `_orgList`, `_mediaList`
- **Getters**: camelCase
  - Example: `get contentEl()`, `get projectId()`, `get orgId()`
- **Methods**: camelCase
  - Example: `async init()`, `async refresh()`, `clickAddOrg()`

#### Event Handlers
- **Element event handlers**: camelCase, starting with event type or action
  - Example: `clickAddOrg()`, `onShowClick()`, `onCardShowMenuUp()`
- **Hub event handlers**: camelCase, starting with `on` and entity name
  - Example: `onOrgChange()`, `onMediaChange()`

#### Render Functions
- Use underscore prefix to indicate private/internal
  - Example: `_render()`, `_renderContent()`, `_renderHeader()`

### File Structure and Ordering

Organize class members in the following order:

1. **Custom Element Decorator** - At the top, immediately after imports
2. **Getters for Key Elements** - Important DOM element references
3. **Properties** - Data properties with getters
4. **Region: Events** - `@onEvent` decorated methods
5. **Region: Hub Events** - `@onHub` decorated methods  
6. **Lifecycle Methods** - `async init()`, `async refresh()`
7. **Private Methods** - Other internal methods
8. **Render Functions** - HTML/template generation functions (after class)

#### Example Structure

```typescript
@customElement('v-example')
export class ExampleView extends BaseViewElement {

    //#region    ---------- Key Elements ---------- 
    get contentEl():BaseViewElement { return this.cacheFirst('.content')! }
    get itemAddEl():HTMLElement { return this.cacheFirst('.item-add')! }
    //#endregion ---------- /Key Elements ---------- 

    //// properties
    get projectId() { return asNum(getAttr(this, 'project-id')) }

    //#region    ---------- Events---------- 
    @onEvent('click', '.item-add')
    clickAddItem() { ... }

    @onEvent('pointerup', '.show-menu')
    onCardShowMenuUp(evt: PointerEvent & OnEvent) { ... }
    //#endregion ---------- /Events---------- 

    //#region    ---------- Hub Events ---------- 
    @onHub('dcoHub', 'Item', 'create, update, remove')
    async onItemChange() { ... }
    //#endregion ---------- /Hub Events ---------- 

    async init() {
        super.init();
        this.refresh();
    }

    async refresh(itemList?: Item[]) {
        if (itemList == null) {
            itemList = await itemDco.list();
        }
        this.innerHTML = _render(itemList);
    }

}

//// HTMLs

function _render(itemList: Item[] = []) {
    // render logic here
}
```

### Comment Format

#### Region Comments
Use region markers to organize code sections:

```typescript
//#region    ---------- Section Name ---------- 
// code here
//#endregion ---------- /Section Name ---------- 
```

Note the spacing and naming convention:
- Two hashes `//`
- Word `region` in lowercase
- Spaces around `region` and section name
- Dashes `----------` for visual separation
- End region has `/` prefix before section name
- Keep region names consistent (e.g., `Events`, `Hub Events`, `Key Elements`)

#### Single-Line Comments
Use `//` for single-line comments. Add meaningful context:

```typescript
// BEST-PRACTICE: init() should always attempt to draw the empty state without async when possible
this.refresh([]);
```

#### Multi-Line Comments
For longer explanations, use block comments:

```typescript
/*
    This handles the drag and drop functionality for the media add card.
    It prevents the default browser behavior and creates a new Media record.
*/
```

#### Event Handler Comments
Briefly describe what the handler does if not obvious from the name:

```typescript
// Note: since .card is a <a> tag, prevent following on click on .show-menu (must bind to click)
@onEvent('click', 'a .show-menu')
onShowClick(evt: MouseEvent & OnEvent) {
    evt.preventDefault();
}
```

### Event Handling

#### Element Events
Use `@onEvent` decorator for DOM events:

```typescript
@onEvent('click', '.selector')
onElementClick() { }

@onEvent('pointerup', '.show-menu')
onPointerUp(evt: PointerEvent & OnEvent) { }
```

Event types to combine:
- Use `& OnEvent` to combine with `OnEvent` type from `dom-native`
- This provides `selectTarget` property for event delegation

#### Hub Events
Use `@onHub` for data change events:

```typescript
@onHub('dcoHub', 'EntityName', 'create, update, remove')
async onEntityChange() { }
```

Hub parameters:
- First: hub name (e.g., `'dcoHub'`)
- Second: entity type (e.g., `'Org'`, `'Media'`)
- Third: comma-separated action list (e.g., `'create,update,remove'`)

### Lifecycle Methods

#### init()
Always call `super.init()` first. Attempt to draw empty state synchronously when possible:

```typescript
async init() {
    super.init();
    
    // Render empty state immediately
    this.refresh([]);
    
    // Then fetch and render actual data
    this.refresh();
}
```

#### refresh()
Handle both synchronous (with data) and asynchronous (without data) calls:

```typescript
async refresh(dataList?: DataType[]) {
    if (dataList == null) {
        dataList = await dataDco.list();
    }
    this.innerHTML = _render(dataList);
}
```

### Render Functions

- Name with underscore prefix: `_render()`, `_renderContent()`, `_renderHeader()`
- Accept optional array parameter with default empty array
- Use template literals for HTML
- Keep logic minimal, mostly iteration

```typescript
function _render(items: Item[] = []) {
    let html = `<header><h1>Title</h1></header><section>`;
    
    for (const item of items) {
        html += `<div class="card" data-id="${item.id}">${item.name}</div>`;
    }
    
    html += `</section>`;
    return html;
}
```

### Import Organization

Order imports:

1. Third-party libraries
2. Common/shared modules
3. DCOs and data objects
4. DOM utilities from `dom-native`
5. Entity types
6. Utility functions
7. Sibling views (if any)

```typescript
import { position } from '@dom-native/draggable';
import { BaseViewElement } from 'common/v-base.js';
import { orgDco } from 'dcos';
import { append, closest, customElement, first, on, OnEvent, onHub } from 'dom-native';
import { Org } from 'shared/entities.js';
import { asNum } from 'utils-min';
```

## PostCSS Views (`.pcss`)

### Naming Conventions

#### Element Selectors
- Use kebab-case matching the custom element name
- Selector name should match the element tag name

```pcss
v-home {
    // styles
}

v-images {
    // styles
}
```

#### Class Selectors
- Use kebab-case
- Be descriptive but concise
- Prefix with element type when needed

```pcss
.card-org-add { }
.media-add { }
.show-menu { }
```

### File Structure

Use nested structure with `&` for children:

```pcss
v-home {
    padding: 2rem;
    
    & > section {
        display: grid;
        padding: 2rem;
        grid-gap: 2rem;
        
        .card-org-add {
            // styles
        }
        
        .card {
            // styles
        }
    }
}
```

Benefits:
- Clear parent-child relationships
- Reduces selector repetition
- Easy to understand hierarchy

### Layout Best Practices

#### Grid Layout
Use CSS Grid for card layouts:

```pcss
section {
    display: grid;
    grid-template-columns: repeat(auto-fill, 16rem);
    grid-template-rows: repeat(auto-fill, 12rem);
    grid-gap: 2rem;
}
```

#### Flex Layout
Use Flexbox for single-direction alignment:

```pcss
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
```

### Color Format

Always use CSS custom properties (variables) for colors:

```pcss
&:hover {
    opacity: 1;
    c-symbol {
        fill: var(--clr-prime);
    }
    h3 {
        color: var(--clr-prime);
    }
}
```

Common color variables (defined in vars-colors.pcss):
- `var(--clr-prime)` - Primary color
- `var(--clr-text)` - Text color
- `var(--clr-bg)` - Background color
- `var(--clr-border)` - Border color

Do not hardcode hex colors in component styles unless absolutely necessary.

### Spacing

Use consistent spacing values:
- `1rem` - Small spacing
- `2rem` - Medium spacing (default)
- `4rem` - Large spacing

```pcss
v-home {
    padding: 2rem;
    
    & > section {
        padding: 2rem;
        grid-gap: 2rem;
    }
}
```

### State Styles

Use `&` modifier for states:

```pcss
.card-org-add {
    opacity: .4;
    
    &:hover {
        opacity: 1;
    }
    
    &:active {
        transform: scale(0.98);
    }
}
```

### Icon and Symbol Styling

Use specific selectors for icons:

```pcss
.card {
    c-ico {
        width: 4rem;
        height: 4rem;
    }
    
    c-symbol {
        fill: var(--clr-text);
    }
}
```

### Image Handling

For images within cards:

```pcss
.card {
    section > img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
}
```

## Common Patterns

### Add Card Pattern
For "Add New" cards:

```pcss
.card-add {
    cursor: pointer;
    display: grid;
    grid-template-rows: 1fr auto 1rem auto 1fr;
    align-items: center;
    justify-items: center;
    opacity: .4;
    
    c-ico {
        grid-row: 2;
        width: 4rem;
        height: 4rem;
    }
    
    h3 {
        grid-row: 4;
    }
    
    &:hover {
        opacity: 1;
    }
}
```

### Card Pattern
For content cards:

```pcss
.card {
    cursor: pointer;
    display: block;
    position: relative;
}
```

## Summary Checklist

### TypeScript
- [ ] Class name ends with `View` or describes the type
- [ ] Custom element uses kebab-case with `v-` prefix
- [ ] Region markers used consistently
- [ ] Members ordered: decorators, getters, events, hub events, lifecycle, methods
- [ ] `@onEvent` and `@onHub` decorators used correctly
- [ ] `init()` calls `super.init()` first
- [ ] `refresh()` handles both sync and async cases
- [ ] Render functions use underscore prefix
- [ ] Comments are meaningful and properly formatted

### PostCSS
- [ ] Element selector matches custom element name
- [ ] Nested structure with `&` for hierarchy
- [ ] Colors use CSS variables (`var(--clr-*)`)
- [ ] Consistent spacing units
- [ ] State modifiers use `&:hover`, `&:active`, etc.
- [ ] Grid layout for card grids
- [ ] Images use `object-fit: contain` or `cover`
