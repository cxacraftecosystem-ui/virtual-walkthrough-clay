# Artwork images

The pavilion hangs the nine `clay-*.jpg` studies in this folder (`src/museum/config/artworks.ts`). They are
**placeholders**: procedurally drawn reliefs, plaques and pots in the manner of each tradition, used for layout
and lighting calibration. They depict no documented object and make no cultural or historical claim. Replace them
with the workshop's photographs. (The other files here are the hand block museum's stand-ins, kept from the shared
code base; the pavilion does not use them.)

| File | Gallery | Surface |
|---|---|---|
| `clay-a-01` · `clay-a-02` · `clay-a-03` | A — Bankura terracotta | `a-outer-1` (eye level), `a-outer-3`, `a-outer-2` (upper register) |
| `clay-b-01` · `clay-b-02` · `clay-b-03` | B — Molela plaques | `b-outer-2`, `b-outer-3`, `b-outer-4` (upper register) |
| `clay-c-01` · `clay-c-02` · `clay-c-03` | C — Longpi pottery | `c-south-1`, `c-south-2`, `c-south-3` (eye level) |

## Replacing an image

1. Drop the new image into this folder (JPG; sRGB; long edge 2048–4096 px). **Any aspect ratio works**: the
   frame, mat and spotlight follow the image's size.
2. Either keep the same file name, or point the entry at the new file (`image: '/artworks/<file>'`). Then run
   `node scripts/optimize-assets.mjs --artworks` to write the `.2048.webp` / `.1024.webp` variants the pavilion loads
   (or delete the old variants: the original is loaded when they are missing).
3. Fill in the real metadata and remove `placeholder: true` — or do all of this in the admin (Content), which is
   the normal route once the pavilion is deployed.

## Regenerating the placeholders

    node scripts/generate-placeholders.mjs

(Headless Chrome via puppeteer-core; set `CHROME_PATH` if Chrome is not at the default Windows location and
`ONLY=clay-a-01.jpg` to render a subset.) It skips files that already exist unless `FORCE=1` is set, so real
photographs saved under these names are safe.
