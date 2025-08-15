export interface ProviderAdapter {
  generate(prompt: string): Promise<string>;
  embed?(text: string[]): Promise<number[][]>;
  moderate?(text: string): Promise<boolean>;
}

export class OpenAIAdapter implements ProviderAdapter {
  async generate(prompt: string): Promise<string> {
    return Promise.resolve(`openai:${prompt}`);
  }
}
