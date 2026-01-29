# Form Best Practices

This document outlines the coding standards and best practices for form components in TypeScript views. It covers form controls, data extraction, and dialog integration.

## Form Controls

### Available Form Controls

The following form controls are available for use in forms:

- **`d-input`** - Single-line text input
- **`d-text`** - Multi-line textarea input
- **`d-checkbox`** - Checkbox for boolean values
- **`d-select`** - Dropdown selection
- **`d-radio`** - Radio button group

## Form Data Extraction

### Using pull()

The `pull()` method from `dom-native` extracts form data from a component hierarchy.

```typescript
import { pull } from 'dom-native';
```

Basic usage:

```typescript
const formData = pull(this);
```

Returns an object with field names as keys and input values as values:

```typescript
{
    name: "Organization Name",
    description: "Some description",
    active: true,
    type: "org"
}
```

### Example: Dialog Form Handler

```typescript
@onEvent('pointerup', '.do-ok')
doOk() {
    super.doOk();
    const detail = pull(this);
    trigger(this, 'ORG_ADD', { detail });
}
```

The `pull(this)` extracts all form control values from within the component.

## Form Layout in Dialogs

### Dialog Structure

Standard dialog structure for forms:

```html
<div slot="title">Add Organization</div>

<div class="dialog-content">
    <d-input label="Name" name="name"></d-input>
    <d-text label="Description" name="description"></d-text>
    <d-checkbox label="Active" name="active"></d-checkbox>
</div>

<button slot="footer" class="do-cancel">CANCEL</button>
<button slot="footer" class="do-ok medium">OK</button>
```

Components:
- `slot="title"` - Dialog title
- `dialog-content` - Container for form controls
- `slot="footer"` - Action buttons

## Complete Form Example

```html
<div class="dialog-content">
    <d-input label="Name" name="name"></d-input>
    <d-text label="Description" name="description"></d-input>
    <d-select label="Status" name="status">
        <option value="planning">Planning</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
    </d-select>
    <d-checkbox label="Public" name="isPublic"></d-checkbox>
</div>
```

## Best Practices

### Form Control Usage

- Use `d-input` for single-line text
- Use `d-text` for multi-line content
- Use `d-select` for more than 5 options
- Use `d-radio` for 3-5 visible options
- Use `d-checkbox` for boolean flags

### Naming Conventions

- Use `name` attribute matching the data field
- Use descriptive labels
- Use kebab-case for names and labels

### Layout

- Use grid layout with `grid-auto-flow: row`
- Set `grid-auto-rows: min-content`
- Use consistent `grid-gap` (1rem default)
- Group related fields

### Event Handling

- Use `@onEvent` decorator for button handlers
- Call `super.doOk()` to close dialog
- Use `trigger()` to notify parent components
- Extract form data with `pull(this)`

### Focus Management

- Auto-focus first input on display:

```typescript
postDisplay() {
    first(this, 'd-input')?.focus();
}
```

## Common Patterns

### Add Dialog Pattern

Standard pattern for add dialogs:

1. Extend `DgDialog`
2. Define CSS for content layout
3. Use `pull(this)` in OK handler
4. Trigger event with form data
5. Focus first input on display

### Edit Dialog Pattern

For edit dialogs, populate form with existing data:

```typescript
init() {
    const record = this.record; // assume passed in
    
    this.innerHTML = `
        <div slot="title">Edit Project</div>
        
        <div class="dialog-content">
            <d-input label="Name" name="name" value="${record.name}"></d-input>
            <d-text label="Description" name="description">${record.description}</d-text>
        </div>
        
        <button slot="footer" class="do-cancel">CANCEL</button>
        <button slot="footer" class="do-ok medium">SAVE</button>
    `;
}
```

## Summary Checklist

### Form Controls
- [ ] Appropriate control type used for data
- [ ] `name` attribute matches data field
- [ ] Labels are descriptive
- [ ] Select options include appropriate values

### Layout
- [ ] Grid layout with `grid-auto-flow: row`
- [ ] `grid-auto-rows: min-content`
- [ ] Consistent `grid-gap`
- [ ] Related fields grouped together

### Data Extraction
- [ ] `pull()` used to extract form data
- [ ] Validation performed if needed
- [ ] Event triggered with form data

### Event Handling
- [ ] `@onEvent` decorators used correctly
- [ ] `super.doOk()` called to close dialog
- [ ] Custom events triggered for parent components

### User Experience
- [ ] First input auto-focused on display
- [ ] Clear cancel/ok buttons
- [ ] Descriptive dialog title
- [ ] Appropriate button labels
