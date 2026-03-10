# PCSS Best Practices

This document outlines the best practices for writing CSS (with nesting) in this project.

## Class Naming Conventions

### General Rules

- Use **lowercase** with **hyphens** for all class names
- Do **not** use BEM-style naming with `--` or `__` separators
- Keep names **concise** but **descriptive**
- Use **prefixes** to group related classes (e.g., `ui-`, `v-`, `dg-`)
- Prefix based on file/context:
  - `ui-` - Common UI components (buttons, cards, forms, etc.)
  - `v-` - Views (page-level styles)
  - `dg-` - Dialogs
  - `c-` - Components (when creating reusable components)

### Examples

```css
/* Good - simple, descriptive, no BEM */
.button-primary
.card-content
.nav-item
.form-input
.icon-large

/* Bad - avoid BEM style */
.button__primary--active
.nav__item--selected
```

## File Structure

### File Naming

- Use **lowercase** with **hyphens** (e.g., `ui-button.css`, `v-main.css`)
- Prefix files based on their purpose:
  - `ui-*.css` - Common UI component styles
  - `v-*.css` - View-specific styles
  - `dg-*.css` - Dialog styles
  - `vars-*.css` - Variable definitions
  - `mixins-*.css` - Mixin definitions

### Recommended File Organization

```
frontends/
  _common/css/
    ui-*.css          # Common UI components
    vars-*.css        # Variables (colors, typography, etc.)
    mixins-*.css      # Mixins
  web/css/
    base.css          # Base/reset styles
    main.css          # Main entry point
    vars-colors.css  # Color variables (overrides)
    views/
      v-*.css       # View-specific styles
    dialog/
      dg-*.css      # Dialog-specific styles
```

## Writing PCSS

### Use Nesting Sparingly

PCSS supports nesting

```css
/* Good - minimal nesting */
.button-primary {
  background: var(--color-primary);
  
  &:hover {
    background: var(--color-primary-dark);
  }
  
  &:disabled {
    opacity: 0.5;
  }
}

```

### Use the `&` Selector

Use `&` for pseudo-classes and combinators:

```css
.nav-item {
  color: var(--color-text);
  
  &:hover {        /* Pseudo-class */
    color: var(--color-primary);
  }
  
  &.active {       /* Modifier class */
    font-weight: bold;
  }
}
```

## Color Variables

### Define Colors in Variable Files

Always define colors in a dedicated variable file (e.g., `vars-colors.css` or `common-colors.css`).

```css
/* vars-colors.css */
:root {
  /* Primary colors */
  --color-primary: #3b82f6;
  --color-primary-light: #60a5fa;
  --color-primary-dark: #2563eb;
  
  /* Secondary colors */
  --color-secondary: #64748b;
  --color-secondary-light: #94a3b8;
  --color-secondary-dark: #475569;
  
  /* Semantic colors */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Neutral colors */
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-background: #ffffff;
  --color-background-alt: #f1f5f9;
  --color-border: #e2e8f0;
}
```

### Reference Variables in Styles

Always use CSS custom properties for colors:

```css
.button-primary {
  background-color: var(--color-primary);
  color: var(--color-background);
  border: 1px solid var(--color-primary-dark);
}

.button-secondary {
  background-color: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
```

## Typography Variables

Define typography in a separate variables file:

```css
/* vars-typo.css */
:root {
  --font-family-base: 'Open Sans', sans-serif;
  --font-family-heading: 'Open Sans', sans-serif;
  
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

## Import Order

Organize imports in this order:

```css
/* 1. Variables */
@import '../common/css/vars-typo.css';
@import '../common/css/vars-elev.css';

/* 2. Mixins */
@import '../common/css/mixins-typography.css';
@import '../common/css/mixins-utils.css';

/* 3. Base/Reset styles */
@import './base.css';

/* 4. Component styles */
@import '../common/css/ui-button.css';
@import '../common/css/ui-card.css';
```

## Component Style Pattern

Follow this pattern when writing component styles:

```css
/* 1. Component root */
.card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  
  /* 2. Child elements */
  .card-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--spacing-sm);
  }
  
  .card-content {
    color: var(--color-text-muted);
    line-height: var(--line-height-normal);
  }
  
  .card-footer {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }
  
  /* 3. Pseudo-classes and modifiers */
  &:hover {
    border-color: var(--color-primary);
  }
  
  &.card-elevated {
    box-shadow: var(--elevation-md);
  }
}
```

## Mixins

Create reusable mixins for common patterns:

```css
/* mixins-utils.css */
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

@mixin truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin reset-button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
}

/* Usage */
.icon-button {
  @mixin reset-button;
  @mixin flex-center;
  width: 32px;
  height: 32px;
}
```

## Responsive Design

Use CSS variables for breakpoints when needed:

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

/* Usage */
.container {
  padding: var(--spacing-md);
  
  @media (min-width: var(--breakpoint-md)) {
    padding: var(--spacing-lg);
  }
  
  @media (min-width: var(--breakpoint-lg)) {
    padding: var(--spacing-xl);
  }
}
```

## Z-Index Scale

Use a predefined z-index scale to avoid z-index wars:

```css
/* vars-elev.css */
:root {
  --z-index-dropdown: 100;
  --z-index-sticky: 200;
  --z-index-fixed: 300;
  --z-index-modal-backdrop: 400;
  --z-index-modal: 500;
  --z-index-popover: 600;
  --z-index-tooltip: 700;
}

/* Usage */
.modal {
  position: fixed;
  z-index: var(--z-index-modal);
}

.modal-backdrop {
  position: fixed;
  z-index: var(--z-index-modal-backdrop);
}
```

## Additional Guidelines

### Keep Selectors Simple

```css
/* Good */
.button-primary
.card-title
.nav-item.active

/* Avoid */
div.container .content > .card .card-title
```

### Avoid !important

Only use `!important` as a last resort, typically for utility classes:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Group Related Properties

```css
.card {
  /* Layout */
  display: flex;
  flex-direction: column;
  
  /* Spacing */
  padding: var(--spacing-md);
  gap: var(--spacing-sm);
  
  /* Sizing */
  width: 100%;
  max-width: 400px;
  
  /* Colors */
  background: var(--color-background);
  border: 1px solid var(--color-border);
  
  /* Typography */
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  
  /* Effects */
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-sm);
}
```

## Summary Checklist

- [ ] Class names use lowercase with hyphens
- [ ] No BEM-style naming (no `--` or `__`)
- [ ] Colors defined in variable files
- [ ] Use CSS custom properties for colors
- [ ] Nesting is shallow (max 2-3 levels)
- [ ] Use `&` for pseudo-classes and combinators
- [ ] Keep selectors simple and specific
- [ ] Group related properties
- [ ] Use mixins for reusable patterns
- [ ] Follow consistent file naming conventions
