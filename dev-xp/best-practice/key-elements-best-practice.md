# Key Elements Best Practices

This document explains how and when to add getter methods to access DOM elements and context within views.

## Overview

Key element getters provide a clean, type-safe way to access frequently used DOM elements within a view component. They improve code readability and maintainability by centralizing element access logic.

## When to Use Key Element Getters

Use element getters when:
- A DOM element is accessed multiple times within a view
- The element is used in multiple methods
- You want to avoid repetitive `first()` calls throughout the code
- You want to cache element lookups for performance

## DOM Element Getters

### Basic Pattern

Use the `first()` function from `dom-native` combined with TypeScript getters:

```typescript
private get mainEl():HTMLElement { return first(this, 'main')! };
private get headerAsideEl():HTMLElement { return first(this, 'header aside')! };
private get fieldset():HTMLElement { return first(this, 'section.content')! };
private get footerMessage():HTMLElement { return first(this, 'footer .message')! };
```

### Key Points

1. **Non-null assertion**: Use the `!` postfix operator to tell TypeScript the element will always exist
2. **Selector specificity**: Use the most specific selector needed (e.g., `'section.content'` instead of `'section'`)
3. **Private visibility**: Mark getters as `private get` to encapsulate them within the view
4. **Return type**: Use `HTMLElement` as the return type for general elements
5. **Naming convention**: Use `elementNameEl` pattern (e.g., `mainEl`, `headerEl`, `fieldsetEl`)

### Example Usage

Before (repetitive):
```typescript
init() {
    first(this, 'main')!.innerHTML = 'content';
    first(this, 'main')!.classList.add('active');
}
```

After (with getter):
```typescript
private get mainEl():HTMLElement { return first(this, 'main')! };

init() {
    this.mainEl.innerHTML = 'content';
    this.mainEl.classList.add('active');
}
```

### Section Markers

Group element getters together with region markers for clarity:

```typescript
//// Key elements
private get mainEl():HTMLElement { return first(this, 'main')! };
private get headerAsideEl():HTMLElement { return first(this, 'header aside')! }
private get footerMessage():HTMLElement { return first(this, 'footer .message')! };
private get googleLink():HTMLElement { return first(this, 'a.google-oauth')! };
```

## Context Getters

Use getters to access context from parent views using `closest()`:

```typescript
get projectId() { return (<ProjectMainView>this.closest('v-project-main'))?.projectId }
get wksId() { return (<projectListView>this.closest('v-project'))?.wksId }
get orgId() { return (<wksListView>this.closest('v-wks'))?.orgId }
```

### When to Use Context Getters

Use context getters when:
- A child view needs access to parent view state
- Multiple child views share the same context pattern
- You need to pass context through the DOM hierarchy

### Best Practices

1. **Optional chaining**: Use `?.` since the parent may not always exist
2. **Type casting**: Cast the result with `<>` to access specific properties
3. **Read-only**: Context getters should typically be read-only (no setter)
4. **Descriptive names**: Use property names that clearly indicate the context being accessed

## Complete Example

```typescript
@customElement('v-example')
export class ExampleView extends BaseViewElement {

    //// Key elements
    private get contentEl():HTMLElement { return first(this, 'section.content')! };
    private get headerEl():HTMLElement { return first(this, 'header')! };

    get projectId() { return (<ProjectMainView>this.closest('v-project-main'))?.projectId }

    init() {
        super.init();
        this.refresh();
    }

    refresh() {
        this.contentEl.innerHTML = 'Updated content';
        this.headerEl.textContent = 'New title';
    }
}
```

## Related Patterns

- **Event selectors**: Pair element getters with `@onEvent` decorators for clean event binding
- **Data attributes**: Use `getAttribute('data-id')` on elements accessed via getters
- **View communication**: Use context getters to establish parent-child relationships

## Notes

- The `first()` function is imported from `dom-native`
- Non-null assertion (`!`) assumes the element exists in the template
- For optional elements, consider removing the `!` and handling null cases
