---
title: Agent Roles
description: The 9 specialized roles that participate in each ralph iteration.
---

Each iteration of `ralph loop` is a structured collaboration between **9 specialized agent roles**. The AI agent adopts each role in sequence, producing explicit commentary from that role's perspective. This commentary is captured in the iteration's JSONL log file, giving full transparency into the reasoning behind every decision.

## Role Definitions

| Role                          | Focus                    | Responsibility                                                                                                                                                           |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Product Manager (PM)**      | Business-technical alignment | Validates that the task aligns with PRD requirements and acceptance criteria. Ensures implementation scope matches what was asked for — no more, no less.               |
| **System Architect**          | Structural design        | Designs the structural blueprint. Reviews the approach for scalability, modularity, and separation of concerns.                                                          |
| **Security Engineer (AppSec)**| Shift-left security      | Reviews designs for vulnerabilities before code is written. Validates OWASP guidelines compliance. No injection, XSS, or common attack vectors.                         |
| **UX/UI Designer**            | User experience          | Ensures user-facing changes are intuitive and consistent. Reviews CLI output formatting, error messages, and user flows. Participates only when the task has user-facing surface. |
| **Frontend & Backend Engineers** | Implementation        | Write the actual implementation. Focus on DRY, SRP, and clean modular code.                                                                                             |
| **DevOps / SRE**              | CI/CD and operations     | Evaluates CI/CD and operational impact. Ensures changes do not break the build or introduce slow tests.                                                                  |
| **SDET**                      | Test strategy            | Designs the test strategy and builds automated regression suites. Critically verifies that TDD actually drove the development.                                           |
| **Technical Lead**            | Code quality             | Performs rigorous code review. Evaluates naming, structure, error handling, and long-term maintainability.                                                                |
| **DBA / Data Engineer**       | Data and persistence     | Reviews schema designs, query patterns, and data access layers. Participates only when the task involves data models or persistence.                                     |

## Phase Participation

Roles participate at specific points in the iteration. **Boot** and **Verify** are gate phases — the iteration must not proceed without explicit approval from participating roles.

| Phase                               | Active Roles                                                                                                | Gate? |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----- |
| **Boot** (task analysis & approach) | PM validates task/PRD alignment. Architect designs approach. Security reviews threat surface. DBA reviews if data models involved. UX reviews if user-facing. | Yes   |
| **Red** (test writing)              | SDET defines test strategy. Engineers write failing tests.                                                  | No    |
| **Green** (implementation)          | Engineers write minimum code. Architect guides if implementation drifts.                                    | No    |
| **Verify** (quality gates)          | SDET audits TDD compliance. Security scans implementation. Tech Lead reviews code quality. DevOps evaluates CI/CD. DBA reviews schema if applicable. | Yes   |
| **Commit**                          | Engineers produce the clean commit.                                                                         | No    |

## Commentary Format

Each role's commentary uses a `[ROLE: ...]` marker so it is identifiable in the log:

```
[ROLE: Product Manager] Task T-042 aligns with PRD §5.3. Acceptance criteria require...
[ROLE: System Architect] Proposed approach: extract the parser into a separate module...
[ROLE: Security Engineer] No external input surfaces in this task. No threat model concerns.
```

Roles that are not applicable must explicitly skip with a reason:

```
[ROLE: UX/UI Designer] Skipping — this task has no user-facing surface.
[ROLE: DBA / Data Engineer] Skipping — no data models or persistence changes.
```

This ensures the log is a complete record — every role is accounted for in every iteration.

## TDD Compliance Audit

The SDET role during the Verify phase has a specific mandate: verify that TDD actually drove the development. The SDET must look for evidence that:

- Tests were written during the Red phase (before implementation)
- Tests initially failed (they tested behavior that did not exist yet)
- Implementation in the Green phase was the minimum needed to make tests pass
- Tests are semantic assertions about behavior, not string-matching or implementation-coupled checks

If the SDET finds evidence that tests were written after the implementation, this must be flagged as a review failure.

## Customizing Roles

Users customize roles via `docs/prompts/roles.md`, an optional extension file that modifies the built-in role definitions using Markdown headings with directives.

### Override a Built-in Role

Replace its description for this project:

```markdown
## Override: SDET

In this project, the SDET focuses on integration testing with real database connections.
All tests must hit the actual PostgreSQL instance, not mocks.
```

### Add a Custom Role

Define a new role with its participation phases:

```markdown
## Add: Compliance Officer

- **Focus**: Regulatory compliance
- **Responsibility**: Reviews all data handling for GDPR/HIPAA compliance. Validates that PII is encrypted at rest and in transit.
- **Participates**: Boot, Verify
```

### Disable a Built-in Role

Exclude it from this project:

```markdown
## Disable: UX/UI Designer

This is a headless API project with no user-facing surface.
```

### Per-Task Role Selection

Task files may include an optional `Roles` field:

```markdown
- **Roles**: DBA, Compliance Officer
```

When `Roles` is present, only the listed roles participate (plus Engineers, which always participate). When absent, all applicable roles participate using the default logic.

## Inspecting Roles

```bash
ralph show roles                # All roles with source annotations
ralph show roles --json         # Machine-readable output
ralph show roles --built-in-only # Only the 9 built-in roles
ralph show task T-042           # Roles active for a specific task
```
