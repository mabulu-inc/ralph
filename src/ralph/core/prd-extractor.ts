/**
 * Extracts PRD sections by §-reference for inline injection into boot prompts.
 */

export function parsePrdReferences(prdReference: string): string[] {
  if (!prdReference.trim()) return [];

  return prdReference.split(',').map((ref) => ref.trim().replace(/^§/, ''));
}

/**
 * Extract one or more PRD sections from markdown content.
 *
 * Section references like `§3.2` match headings whose text starts with the
 * numeric prefix (e.g., `### 3.2 Loop` or `## 3. Commands`).
 *
 * Returns the concatenated section content (including headings).
 * Missing sections produce an inline warning rather than failing.
 */
export function extractPrdSections(prdContent: string, prdReference: string): string {
  const refs = parsePrdReferences(prdReference);
  if (refs.length === 0) return '';

  const parts: string[] = [];

  for (const ref of refs) {
    const extracted = extractSingleSection(prdContent, ref);
    if (extracted === undefined) {
      parts.push(`<!-- WARNING: PRD section §${ref} not found -->`);
    } else {
      parts.push(extracted);
    }
  }

  return parts.join('\n\n');
}

function extractSingleSection(prdContent: string, sectionNum: string): string | undefined {
  const lines = prdContent.split('\n');
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escapeRegex(sectionNum)}\\b`);

  let startLine = -1;
  let headingDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingPattern);
    if (match) {
      startLine = i;
      headingDepth = match[1].length;
      break;
    }
  }

  if (startLine === -1) return undefined;

  let endLine = lines.length;
  for (let i = startLine + 1; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s/);
    if (headingMatch && headingMatch[1].length <= headingDepth) {
      endLine = i;
      break;
    }
  }

  return lines.slice(startLine, endLine).join('\n').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
