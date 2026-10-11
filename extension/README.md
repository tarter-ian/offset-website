# Offset browser extension: how the site talks to it

The site (`src/lib/extension.ts`) and the extension talk through
`window.postMessage` on the Offset page. The extension needs a content script
on the site's pages (`https://offset-website*.vercel.app/*`, the production
domain once there is one, and `http://localhost/*` for development) that
relays these messages to its background worker.

Every message is an object with a `source` field: `"offset-site"` from the
page, `"offset-extension"` from the extension. Ignore anything else.

## Detect

Page sends `{ source: "offset-site", type: "ping" }`.

Extension answers, and may also send this unprompted on load:

```js
{ source: "offset-extension", type: "ready", version: "0.1.0", services: ["chatgpt", "claude", "gemini"] }
```

`services` lists what this version can count. The site only routes those
services' Connect buttons to the extension; the rest get the quick count.

## Count

Page sends `{ source: "offset-site", type: "count", service: "chatgpt", id }`.

While working, the extension may send any number of
`{ source: "offset-extension", type: "progress", id, text: "Counting your ChatGPT use…" }`.

Then exactly one of:

```js
{ source: "offset-extension", type: "result", id, usage: { ... } }
{ source: "offset-extension", type: "error", id, message: "Log in to ChatGPT, then press Connect again." }
```

`message` is shown to the person as is, so write it for them.

`usage` is the same shape the counting scripts already produce (read by
`signInUsage` in `src/lib/ai/signin.ts`):

| Field | Meaning |
| --- | --- |
| `prompts` | Prompts sent in the window (required) |
| `reasoningResponses` | Answers from reasoning models |
| `images` | Images made |
| `windowDays` | Days counted, usually 30 |
| `planType` or `rateLimitTier` | The plan, e.g. `plus`, `default_claude_max_5x` |
| `weeklyLimitUsedPercent` | Claude only: share of the weekly limit used |
| `conversations`, `activeDays`, `daily[]` | Optional extras |

Counts only. Never send titles, message text or anything else from a chat.
