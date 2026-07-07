import { Observable } from "./observable";
import type { PuzzleBank } from "../model/bank";
import type { ProgressStore } from "../model/progress";

export interface TopicRow {
  topic: number;
  unlocked: boolean;
  cleared: boolean;
  rungsCleared: number;
  rungsTotal: number;
}
export interface MapState { rows: TopicRow[]; }

export class MapViewModel extends Observable<MapState> {
  constructor(private readonly bank: PuzzleBank, private readonly progress: ProgressStore) {
    super({ rows: [] });
    this.refresh();
  }

  refresh(): void {
    const rows: TopicRow[] = this.bank.topics().map((topic) => {
      const rungs = this.bank.rungs(topic);
      return {
        topic,
        unlocked: this.progress.topicUnlocked(topic),
        cleared: this.progress.topicCleared(topic),
        rungsCleared: rungs.filter((r) => this.progress.rungCleared(topic, r)).length,
        rungsTotal: rungs.length,
      };
    });
    this.set({ rows });
  }
}
