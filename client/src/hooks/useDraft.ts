import { useCallback, useEffect, useState } from 'react';

export interface Draft {
  designSkeleton: string;
  designDecisions: string;
  assumptions: string;
}

export const EMPTY_DRAFT: Draft = {
  designSkeleton: '',
  designDecisions: '',
  assumptions: '',
};

/**
 * Keeps an in-progress design in localStorage, per problem.
 *
 * Working out a design takes fifteen minutes of thinking typed into three
 * boxes. Losing that to a stray refresh or a closed tab would be the single
 * most infuriating thing this app could do to someone, and it is a few lines to
 * prevent.
 *
 * Every access is guarded: storage throws outright in some privacy modes, and a
 * blocked write must not take the editor down with it. A draft that fails to
 * save is a small loss; a workspace that fails to render is a total one.
 */
export function useDraft(problemId: string): {
  draft: Draft;
  setField: (field: keyof Draft, value: string) => void;
  replace: (next: Draft) => void;
  clear: () => void;
} {
  const key = draftKey(problemId);

  const [draft, setDraft] = useState<Draft>(() => read(key));

  // Reload when the learner moves to a different problem.
  useEffect(() => {
    setDraft(read(key));
  }, [key]);

  useEffect(() => {
    write(key, draft);
  }, [key, draft]);

  const setField = useCallback((field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const replace = useCallback((next: Draft) => setDraft(next), []);

  const clear = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    remove(key);
  }, [key]);

  return { draft, setField, replace, clear };
}

export function draftKey(problemId: string): string {
  return `lld-practice:draft:${problemId}`;
}

/**
 * Whether a saved draft has anything in it.
 *
 * Read directly from storage rather than from hook state so a caller can decide
 * what to show on first render, before any effect has run.
 */
export function hasStoredDraft(problemId: string): boolean {
  const draft = read(draftKey(problemId));
  return (
    draft.designSkeleton.trim().length > 0 ||
    draft.designDecisions.trim().length > 0 ||
    draft.assumptions.trim().length > 0
  );
}

function read(key: string): Draft {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_DRAFT;

    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      designSkeleton: parsed.designSkeleton ?? '',
      designDecisions: parsed.designDecisions ?? '',
      assumptions: parsed.assumptions ?? '',
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function write(key: string, draft: Draft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage unavailable or full. The editor keeps working from memory.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do; the stale draft will be overwritten on the next save.
  }
}
