# Design System Strategy: The Culinary Atelier

### 1. Overview & Creative North Star
**Creative North Star: The Living Editorial**
This design system moves away from the sterile, "app-like" feel of traditional meal planners. Instead, it adopts the persona of a high-end culinary magazine—think *Cereal* or *Kinfolk*—where recipes are treated as art. We reject the rigid, boxed-in layouts of the web's past in favor of **The Living Editorial**: a fluid, breathing interface that uses intentional white space, sophisticated asymmetry, and layered depth to make content feel appetizing and curated.

By prioritizing tonal shifts over harsh borders and utilizing a "high-contrast" typographic rhythm, we create an environment that feels as fresh as the ingredients it describes.

---

### 2. Colors: The Fresh Palette
Our colors are derived from nature—earthy greens, sun-ripened oranges, and soft parchment neutrals.

*   **Primary (`#0f5238`) & Primary Container (`#2d6a4f`):** These represent the "Leafy Greens." Use the Primary for high-impact brand moments and the Container for grounded, tactile elements.
*   **Secondary (`#944a00`) & Secondary Container (`#fc8f34`):** The "Warm Oranges." These are your "appetite" colors. Use them sparingly for CTAs, notifications, or to highlight "Special Offers" and "Seasonal Picks."
*   **The "No-Line" Rule:** To maintain a premium, editorial feel, **1px solid borders are strictly prohibited for sectioning.** Instead of drawing a line to separate a sidebar from a feed, use a background shift from `surface` (`#fbf9f8`) to `surface_container_low` (`#f5f3f3`).
*   **Surface Hierarchy & Nesting:** Treat the UI as layers of fine paper. 
    *   Base: `surface`
    *   Sectioning: `surface_container`
    *   Cards/Floating Elements: `surface_container_lowest` (pure white) to provide a "pop" against the off-white background.
*   **Signature Textures:** For Hero sections or primary action buttons, apply a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle. This adds "soul" and depth that flat hex codes cannot achieve.

---

### 3. Typography: The Editorial Rhythm
The soul of this system lies in the tension between a sophisticated serif and a contemporary sans-serif.

*   **The Display Voice (Newsreader):** Use Newsreader for all `display`, `headline`, and `title` roles. It provides a friendly, human, and "kitchen-table" warmth. For `display-lg` (`3.5rem`), use tight letter-spacing (-0.02em) to create an authoritative, editorial look.
*   **The Functional Voice (Plus Jakarta Sans):** Use Plus Jakarta Sans for `body` and `label` roles. Its high x-height ensures legibility even in complex recipe instructions or dense shopping lists.
*   **Hierarchy Tip:** Never center-align body text. Keep it left-aligned to maintain the "grid-less" editorial flow. Use `title-lg` in Newsreader to introduce sections, paired with `body-md` in Plus Jakarta Sans for the description.

---

### 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "distance"; we use them to create "atmosphere."

*   **The Layering Principle:** Depth is achieved by stacking surface tiers. A recipe card should be `surface_container_lowest` sitting on a `surface_container` background. The change in "paper tone" is enough to define the boundary.
*   **Ambient Shadows:** If a floating element (like a "Add to Plan" FAB) requires a shadow, use a highly diffused blur (24px-32px) at 6% opacity, tinted with `primary` (`#0f5238`). This mimics natural light filtered through a kitchen window.
*   **The "Ghost Border" Fallback:** In rare cases where a container needs more definition (e.g., an input field), use the `outline_variant` token at **20% opacity**. It should be felt, not seen.
*   **Glassmorphism:** For overlays or navigation bars, use `surface` with a 0.8 alpha and a 12px backdrop-blur. This allows the vibrant food photography to bleed through the UI, keeping the experience "appetizing" at all times.

---

### 5. Components

*   **Buttons:** 
    *   *Primary:* Rounded (`md: 0.75rem`), using the Primary-to-Primary-Container gradient. White text (`on_primary`).
    *   *Secondary:* `surface_container_high` background with `primary` text. No border.
*   **Recipe Cards:** 
    *   Background: `surface_container_lowest`. 
    *   Corner Radius: `lg: 1rem`. 
    *   *Constraint:* No dividers. Use `spacing-6` (`2rem`) to separate the image, title, and "Cook Time" metadata.
*   **Chips (Category Filters):** 
    *   Unselected: `surface_container_low` background, `on_surface_variant` text.
    *   Selected: `primary_fixed` background, `on_primary_fixed` text.
    *   Shape: `full` (pill-shaped).
*   **Input Fields:** 
    *   Background: `surface_container_lowest`. 
    *   Bottom Border only: `outline_variant` at 40% opacity. 
    *   Focus state: Transition the bottom border to `primary` at 2px thickness.
*   **Interactive Ingredients List:** 
    *   Use `surface_container_low` for the background of the active row.
    *   Checkboxes: Use `primary` for the checked state, with a soft `primary_fixed` glow. Avoid the standard square; use a slightly rounded `sm: 0.25rem` for the checkbox itself.

---

### 6. Do's and Don'ts

**Do:**
*   **Do** use asymmetrical margins. For example, give a recipe hero image a `spacing-10` left margin but a `spacing-0` right margin so it bleeds off the screen.
*   **Do** prioritize high-quality food photography. The UI is the "plate," and the photo is the "meal."
*   **Do** use `newsreader` for numbers in recipes (e.g., "Step 01"). It adds a premium, curated touch.

**Don't:**
*   **Don't** use 100% black text. Always use `on_surface` (`#1b1c1c`) to maintain a soft, organic feel.
*   **Don't** use dividers between list items. Use the `spacing-3` or `spacing-4` scale to let the typography and white space create the separation.
*   **Don't** use sharp 90-degree corners. Everything in a kitchen is tactile; use the `md` or `lg` rounding tokens to keep the UI "soft."