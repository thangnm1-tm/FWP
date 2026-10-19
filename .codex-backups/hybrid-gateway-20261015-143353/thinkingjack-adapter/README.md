# ThinkingJack session adapter

This adapter does not change the normal Codex configuration and does not start automatically. The launcher stops it when the Codex session exits.

## URL semantics

- Codex session base URL: `http://127.0.0.1:8787/v1`
- Codex appends `/responses`, producing `http://127.0.0.1:8787/v1/responses`.
- Adapter upstream base URL: `https://thinkingjack.com/v1`
- Adapter appends `/chat/completions`, producing `https://thinkingjack.com/v1/chat/completions`.

The loopback URL is required only because `thinkingJack4_stateless` exposes Chat Completions while Codex model providers use the Responses wire API. It is not a replacement for the ThinkingJack upstream URL.

## Session-only launch

Store a fresh credential in the Windows User environment variable `THINKINGJACK_API_KEY`, then run:

```powershell
C:\Users\Admin\.codex\thinkingjack-adapter\run-session.ps1 -Model thinkingJack4_stateless
C:\Users\Admin\.codex\thinkingjack-adapter\run-session.ps1 -Model thinkingJack4
```

Extra arguments are forwarded to `codex`. The launcher starts the adapter, supplies provider settings and the isolated ThinkingJack chat catalog as command-line overrides, and stops the adapter in `finally` when Codex exits. It makes no registry, scheduled-task, or global TOML changes.

## Test

```powershell
node .\test.mjs
```

The test uses a local mock upstream. It verifies exact URL joining, bearer forwarding, non-stream text conversion, streaming function-call conversion, completion events, and rejection of an unrelated model. It never reads a real key.

## Known limits

- This is a best-effort bridge, not native Responses API compatibility.
- It does not implement `previous_response_id`; Codex must resend conversation items.
- Built-in Responses tools, encrypted reasoning items, citations, images, audio, and usage accounting are not translated.
- Only function tools and text are translated.
- `thinkingJack4` may be selected as a Chat Completions fallback, but its observed upstream availability should be retested before use.
- A full live Codex tool-output loop is still required before treating the adapter as production-ready.

