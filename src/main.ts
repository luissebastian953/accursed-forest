import { startApp } from '@app/App.ts';
import { startSpike } from '@app/Spike.ts';

import './ui/styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app mount point is missing from index.html');

// `?spike` keeps the §6.9 art spike reachable for tuning the look.
if (new URLSearchParams(location.search).has('spike')) {
  void startSpike(root);
} else {
  void startApp(root);
}
