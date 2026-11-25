# Japandi Capybara

[![Latest release](https://img.shields.io/github/v/release/Stukongeluk/japandi-capybara?color=8a4a32&label=release)](https://github.com/Stukongeluk/japandi-capybara/releases/latest)
[![Claude Code theme](https://img.shields.io/badge/Claude%20Code-theme-c9785a)](#install)
[![Stats on Windows, macOS and Linux](https://img.shields.io/badge/stats-Windows%20%7C%20macOS%20%7C%20Linux-5d7d45)](#notes)
[![Last commit](https://img.shields.io/github/last-commit/Stukongeluk/japandi-capybara?color=9a7652)](https://github.com/Stukongeluk/japandi-capybara/commits/main)
[![Stars](https://img.shields.io/github/stars/Stukongeluk/japandi-capybara?style=flat&color=b07a28)](https://github.com/Stukongeluk/japandi-capybara/stargazers)
[![MIT license](https://img.shields.io/github/license/Stukongeluk/japandi-capybara?color=3f5f7a)](LICENSE)

An animated, light Japandi theme for the Claude desktop app: a sunlit room with a round window, shoji screens, a swaying bonsai, drifting sakura petals, a meditating samurai and two very relaxed capybaras. The motion borrows from hand-drawn anime: held steam frames, petal smears, a head turn with anticipation and overshoot, a dragonfly that darts with speed lines.

![The room while Claude works: the samurai practises sword cuts, the scroll shows the current step and task list, the shoji glow with RAM use](docs/room-working.svg)

*While Claude works: the samurai trains, the scroll follows the task list, and the room shows CPU, RAM, GPU, usage limit and context.*

![The room while Claude rests: the samurai meditates beside his incense and the yuzu capybara dozes off](docs/room-resting.svg)

*While Claude rests: the samurai meditates and the capybara dozes.*

The room also shows what is going on, without a single gauge:

| What | In the room |
| --- | --- |
| RAM | Shoji panes glow warm, filling from the bottom up |
| CPU | The samurai's incense: more smoke, rising faster; while Claude works he trains harder, with sweat and dust from 55% and speed lines above 80% |
| GPU load | Steam from the capybara's hinoki bath |
| GPU temperature | The bath heats up: bubbles, a red-faced capybara, and above 83° it climbs halfway out |
| Claude usage limit | Sakura blossoms on the branch fall onto the shelf as you use your 5-hour limit, and the sky in the round window turns from morning to sunset; a plaque shows 5h and 7d usage and when it resets |
| Context window | The paper lantern dims as the conversation fills up |
| What Claude is doing | A hanging scroll shows the current step, the task list and background work |
| Working or resting | The samurai practises sword cuts while Claude works and meditates when it rests; the capybara dozes off |

The bath follows your GPU temperature:

| 50° — a relaxed soak | 79° — a rolling boil | 88° — time to get out |
| :---: | :---: | :---: |
| ![Relaxed capybara soaking with eyes closed](docs/bath-50.svg) | ![Red-faced capybara squinting in a bubbling bath](docs/bath-79.svg) | ![Wide-eyed capybara climbing halfway out of a boiling bath](docs/bath-88.svg) |

The images are drawn by the theme's own code with sample figures, and they move, as the room does.

It also restyles messages (washi cards with a small red seal) and adds a quiet ambience you can switch on with the speaker button in the session's title bar: a breeze, a wind chime and the bath trickling.

## Install

At the prompt of a terminal session:

```
/plugin install japandi-capybara --marketplace Stukongeluk/japandi-capybara
```

From a shell:

```
claude plugin install japandi-capybara --marketplace Stukongeluk/japandi-capybara
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Stukongeluk/japandi-capybara`, then **Add plugin**.

## Notes

- The room is drawn in the desktop and mobile apps. The terminal does not draw themes.
- CPU, RAM and GPU readings come from one small background process, chosen per system:
  - **Windows:** PowerShell; GPU from `nvidia-smi` on NVIDIA cards.
  - **Linux:** `/proc`; GPU from `nvidia-smi` on NVIDIA cards, or the driver's own files on AMD cards.
  - **macOS:** `top`, `vm_stat` and `ioreg`; GPU load on Apple Silicon. macOS reports no GPU temperature, so the bath stays relaxed there.

  Without a supported GPU the room still runs, without the GPU readings.
- The usage-limit plaque needs a Claude subscription and fills in after the first reply of a session.
- The layout is tuned for a wide window with the sidebar open. On a tall (portrait) screen, where the chat covers the middle of the room, a narrow paper strip hangs at the right edge with every reading written top to bottom.

## License

[MIT](LICENSE). `hooks/make-colors.js` and `hooks/make-colors.d.ts` are the color helper from Claude Code's theme kit, included unchanged; the MIT license covers the rest of this repository.
