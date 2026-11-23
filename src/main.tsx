import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { getExhibitionId } from './config';
import { loadExhibition } from './content/loadExhibition';
import { startTuning } from './tuning/tuning';

const root = createRoot(document.getElementById('root')!);
startTuning();

const path = location.pathname.replace(/\/+$/, '');

if (path === '/modules') {
  import('./lab/ModuleLab').then(({ ModuleLab }) =>
    root.render(
      <StrictMode>
        <ModuleLab />
      </StrictMode>,
    ),
  );
} else if (path === '/tuning') {
  import('./tuning/TuningPage').then(({ TuningPage }) =>
    root.render(
      <StrictMode>
        <TuningPage />
      </StrictMode>,
    ),
  );
} else {
  renderExhibition();
}

function renderExhibition() {
  try {
    const loaded = loadExhibition(getExhibitionId());
    root.render(
      <StrictMode>
        <App {...loaded} />
      </StrictMode>,
    );
  } catch (err) {
    root.render(
      <pre className="content-error">
        {'Could not load the exhibition.\n\n'}
        {(err as Error).message}
      </pre>,
    );
  }
}
