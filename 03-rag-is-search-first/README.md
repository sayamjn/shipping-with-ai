# RAG is a search problem first

A glossary lookup scored as search before any model writes a word. Companion code for the Shipping with AI article "RAG is a search problem first".

**The setup:** a small café has a house glossary of its own words, the way my Nagamese generator hands Gemini a glossary from a dictionary. For each English post, a retriever picks the glossary entries that apply, and a model rewrites the post using those words. If retrieval misses an entry, the model has no way to use it; if retrieval picks the wrong one, the model is told to use it anyway.

**The point:** score retrieval on its own, in code, against labels. Then run the model and trace every wrong answer back to what retrieval handed it.

The glossary words are made up on purpose (`cold coffee` → `frosk mavi`). A model cannot know them, so it can only use one if retrieval put it in the prompt. Everything here is synthetic and hand written by me; no dictionary, Nagamese text or real post is in this repo.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                           # offline tests
npm run eval:offline               # scripted stand-in model, only to see the shape of the output
GROQ_API_KEY=... npm run eval      # real run on Groq, openai/gpt-oss-120b (set GROQ_MODEL to change)
```

`npm run eval` also reads the key from a `.env` file in this folder, which git ignores. Set `TRACE_LIVE=1` to print each model call as it finishes.

Retrieval is scored in code and costs nothing. A real run then makes one model call per post for three of the retrievers: 24 posts × 3 = 72 calls, one after another to stay inside free tier rate limits.

Each run prints a retrieval table, the same results by tag, an answers table, a usage table and every post the answer got wrong with the reason, then saves the full result in `results/` (ignored by git, except sample runs kept for the article).

## Exact setup

- **Glossary** (`data/glossary.json`): 25 entries, single words and two word phrases, each mapped to a made up word. Four entries mean one sense only: `date` (the fruit), `roll` (a bread roll), `mint` (the herb) and `order` (a food order). The sense is documentation; it is not shown to the model, just as my Nagamese prompt shows only the English and the Nagamese.
- **Posts** (`data/posts.jsonl`): 24 English posts, each with the glossary terms a correct rewrite must use (`required`), the terms that would be the wrong sense (`forbidden`), tags and a note. 36 required entries in all. Tags: `exact` (6, the term as written), `plural` (5, plurals and past tense), `phrase` (4, a two word entry next to one of its own words), `typo` (4), `synonym` (3: biscuits for cookie, to go for takeaway, a latte for coffee) and `distractor` (3: save the date, rolling out, mint condition).
- **Retrievers** (`src/retrievers.ts`, all plain code):
  - `exact`: the rule from my Nagamese glossary step (`glossaryInjector.js` in `sayamjn/Nagamese`). Lowercase the text, replace punctuation with spaces, keep words longer than one character, build every one to four word phrase, drop terms of two characters or fewer, the same fourteen stop words and pure numbers, then look each term up as an exact key. The real pipeline first rewrites the English into short simple sentences; this demo skips that step.
  - `normalised`: the same phrases, with a small hand written normaliser on both sides (plurals, `-ing`, `-ed`).
  - `fuzzy`: the Dice similarity of character trigrams (twice the shared trigrams over the total, with the text padded by spaces) between each glossary term and every phrase of the same length in the post, matched at 0.75 or above.
  - `normalised + fuzzy`: everything either of the two finds.
  - `oracle (labels)`: exactly the required entries. It is not a retriever; it shows what the model does when retrieval is perfect.
  - No embeddings: Groq has no embeddings endpoint, and the demo stays on one provider with no dependencies. Embeddings are the usual answer to the synonym posts; the article says so.
- **Retrieval grade** (`src/metrics.ts`): for each post, which required entries were found or missed, which extra entries came back, and whether a wrong sense entry came back. A post's retrieval is complete when every required entry is there and no wrong sense entry is.
- **Answer step** (`src/answer.ts`), for `exact`, `normalised + fuzzy` and the oracle. System prompt: "You write short social media posts for a café. The café has a house glossary of its own words. Rewrite the post in English, but use the glossary word in place of each glossary term, exactly as given. Keep everything else as it is. Reply with the rewritten post only." User message: `Glossary (use exactly as provided):` with one `- term → word` line per retrieved entry (or `(no entries)`), then `Post:` and the post. Default model settings: no temperature set, reasoning left at the model's default.
- **Answer grade:** the rewrite passes when every required entry's made up word appears and no wrong sense word appears, matched as a whole word, ignoring case, with a plural ending allowed (`dorpas` counts as `dorpa`; `davra velt` does not count as `dovra velt`). Code only, no judge. The plural rule was added after the first set of runs showed the model writing "Fresh dorpas" for "Fresh cookies", a fair rewrite the stricter grader failed; those runs were discarded and all three sample runs use this grader.
- **Rate limits:** on a 429 the client waits for Groq's `retry-after` (capped at 90 seconds) and retries up to six times, recording the wait. Every request times out after 60 seconds. A call that still fails marks that post as errored (counted as wrong) and the run goes on.

## What the tables mean

- **Posts with every entry and no wrong sense:** posts whose retrieval was complete, out of 24.
- **Needed entries found:** required entries retrieved, out of 36.
- **Extra entries:** entries retrieved that the post did not need, such as `coffee` next to `cold coffee`. Mostly harmless; counted so the cost of a loose retriever is visible.
- **Wrong sense entries:** forbidden entries retrieved, such as `date` for "save the date".
- **Posts right:** rewrites that passed the answer grade.
- **Right when retrieval was complete / had a gap:** the same answers split by whether that retriever's retrieval was complete for the post. This is the table the article is about.
- **Usage:** model calls, tokens and time for the answer step. Thinking tokens are Groq's `completion_tokens_details.reasoning_tokens`, subtracted from `completion_tokens`.

## Limitations

- 24 short synthetic posts and 25 entries, labelled by one person. They show how to score retrieval apart from the answer, not how any retriever performs on a real glossary.
- The made up words make retrieval decisive by design: a missed entry cannot be guessed. With a real language, a model may know some words already, which hides retrieval misses rather than fixing them.
- The normaliser and the fuzzy threshold are tuned by hand on the same 24 posts they are scored on; there is no held out set, so the combined retriever's numbers show the method, not how it does on new inputs. Other words would need other rules; that is the point of having labels.
- The answer step tells the model to use every entry it is given, as my Nagamese prompt does. A prompt that let the model skip entries could avoid some wrong sense words and also skip right ones.
- One model per run. A different model, or another run of the same one, can give different answers on the same retrieval.
- `npm run eval:offline` uses a scripted stand-in, not a model: it replaces glossary terms only where they appear word for word, so it fails every plural, typo and synonym even when the oracle hands it the entry. Its numbers show the shape of the output and mean nothing about a real model.
