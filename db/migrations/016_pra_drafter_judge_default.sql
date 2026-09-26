-- Judge default moved from minimax/minimax-m3 to qwen/qwen3-30b-a3b after a
-- real-call bake-off (docs/pra-drafter/JUDGE-BAKEOFF.md): 12/12 valid JSON and
-- 12/12 verdict agreement vs 8/12 for MiniMax M3. Prices are OpenRouter's, in
-- USD cents per 1M tokens. Only rewrites the seeded MiniMax entry, so a price
-- the user has already edited is left alone.
UPDATE drafter_settings
   SET value = jsonb_set(value, '{judge}', '{"model": "qwen/qwen3-30b-a3b", "in": 12, "out": 50}'::jsonb)
 WHERE key = 'model_prices_per_million_tokens_usd_cents'
   AND value -> 'judge' ->> 'model' IN ('minimax/minimax-m3', 'qwen/qwen3-30b-a3b');
