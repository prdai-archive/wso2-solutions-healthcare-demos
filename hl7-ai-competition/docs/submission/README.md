# Care Loop — HL7 AI Competition submission documents

The submission documents for the WSO2 Care Loop entry, authored as HTML and
rendered to A4 PDF with headless Chrome. The layout follows the B3 (BitByBit)
docs approach (editorial print CSS, full-bleed cover, CSS `@page` margin boxes
for page numbers), retyped in Space Grotesk + Inter with a WSO2-orange accent.

## Documents

- `solution.html` — the required 10-page solution document. Covers the three
  judging axes: functional (problem, what it does, who for, impact), technical
  (the AI, HL7 FHIR usage, architecture, portability), and contextual (privacy,
  safety, human-in-the-loop, limitations).
- `evidence.html` — the supporting evidence document. Clinical citation table,
  FHIR resource catalogue with worked examples, AI agent specification,
  machine-learning model card, security/observability, and component inventory.

## Build

```sh
./build.sh
```

Renders both files to `out/*.pdf`. Needs `google-chrome` on the path (override
with `CHROME=...`). Chrome honours the CSS `@page` size and margin boxes, so
page geometry, page numbers, and backgrounds come entirely from
`assets/careloop.css`; `--no-pdf-header-footer` suppresses Chrome's own
header/footer so only the CSS margin boxes show.

## Layout

- `assets/careloop.css` — the stylesheet (design tokens, cover, sections,
  tables, callouts, code blocks, references, print rules).
- `assets/architecture.png` — the architecture diagram (copied from
  `../../assets/architecture-diagram-v2.png`), embedded in the solution document.

## Notes

- Fonts load from Google Fonts at render time, so the build needs network
  access; the layout degrades to the system sans stack offline.
- `out/` is generated; regenerate with `build.sh` rather than editing the PDFs.
