# PixelPair brand sources

Variant A (joined pair) is the default. Replace `mark-source.svg` with `variants/b.svg` or `variants/c.svg`, then run `npm run brand`. This one file drives the runtime mark, all logos and directory assets. `npm run check:brand` verifies dimensions, contrast, outlined text, the 2 KB SVG limit and repeatability.

Accent `#9063b5` has contrast 4.53:1 on white and 3.51:1 on WordPress's `#1d2327` dark menu. Wordmark ink is `#1d2327`. Menu SVG uses `currentColor`, replaced with black when encoded so WordPress recolors it for the chosen admin scheme, following [WordPress menu guidance](https://developer.wordpress.org/reference/functions/add_menu_page/).

The wordmark uses Outfit, weight 500, converted to paths at build time. Source: [Google Fonts' Outfit directory](https://github.com/google/fonts/tree/main/ofl/outfit), downloaded 2026-10-02. Font SHA-256: `fc7287273e66929776e2ba54f144fe699080bec29f61bf649d70d871468aeade`. Its original [OFL license](fonts/OFL.txt) is included beside the unmodified font. Latin glyphs are outlined individually with kerning; no contextual substitutions are needed for these fixed brand strings. The font is never loaded by the admin or included in the plugin ZIP.

The release contains only `assets/images/pixelpair-logo.svg` and `assets/images/pixelpair-mark-mono.svg`. This directory and `.wordpress-org` are repository/directory-submission inputs, excluded by the release allowlist. The preview is `logo-preview.html`.
