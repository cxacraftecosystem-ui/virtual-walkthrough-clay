# Content still needed from the workshop

The pavilion never tells visitors that anything is missing. Where the workshop's own material has not
arrived, an item shows a neutral stand-in of itself, or is hidden. This list is what is still needed to
replace those stand-ins. In the admin, untick **Needs content from the workshop** on each item once its real
material is in. For makers, untick **Hidden from visitors**.

| What | Where in the pavilion | What is shown meanwhile |
|---|---|---|
| Confirmation of the three traditions and their names (working titles: Bankura terracotta, Molela votive plaques, Longpi black pottery) | Galleries A, B, C; zone names; landing page; tour | The working titles |
| Photographs and details (maker, region, material, technique, year) of the 9 hung works (`clay-a-01 … clay-c-03`, six of them hero works) | Galleries A, B (upper register), C (curved wall) | Generated studies, described as "made for this exhibition, in the manner of …" |
| The 11 podium pieces — 3D scans or photographs and details (`clay-a-horse`, `clay-a-horse-small`, `clay-a-pot`, `clay-b-plaque-rider`, `clay-b-cups`, `clay-b-plaque-deity`, `clay-b-lamp`, `clay-b-plaque-serpent`, `clay-c-kettle`, `clay-c-bowl`, `clay-c-pot`) | The podium row, A → B → C | Modelled pieces |
| Review of the wall-panel text: *Three traditions of clay*, the three tradition panels, the five making panels (prepare, form, dry, fire, finish) and the statement on the inner main wall | Entrance hall, A / B / C, hallway, oculus court | The panels as written from general sources (modest, factual) |
| Review of the exhibition title and introduction on the description wall | Entrance hall | "Clay Traditions — Earth, water, hand and fire" with a short introduction |
| Pieces for the two drying shelves (unfired and fired) | Hallway | Modelled pots |
| Films of the making, if any | — (no screen is installed yet; a screen can go in the hallway or the entrance hall) | Nothing |
| Maker profiles (name, cluster, biography, portrait, links), with the maker's consent | "Meet the maker" cards, `/makers/<id>` | Nothing: the three stand-in profiles are hidden from visitors |
| Final partner credit wording and any additional partners | Landing page, entry screen | DC Handicrafts and IIT Kharagpur, "Presented by" |
| Screenshots of the finished pavilion for the landing page (`scripts/capture-landing.mjs`, re-authored for the pavilion's spaces) | Landing page | Quiet clay-ring panels with each picture's label |

## Before launch

- Replace the stand-in images by name (`public/artworks/clay-*.jpg`) or, better, through the admin, so curators can
  see what changed in the item's history.
- Hindi and Bengali: every visitor-facing text has a translation; have a native speaker read the panels, the tour
  captions and the tradition names before launch.
