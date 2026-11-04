# Certification notes – Smart Org Pro 2.3.0.0

| # | Microsoft item | What was done |
|---|---|---|
| 1 | 100.3.3.3 URLs | No youtu.be link exists in this source. The short link is in the Partner Center listing (video field): replace it with `https://www.youtube.com/watch?v=<VIDEO_ID>`. |
| 2 | 100.6.1 Privacy Policy | `privacy/index.html` (host it at the URL in `src/Core/appInfo.ts` → `privacyUrl`, and enter the same URL in Partner Center). URL also shown in Format pane → About. |
| 3 | 1180.2.5 Right click | `selectionManager.showContextMenu` on cards (data point) and on empty space. |
| 4 | 1200.1.1.1 Code repository | This tree is clean (no node_modules/dist/.tmp). Push it to the `certification` branch, see below. |
| 5 | 1180.2.2.3 Filter out | Clicking a card (or a department in the legend) applies a basic filter on that column via `host.applyJsonFilter` (Ctrl = several people, empty space or second click = clear) → other visuals are filtered. Highlight/dim state is restored from `options.jsonFilters`. |
| 6 | 1180.2.3.1 Sample hints | `docs/SAMPLE-FILE-HINTS.md` + `sample/SmartOrg-Pro-sample-data.csv`; in-visual hint when no data is bound. |

## Host compatibility
No API newer than the existing `apiVersion` 5.1.0 was added (selection and context menu are API 2.x).
Check which API your target Report Server build ships (Microsoft changelog) before submitting.

## Build
    npm ci
    npx pbiviz package

## Branch
    git checkout -b certification
    git add -A && git commit -m "Smart Org Pro 2.3.0.0 certification source"
    git push -u origin certification
Then set `gitHubUrl` in `pbiviz.json` to the repository URL and rebuild.
