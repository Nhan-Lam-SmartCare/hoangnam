/**
 * Script: remove-console-logs.mjs
 * Xóa tất cả console.log() trong src/ (giữ lại console.warn và console.error).
 * Xử lý cả single-line và multi-line console.log.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';
const EXTENSIONS = ['.ts', '.tsx'];
let totalRemoved = 0;
let filesModified = 0;

/**
 * Removes console.log(...) calls, including multi-line ones.
 * Keeps console.warn, console.error, console.info.
 */
function removeConsoleLogs(code) {
  let result = code;
  let changed = true;
  let removeCount = 0;

  while (changed) {
    changed = false;
    // Match console.log( ... ) — handles nested parens
    const regex = /[ \t]*console\.log\s*\(/g;
    let match;
    while ((match = regex.exec(result)) !== null) {
      const start = match.index;
      // Find matching closing paren
      let depth = 0;
      let i = start + match[0].length - 1; // position of opening (
      const len = result.length;

      while (i < len) {
        const ch = result[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        } else if (ch === '`' || ch === '"' || ch === "'") {
          // Skip strings
          const quote = ch;
          i++;
          while (i < len && result[i] !== quote) {
            if (result[i] === '\\') i++; // skip escape
            i++;
          }
        }
        i++;
      }

      // i is now the position of the closing )
      let end = i + 1;
      // Consume trailing semicolon if present
      if (end < len && result[end] === ';') end++;
      // Consume trailing newline
      const lineEnd = result.indexOf('\n', end);

      // Check if the entire line is just this console.log (possibly with leading whitespace)
      const lineStart = result.lastIndexOf('\n', start - 1) + 1;
      const lineContent = result.slice(lineStart, lineEnd === -1 ? len : lineEnd + 1);
      const withoutLog = lineContent.replace(/[ \t]*console\.log\s*\([^)]*\);?\r?\n?/, '');

      if (withoutLog.trim() === '' || withoutLog === '') {
        // Whole line is just console.log — remove the entire line(s)
        const removeEnd = lineEnd === -1 ? len : lineEnd + 1;
        result = result.slice(0, lineStart) + result.slice(removeEnd);
        removeCount++;
        changed = true;
        break; // restart scan after modification
      } else {
        // console.log is inline with other code — just remove the call
        result = result.slice(0, start) + result.slice(end);
        removeCount++;
        changed = true;
        break;
      }
    }
  }

  return { result, removeCount };
}

function walkFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (EXTENSIONS.includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walkFiles(SRC_DIR);
const results = [];

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes('console.log(')) continue;

  const { result, removeCount } = removeConsoleLogs(original);

  if (removeCount > 0) {
    writeFileSync(file, result, 'utf8');
    totalRemoved += removeCount;
    filesModified++;
    results.push({ file: file.replace(SRC_DIR + '\\', '').replace(SRC_DIR + '/', ''), removed: removeCount });
  }
}

console.log('\n===== console.log Cleanup Report =====');
results.forEach(r => console.log(`  [${r.removed}] ${r.file}`));
console.log(`\nTotal: ${totalRemoved} console.log removed from ${filesModified} files`);
