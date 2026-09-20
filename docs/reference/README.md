# Module reference

Every module in the codebase and what it is for: one page per area, one entry per file.
This is the text that used to sit at the top of each file. It lives here so the
files start at their first import, and so the whole of an area can be read in one place.

A comment in the code is two lines at most. Where the reasoning runs longer, it is
here, under the file's `### Notes`: one bullet per constant, function or branch,
named in backticks so a search from the code lands on it.

| Area                                                                | Modules |
| ------------------------------------------------------------------- | ------- |
| [Application](app.md)                                               | 11      |
| [Audio](audio.md)                                                   | 4       |
| [Configuration](config.md)                                          | 3       |
| [Entry points](entries.md)                                          | 2       |
| [Localisation](i18n.md)                                             | 4       |
| [Input](input.md)                                                   | 2       |
| [Persistence](persistence.md)                                       | 5       |
| [Rendering: geometry, materials, animation, camera](render-core.md) | 14      |
| [Rendering: the crowd](render-mobs.md)                              | 3       |
| [Rendering: models](render-models.md)                               | 18      |
| [Rendering: the scene](render-scene.md)                             | 22      |
| [Shared](shared.md)                                                 | 3       |
| [Simulation: balance tables](sim-balance.md)                        | 19      |
| [Simulation: commands](sim-commands.md)                             | 25      |
| [Simulation: core](sim-core.md)                                     | 14      |
| [Simulation: systems](sim-systems.md)                               | 11      |
| [Simulation: world generation](sim-worldgen.md)                     | 6       |
| [Tests](tests.md)                                                   | 11      |
| [Tools](tools.md)                                                   | 2       |
| [Interface](ui.md)                                                  | 26      |
| [Workers](workers.md)                                               | 1       |

The curated overviews are [architecture](../architecture.md) and
[the simulation](../simulation.md); this is the index they point into.
