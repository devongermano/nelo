export interface ComposeContextResult {
  segments: any[];
  redactions: any[];
}

export async function composeContext(): Promise<ComposeContextResult> {
  return { segments: [], redactions: [] };
}
