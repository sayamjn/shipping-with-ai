# Agent or workflow?

The same task built two ways, with traces you can compare. Companion code for the Shipping with AI article "Not every AI feature needs an agent".

**The task:** triage a day of WhatsApp chats and return what is waiting on me and what I promised, each with an exact quote. The twelve chats in `data/chats.json` are made up; no real conversation is in this repo.

**Workflow** (`src/workflow.ts`): plain code ranks the chats with simple text signals (the same point rules as my Message Yourself OS bot, simplified), keeps the ones with 12 points or more inside a token budget, makes one model call with a JSON schema, then checks every finding in code.

**Agent** (`src/agent.ts`): the model gets `list_chats`, `read_chat` and `finish`, decides what to read, and loops until it calls `finish` or hits 15 steps. The same check runs at the end.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                              # offline tests
npm run compare:offline               # scripted stand-in model, only to see the shape of the traces
GROQ_API_KEY=... npm run compare      # real run on Groq, openai/gpt-oss-120b (set GROQ_MODEL to change)
GEMINI_API_KEY=... npm run compare    # real run on gemini-2.5-flash (set GEMINI_MODEL to change)
```

If both keys are set, Groq is used. `npm run compare` also reads keys from a `.env` file in this folder, which git ignores.

Each run prints a table and both traces, and saves the full result in `results/` (ignored by git, except the sample runs kept for the article).

## Exact setup

- **Models:** `openai/gpt-oss-120b` through Groq's OpenAI compatible chat completions API (three sample runs), and `gemini-2.5-flash` through the Gemini REST API, `v1beta generateContent` (one sample run, before its free tier daily cap of 20 requests ran out). Default settings: no temperature set, reasoning left at each model's default. On Groq the agent's tool choice is `required`, since the loop treats a reply without a tool call as an error.
- **Workflow system prompt:** "You read WhatsApp chats for Sayam. Return only what is waiting on him (someone asked him something) and what he promised. Copy the quote exactly from the message."
- **Agent system prompt:** "You help Sayam triage WhatsApp. Use the tools to decide which chats to read. Find what is waiting on him and what he promised, copying quotes exactly. Read only what you need, then call finish once."
- **Ranking signals** (`src/rank.ts`): unread messages (up to 30), they wrote last (10), last message ends with "?" (14), my last message contains "I'll" or "I will" (14), activity today (8), muted (minus 8), quiet group (minus 8); ignored chats are skipped. 12 points to qualify, at most 50 chats, 40,000 token budget.
- **Check** (`src/verify.ts`): a finding passes only if its quote appears in the named message and the sender matches the claim (a promise from me, "waiting on me" from someone else). It checks evidence and attribution, not whether the meaning is right.
- **Rate limits:** on a 429, the client waits for the delay the provider returns (`retryDelay` on Gemini, `retry-after` on Groq, capped at 90 seconds) and retries up to six times, recording the wait in the trace. Every request times out after 60 seconds.

## What the table means

- **Input tokens (all calls):** summed across every model call. For the agent each call resends the conversation so far, so this is cumulative, not the size of one context window.
- **Output tokens:** generated answer tokens. **Thinking tokens** are reported separately: `thoughtsTokenCount` on Gemini, `completion_tokens_details.reasoning_tokens` on Groq, where they are subtracted from `completion_tokens`. The Gemini sample run predates this column, so it has none.
- **Tools run:** `list_chats` and `read_chat` executions; the `finish` call is not counted.
- **Model time excl. waits / rate limit wait / elapsed:** elapsed is the total; the other two split it.

## Limitations

- Three runs on one model and one on another, on twelve synthetic chats. It shows what happened in these tests, not that workflows always beat agents.
- The agent is one design: one prompt, three tools, a 15 step limit. A better prompt or different stopping rules could change its results.
- The ranking rules are simple text signals and miss things on purpose (for example a promise written in Hinglish).
- Rate limits depend on the project, its usage tier and the model; the waits in the sample runs reflect free tier accounts and runs made back to back.
- Free tier Gemini API content may be used by Google to improve its products. Only synthetic data is sent to either provider.
- `npm run compare:offline` uses a scripted stand-in, not a model. Its numbers mean nothing about cost or behaviour.
