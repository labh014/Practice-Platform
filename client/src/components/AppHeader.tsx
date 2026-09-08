import { Link, useLocation } from 'react-router-dom';

import './AppHeader.css';

export function AppHeader() {
  const { pathname } = useLocation();
  const inWorkspace = pathname.startsWith('/problems/');

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand">
          <span className="app-header__mark" aria-hidden />
          <span className="app-header__name">LLD Practice</span>
        </Link>

        {inWorkspace ? (
          <Link to="/" className="btn btn--ghost app-header__back">
            All problems
          </Link>
        ) : null}
      </div>
    </header>
  );
}
