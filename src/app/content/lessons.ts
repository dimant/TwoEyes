import type { Stone, Mark, Pt, DemoMove } from "../model/types";

// A short, illustrated concept lesson shown before a topic's puzzles.
// Pure data — no engine or React imports so it stays out of the shipped path's logic.
// Every diagram is verified against the go engine in lessons.verify.test.ts.

export interface LessonDiagram {
  size: number;
  stones: Stone[];
  /** Rings around stones ("mark") or at points ("target") to draw attention. */
  marks?: Mark[];
  /** Warn rings — used to flag a point you should NOT play. */
  ataris?: Pt[];
  /** The teaching move(s), drawn as a ghost stone + accent ring (the "answer"). */
  keyMove?: Pt[];
  /** Pre-computed, engine-verified capture line played on reveal (net/snapback). */
  payoff?: DemoMove[];
  /** A ladder-breaker stone to ring on reveal (topic 9). */
  breaker?: Pt;
  caption: string;
}

export interface Lesson {
  topic: number;
  title: string;
  body: string[];
  diagram: LessonDiagram;
}

const b = (x: number, y: number): Stone => ({ x, y, c: "b" });
const w = (x: number, y: number): Stone => ({ x, y, c: "w" });

export const LESSONS: Lesson[] = [
  {
    topic: 1,
    title: "Liberties",
    body: [
      "A stone's liberties are the empty points directly touching it — up, down, left and right (not diagonals).",
      "The white stone below sits in the open, so it has four liberties, marked with rings.",
      "To capture a stone you fill its last liberty. A stone with no liberties left is taken off the board.",
    ],
    diagram: {
      size: 5,
      stones: [w(2, 2)],
      marks: [
        { x: 1, y: 2, kind: "target" }, { x: 3, y: 2, kind: "target" },
        { x: 2, y: 1, kind: "target" }, { x: 2, y: 3, kind: "target" },
      ],
      caption: "Four empty points touch the stone — four liberties.",
    },
  },
  {
    topic: 2,
    title: "Capture a stone",
    body: [
      "When a stone has just one liberty left, it is in atari — one move from being captured.",
      "The white stone here has a single liberty. Black plays on that last point to capture it.",
      "Look for enemy stones in atari and take them.",
    ],
    diagram: {
      size: 5,
      stones: [w(2, 2), b(1, 2), b(3, 2), b(2, 1)],
      marks: [{ x: 2, y: 2, kind: "mark" }],
      keyMove: [{ x: 2, y: 3 }],
      caption: "Fill the last liberty to capture the marked stone.",
    },
  },
  {
    topic: 3,
    title: "Capture a group",
    body: [
      "Stones of the same colour that touch each other form one group and share all their liberties.",
      "The whole group is captured together the moment its last shared liberty is filled.",
      "This two-stone white group has one liberty left — Black fills it and takes both stones.",
    ],
    diagram: {
      size: 5,
      stones: [w(2, 2), w(2, 3), b(1, 2), b(3, 2), b(2, 1), b(1, 3), b(3, 3)],
      marks: [{ x: 2, y: 2, kind: "mark" }, { x: 2, y: 3, kind: "mark" }],
      keyMove: [{ x: 2, y: 4 }],
      caption: "One move captures the whole group.",
    },
  },
  {
    topic: 4,
    title: "Escape atari",
    body: [
      "When your own stone is in atari, you can often save it by adding a stone next to it.",
      "The new stone joins the old one into a bigger group with more liberties, so it is no longer in atari.",
      "The marked black stone has one liberty; extending downward gives the group room to breathe.",
    ],
    diagram: {
      size: 5,
      stones: [b(2, 2), w(1, 2), w(3, 2), w(2, 1)],
      marks: [{ x: 2, y: 2, kind: "mark" }],
      keyMove: [{ x: 2, y: 3 }],
      caption: "Extend to connect and gain liberties.",
    },
  },
  {
    topic: 5,
    title: "Don't self-atari",
    body: [
      "Before playing, count the liberties your own stone would have.",
      "The marked point looks tempting, but a black stone there would have just one liberty — White captures it next move.",
      "Playing into your own atari like this usually just gives the stone away. Avoid it.",
    ],
    diagram: {
      size: 5,
      stones: [w(0, 2), w(2, 2), w(1, 1)],
      ataris: [{ x: 1, y: 2 }],
      caption: "Playing the flagged point self-ataris — don't.",
    },
  },
  {
    topic: 6,
    title: "Double atari",
    body: [
      "A double atari is one move that puts two different enemy stones in atari at the same time.",
      "Your opponent can only save one of them, so you capture the other next move.",
      "Black plays in the middle here and both marked white stones are suddenly down to one liberty.",
    ],
    diagram: {
      size: 5,
      stones: [w(1, 2), w(3, 2), b(0, 2), b(1, 1), b(4, 2), b(3, 1)],
      marks: [{ x: 1, y: 2, kind: "mark" }, { x: 3, y: 2, kind: "mark" }],
      keyMove: [{ x: 2, y: 2 }],
      caption: "One move, two stones in atari.",
    },
  },
  {
    topic: 7,
    title: "Connect & cut",
    body: [
      "Two of your stones with a gap between them can be cut apart by the opponent.",
      "Playing on the connecting point links them into one strong group that can't be split.",
      "The two marked black stones are about to be cut — the middle point joins them safely.",
    ],
    diagram: {
      size: 5,
      stones: [b(1, 2), b(3, 2), w(2, 1), w(2, 3)],
      marks: [{ x: 1, y: 2, kind: "mark" }, { x: 3, y: 2, kind: "mark" }],
      keyMove: [{ x: 2, y: 2 }],
      caption: "Connect on the cutting point.",
    },
  },
  {
    topic: 8,
    title: "The ladder (shicho)",
    body: [
      "A ladder catches a running stone that can never quite get away.",
      "You keep it in atari — one liberty — and it flees in a zig-zag. Each time it runs, you atari again, herding it toward the edge.",
      "The marked white stone can't escape: chased into the corner, it finally runs out of room and is captured.",
    ],
    diagram: {
      size: 7,
      stones: [b(1, 1), b(1, 2), w(2, 2), b(2, 3)],
      marks: [{ x: 2, y: 2, kind: "mark" }],
      keyMove: [{ x: 3, y: 2 }],
      payoff: [
        { x: 3, y: 2, c: "b" },
        { x: 2, y: 1, c: "w" },
        { x: 3, y: 1, c: "b" },
        { x: 2, y: 0, c: "w" },
        { x: 3, y: 0, c: "b" },
        { x: 1, y: 0, c: "w" },
        { x: 0, y: 0, c: "b", captures: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }] },
      ],
      caption: "Keep it in atari and chase it to the corner.",
    },
  },
  {
    topic: 9,
    title: "The ladder-breaker",
    body: [
      "A ladder only works if nothing is waiting in its path.",
      "A friendly stone of the hunted colour, sitting further along the zig-zag, is a ladder-breaker: the running stone reaches it, connects, and gets free.",
      "So before you start a ladder, look ahead. The marked white stone here can't be caught — the ringed white stone breaks the ladder.",
    ],
    diagram: {
      size: 9,
      stones: [b(4, 5), w(5, 5), b(6, 5), b(6, 6), w(3, 7)],
      marks: [{ x: 5, y: 5, kind: "mark" }],
      breaker: { x: 3, y: 7 },
      caption: "The ringed stone breaks the ladder — the marked stone escapes.",
    },
  },
  {
    topic: 10,
    title: "The net (geta)",
    body: [
      "Chasing a stone by putting it in atari often just lets it run away, one step ahead of you.",
      "A net catches it a different way: you play a loose move that covers every escape square at once.",
      "The marked white stone still has liberties after Black's move — but wherever it runs, it gets captured. It is netted.",
    ],
    diagram: {
      size: 7,
      stones: [b(5, 3), b(4, 4), w(5, 4), b(4, 5)],
      marks: [{ x: 5, y: 4, kind: "mark" }],
      keyMove: [{ x: 6, y: 5 }],
      payoff: [
        { x: 6, y: 5, c: "b" },
        { x: 6, y: 4, c: "w" },
        { x: 5, y: 5, c: "b" },
        { x: 6, y: 3, c: "w" },
        { x: 6, y: 2, c: "b", captures: [{ x: 6, y: 3 }, { x: 6, y: 4 }, { x: 5, y: 4 }] },
      ],
      caption: "The loose net move — the stone can't run.",
    },
  },
  {
    topic: 11,
    title: "Snapback",
    body: [
      "Sometimes you throw a stone deep into the opponent's shape, right into atari — on purpose.",
      "If they capture it, filling that point puts their own group into self-atari.",
      "You play back on the same spot and snap the whole group off the board. That's a snapback.",
    ],
    diagram: {
      size: 7,
      stones: [b(5, 3), b(4, 4), w(5, 4), b(6, 4), b(4, 5), w(5, 5), b(4, 6), w(5, 6)],
      keyMove: [{ x: 6, y: 6 }],
      payoff: [
        { x: 6, y: 6, c: "b" },
        { x: 6, y: 5, c: "w", captures: [{ x: 6, y: 6 }] },
        { x: 6, y: 6, c: "b", captures: [{ x: 5, y: 6 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 5 }] },
      ],
      caption: "The throw-in that sets up the snapback.",
    },
  },
];

export function lessonFor(topic: number): Lesson | undefined {
  return LESSONS.find((l) => l.topic === topic);
}
