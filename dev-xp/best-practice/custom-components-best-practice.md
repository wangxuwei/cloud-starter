# Custom Components Best Practice

## Definition

A custom component in this codebase is a custom web component that:

- Does not have async data dependencies, but can provide interface if need
- Encapsulates its UI and CSS within a shadow root
- Extends from `BaseHTMLElement`
- Uses the `@customElement` decorator

## Characteristics

### Self-contained

Custom components are independent building blocks. They should not depend on other custom components in the codebase. This makes them:

- Reusable across different views
- Easy to test in isolation
- Simple to understand and maintain

### No Async Data

These components do not fetch or process async data. They operate purely on synchronous state or props passed through attributes or DOM manipulation.

### Shadow DOM Encapsulation

All custom components use Shadow DOM to encapsulate:

- Styles (CSS)
- UI structure (HTML)

This prevents style leakage from the parent document and ensures consistent appearance regardless of where the component is used.

## Example: c-ico

The `c-ico` component is a classic example of a custom component. It displays an icon from an SVG sprite.

```ts
import { adoptStyleSheets, BaseHTMLElement, css, customElement, html } from 'dom-native';

const _compCss = css`
    :host{
        --ico-fill: black;
        text-transform: none; 
        padding: 0;
        margin: 0;
        width: 1rem;
        height: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
    }
    
    svg{
        width: 100%;
        height: 100%;
        fill: var(--ico-fill);        
    }
`;

@customElement('c-ico')
class IcoElement extends BaseHTMLElement {
    static _BASE_URL_: string = '/svg/sprite.svg';

    get src() { return this.getAttribute('src') ?? '' };

    constructor() {
        super();
        this.attachShadow({ mode: 'open' }).append(_renderShadow(this.src));
        adoptStyleSheets(this, _compCss);
    }
}

function _renderShadow(src: string) {
    const href = src.startsWith('#') ? `${IcoElement._BASE_URL_}${src}` : src;
    const content = html`
        <svg class="symbol">
            <use xlink:href="${href}" aria-hidden="true"></use>
        </svg>`;
    return content;
}
```

Key characteristics:
- Extends `BaseHTMLElement`
- Uses `@customElement` decorator
- Attaches shadow root in constructor
- Applies scoped CSS via `adoptStyleSheets`
- Simple, synchronous rendering

## Example: c-menu

The `c-menu` component is another example that displays a menu with selectable items.

```ts
import { adoptStyleSheets, BaseHTMLElement, css, customElement, html, onDoc, onEvent, trigger } from 'dom-native';

const _compCss = css`
    :host{
        --min-width: 10rem; 
        background: #fff;
        min-width: var(--min-width) !important; 
        position: absolute;
        box-shadow: 0px 3px 3px -2px rgba(0, 0, 0, 0.2),
            0px 3px 4px 0px rgba(0, 0, 0, 0.14),
            0px 1px 8px 0px rgba(0, 0, 0, 0.12);        
        text-transform: none; 
        padding: 0;
        margin: 0;
        display: grid;
        grid-auto-flow: row;
        grid-auto-rows: min-content;
    }
    
    :host ::slotted(li){
        list-style: none;
        padding: 0 1rem !important;
        margin: 0;
        height: 3rem;
        display: flex;
        align-items: center;
    }
    
    :host ::slotted(li:hover){
        background-color: #ddd;
    }
`;

@customElement('c-menu')
class MenuElement extends BaseHTMLElement {
    private _acceptDocEvent = false;

    constructor() {
        super();
        adoptStyleSheets(this.attachShadow({ mode: 'open' }), _compCss);
        this.shadowRoot!.append(html`<slot></slot>`);
    }

    postDisplay() {
        this._acceptDocEvent = true;
    }

    @onEvent('pointerup')
    onUp() {
        this.close();
    }

    @onDoc('pointerup')
    onDocUp(evt: PointerEvent) {
        if (this._acceptDocEvent) {
            const el = evt.target as HTMLElement;
            const parentEl = el.closest('c-menu');
            if (parentEl == null || parentEl != this) {
                this.close();
            }
        }
    }

    close() {
        trigger(this, 'CLOSE');
        this.remove();
    }
}
```

Key characteristics:
- Uses `::slotted` for styling slotted content
- Uses decorators like `@onEvent` and `@onDoc` for event handling
- Emits custom events via `trigger`
- Manages its own lifecycle (open/close)

## Best Practices

### 1. Use CSS Variables

Define customizable properties via CSS custom properties:

```css
:host {
    --ico-fill: black;
    --min-width: 10rem;
}
```

### 2. Scoped Styles with `css` Tag Function

Always use the `css` tag function to define component styles:

```ts
const _compCss = css`
    :host {
        /* component styles */
    }
`;
```

### 3. Apply Styles with `adoptStyleSheets`

Apply styles to the shadow root:

```ts
adoptStyleSheets(this.attachShadow({ mode: 'open' }), _compCss);
```

### 4. Use Slots for Content Projection

Allow external content with `<slot>`:

```ts
this.shadowRoot!.append(html`<slot></slot>`);
```

### 5. Keep Logic Simple and Synchronous

Avoid async operations in custom components. They should render immediately based on attributes or simple state.

### 6. Use Decorators for Event Handling

Leverage the available decorators for clean event handling:

```ts
@onEvent('pointerup')
onUp() {
    // handler code
}

@onDoc('pointerup')
onDocUp(evt: PointerEvent) {
    // handler code
}
```

### 7. Provide Public Methods When Needed

Expose methods like `close()` for programmatic control.

### 8. Use Custom Events for Communication

When components need to communicate with parents, use custom events:

```ts
trigger(this, 'CLOSE');
```

## File Naming Convention

Custom components should be named with the `c-` prefix and be located in `frontends/web/src/components/`:

- `c-ico.ts` - Icon component
- `c-menu.ts` - Menu component

## When to Create a Custom Component

Create a custom component when:

- The UI element is reusable across multiple views
- The component needs style encapsulation
- The component does not require async data fetching
- The component does not depend on other custom components

## When NOT to Create a Custom Component

Avoid creating a custom component when:

- The component needs to fetch async data (use a view instead)
- The component depends on other custom components (consider a composite view)
- The component is view-specific and not reusable
- The component requires complex routing or state management (these belong in views)
