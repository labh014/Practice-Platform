import { useEffect, useState } from 'react';

import { api } from '../api/client';
import './EvaluatorNotice.css';

/**
 * Says out loud when the offline evaluator is answering.
 *
 * Feedback from the rule-based fallback looks identical to feedback from a
 * model that actually read the design - same scorecard, same cards, same
 * evidence. A learner has no way to tell them apart, so without this they are
 * invited to trust a judgement the rules were never capable of making.
 *
 * Shown only for the offline evaluator. When a real model is answering there is
 * nothing to warn about, and a banner on every page would just become furniture.
 */
export function EvaluatorNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .getHealth()
      .then((health) => {
        if (active) setOffline(health.evaluator.isOffline);
      })
      .catch(() => {
        // The pages themselves report an unreachable server; a second complaint
        // in a banner would add noise, not information.
      });

    return () => {
      active = false;
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="evaluator-notice" role="status">
      <span className="evaluator-notice__tag">Offline evaluator</span>
      <span className="evaluator-notice__text">
        Feedback is coming from pattern rules, not a model reading your design. It
        knows the Parking Lot and Vending Machine problems, and declines to score where
        it cannot judge rather than guessing. Set <code>GEMINI_API_KEY</code> in{' '}
        <code>server/.env</code> for real evaluation.
      </span>
    </div>
  );
}
