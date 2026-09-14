import { startSpike } from '@app/Spike.ts';

import './ui/styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app mount point is missing from index.html');

// §6.9: the art spike is the entry point until the sim core lands (M1a).
void startSpike(root);
