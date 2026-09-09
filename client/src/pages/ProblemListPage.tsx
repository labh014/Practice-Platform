import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { overallScoreColour, statusLabel } from '../lib/format';
import {
  CATEGORY_ACCENT,
  CATEGORY_LABELS,
  metaFor,
  type ProblemCategory,
} from '../lib/problemMeta';
import type { ProblemSummary } from '../types/api';
import './ProblemListPage.css';

type FilterKey = 'all' | ProblemCategory;

/**
 * The catalogue.
 *
 * Its job is not to list what exists but to answer "what should I do next".
 * Every card leads with the learner's own history on that problem, and the
 * call to action changes depending on whether they have started, need to
 * revise, or have something waiting to be read. Cards also carry a category
 * chip and a focus tag, so choosing the next problem is a choice between
 * different design instincts rather than picking a title at random.
 */
export default function ProblemListPage() {
  const { data, loading, error, reload } = useAsync(() => api.listProblems(), []);
  const [filter, setFilter] = useState<FilterKey>('all');

  const availableCategories = useMemo(() => categoriesPresent(data ?? []), [data]);
  const filtered = useMemo(() => applyFilter(data ?? [], filter), [data, filter]);

  if (loading && !data) return <LoadingState label="Loading problems" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.length === 0) {
    return (
      <EmptyState title="No problems available">
        The server started without a problem catalogue. Restarting it should restore the
        seeded problems.
      </EmptyState>
    );
  }

  const totalAttempts = data.reduce((sum, problem) => sum + problem.attemptCount, 0);
  const started = data.filter((problem) => problem.attemptCount > 0).length;

  return (
    <div className="catalogue">
      <header className="catalogue__intro">
        <div className="catalogue__eyebrow">LLD practice loop</div>
        <h1 className="catalogue__title">Practise low-level design</h1>
        <p className="catalogue__lede">
          Submit a design, get feedback grounded in what you actually wrote, then revise
          it and see whether the next attempt is genuinely better.
        </p>
        <dl className="catalogue__stats">
          <div>
            <dt>Problems</dt>
            <dd>{data.length}</dd>
          </div>
          <div>
            <dt>Focus areas</dt>
            <dd>{availableCategories.length}</dd>
          </div>
          <div>
            <dt>Attempts made</dt>
            <dd>{totalAttempts}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>
              {started}
              <span className="subtle"> / {data.length}</span>
            </dd>
          </div>
        </dl>
      </header>

      {availableCategories.length > 1 && (
        <div className="catalogue__filters" role="tablist" aria-label="Filter by focus area">
          <FilterChip
            label="All"
            count={data.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {availableCategories.map((category) => (
            <FilterChip
              key={category}
              label={CATEGORY_LABELS[category]}
              category={category}
              count={countIn(data, category)}
              active={filter === category}
              onClick={() => setFilter(category)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="catalogue__empty muted">
          No problems in this focus area yet. Pick another category above.
        </div>
      ) : (
        <div className="catalogue__grid">
          {filtered.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  category,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  category?: ProblemCategory;
}) {
  const accent = category ? CATEGORY_ACCENT[category] : null;
  const style = active && accent
    ? { color: accent.fg, background: accent.bg, borderColor: accent.border }
    : undefined;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`catalogue__filter${active ? ' is-active' : ''}`}
      onClick={onClick}
      style={style}
    >
      {category && <span className="catalogue__filter-dot" style={{ background: accent!.fg }} />}
      <span>{label}</span>
      <span className="catalogue__filter-count">{count}</span>
    </button>
  );
}

function ProblemCard({ problem }: { problem: ProblemSummary }) {
  const started = problem.attemptCount > 0;
  const meta = metaFor(problem.id);
  const accent = meta ? CATEGORY_ACCENT[meta.category] : null;

  return (
    <Link
      to={`/problems/${problem.id}`}
      className="problem-card card"
      style={accent ? { ['--card-accent' as string]: accent.fg } : undefined}
    >
      {accent && <span className="problem-card__stripe" style={{ background: accent.fg }} />}
      <div className="problem-card__body">
        <div className="problem-card__head">
          <div className="problem-card__title-row">
            <h2 className="problem-card__title">{problem.title}</h2>
            {meta && (
              <span
                className="problem-card__category"
                style={{
                  color: accent!.fg,
                  background: accent!.bg,
                  borderColor: accent!.border,
                }}
              >
                {CATEGORY_LABELS[meta.category]}
              </span>
            )}
          </div>
          {started ? (
            <ProgressPill problem={problem} />
          ) : (
            <span className="badge problem-card__new">Not started</span>
          )}
        </div>

        <p className="problem-card__summary muted">{problem.summary}</p>

        {meta && (
          <p className="problem-card__focus">
            <span className="problem-card__focus-label">Focus</span>
            <span>{meta.focus}</span>
          </p>
        )}

        <div className="problem-card__foot">
          <div className="problem-card__meta">
            <span className="subtle">{problem.requirementCount} requirements</span>
            {meta && (
              <span className={`problem-card__difficulty problem-card__difficulty--${meta.difficulty.toLowerCase()}`}>
                {meta.difficulty}
              </span>
            )}
          </div>
          <span className="problem-card__cta">{callToAction(problem)} →</span>
        </div>
      </div>
    </Link>
  );
}

function ProgressPill({ problem }: { problem: ProblemSummary }) {
  if (problem.bestScore === null) {
    return (
      <span className="badge problem-card__pending">
        {problem.latestStatus ? statusLabel(problem.latestStatus) : 'In progress'}
      </span>
    );
  }

  return (
    <span className="problem-card__score">
      <span
        className="problem-card__score-value"
        style={{ color: overallScoreColour(problem.bestScore) }}
      >
        {problem.bestScore}
      </span>
      <span className="subtle">/100 best</span>
    </span>
  );
}

function categoriesPresent(problems: ProblemSummary[]): ProblemCategory[] {
  const seen = new Set<ProblemCategory>();
  for (const problem of problems) {
    const meta = metaFor(problem.id);
    if (meta) seen.add(meta.category);
  }
  return Array.from(seen);
}

function countIn(problems: ProblemSummary[], category: ProblemCategory): number {
  return problems.reduce((n, p) => (metaFor(p.id)?.category === category ? n + 1 : n), 0);
}

function applyFilter(problems: ProblemSummary[], filter: FilterKey): ProblemSummary[] {
  if (filter === 'all') return problems;
  return problems.filter((problem) => metaFor(problem.id)?.category === filter);
}

/**
 * The next action, phrased as the thing the learner would actually do.
 *
 * "Continue" tells them nothing. Whether they are starting, waiting on a
 * result, or looking at feedback they have not acted on yet are three different
 * situations, and the card should say which one they are in.
 */
function callToAction(problem: ProblemSummary): string {
  if (problem.attemptCount === 0) return 'Start practising';
  if (problem.latestStatus === 'FAILED') return 'Evaluation failed — retry';
  if (problem.latestStatus === 'SUBMITTED' || problem.latestStatus === 'EVALUATING') {
    return 'Evaluation in progress';
  }
  return `Review and try again`;
}
