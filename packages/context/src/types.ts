import typia from 'typia';

export interface ComposeContextOptions {
  template: string;
}

export const validateComposeContextOptions = typia.createValidate<ComposeContextOptions>();
