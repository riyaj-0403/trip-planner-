# Theme Migration Plan: Replace Hardcoded Colors with Tailwind Theme Classes

## Overview
This plan converts all pages and components from hardcoded CSS colors (hex, rgb) and styles to the tweakCN theme system using Tailwind classes and CSS variables. All logic is preserved; only styling and HTML elements change.

---

## 1. Global Styles (src/index.css and src/App.css)

### Current State
- **src/index.css**: Already has tweakCN theme variables (--primary, --background, --foreground, etc.) and Tailwind import. Body correctly uses `@apply bg-background text-foreground`.
- **src/App.css**: Contains Vite template boilerplate (.hero, #center, #next-steps, .counter, #spacer, .ticks) using old --accent-bg, --accent-border, --border, --text-h, --social-bg variables.

### Changes Required
- **src/App.css**: Delete all boilerplate CSS (.hero, .framework, .vite, #center, #next-steps, #docs, .ticks, .counter, #spacer) — these are leftover from the Vite template and no longer used by the app.
- **src/index.css**: Confirm already correct (no action needed on body/html styling).

### Verification
- Run `npm run build` — no TypeScript errors.

---

## 2. TripsPage.tsx and TripsPage.css

### Current State
**TripsPage.tsx**:
- Has hardcoded class `page-message` with error state styling
- Uses raw `<button class="create-trip-button">` (line 82)
- No shadcn Button component

**TripsPage.css**:
- Appears to be an exact copy of TripsFormPage.css (same selectors, same colors)
- Contains many form-page, form-field, stepper, trip-form styles that don't apply to TripsPage
- Not the correct CSS file

### Changes Required
1. **TripsPage.tsx**:
   - Remove the "Create New Trip" button (line 82 `<button className="create-trip-button">...`)
   - Keep the page title "My Trips"
   - Keep the EmptyState in TripList component (already handled in TripList)
   - Remove import of TripsPage.css
   - Replace hardcoded divs:
     - `.page-message` div → use Tailwind classes: `flex items-center justify-center min-h-screen text-foreground text-lg`
     - `.page-message.error` → add `text-destructive` class
   - Replace raw button with shadcn Button (once added to components.json)
   - Wrap the main content in a div with page styling: `bg-background text-foreground min-h-screen`

2. **TripsPage.css**:
   - Delete the file entirely — it's a duplicate of TripsFormPage.css and not needed

### Replacement Styling
- Page wrapper: `bg-background text-foreground min-h-screen py-10 px-6`
- Loading/error state: `flex items-center justify-center h-screen text-muted-foreground`
- Error state: add `text-destructive`
- Page header: `max-w-6xl mx-auto mb-8`
- Title: use Tailwind (no custom CSS needed)

### Verification
- `npm run build` — no errors
- Navigate to home page in browser
- Confirm "Create New Trip" button is gone
- Confirm "My Trips" title still appears
- Confirm empty state message shows when no trips
- Check light and dark mode: text readable, background correct

---

## 3. TripsFormPage.tsx and TripsFormPage.css

### Current State
**TripsFormPage.tsx**:
- Uses raw `<input>`, `<select>`, `<button>`, `<label>` elements
- Uses many hardcoded classes from TripsFormPage.css
- Has `<label>` for mini-fields but no shadcn Label
- Form fields have inline styling via CSS

**TripsFormPage.css** (450+ lines):
- Extensive hardcoded colors: #2563eb (blue), #ffffff (white), #e5e7eb (light gray), #111827 (dark text), #f3f4f6 (gray bg), #d1d5db (borders), #6b7280 (muted text), #374151 (darker text), #fca5a5, #fee2e2 (error reds), #fef3c7, #fcd34d (warning yellows), #eff6ff (light blue bg), #dc2626 (destructive red)
- Hardcoded border-radius: 16px, 14px, 12px, 10px, 8px
- Box shadows: 0 4px 12px rgba(0,0,0,0.06), 0 0 0 3px rgba(37, 99, 235, 0.15)
- Focus states hardcoded with #2563eb

### Changes Required
1. **TripsFormPage.css**: Delete entirely after converting all styles to Tailwind classes in TSX

2. **TripsFormPage.tsx**:

   **Step 1: Replace all raw form elements with shadcn components**
   - Import Button, Input, Select, Label, Textarea from "@/components/ui"
   - Replace `<input>` → `<Input>` 
   - Replace `<select>` → `<Select>`
   - Replace `<label>` → `<Label>`
   - Replace `<button className="add-button">` → `<Button variant="outline">`
   - Replace `<button className="save-button">` → `<Button>`
   - Replace `<button className="cancel-button">` → `<Button variant="outline">`
   - Replace `<button className="remove-button">` → `<Button variant="ghost" size="sm">`
   - Replace `<button className="drag-handle">` → keep as raw button but apply `text-muted-foreground hover:text-foreground` classes

   **Step 2: Replace all CSS classes with Tailwind**
   - `.form-page` → `className="min-h-screen bg-background text-foreground py-10 px-6 sm:px-4"`
   - `.trip-form` → `className="bg-card border border-border rounded-lg shadow-md p-7 flex flex-col gap-5 max-w-2xl mx-auto"`
   - `.form-field` → `className="flex flex-col gap-1.5"`
   - `.form-field label` → use `<Label>` component
   - `.form-field input, select` → already handled by Input/Select components
   - `.form-row` → `className="flex gap-4 flex-col md:flex-row"`
   - `.field-error` → `className="text-sm text-destructive"`
   - `.stepper` → `className="flex gap-2 justify-between mb-5"`
   - `.step` → `className="flex items-center gap-2 text-muted-foreground text-xs font-semibold flex-1"`
   - `.step.active` → add `text-foreground`
   - `.step-circle` → `className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center text-xs flex-shrink-0"` with `.active` → `bg-primary border-primary text-primary-foreground`
   - `.step-panel` → `className="flex flex-col gap-5"`
   - `.section-heading` → `className="mb-2"`
   - `.section-heading h2` → `className="text-xl text-foreground font-semibold"`
   - `.section-heading p` → `className="text-sm text-muted-foreground"`
   - `.destination-row` → `className="flex items-center gap-2.5"`
   - `.destination-number` → `className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0"`
   - `.day-adjuster` → `className="flex items-center gap-2 bg-muted px-2.5 py-1.5 rounded-lg flex-shrink-0"`
   - `.day-button` → use `<Button>` with size="sm" variant="outline"`
   - `.day-count` → `className="text-xs font-semibold text-foreground min-w-11 text-center"`
   - `.add-button` → use `<Button>` with `variant="outline"` class `dashed`
   - `.remove-button` → use `<Button>` with `size="sm" variant="ghost"`
   - `.budget-summary` → `className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg px-3.5 py-3 flex flex-col gap-2.5"`
   - `.summary-row` → `className="flex justify-between text-xs font-semibold text-foreground"`
   - `.summary-row .amount` → `className="text-foreground font-bold"`
   - `.summary-row .over-budget` → `text-destructive`
   - `.category-breakdown` → `className="pt-2 border-t border-green-200/50 dark:border-green-900/30 flex flex-col gap-1.5"`
   - `.breakdown-title` → `className="text-xs font-semibold text-muted-foreground uppercase"`
   - `.category-item` → `className="flex justify-between text-xs text-muted-foreground"`
   - `.category-name` → `className="capitalize"`
   - `.category-amount` → `className="font-medium text-foreground"`
   - `.duration-warning` → `className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 text-yellow-900 dark:text-yellow-200 px-3 py-2.5 rounded-lg text-xs font-medium"`
   - `.overlap-error` → `className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 px-3 py-2.5 rounded-lg text-xs font-medium"`
   - `.days-grid` → `className="flex flex-col gap-4"`
   - `.destination-heading` → `className="flex justify-between items-baseline py-1.5 pb-1.5 border-b-2 border-primary"`
   - `.destination-heading h3` → `className="text-lg text-foreground font-semibold"`
   - `.day-card` → `className="bg-muted/50 border border-border rounded-xl px-4 py-4 flex flex-col gap-3"`
   - `.day-card-header` → `className="flex justify-between items-baseline"`
   - `.day-card-header h3` → `className="text-base text-foreground font-semibold"`
   - `.day-card-header span` → `className="text-xs text-muted-foreground"`
   - `.day-empty` → `className="text-xs text-muted-foreground"`
   - `.activity-item` → `className="bg-card border border-border rounded-lg p-2.5 flex flex-col gap-2"`
   - `.activity-top` → `className="flex gap-2"`
   - `.activity-bottom` → `className="grid grid-cols-2 md:grid-cols-4 gap-2"`
   - `.mini-field` → `className="flex flex-col gap-0.5 text-xs font-semibold text-muted-foreground"`
   - `.drag-handle` → `className="cursor-grab touch-none bg-none border-none text-sm text-muted-foreground px-1 flex-shrink-0 hover:text-foreground"`
   - `.day-card.drop-over` → `outline outline-2 outline-dashed outline-muted-foreground/30`
   - `.form-actions` → `className="flex justify-end gap-3 mt-1"`
   - `.split-summary` → `className="m-0 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-700 dark:text-blue-200"`
   - `.step-panel` animation: keep via inline `animation` prop or Tailwind animation utilities

   **Step 3: Drag-and-drop styling**
   - Keep drag-and-drop logic exactly as is
   - Only update CSS class names to Tailwind utilities

3. **Delete TripsFormPage.css**

### Drag-and-Drop Logic
- Keep DraggableActivityItem component exactly as is
- Keep useSortable hooks and CSS.Transform logic unchanged
- Only update className and style props to use Tailwind

### Verification
- `npm run build` — no TypeScript errors
- Navigate to /trips/new in browser
- Fill form Step 1 (trip details), confirm dates, budget, travellers fields display correctly with theme
- Go to Step 2 (destinations), add destinations, confirm +/- day buttons work and use theme colors
- Go to Step 3 (itinerary), drag activities between days, confirm drag-and-drop works exactly as before
- Check light and dark mode on each step
- Verify budget summary uses green for positive, red for over-budget

---

## 4. TripCard.tsx and TripCard.css

### Current State
**TripCard.tsx**:
- Uses raw `<button>` element (View Trip button)
- Hardcoded inline style for budget progress bar: `width: ${budgetPercentage}%`

**TripCard.css** (60 lines):
- Colors: #ffffff (white), #111827 (dark text), #2563eb (blue), #1d4ed8 (darker blue), #374151, #6b7280, #e5e7eb (borders)
- Box shadow: 0 4px 12px rgba(0,0,0,0.05), 0 8px 20px rgba(0,0,0,0.08)
- Border-radius: 16px, 10px
- Transition effects on transform and shadow

### Changes Required
1. **TripCard.tsx**:
   - Import Button from "@/components/ui"
   - Replace raw `<button className="view-trip-button">` → `<Button className="w-full">View Trip →</Button>`
   - Replace all className references with Tailwind:
     - `.trip-card` → `className="bg-card border border-border rounded-2xl px-5 py-5 flex flex-col gap-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"`
     - `.trip-card-header h2` → `className="text-2xl text-foreground font-semibold m-0"`
     - `.trip-card-info` → `className="grid grid-cols-3 gap-3"`
     - `.info-item` → `className="flex flex-col gap-1.5 text-sm text-foreground"`
     - `.info-label` → `className="text-xs text-muted-foreground"`
     - `.budget-section` → `className="flex flex-col gap-2"`
     - `.budget-header` → `className="flex justify-between items-center text-sm text-foreground"`
     - `.budget-bar` → `className="w-full h-2 bg-border rounded-full overflow-hidden"`
     - `.budget-progress` → `className="h-full bg-primary rounded-full transition-all duration-300"` (keep inline width style)
     - `.budget-footer` → `className="text-xs text-muted-foreground"`

2. **Delete TripCard.css**

### Verification
- `npm run build` — no errors
- Navigate to home page (trips list)
- Hover over trip card — confirm shadow increases and card rises slightly
- Confirm budget bar color matches theme primary color
- Check light and dark mode on trip cards

---

## 5. TripList.tsx and TripList.css

### Current State
**TripList.tsx**:
- Uses raw `<h2>` and `<p>` in empty state

**TripList.css** (20 lines):
- Colors: #111827 (text), #6b7280 (muted text), #d1d5db (borders), #f9fafb (light bg)
- Border-radius: 16px
- Grid layout: 3 columns → 2 columns → 1 column responsive

### Changes Required
1. **TripList.tsx**:
   - Replace all className references with Tailwind:
     - `.trip-list` → `className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1 gap-5"`
     - `.empty-trips` → `className="text-center py-16 px-5 border border-dashed border-border rounded-2xl bg-muted"`
     - `.empty-trips h2` → `className="mb-2 text-foreground font-semibold"`
     - `.empty-trips p` → `className="m-0 text-muted-foreground"`

2. **Delete TripList.css**

### Verification
- `npm run build` — no errors
- Home page: confirm grid layout is 3 columns on desktop, 2 on tablet, 1 on mobile
- Empty state shows correct colors and text

---

## 6. TripDetailPage.tsx and TripDetailPage.css

### Current State
**TripDetailPage.tsx**:
- Uses raw `<button>` elements (Edit, Delete, Retry)
- Hardcoded inline styles for activity badge color
- No shadcn components

**TripDetailPage.css** (200+ lines):
- Colors: #111827 (text), #f3f4f6 (page bg), #ffffff (card bg), #e5e7eb (borders), #2563eb (blue links/buttons), #6b7280 (muted text), #374151, #9ca3af, #d1d5db, #dc2626 (destructive red), #fef2f2 (light red), #fca5a5, #1d4ed8 (darker blue)
- Box shadows: 0 1px 4px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)
- Border-radius: 14px, 12px, 8px, 999px
- Complex two-column grid layout on desktop, single column on mobile

### Changes Required
1. **TripDetailPage.tsx**:
   - Import Button from "@/components/ui"
   - Replace raw `<button className="tdp-edit-button">` → `<Button variant="outline" size="sm">Edit</Button>`
   - Replace raw `<button className="tdp-delete-button">` → `<Button variant="destructive" size="sm">Delete</Button>`
   - Replace raw `<button className="tdp-retry-button">` → `<Button variant="outline">Retry</Button>`
   - Replace all className references with Tailwind:
     - `.tdp-page` → `className="min-h-screen px-6 py-8 bg-background text-foreground"`
     - `.tdp-back-link` → `className="inline-block mb-4 text-xs font-semibold text-primary hover:underline"`
     - `.tdp-header` → `className="max-w-5xl mx-auto mb-6"`
     - `.tdp-header-main` → `className="flex items-start justify-between gap-4 flex-wrap"`
     - `.tdp-title` → `className="text-3xl text-foreground font-semibold m-0 mb-1.5"`
     - `.tdp-meta` → `className="m-0 text-sm text-muted-foreground flex items-center gap-2 flex-wrap"`
     - `.tdp-meta-sep` → `className="text-border"`
     - `.tdp-header-actions` → `className="flex gap-2 flex-shrink-0"`
     - `.tdp-body` → `className="max-w-5xl mx-auto grid grid-cols-4 lg:grid-cols-1 gap-6 items-start"`
     - `.tdp-sidebar` → `className="sticky top-4 h-fit max-h-screen overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-border"`
     - `.tdp-stat-cards` → `className="flex flex-col gap-2.5"`
     - `.stat-card` → `className="bg-card border border-border rounded-lg px-4 py-3.5 flex justify-between items-center shadow-sm"`
     - `.stat-label` → `className="text-xs font-medium text-muted-foreground"`
     - `.stat-value` → `className="text-base font-bold text-foreground"`
     - `.stat-value--negative` → `text-destructive`
     - `.tdp-chart-card` → `className="bg-card border border-border rounded-xl p-5 shadow-sm"`
     - `.tdp-chart-title` → `className="m-0 mb-4 text-sm font-bold text-foreground uppercase tracking-wider"`
     - `.tdp-itinerary` → `className="flex flex-col gap-6"`
     - `.tdp-itinerary-heading` → `className="m-0 text-xl text-foreground font-semibold"`
     - `.tdp-dest-section` → `className="flex flex-col gap-3"`
     - `.tdp-dest-heading` → `className="flex justify-between items-baseline pb-1.5 border-b-2 border-primary"`
     - `.tdp-dest-name` → `className="m-0 text-lg text-foreground font-semibold"`
     - `.tdp-dest-days` → `className="text-xs font-semibold text-primary"`
     - `.tdp-day-card` → `className="bg-card border border-border rounded-2xl px-4 py-4 flex flex-col gap-3 shadow-sm"`
     - `.tdp-day-header` → `className="flex justify-between items-baseline"`
     - `.tdp-day-label` → `className="flex items-baseline gap-2.5"`
     - `.tdp-day-number` → `className="text-base font-bold text-foreground"`
     - `.tdp-day-date` → `className="text-xs text-muted-foreground"`
     - `.tdp-day-subtotal` → `className="text-xs font-semibold text-foreground"`
     - `.tdp-no-activities` → `className="m-0 text-xs text-muted-foreground"`
     - `.tdp-activity-list` → `className="flex flex-col gap-2"`
     - `.activity-row` → `className="grid grid-cols-4 sm:grid-cols-2 items-center gap-2.5 px-2.5 py-2 bg-muted rounded-lg text-xs"`
     - `.activity-time` → `className="text-xs text-muted-foreground whitespace-nowrap"`
     - `.activity-name` → `className="font-medium text-foreground min-w-0 truncate col-span-full sm:col-span-1"`
     - `.activity-badge` → keep inline `style` prop for background color, add `className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"`
     - `.activity-cost` → `className="text-xs font-semibold text-foreground whitespace-nowrap text-right sm:text-left"`
     - `.tdp-loading` → `className="flex flex-col items-center justify-center min-h-96 gap-3 text-center text-muted-foreground text-base"`
     - `.tdp-message` → `className="flex flex-col items-center justify-center min-h-96 gap-3 text-center text-muted-foreground"`
     - `.tdp-message h2` → `className="m-0 text-2xl text-foreground font-semibold"`
     - `.tdp-message p` → `className="m-0 text-sm"`
     - `.tdp-empty` → `className="text-muted-foreground text-sm m-0"`

   **Note on StatCard component**:
   - Keep StatCard component as-is (it's already minimal)
   - Just add Tailwind classes to its JSX

2. **Delete TripDetailPage.css**

3. **Activity badge styling**:
   - Keep the inline `style={{ background: color + "22", color }}` for category colors (from constants/categories)
   - Just add Tailwind utility classes: `className="px-2 py-0.5 rounded-full text-xs font-semibold"`

### Layout Notes
- Two-column layout (sidebar + main itinerary): `grid grid-cols-4` where sidebar is 1 col, main is 3 cols
- Responsive: `lg:grid-cols-1` stacks sidebar on top on tablet/mobile
- Sidebar sticky: `sticky top-4 h-fit` keeps stats visible while scrolling

### Verification
- `npm run build` — no TypeScript errors
- Navigate to /trips/:id (a trip detail page)
- Confirm all buttons (Edit, Delete, Retry) use theme colors
- Verify layout: budget stats sidebar on left, itinerary on right (desktop); stacked on mobile
- Confirm activity badges show category color with theme-based styling
- Check light and dark mode on all sections
- Verify links (back link) use primary color

---

## 7. CategoryDonutChart.tsx and CategoryDonutChart.css

### Current State
**CategoryDonutChart.tsx**:
- Renders donut chart with recharts
- Empty state shown as gray ring
- Custom tooltip component

**CategoryDonutChart.css** (120+ lines):
- Colors: #6b7280 (muted text), #111827 (text), #e5e7eb (border), #ffffff (white bg), #dc2626 (destructive red), #E5E7EB (gray for empty), #374151, #1f2937, #9ca3af
- Box shadow: 0 2px 8px rgba(0,0,0,0.1)
- Border-radius: 8px, 50%
- Font sizes: 11px, 12px, 13px, 18px

### Changes Required
1. **CategoryDonutChart.tsx**:
   - Replace all className references with Tailwind:
     - `.donut-root` → `className="flex flex-col gap-4"`
     - `.donut-chart-wrapper` → `className="relative h-64 w-full"`
     - `.donut-center` → `className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1/5"` (use max-w-xs for padding effect)
     - `.donut-center-muted` → `className="text-xs text-muted-foreground leading-relaxed"`
     - `.donut-center-total` → `className="text-lg font-bold text-foreground leading-snug"`
     - `.donut-center-total.over-budget` → `text-destructive`
     - `.donut-center-over` → `className="text-xs text-destructive font-semibold mt-0.5"`
     - `.donut-tooltip` → `className="bg-card border border-border rounded-lg p-3 flex flex-col gap-0.5 shadow-md"`
     - `.donut-tooltip-label` → `className="text-xs font-semibold text-foreground"`
     - `.donut-tooltip-amount` → `className="text-sm text-foreground font-bold"`
     - `.donut-tooltip-pct` → `className="text-xs text-muted-foreground"`
     - `.donut-legend` → `className="list-none m-0 p-0 flex flex-col gap-2"`
     - `.donut-legend-item` → `className="grid gap-2 items-center text-xs grid-cols-4 sm:grid-cols-3"`
     - `.donut-legend-dot` → `className="w-2.5 h-2.5 rounded-full flex-shrink-0"`
     - `.donut-legend-name` → `className="text-foreground font-medium"`
     - `.donut-legend-amount` → `className="text-foreground font-semibold whitespace-nowrap"`
     - `.donut-legend-pct` → `className="text-muted-foreground text-xs whitespace-nowrap min-w-9 text-right"`

2. **Delete CategoryDonutChart.css**

### Category Colors
- Keep category colors from `src/constants/categories.ts` unchanged (each category stays distinct)
- Chart will use these colors correctly via `getCategoryColor()` function

### Verification
- `npm run build` — no errors
- Trip detail page loads chart
- Confirm donut chart displays with proper category colors
- Empty state shows "No spending yet" message
- Legend shows category names, amounts, percentages
- Hover tooltip on chart shows category details
- Light and dark mode: chart background and text use theme colors, category colors remain distinct

---

## 8. Remove TripsPage.css

### Action
- Delete `src/pages/TripsPage.css` (it's an incorrect duplicate of TripsFormPage.css)

---

## Summary of File Changes

| File | Action | Why |
|------|--------|-----|
| src/index.css | ✓ No change needed | Already has correct theme and Tailwind setup |
| src/App.css | Delete boilerplate | Remove .hero, #center, #next-steps, .counter, #spacer, .ticks (Vite template) |
| src/pages/TripsPage.tsx | Replace classes + remove button + add inline theme | Remove "Create New Trip" button; use theme colors |
| src/pages/TripsPage.css | Delete | Incorrect duplicate file |
| src/pages/TripsFormPage.tsx | Replace all elements + classes | Use shadcn Input/Select/Button/Label; Tailwind classes |
| src/pages/TripsFormPage.css | Delete | All styles moved to Tailwind classes |
| src/pages/TripDetailPage.tsx | Replace buttons + classes | Use shadcn Button; Tailwind classes |
| src/pages/TripDetailPage.css | Delete | All styles moved to Tailwind classes |
| src/components/Trip/TripCard.tsx | Replace button + classes | Use shadcn Button; Tailwind classes |
| src/components/Trip/TripCard.css | Delete | All styles moved to Tailwind classes |
| src/components/Trip/TripList.tsx | Replace classes | Tailwind grid + empty state styling |
| src/components/Trip/TripList.css | Delete | All styles moved to Tailwind classes |
| src/components/CategoryDonutChart.tsx | Replace classes | Tailwind classes for chart wrapper + tooltip |
| src/components/CategoryDonutChart.css | Delete | All styles moved to Tailwind classes |

---

## Hardcoded Color Replacements Reference

| Old Color | Tailwind Class | Theme Variable | Usage |
|-----------|----------------|-----------------|-------|
| #111827 (dark text) | `text-foreground` | --foreground | Page text, headings, labels |
| #ffffff (white) | `bg-card` | --card | Cards, form fields, backgrounds |
| #2563eb (blue primary) | `bg-primary`, `text-primary`, `border-primary` | --primary | Buttons, links, active states |
| #1d4ed8 (darker blue) | — | — | Hover state (use `hover:bg-primary/90` or shadcn Button) |
| #f3f4f6 (light gray) | `bg-muted` | --muted | Page background, alternating rows |
| #e5e7eb (gray border) | `border-border` | --border | Borders, dividers |
| #d1d5db (medium gray) | `border-border` | --border | Borders |
| #6b7280 (muted text) | `text-muted-foreground` | --muted-foreground | Secondary text, labels |
| #374151 (dark gray text) | `text-foreground` | --foreground | Form labels, secondary text |
| #9ca3af (light muted) | `text-muted-foreground` | --muted-foreground | Placeholder, hint text |
| #dc2626 (destructive red) | `text-destructive`, `bg-destructive` | --destructive | Error states, delete buttons |
| #fee2e2 (light red) | `bg-red-50 dark:bg-red-950/20` | — | Error backgrounds |
| #fca5a5 (red border) | `border-red-200 dark:border-red-900` | — | Error borders |
| #fef3c7 (light yellow) | `bg-yellow-50 dark:bg-yellow-950/20` | — | Warning backgrounds |
| #fcd34d (yellow border) | `border-yellow-200 dark:border-yellow-900` | — | Warning borders |
| #eff6ff (light blue) | `bg-blue-50 dark:bg-blue-950/20` | — | Info backgrounds |
| rgba(37, 99, 235, 0.15) (blue shadow) | `ring-primary/15` or `shadow-primary` | — | Focus ring (use shadcn input focus) |

---

## Border-Radius Replacements Reference

| Old Value | Tailwind Class |
|-----------|----------------|
| border-radius: 16px | `rounded-2xl` |
| border-radius: 14px | `rounded-xl` |
| border-radius: 12px | `rounded-lg` |
| border-radius: 10px | `rounded-md` |
| border-radius: 8px | `rounded` or `rounded-lg` |
| border-radius: 6px | `rounded-sm` |
| border-radius: 999px | `rounded-full` |

---

## Shadow Replacements Reference

| Old Value | Tailwind Class |
|-----------|----------------|
| 0 4px 12px rgba(0,0,0,0.06) | `shadow-md` |
| 0 4px 12px rgba(0,0,0,0.05) | `shadow-sm` |
| 0 8px 20px rgba(0,0,0,0.08) | `shadow-lg` |
| 0 1px 4px rgba(0,0,0,0.05) | `shadow-sm` |
| 0 2px 8px rgba(0,0,0,0.1) | `shadow` or `shadow-md` |
| 0 0 0 3px rgba(37, 99, 235, 0.15) | Handled by shadcn components |

---

## Verification Checklist

### Build & TypeScript
- [ ] `npm run build` completes with zero TypeScript errors
- [ ] No missing imports or components

### TripsPage
- [ ] "Create New Trip" button is removed
- [ ] "My Trips" title still visible
- [ ] Empty state message appears when no trips
- [ ] Page background uses theme colors
- [ ] Text readable in both light and dark mode

### TripsFormPage
- [ ] Step 1: Date picker, budget, travellers fields display correctly
- [ ] Form uses theme input styling (shadcn Input)
- [ ] Step 2: Destinations list with +/- day adjuster buttons
- [ ] Step 3: Itinerary with day cards and activity items
- [ ] **Drag-and-drop works exactly as before**: activities can be dragged between days
- [ ] Budget summary shows correct colors (green for positive, red for over-budget)
- [ ] Error messages and warnings use correct theme colors
- [ ] All form buttons (Add, Save, Cancel) use shadcn styling
- [ ] Light and dark mode: colors correct on each step

### TripCard
- [ ] Cards display in grid (3 columns desktop, 2 tablet, 1 mobile)
- [ ] Budget bar color matches primary theme color
- [ ] Hover effect: shadow increases, card rises
- [ ] Light and dark mode: card background and text readable

### TripDetailPage
- [ ] Sidebar (budget stats) displays correctly
- [ ] Donut chart renders with category colors
- [ ] Two-column layout on desktop (sidebar left, itinerary right)
- [ ] Single column layout on mobile (sidebar on top)
- [ ] Activity rows show correct colors
- [ ] All buttons (Edit, Delete, Retry) use shadcn styling
- [ ] Category colors from src/constants/categories remain distinct
- [ ] Light and dark mode: all colors correct

### CategoryDonutChart
- [ ] Donut chart displays on trip detail page
- [ ] Empty state shows "No spending yet" with gray ring
- [ ] Legend shows categories with correct colors
- [ ] Tooltip on hover shows category, amount, percentage
- [ ] Over-budget indicator appears in red when applicable

### Global
- [ ] All pages have correct background color (--background)
- [ ] All text uses correct foreground color
- [ ] Borders use --border color
- [ ] Buttons use primary/destructive colors appropriately
- [ ] Light mode: all colors readable
- [ ] Dark mode: all colors readable and contrasting
- [ ] No hardcoded colors remain in CSS files
- [ ] All CSS files except index.css have been deleted

---

## Notes

1. **Keep All Logic**: No business logic, state management, or API calls change. Only CSS and HTML elements.
2. **Drag-and-Drop**: The dnd-kit integration in TripsFormPage stays exactly the same. Only styling changes.
3. **Category Colors**: The `getCategoryColor()` function from src/constants/categories.ts provides category-specific colors. These colors remain unchanged and are kept distinct from the theme palette.
4. **Component Imports**: All shadcn components (Button, Input, Select, Label, Textarea) must be added to components.json before starting this work.
5. **Responsive Design**: Keep all existing responsive breakpoints (600px, 900px, 1200px). Tailwind classes handle these via `sm:`, `md:`, `lg:`, `xl:` prefixes.

