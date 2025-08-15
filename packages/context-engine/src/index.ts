export interface CanonFact {
  entityId: string;
  fact: string;
  revealAtScene?: number;
  revealed?: boolean;
}

export interface Scene {
  id: number;
  text: string;
}

export function composeContext(scene: Scene, facts: CanonFact[]): string {
  return facts
    .filter(f => f.revealed || (f.revealAtScene !== undefined && f.revealAtScene <= scene.id))
    .map(f => f.fact)
    .join('\n');
}
