# Two Eyes — Concept Lessons Design

**Date:** 2026-07-07
**Goal:** Give each topic a short, illustrated lesson so a beginner can understand the
concept before drilling it with quizzes. Motivated by: "I can't understand the net
concept without a short description or lesson of some kind."

## Decisions (approved)

- **Format:** short prose (2–4 sentences) **plus a worked diagram** — a small example
  board with the key move / stones highlighted, using the app's existing goban renderer.
- **Coverage:** all 9 topics (1 Liberties, 2 Capture a stone, 3 Capture a group,
  4 Escape atari, 5 Don't self-atari, 6 Double atari, 7 Connect & cut, 10 Net, 11 Snapback).
- **Placement:** a dismissible card shown **over the player**. Auto-opens the first time
  you enter a topic; a **Learn** button in the player header reopens it anytime. Dismissing
  drops straight into practice with the puzzle state untouched.

## Content & correctness

- `src/app/content/lessons.ts` — pure data (no engine/React imports), one `Lesson` per
  topic. Each lesson holds a title, body lines, a diagram (board size, stones, marks,
  key move(s), key-move color) and a caption.
- The diagram renders through the **existing `Board`** component: a lesson diagram is a
  `Puzzle`-shaped object rendered with `reveal` so the key move shows as a ghost stone +
  accent ring, and marked stones get an accent ring. No `Board` changes.
- **Every diagram is engine-verified** by a permanent test (`lessons.verify.test.ts`,
  node env) that imports the lessons data and the repo's build-time engine/reader (the
  same tools that verify the puzzle bank) and asserts, per topic, that the highlighted
  move actually demonstrates the concept:
  - Liberties: the marked stone has the stated liberty count; marked points are its liberties.
  - Capture a stone / group: the target group is in atari (1 liberty); the key move captures it.
  - Escape atari: the black group is in atari; the key move raises it to ≥2 liberties and it
    is not immediately capturable.
  - Don't self-atari: playing the flagged point leaves Black on exactly 1 liberty (and
    captures nothing) — a self-atari to avoid.
  - Double atari: after the key move, ≥2 distinct white groups are each in atari.
  - Connect & cut: the two marked black stones are separate groups before the key move and a
    single group after.
  - Net: base alive before (`capturedUnderBestPlay` false at depth 8); the key move leaves the
    white target on exactly 2 liberties and `capturedUnderBestPlay` true.
  - Snapback: `snapbackWorks(board, keyMove).ok` is true.
- Example shapes are found empirically against the engine (as the generators were), not
  hand-guessed, then baked in as data. The verify test is the fail-loud guard against a
  wrong shape shipping.

## UI

- `src/app/ui/LessonScreen.tsx` — presentational: renders title, the `Board` diagram,
  caption, body lines, and a "Start practicing" button. Takes a `Lesson` and `onDismiss`.
- `PlayerScreen` renders `LessonScreen` as an overlay when its `showLesson` prop is set,
  and shows a **Learn** button in the header (next to Back) that opens it. Overlay open
  state is local to the player; the puzzle VM is never reset by opening/closing it.
- On first entry to a topic the overlay starts open; dismissing it calls
  `progress.markLessonSeen(topic)`. Subsequent entries start with it closed.

## Persistence

- `ProgressStore` gains `lessonSeen(topic): boolean` and `markLessonSeen(topic): void`,
  persisted under `two-eyes:lessons-seen` (JSON array of topic numbers), tolerant of
  corrupt/absent storage like the existing counts.

## Out of scope

No change to puzzle content, the generator, or the committed bank. No new lesson content
beyond the 9 current topics.
