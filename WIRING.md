# feat/018-ai-review

Deterministic tenant-isolated AI review.
No Ollama, Qwen, Hugging Face, or paid inference.

## Verify

```bash
npm --workspace backend run typecheck
npm --workspace backend exec vitest run -- tests/unit/aiAnalyzer.test.ts tests/integration/aiReview.test.ts
```
