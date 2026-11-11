# Evals before vibes

Two prompts for the same task, judged two ways: on three examples that look right, and on a labelled set. Companion code for the Shipping with AI article "Evals before vibes".

**The task:** the WhatsApp triage extraction from `01-agent-or-workflow`. Given a few chats, return what is waiting on me (`waiting_on_me`) and what I promised (`i_promised`), each with the chat id, message id, an exact quote and a summary, through a JSON schema.

**Vibes:** run each prompt on three easy cases and read the answers. Both prompts get them right, so the change looks safe or pointless depending on your mood.

**Evals:** run each prompt on all 24 labelled cases in `data/cases.jsonl`, grade every answer in code against the labels, then ask an LLM judge about every returned finding and measure how often the judge agrees with the labels.

The chats and labels are made up and hand written by me. The labels are the ground truth for every number this demo prints; no real conversation is in this repo.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                           # offline tests
npm run eval:offline               # scripted stand-in model, only to see the shape of the output
GROQ_API_KEY=... npm run eval      # real run on Groq, openai/gpt-oss-120b (set GROQ_MODEL to change)
GEMINI_API_KEY=... npm run eval    # real run on gemini-2.5-flash (set GEMINI_MODEL to change)
```

If both keys are set, Groq is used. `npm run eval` also reads keys from a `.env` file in this folder, which git ignores. Set `TRACE_LIVE=1` to print each model call as it finishes.

A real run makes one call per case per pass (3 vibes cases and 24 cases, for each of two prompts, so 54) plus one judge call per returned finding, usually around a hundred calls in all. Cases run one after another to stay inside free tier rate limits. That is more than the Gemini free tier daily cap of 20 requests that `01-agent-or-workflow` ran into.

Each run prints a results table, a usage table, every failed case with its tags, and every finding where the judge and the labels disagree, then saves the full result in `results/` (ignored by git, except sample runs kept for the article).

## Exact setup

- **Models:** `openai/gpt-oss-120b` through Groq's OpenAI compatible chat completions API, or `gemini-2.5-flash` through the Gemini REST API, `v1beta generateContent`. Default settings: no temperature set, reasoning left at each model's default. The same model answers the task and acts as the judge.
- **Cases** (`data/cases.jsonl`): 24 cases, each with one to three small chats, the findings a correct answer must contain (`expected`), tags and a note explaining the label. 17 findings are expected in all (10 waiting on me, 7 promises); 9 cases expect nothing. They cover plain questions, requests without a question mark, promises with "I'll" and "I will", Hinglish questions, requests and promises ("Kal tak bhej dunga", "Main kal call karta hoon"), a statement about a problem ("Bro the API docs link is broken"), a status update, a question in a group addressed to someone else, a muted group, a question I already answered, a promise I already kept, a reply that is only an emoji, a rhetorical question, someone else's "I'll", and chats with nothing to do. The three cases tagged `vibes` are the easy ones.
- **Prompt v1** (`src/prompts.ts`), the workflow prompt from `01-agent-or-workflow`: "You read WhatsApp chats for Sayam. Return only what is waiting on him (someone asked him something) and what he promised. Copy the quote exactly from the message."
- **Prompt v2:**

  > You read WhatsApp chats for Sayam. Messages with from "me" are Sayam's; messages with from "them" are from other people.
  > Return two kinds of findings:
  > \- waiting_on_me: someone asks Sayam a question or requests something from him, and he has not answered it or done it later in the chat.
  > \- i_promised: Sayam commits to a future action, in any language including Hinglish, and has not done it later in the chat.
  > These do not count: statements and updates, even about a problem; rhetorical questions; questions or requests addressed to someone else; anything Sayam has already answered or done.
  > If nothing counts, return an empty list. Copy the quote exactly from the message.

  It gives no example phrases, so no wording from the cases leaks into the prompt.
- **User message:** `Chats:` followed by the case's chats as JSON, the same shape as `01-agent-or-workflow/data/chats.json`.
- **Code grader** (`src/graders/code.ts`): each returned finding is matched to the labels by chat id, message id and kind. The right message with the other kind counts as wrong kind; anything else returned, including a repeat, is a false positive; a label with no finding at its message is missed. Every finding also goes through the quote check from `01-agent-or-workflow` (`src/verify.ts`): the quote must appear in the named message and the sender must match the kind. A case passes only if every expected finding comes back with the right kind, nothing else comes back, and every quote passes the check.
- **LLM judge** (`src/graders/judge.ts`): one call per finding returned in the all cases pass, with the finding's chat, the message id, kind and quote, and a binary question: "Is this message really something waiting on Sayam?" or "Is this message really a promise Sayam made?". It answers `pass` or `fail` with a one line reason through a JSON schema. Judge system prompt: "You check one finding from a WhatsApp triage for Sayam. Messages with from "me" are Sayam's; messages with from "them" are from other people. Read the chat, then answer the question about the named message with pass or fail and a one line reason." The vibes pass is not judged.
- **Rate limits:** on a 429, the client waits for the delay the provider returns (`retryDelay` on Gemini, `retry-after` on Groq, capped at 90 seconds) and retries up to six times, recording the wait. Every request times out after 60 seconds. A call that still fails marks that case as errored (counted as not passed) and the run goes on.

## What the table means

- **Vibes cases passed / all cases passed:** cases where the answer was exactly right, out of the cases run. Everything is reported as counts and fractions, never percentages.
- **False positives:** findings returned that no label asks for.
- **Missed:** labelled findings with nothing returned at that message, out of all labelled findings.
- **Wrong kind:** the right message returned as the other kind (a question filed as a promise, or the reverse).
- **Judge agreement with labels:** of the findings the judge ruled on, how many times its pass or fail matched the labels. A finding is truly correct only if it matches a label by chat, message and kind. Disagreements are listed both ways: the judge passing a finding the labels reject (too lenient) and failing one they accept (too strict). This checks the judge; it is not a second score for the prompt.
- **Usage table:** model calls, input, output and thinking tokens, model time and rate limit waits, per prompt and per phase (vibes pass, all cases, judge). Thinking tokens are `thoughtsTokenCount` on Gemini and `completion_tokens_details.reasoning_tokens` on Groq, where they are subtracted from `completion_tokens`.

## Limitations

- 24 small synthetic cases, labelled by one person. They show how to compare two prompts, not how well either prompt works on real chats.
- The labels encode my own calls on borderline messages, for example that a question I answered with a promise leaves only the promise open. Someone else could label a few cases differently, and the numbers would move.
- One model per run, and the same model answers and judges. A different model, or a second run of the same one, can give different results.
- The judge is checked against the labels rather than trusted. Its questions are deliberately plain, so it can pass a promise that was already kept or a question that was already answered; the disagreement list shows where.
- `npm run eval:offline` uses a scripted stand-in, not a model. Its v1 behaviour copies typical mistakes on purpose (it flags problem statements, ignores who wrote "I'll", and misses requests and Hinglish promises) and its v2 behaviour fixes most of them, so its numbers show the shape of the output and mean nothing about any real model.
- Free tier Gemini API content may be used by Google to improve its products. Only synthetic data is sent to either provider.
