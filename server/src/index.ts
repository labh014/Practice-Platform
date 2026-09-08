import 'dotenv/config';

import { createApp } from './app';
import { createContainer } from './container';

const PORT = Number(process.env['PORT'] ?? 4000);

const container = createContainer();
const app = createApp(container);

app.listen(PORT, () => {
  console.log('');
  console.log('  LLD Practice Platform');
  console.log(`  API      http://localhost:${PORT}/api`);
  // Stated at boot rather than buried in config, because which evaluator is
  // running changes what the feedback is worth - and the fallback to the mock
  // is silent otherwise.
  console.log(`  ${container.llmNotice}`);
  console.log('');
});
