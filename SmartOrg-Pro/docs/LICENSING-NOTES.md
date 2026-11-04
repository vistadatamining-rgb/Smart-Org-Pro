# Smart Org Pro - licensing (same model as the Orbit Chart Pro guide)

- Two states only: **Free** (no key) and **Licensed** (any valid key). No Pro/Premium levels; the old `tier` field in a key is ignored.
- Key = `<payload>.<signature>` (ECDSA P-256 / SHA-256), signed with the project's existing private key; an optional `SOP1.` prefix and pasted spaces/line breaks are accepted. Existing keys keep working.
- Check order: signature -> product -> clock tampering -> expiry -> device -> email.
- No key: badge "Free version - hover for limits" (bottom-right) with the list of locked features, faint watermark, no lock-out.
- Key present but unusable (expired, wrong device/email/product, clock change): blurred overlay with the exact reason + watermark.
- Valid key: no badge, no watermark, no overlay.
- Clock rollback: key issue date check + stored "last seen" ratchet (2 h tolerance); re-check every 60 s.
- Free-locked features: see `src/Core/constants.ts` (RESTRICTED / FEATURE_LABELS). Collapse/expand and zoom stay free.
- Turn the watermark off: `watermark: false` in `src/Core/appInfo.ts`.
