import { describe, it, expect } from 'vitest';

import { extractPrdSections, parsePrdReferences } from '../core/prd-extractor.js';

const samplePrd = `# My PRD

## 1. Overview

This is the overview section.

### 1.1 Goals

The primary goals are listed here.

- Goal A
- Goal B

### 1.2 Non-Goals

Things we will not do.

## 2. Architecture

The architecture section content.

### 2.1 Components

Component details here.

Some more component info.

### 2.2 Data Flow

Data flows from A to B.

## 3. Commands

### 3.1 Init

The init command sets up the project.

### 3.2 Loop

The loop command runs tasks.

It does many things.

## 4. Empty Section
`;

describe('parsePrdReferences', () => {
  it('parses a single reference', () => {
    expect(parsePrdReferences('§3.2')).toEqual(['3.2']);
  });

  it('parses multiple comma-separated references', () => {
    expect(parsePrdReferences('§3.2, §1.1')).toEqual(['3.2', '1.1']);
  });

  it('parses top-level section reference', () => {
    expect(parsePrdReferences('§2')).toEqual(['2']);
  });

  it('returns empty array for empty string', () => {
    expect(parsePrdReferences('')).toEqual([]);
  });

  it('handles whitespace variations', () => {
    expect(parsePrdReferences('§3.2,§1.1, §2')).toEqual(['3.2', '1.1', '2']);
  });
});

describe('extractPrdSections', () => {
  it('extracts a subsection by reference', () => {
    const result = extractPrdSections(samplePrd, '§3.2');
    expect(result).toContain('The loop command runs tasks.');
    expect(result).toContain('It does many things.');
  });

  it('extracts a top-level section including subsections', () => {
    const result = extractPrdSections(samplePrd, '§2');
    expect(result).toContain('The architecture section content.');
    expect(result).toContain('Component details here.');
    expect(result).toContain('Data flows from A to B.');
  });

  it('extracts multiple sections', () => {
    const result = extractPrdSections(samplePrd, '§1.1, §3.2');
    expect(result).toContain('The primary goals are listed here.');
    expect(result).toContain('The loop command runs tasks.');
  });

  it('does not include sibling section content', () => {
    const result = extractPrdSections(samplePrd, '§1.1');
    expect(result).toContain('The primary goals are listed here.');
    expect(result).not.toContain('Things we will not do.');
  });

  it('includes a warning for missing section references', () => {
    const result = extractPrdSections(samplePrd, '§99.9');
    expect(result).toContain('99.9');
    expect(result.toLowerCase()).toContain('not found');
  });

  it('includes found sections and warnings for mixed references', () => {
    const result = extractPrdSections(samplePrd, '§3.2, §99.9');
    expect(result).toContain('The loop command runs tasks.');
    expect(result).toContain('99.9');
    expect(result.toLowerCase()).toContain('not found');
  });

  it('returns empty string for empty prdReference', () => {
    expect(extractPrdSections(samplePrd, '')).toBe('');
  });

  it('handles section with no body content', () => {
    const result = extractPrdSections(samplePrd, '§4');
    // Section exists but has no content after heading — should not error
    expect(result).not.toContain('not found');
  });

  it('includes the section heading in extracted content', () => {
    const result = extractPrdSections(samplePrd, '§3.2');
    expect(result).toMatch(/###\s+3\.2/);
  });
});
