# Vendored Superlearn contract

- [AI] types.ts and schemas.ts are copied verbatim from https://github.com/snowfranco/Superlearn at commit 34ef77e179903013ac5fbf082390a9485a5b4038 (2026-08-12). Previous pin: d5595e2 (2026-08-05).
- [AI] What the re-pin brought in: OutboxKind gained 'assign-to-theme'; new payload contracts ParkItemPayload (park with a singular itemId, the Feeds tab shape) and AssignToThemePayload (themeId or newThemeLabel, exactly one); writer-side validateOutboxPayload; ViewKey gained 'feeds'. No shape manifold writes changed.
- [AI] One mechanical change: the import specifier in schemas.ts gained a `.ts` extension (`'./types'` to `'./types.ts'`) because Node's native TypeScript loader requires explicit extensions. No shape changed.
- [AI] These files are the app's own reader-side validation. manifold's gate round-trips every row it intends to write through these schemas, so "validates against the app's contract" means literally the app's code, not a re-implementation.
- [AI] To re-vendor: copy the two files from the Superlearn repo, re-apply the import extension, update the commit hash here, and run the evals harness before shipping.
