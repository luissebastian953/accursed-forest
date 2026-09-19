import './ui/styles.css';
import { reportVitals } from './app/vitals.ts';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app mount point is missing from play.html');

reportVitals();

// `?spike` keeps the GDD 6.9 art spike reachable for tuning the look; `?models`
// lays out every scenery model; `?mobs` is the mob proof of concept.
const params = new URLSearchParams(location.search);

async function boot(): Promise<void> {
  if (params.has('spike')) {
    const { startSpike } = await import('@app/Spike.ts');
    await startSpike(root!);
  } else if (params.has('models')) {
    const { startGallery } = await import('@app/ModelGallery.ts');
    await startGallery(root!);
  } else if (params.has('mobs')) {
    const { startMobPoc } = await import('@app/MobPoc.ts');
    await startMobPoc(root!);
  } else {
    const { startApp } = await import('@app/App.ts');
    await startApp(root!);
  }
}

void boot().finally(() => {
  document.querySelector('#boot')?.remove();
});
