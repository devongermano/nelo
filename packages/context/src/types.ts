import { z } from 'zod';

export const ComposeContextOptionsSchema = z.object({
  template: z.string()
});

export type ComposeContextOptions = z.infer<typeof ComposeContextOptionsSchema>;
