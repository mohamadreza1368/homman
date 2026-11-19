/** Code fence delimiter pattern (backticks or tildes). */
const CODE_FENCE_REGEX = /^(?:```|~~~)/;

/**
 * Punctuation immediately followed by 1 to 6 hash characters and whitespace,
 * indicating a markdown heading erroneously joined to the end of a sentence.
 */
const JOINED_HEADING_REGEX = /([.!?:])(#{1,6}[ \t])/g;

/**
 * Corrects streaming LLM artifact where markdown headings are directly concatenated
 * onto sentence-terminating punctuation without line breaks.
 * Preserves code blocks and leaves standard prose hashtags and identifiers untouched.
 */
export function repairGluedHeadings(rawMarkdown: string): string {
  if (!rawMarkdown.includes("#")) {
    return rawMarkdown;
  }

  let insideCodeBlock = false;
  const lines = rawMarkdown.split("\n");

  return lines
    .map((line) => {
      if (CODE_FENCE_REGEX.test(line.trimStart())) {
        insideCodeBlock = !insideCodeBlock;
        return line;
      }

      if (insideCodeBlock) {
        return line;
      }

      return line.replace(JOINED_HEADING_REGEX, "$1\n\n$2");
    })
    .join("\n");
}
