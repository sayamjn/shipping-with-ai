# Agent or workflow?

The same task built two ways, with traces you can compare. Companion code for the Shipping with AI article "Not every AI feature needs an agent".

**The task:** triage a day of WhatsApp chats (synthetic, in `data/chats.json`) and return what is waiting on me and what I promised, each with an exact quote.

**Workflow** (`src/workflow.ts`): plain code ranks the chats (the same point rules as my Message Yourself OS bot, simplified), keeps the ones above 12 points inside a token budget, makes one model call with a JSON schema, then checks every quote against its message in code.

**Agent** (`src/agent.ts`): the model gets `list_chats`, `read_chat` and `finish`, decides what to read, and loops until it calls `finish` or hits 15 steps. The same quote check runs at the end.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                 # offline tests
npm run compare:offline  # scripted stand-in model, only to see the shape of the traces
GEMINI_API_KEY=... npm run compare   # real run with gemini-2.5-flash (set GEMINI_MODEL to change)
```

Each run prints a table (model calls, tool calls, tokens, time, findings, verified) and both traces, and saves the full result in `results/`.

**Note:** numbers from `compare:offline` come from a scripted stand-in, not a model. Only real runs say anything about cost or behaviour.
