import { startApp } from '@app/App.ts';
import { startMobPoc } from '@app/MobPoc.ts';
import { startGallery } from '@app/ModelGallery.ts';
import { startSpike } from '@app/Spike.ts';

import './ui/styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app mount point is missing from index.html');

// `?spike` keeps the §6.9 art spike reachable for tuning the look; `?models`
// lays out every scenery model; `?mobs` is the mob proof of concept.
const params = new URLSearchParams(location.search);
if (params.has('spike')) {
  void startSpike(root);
} else if (params.has('models')) {
  void startGallery(root);
} else if (params.has('mobs')) {
  void startMobPoc(root);
} else {
  void startApp(root);
}
