# Unseen terms

The retrievers from [`03-rag-is-search-first`](../03-rag-is-search-first), frozen exactly as they were tuned, scored on glossary terms they never saw. Companion code for the follow up to the Shipping with AI article "RAG is a search problem first".

**Why:** two comments on that article asked what it couldn't answer. Nilesh Sharma asked whether the three and four word lookups earn their place; the glossary had no entry longer than two words, so they never matched anything. KolmoPDF pointed out that the normaliser and the 0.75 fuzzy threshold were tuned on the same 24 posts they were scored on, and suggested splitting the test by glossary term, so a threshold tuned on familiar words is tried on unseen ones, with the posts where nothing should be injected labelled too.

**How it stays honest:** the new glossary entries and the 36 posts were committed (`e7bbe7d`) before any retriever ran on them, and this folder imports the retrievers, grading and answer step from `03-rag-is-search-first` without changing a line. Nothing was tuned after seeing these scores.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                           # offline tests of the data and the lookup lengths
npm run retrieval                  # retrieval only, scored in code, no key needed
GROQ_API_KEY=... npm run eval      # retrieval plus the model rewrite on Groq, openai/gpt-oss-120b
```

`npm run eval` also reads the key from a `.env` file in this folder, which git ignores. Each run prints its tables and saves the full result in `results/` (ignored by git, except sample runs kept for the article).

## Exact setup

- **Glossary:** the 25 tuned entries from `03-rag-is-search-first/data/glossary.json` plus 25 unseen ones in `data/glossary-unseen.json`, 50 in all, every one mapped to a made up word. The unseen entries are 13 single words, 2 two word entries, 8 three word entries and 2 four word entries (`buy one get one`, `pay at the counter`). Five are ambiguous and carry the sense the glossary means: `toast` (toasted bread), `jam` (fruit jam), `tart` (a pastry), `pie` (a baked pie) and `shot` (an espresso shot).
- **Posts** (`data/posts.jsonl`): 36 new English posts, each with the entries a correct rewrite needs (`required`) and the wrong sense entries (`forbidden`). 40 required entries: 39 unseen, and one tuned (`bake`, for "baked", as in the tuned set). Tags: `exact` (4), `plural` (4), `long` (11, entries of two to four words), `spelling` (2: gluten-free, Wi-Fi), `typo` (4), `synonym` (3: hotcakes, nimbu pani, BOGO), `sense` (3, ambiguous words in the glossary's sense) and `distractor` (6 posts that need no entry at all: a traffic jam, raising a toast, a little tart, a pie chart, a photo shot, and a site that uses cookies, which is a tuned entry in a sense the tuned set never had).
- **Retrievers:** the five from `03-rag-is-search-first/src/retrievers.ts`, unchanged, run over all 50 entries. A test checks the fuzzy threshold is still 0.75.
- **Split by term:** every score is also counted separately for tuned and unseen entries.
- **Lookup length:** the exact rule run with lookups of up to two words and up to four (the tuned rule), reporting entries found by entry length, posts complete, lookup keys built and entries sent to the model.
- **Answer step and grade:** `npm run eval` reuses `runEval` from `03-rag-is-search-first` with these posts and all 50 entries: the same prompt, the same retrievers for the answers (exact, normalised + fuzzy, oracle) and the same code only grade.

## Results, retrieval only

`results/sample-run-2026-11-16-retrieval.json`. Retrieval is plain code, so every run gives the same numbers.

| Retriever | Posts complete | Needed mentions found | Unseen term mentions found | Wrong sense entries |
| :--- | :--- | :--- | :--- | :--- |
| Exact (the tuned rule) | 18 of 36 | 25 of 40 | 25 of 39 | 5 |
| Normalised | 22 of 36 | 32 of 40 | 31 of 39 | 6 |
| Fuzzy | 23 of 36 | 33 of 40 | 33 of 39 | 6 |
| Normalised + fuzzy | 25 of 36 | 35 of 40 | 34 of 39 | 6 |
| Oracle | 36 of 36 | 40 of 40 | 39 of 39 | 0 |

| Exact lookups up to | 3 word mentions found | 4 word mentions found | Posts complete | Lookup keys built | Entries sent to the model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 words | 0 of 9 | 0 of 3 | 8 of 36 | 457 | 24 |
| 4 words | 8 of 9 | 2 of 3 | 18 of 36 | 837 | 34 |

- **Recall on unseen terms:** the counts are mentions: posts need the 25 unseen terms 39 times in all (`early bird offer` and `buy one get one` twice each, among others). Normalised + fuzzy found 34 of 39; on the tuned set it found 33 of 36. Its misses are two synonyms (hotcakes, nimbu pani), the abbreviation BOGO, a plural with a typo ("croisants") and a single misspelt word ("smoothy").
- **Per term:** normalised + fuzzy found 20 of the 25 unseen terms on every mention and the other 5 on some; none never. Exact found 14 on every mention, 9 on some and never found `pancake` or `free wifi`.
- **Wrong senses:** none of the six distractor posts came through clean with normalised, fuzzy or both. Exact missed only "cookies", because it doesn't match plurals. Nothing in these retrievers knows about sense.
- **Longer lookups:** they found 10 of the 12 three and four word mentions that two word lookups could never reach, and took complete posts from 8 to 18. Lookup keys are built locally and never reach the prompt; the prompts grew by the 10 entries found, in total across the 36 posts. Prompt tokens and lookup time were not measured, and the answer step was not run separately for the two limits.

## Results, the model

`results/sample-run-2026-11-16-groq-gpt-oss-120b-{1,2,3}.json`: three runs on `openai/gpt-oss-120b` through Groq, 108 calls each, no errors. Retrieval in all three is identical to the retrieval only run.

| Retriever | Posts right, runs 1 / 2 / 3 | Right when retrieval was complete | Right when retrieval had a gap |
| :--- | :--- | :--- | :--- |
| Exact (the tuned rule) | 18, 18, 18 | 18 of 18, every run | 0 of 18, every run |
| Normalised + fuzzy | 25, 25, 25 | 25 of 25, every run | 0 of 11, every run |
| Oracle | 33, 34, 32 | 33, 34, 32 of 36 | none |

- **A gap was always a wrong answer.** Every post whose retrieval missed an entry or returned a wrong sense came out wrong, in every run.
- **A wrong sense entry was always used.** Exact returned 5 per run and normalised + fuzzy 6, so there were (5 + 6) × 3 = 33 chances, and the model put the wrong word in all 33: "Stuck in a traffic murla?", "This goma chart shows our most loved drinks". In article 3 it held back twice in 15.
- **Perfect retrieval still left a few.** With the labelled entries handed over, the model left "hotcakes" and "nimbu pani" as written in every run instead of using the pancake and lemonade entries. The other misses: "smoothy" kept as written in runs 1 and 3, and "hapy hour" in run 3; run 2 had none. It did turn BOGO into the buy one get one word every time.

## Limitations

- 36 synthetic posts and 25 new entries, written and labelled by the same person who built the retrievers. Knowing how they work could make the posts easier or harder than real ones; real posts would be the stronger test.
- Only one post needs a tuned entry, so the split by term compares unseen terms here against the tuned set's own scores in article 3, not two halves of one set.
- Six distractor posts and five ambiguous entries are enough to show the failure, not to measure its rate.
- The answer step tells the model to use every entry it is given, as in article 3.
