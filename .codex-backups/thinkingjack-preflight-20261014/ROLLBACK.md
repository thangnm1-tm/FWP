# ThinkingJack preflight backup

Created before any proposed ThinkingJack provider changes on 2026-10-14.

## Baseline

- Codex CLI: `0.161.0`
- Authentication: ChatGPT
- Base `config.toml`: no pinned `model`, `model_provider`, or `model_catalog_json`
- Effective bundled catalog: 10 models; first model `gpt-6.1-sol`
- ThinkingJack models in effective catalog: 0
- `THINKINGJACK_API_KEY`: absent from User, Machine, and Process scopes at audit time
- ThinkingJack Run entry: absent
- ThinkingJack scheduled task: absent
- TCP listener on port 8787: absent
- Active workspace gateway directory: absent
- Backup config SHA-256: `9ACA9445BEB32E7D372924DF4E805B6618BF5B9ED63F015D9A2CCACFB6B4F6E3`

## Restore

1. Exit Codex completely.
2. Replace `C:\Users\Admin\.codex\config.toml` with `config.toml.before-thinkingjack` from this folder.
3. Remove only the proposed `C:\Users\Admin\.codex\thinkingjack.config.toml` and proposed ThinkingJack catalog, if they were later created.
4. Remove `THINKINGJACK_API_KEY` from User environment scope, if it was later added.
5. Reopen Codex and confirm the provider is OpenAI and the bundled model catalog is active.

This backup intentionally contains no API key.
