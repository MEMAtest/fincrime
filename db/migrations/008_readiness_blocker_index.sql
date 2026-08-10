-- FinCrime Control Lab: index for listOpenReadinessBlockers (Phase 6 follow-up)
--
-- lib/repo/readiness.ts's listOpenReadinessBlockers joins readiness_obligations
-- to readiness_assessments filtering on ro.blocker = true AND ro.gap != 'full'.
-- The existing single-column indexes on readiness_obligations(blocker) and
-- (gap) let Postgres narrow by one predicate but still plan a Seq Scan across
-- every obligation row per assessment to apply the other - a nested loop that
-- gets slower with every obligation the workspace accumulates (184+ rows per
-- workspace is already common; see the governance dashboard's readiness
-- blockers section). A single composite index over exactly the two columns
-- the WHERE clause filters on lets the planner do a direct index scan for the
-- (small) set of open, unresolved blockers instead.
--
-- Safe to re-run: CREATE INDEX IF NOT EXISTS.
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

CREATE INDEX IF NOT EXISTS idx_readiness_obligations_open_blockers
  ON readiness_obligations (assessment_id, blocker, gap);
