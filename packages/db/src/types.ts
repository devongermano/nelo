/**
 * Consolidated type definitions for @nelo/db package
 * This file provides proper TypeScript types for database models and fields
 */

// Import Prisma namespace for use in this file
import { Prisma } from '@prisma/client';

// Re-export all Prisma types
export * from '@prisma/client';

// ============================================================================
// CRDT Document Types
// ============================================================================

/**
 * Yjs CRDT document structure for real-time collaboration
 * This represents the structure of the docCrdt field in Scene model
 */
export interface CRDTDocument {
  /** Document version for compatibility checking */
  version?: number;
  /** The actual Yjs document state (base64 encoded) */
  state?: string;
  /** Pending updates not yet merged */
  pendingUpdates?: string[];
  /** Last update timestamp */
  lastModified?: string;
  /** User who last modified */
  lastModifiedBy?: string;
}

/**
 * Type-safe wrapper for Scene.docCrdt field
 */
export type SceneCRDT = CRDTDocument | Record<string, never>;

// ============================================================================
// Comment and Suggestion Range Types
// ============================================================================

/**
 * Text range for comments and suggestions
 */
export interface TextRange {
  /** Starting character position */
  start: number;
  /** Ending character position */
  end: number;
  /** Optional anchor for relative positioning */
  anchor?: string;
}

// ============================================================================
// EntityType is now exported from @prisma/client as an enum (Spec Evolution #002)
// ============================================================================

// ============================================================================
// Refactor Plan Structure
// ============================================================================

export interface RefactorPlan {
  /** Entities affected by the refactor */
  entities?: string[];
  /** Operations to perform */
  operations?: RefactorOperation[];
  /** Constraints to maintain */
  constraints?: RefactorConstraint[];
  /** Estimated impact */
  impact?: {
    scenes: number;
    words: number;
    confidence: number;
  };
}

export interface RefactorOperation {
  type: 'find_replace' | 'rewrite' | 'delete' | 'insert';
  target: string;
  replacement?: string;
  context?: string;
}

export interface RefactorConstraint {
  type: 'preserve_meaning' | 'maintain_voice' | 'keep_length' | 'custom';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Metrics and Analytics Types
// ============================================================================

export interface RefactorMetrics {
  /** Total patches generated */
  patchCount: number;
  /** Average confidence score */
  avgConfidence: number;
  /** Confidence distribution */
  confidenceDistribution: {
    high: number;  // 80-100
    medium: number; // 50-79
    low: number;   // 0-49
  };
  /** Scenes affected */
  scenesAffected: number;
  /** Processing time in ms */
  processingTime: number;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

export interface ModelConfig {
  /** Model identifier (e.g., 'gpt-4', 'claude-3') */
  model: string;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Custom provider-specific settings */
  customSettings?: Record<string, any>;
}

// ============================================================================
// Prompt Object Structure
// ============================================================================

export interface PromptObject {
  /** System prompt */
  system?: string;
  /** User prompt */
  user: string;
  /** Assistant prompt (for few-shot) */
  assistant?: string;
  /** Context documents */
  context?: ContextDocument[];
  /** Examples for few-shot learning */
  examples?: PromptExample[];
  /** Metadata */
  metadata?: Record<string, any>;
}

export interface ContextDocument {
  /** Document identifier */
  id: string;
  /** Document content */
  content: string;
  /** Document type */
  type: 'scene' | 'entity' | 'fact' | 'style' | 'other';
  /** Relevance score */
  relevance?: number;
}

export interface PromptExample {
  input: string;
  output: string;
  /** Optional explanation */
  explanation?: string;
}

// ============================================================================
// User Settings Type
// ============================================================================

export interface UserSettings {
  /** UI theme preference */
  theme?: 'light' | 'dark' | 'auto';
  /** Editor preferences */
  editor?: {
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    wordWrap?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
  };
  /** AI preferences */
  ai?: {
    defaultProvider?: string;
    defaultModel?: string;
    autoSuggest?: boolean;
    suggestDelay?: number;
  };
  /** Notification preferences */
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    collaborationAlerts?: boolean;
    costAlerts?: boolean;
    costAlertThreshold?: number;
  };
}

// ============================================================================
// Style Guide Rules Type
// ============================================================================

export interface StyleGuideRules {
  /** Writing style rules */
  style?: {
    pointOfView?: 'first' | 'second' | 'third-limited' | 'third-omniscient';
    tense?: 'past' | 'present' | 'future';
    voice?: 'active' | 'passive' | 'mixed';
  };
  /** Vocabulary rules */
  vocabulary?: {
    avoidWords?: string[];
    preferredWords?: Record<string, string>;
    readingLevel?: string;
  };
  /** Formatting rules */
  formatting?: {
    dialogueStyle?: 'quotes' | 'dashes' | 'italic';
    paragraphLength?: { min?: number; max?: number };
    sentenceLength?: { min?: number; max?: number };
  };
  /** Custom rules */
  custom?: Array<{
    name: string;
    description: string;
    regex?: string;
    action: 'warn' | 'error' | 'auto-fix';
  }>;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Type for version-controlled models
 */
export interface Versioned {
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for models with optimistic locking
 */
export interface OptimisticallyLocked extends Versioned {
  /** Check version before update */
  _version?: number;
}

// ============================================================================
// Database Transaction Types
// ============================================================================

/**
 * Type alias for Prisma transaction client
 * Note: Prisma is already exported from @prisma/client at the top of this file
 */
export type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * Options for database transactions
 */
export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}