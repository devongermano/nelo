# 0001: Backend Framework

## Status
Accepted

## Date
2025-08-15

## Context
We need a performant and well-supported Node.js framework for building the service's APIs.
The framework must offer strong TypeScript support, extensibility, and high throughput to handle collaborative features.

## Decision
Adopt **Fastify** as the primary backend framework.

## Alternatives
- **Express**: Ubiquitous and simple but slower and less opinionated.
- **Koa**: Minimalist design requiring additional libraries for common tasks.
- **NestJS**: Feature-rich but introduces unnecessary complexity and learning overhead.

## Consequences
- Benefit from Fastify's plugin ecosystem and performance optimizations.
- Team members must familiarize themselves with Fastify conventions.
- Some middleware available for Express may not yet exist for Fastify.

## Migration Notes
- Translate existing Express-style middleware into Fastify plugins.
- Validate request and response schemas to leverage Fastify's type system.
