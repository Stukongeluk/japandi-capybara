# Changelog

## 0.5.0

- **The room keeps your hours.** A soft pink dawn (06–08), a golden evening (18–21), and at night (21–06) a lantern-lit room: brightest around the lantern, darker toward the edges, with a moon and stars in the round window. The moon sinks and the sky deepens as you use your 5-hour limit. The light through the shoji onto the capybaras turns to moonlight at night, sunset orange in the evening and pink at dawn, and the shoji paper takes the same light while the RAM panes stay a warm glow against it.
- **Click the room.** The left half: the samurai bows (seated, or standing with his sword lowered). The right half: the capybara squeaks "キュッ♪" and its yuzu hops.
- **New sounds** (with the theme's speaker on): a squeak or a soft wooden note on a click, a chime when Claude finishes a whole task list, and a gong on the first message after your 5-hour limit resets.
- Clicks need a current Claude Code; older builds don't know the event.

## 0.4.1

Lighter on your computer:

- **Fewer redraws.** Machine readings move the room at most every 30 seconds, rounded to the steps the room shows; what Claude is doing still shows within 5 seconds. A redraw that would change nothing is skipped, and a terminal no longer redraws a background it never shows.
- **No live blur.** The bath steam is a soft gradient instead of a blur filter recalculated every frame; it looks the same.
- **No hidden animations.** Stars and fireflies left from the night sky, invisible in the light theme, are gone.
- **Lighter readings.** On Windows one system connection is reused for every reading (about four times less CPU each), and readings come every 10 seconds on every system.

## 0.4.0

- **The theme in the terminal.** The terminal draws no themes, so there a band above the prompt shows a small pixel-art capybara in its tub beside three lines of the room's readings: what Claude is doing with its task progress; RAM, CPU, GPU, usage limit and context; and the limit's reset time with any background work.
- The pixel capybara steams with GPU load, blushes, boils and climbs out as the GPU heats, and dozes while Claude rests. It animates without redrawing the band around it.

## 0.3.0

- **Life outside the round window:** a small pagoda on the far ridge, and a flock of birds that flaps across the sky now and then.
- **The day follows your 5-hour limit:** a pale morning sky with plenty left, warming to apricot, then a sunset as the sun sinks behind the mountains near the end. Morning returns when the limit resets.
- **Training follows the CPU:** calm cuts under 55%; heavy training from 55% with faster cuts, sweat and dust at his feet; all-out above 80% with rapid cuts, speed lines and whipping headband tails.
- The README's preview images show the new window.

## 0.2.1

- The training samurai is drawn a third larger, so he stands taller than he sits, and his sword sweeps a wider arc.
- The README's preview images are redrawn with the current room, one-eyed capybaras included.
- The MIT license is part of this release.

## 0.2.0

- **Stats on macOS and Linux.** The theme picks a stats script per system: PowerShell on Windows, `/proc` on Linux (GPU from `nvidia-smi`, or the driver's files on AMD cards), and `top`, `vm_stat` and `ioreg` on macOS (Apple Silicon GPU load; macOS reports no GPU temperature).
- **Portrait screens.** On a tall screen a narrow paper strip hangs at the right edge with every reading written top to bottom, since the chat covers the room's own labels there.
- **The room comes alive.** The backdrop now redraws as things change, so the stats, the scroll and the samurai update live.
- **A scroll of the work.** A hanging scroll shows what Claude is doing, its task list and work started in the background.
- **The samurai trains** with slow sword cuts while Claude works, and meditates when it rests.
- **The bath follows GPU temperature:** bubbles, a red face, and above 83° the capybara climbs halfway out.
- **More to watch:** the lantern dims as the context window fills, the yuzu capybara dozes while Claude rests, and the dragonfly gets busier while it works.
- **Fits more windows:** the room sits in a band that stays in view on very wide windows, and the left corner clears the sidebar.
- Smoother bath steam, and both capybaras drawn in true side view with one eye.
- Animated preview images in the README.

## 0.1.0

- First release: a light Japandi room with a round window, shoji screens, a swaying bonsai, drifting sakura petals, a meditating samurai and two capybaras.
- CPU, RAM, GPU and the Claude usage limit woven into the room on Windows.
- Washi-paper message styling and a quiet ambience with a wind chime.
