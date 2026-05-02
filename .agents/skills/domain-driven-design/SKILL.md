---
name: domain-driven-design
description: Designs feature-level Domain-Driven Design boundaries and artifacts for this project, including bounded contexts, ubiquitous language, aggregates, invariants, and contracts. Use when planning new domain features, defining business models, or clarifying context boundaries.
disable-model-invocation: true
---

# Domain-Driven Design

## Purpose

Use this skill to design new feature domains with clear bounded contexts and implementation-ready contracts before coding.

## Workflow

1. Clarify the feature outcome in business terms.
2. Build a ubiquitous language list:
   - core terms,
   - synonyms to avoid,
   - term ownership by context.
3. Define bounded contexts using:
   - vocabulary differences,
   - lifecycle/rule differences,
   - ownership of invariants.
4. For each context, define:
   - entities and value objects,
   - aggregate roots,
   - domain services (only when behavior does not belong in one entity),
   - invariants and failure conditions.
5. Define context interfaces:
   - API/DTO contracts,
   - events (if needed),
   - anti-corruption mapping when crossing contexts.
6. Produce an implementation slice:
   - minimal folders/modules,
   - first test targets (business behavior),
   - sequencing (what to build first).

## Output Template

```md
# DDD Design: <feature-name>

## Business Outcome
- ...

## Ubiquitous Language
- Term: definition (Context owner)
- ...

## Bounded Contexts
### <Context Name>
- Responsibility:
- Owns invariants:
- Does not own:

## Domain Model by Context
### <Context Name>
- Entities:
- Value Objects:
- Aggregate Root(s):
- Domain Services:
- Key Invariants:

## Contracts Between Contexts
- Producer -> Consumer:
  - Contract type: API DTO | Event
  - Fields:
  - Mapping / anti-corruption notes:

## Initial Implementation Slice
- Modules/folders:
- First tests to write:
- Build order:
```

## Guardrails

- Keep domain language aligned with user/stakeholder language, not database schema names.
- Do not share mutable models across contexts.
- Avoid generic "utils" for domain logic; place behavior in the owning context.
- Prefer a thin first slice over full domain expansion.

## Good vs Bad Boundary Example

```ts
// BAD: Payment logic leaking into Orders context
export function markOrderPaid(orderId: string, cardLast4: string) {}

// GOOD: Orders consumes a payment result contract from Billing context
export function applyPaymentResult(orderId: string, paymentStatus: "succeeded" | "failed") {}
```
