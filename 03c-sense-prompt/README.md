# Sense prompt

The 36 posts, 50 glossary entries and retrievers from [`03b-unseen-terms`](../03b-unseen-terms), answered under two prompts: one that must use every glossary entry it is given, and one that may skip an entry whose meaning doesn't fit the post. It also counts the prompt tokens of two and four word lookups. A follow up to the Shipping with AI post "I tested my RAG retriever on terms it hadn't seen".

**Why:** two comments on that post. Ahmet Özel pointed out that the answer step tells the model to use every entry exactly as given, so a model that used all 33 wrong sense entries was following orders. He suggested freezing two prompts on the same labels and counting wrong swaps avoided next to real swaps lost, with the six empty posts as their own group. Nilesh Sharma asked what the four word lookups cost in tokens.

**How it stays honest:** the two prompts, the scoring and the runner were committed (`a80068d`) before any model call. The posts, glossary, retrievers, glossary block and grader are imported from `03-rag-is-search-first` and `03b-unseen-terms` without changing a line. Only the instruction changes between the two prompts; a test checks that both send the same glossary block and post.

## Run it

Needs Node 23.6 or newer (TypeScript runs directly, no dependencies).

```sh
npm test                           # offline tests of the scoring and the two prompts
GROQ_API_KEY=... npm run eval      # both prompts and both lookup lengths on Groq, openai/gpt-oss-120b
```

`npm run eval` also reads the key from a `.env` file in this folder, which git ignores. Each run prints its tables and saves the full result, every output included, in `results/` (ignored by git, except the sample runs).

## Exact setup

- **Must use** (`src/prompts.ts`): the system prompt from `03-rag-is-search-first`, unchanged ("use the glossary word in place of each glossary term, exactly as given"), with the glossary headed "use exactly as provided".
- **May skip:** the same task, but use the glossary word only where the term means the same thing in the post as on the café's menu, and leave a term used in a different sense as written. The glossary is headed "use where the meaning fits".
- **The glossary block is the same in both:** `- term → word` lines, with no sense written next to an entry. The model has to judge the sense from the post.
- **Retrievers:** normalised + fuzzy, which hands over 35 of the 40 needed entries and all 6 wrong sense entries, one on each empty post; and the oracle, which hands over the 40 labelled entries and nothing else, so it shows whether the looser prompt drops real swaps.
- **Counts:** wrong sense used (a wrong sense entry was supplied and its word appears in the answer), real swaps lost (a needed entry was supplied and its word is missing from the answer), and the six empty posts (`distractor`) counted on their own.
- **Tokens:** the exact rule with lookups up to two and up to four words, under the must use prompt, with input, output and thinking tokens as Groq reports them.
- Three runs on `openai/gpt-oss-120b` through Groq, 216 calls each, no errors.

## Results, the two prompts

`results/sample-run-2026-11-17-groq-gpt-oss-120b-{1,2,3}.json`.

| Prompt | Retriever | Posts right, runs 1 / 2 / 3 | Wrong sense used | Real swaps lost | Empty posts right |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Must use | Normalised + fuzzy | 24, 25, 25 | 6 of 6, every run | 1, 0, 0 of 35 | 0 of 6, every run |
| May skip | Normalised + fuzzy | 31, 31, 31 | 0 of 6, every run | 0 of 35, every run | 6 of 6, every run |
| Must use | Oracle | 32, 34, 34 | none supplied | 4, 2, 2 of 40 | 6 of 6, every run |
| May skip | Oracle | 33, 35, 35 | none supplied | 3, 1, 1 of 40 | 6 of 6, every run |

- **Wrong swaps avoided: 18 of 18.** With the same wrong sense entries in front of it, the must use prompt wrote "Stuck in a traffic murla?" and "This goma chart shows our most loved drinks" in every run. The may skip prompt left jam, toast, tart, pie, shot and cookies as written in every run.
- **It judged the sense, not the word.** The same five ambiguous words appear in the menu's sense in three posts ("Buttered toast with strawberry jam", "Lemon tart and a slice of apple pie", "an extra shot"). The may skip prompt swapped every one of them in every run.
- **Real swaps lost: none to the new prompt.** I read every lost swap. Each is a post where the term isn't written the menu's way: "smoothy", "hotcakes", "nimbu pani" and, in run 1, "ofer". The model left those as written under both prompts. The may skip prompt never dropped a needed entry that matched the post, and with the oracle it lost one fewer than must use in every run.
- **What's left is retrieval.** The may skip prompt with normalised + fuzzy got 31 of 36 in every run; the other 5 are posts where retrieval missed a needed entry, so no prompt could get them right.
- **Its cost:** the may skip system prompt is longer, which added 1,224 input tokens across the 36 posts, 34 a post.

## Results, two and four word lookups

Same three runs, exact rule, must use prompt.

| Lookups up to | Entries sent | Input tokens | Output tokens, runs 1 / 2 / 3 | Thinking tokens, runs 1 / 2 / 3 | Posts right |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2 words | 24 | 5,639 | 713, 713, 714 | 3,253, 3,266, 3,270 | 8 of 36 |
| 4 words | 34 | 5,720 | 709, 709, 709 | 3,956, 3,442, 3,425 | 18 of 36 |

- **The prompt grew by 81 tokens in total**, across all 36 posts. Lookup keys are built in code and never reach the model; only the 10 extra entries they find do.
- **Thinking went up** in all three runs, by 703, 176 and 155 tokens in total. Thinking varies from run to run, so the size of that rise isn't reliable.
- **Lookup time** wasn't measured. The keys are plain string work on posts of one or two sentences.

## Limitations

- Six wrong sense entries, one per empty post, each on a short, obvious post like "a pie chart", and three posts with the same words in the menu's sense. Enough to show the difference, not to measure how often a looser prompt gets sense right on harder posts.
- The glossary block carries no sense, so the model judges it from the post. Writing the sense into the block might help the must use prompt too; this test changes only the instruction.
- 36 synthetic posts written and labelled by the same person who wrote both prompts, one model and three runs.
