/**
 * The workbench's entry (`workbench.html`). A development page: it boots the
 * same renderer and materials the game does, with none of the simulation.
 */

import './ui/styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app mount point is missing from workbench.html');

const { startWorkbench } = await import('@app/workbench/Workbench.ts');
await startWorkbench(root);
