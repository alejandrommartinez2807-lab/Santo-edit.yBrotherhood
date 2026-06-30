#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const targetProp = 'internalAllowEditOrderNotes';
const targetType = 'BusinessComplexitySettings';
const targetFn = 'getBusinessComplexityPermissions';

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', '.vercel'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.includes('.bak')) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function lineNo(text, index) { return text.slice(0, index).split(/\r?\n/).length; }
function contextLines(text, startLine, radius = 4) {
  const lines = text.split(/\r?\n/);
  const from = Math.max(1, startLine - radius);
  const to = Math.min(lines.length, startLine + radius);
  return lines.slice(from - 1, to).map((line, i) => `${String(from + i).padStart(4, ' ')} | ${line}`).join('\n');
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractTypeBlocks(file, text) {
  const blocks = [];
  const patterns = [
    new RegExp(`(?:export\\s+)?interface\\s+${targetType}\\b`, 'g'),
    new RegExp(`(?:export\\s+)?type\\s+${targetType}\\s*=`, 'g'),
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text))) {
      const open = text.indexOf('{', m.index);
      if (open === -1) continue;
      const close = findMatchingBrace(text, open);
      const block = close === -1 ? text.slice(open, open + 1200) : text.slice(open, close + 1);
      blocks.push({ file, index: m.index, line: lineNo(text, m.index), block });
    }
  }
  return blocks;
}

function propExistsAsMember(block, prop) {
  const member = new RegExp(`(^|[\\n;,{])\\s*${prop}\\??\\s*:`, 'm');
  return member.test(block);
}

function listInternalProps(block) {
  const props = new Set();
  const re = /(^|[\n;,{])\s*(internal[A-Za-z0-9_]+)\??\s*:/gm;
  let m;
  while ((m = re.exec(block))) props.add(m[2]);
  return [...props].sort();
}

const files = walk(srcDir);
console.log('='.repeat(90));
console.log('Diagnóstico BusinessComplexitySettings / internal permissions');
console.log('Proyecto:', root);
console.log('Archivos TS/TSX revisados:', files.length);
console.log('='.repeat(90));

const routePath = path.join(root, 'src/app/api/orders/[orderId]/route.ts');
if (exists(routePath)) {
  const text = read(routePath);
  console.log('\n[1] Ruta del error: src/app/api/orders/[orderId]/route.ts');
  const fnIdx = text.indexOf(targetFn);
  const propIdx = text.indexOf(targetProp);
  console.log(`- ${targetFn}:`, fnIdx >= 0 ? `sí, línea ${lineNo(text, fnIdx)}` : 'NO aparece');
  console.log(`- ${targetProp}:`, propIdx >= 0 ? `sí, línea ${lineNo(text, propIdx)}` : 'NO aparece');
  console.log('\nImports iniciales:');
  console.log(contextLines(text, 1, 45));
  if (propIdx >= 0) {
    console.log(`\nContexto de ${targetProp}:`);
    console.log(contextLines(text, lineNo(text, propIdx), 6));
  }
} else {
  console.log('\n[1] NO existe src/app/api/orders/[orderId]/route.ts en esta carpeta.');
}

console.log('\n[2] Definiciones reales de BusinessComplexitySettings encontradas');
const typeBlocks = [];
for (const file of files) {
  const text = read(file);
  typeBlocks.push(...extractTypeBlocks(file, text));
}
if (typeBlocks.length === 0) {
  console.log('❌ No encontré ninguna definición de BusinessComplexitySettings en src/.');
} else {
  for (const b of typeBlocks) {
    const props = listInternalProps(b.block);
    console.log(`\n- ${rel(b.file)}:${b.line}`);
    console.log(`  Tiene ${targetProp} como propiedad real: ${propExistsAsMember(b.block, targetProp) ? 'SÍ' : 'NO'}`);
    console.log(`  Permisos internal declarados (${props.length}): ${props.length ? props.join(', ') : '(ninguno)'}`);
    const propLine = b.block.split(/\r?\n/).find((l) => l.includes(targetProp));
    if (propLine) console.log(`  Línea que contiene ${targetProp}: ${propLine.trim()}`);
  }
}

console.log('\n[3] Definiciones/exports de getBusinessComplexityPermissions');
let foundFn = false;
for (const file of files) {
  const text = read(file);
  if (!text.includes(targetFn)) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(targetFn)) {
      foundFn = true;
      const trimmed = line.trim();
      if (/function|const|export|import|return|await/.test(trimmed)) {
        console.log(`- ${rel(file)}:${i + 1}: ${trimmed}`);
      }
    }
  });
}
if (!foundFn) console.log('❌ No encontré getBusinessComplexityPermissions en src/.');

console.log('\n[4] Imports de BusinessComplexitySettings');
let foundImportType = false;
for (const file of files) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(targetType) && /^\s*import/.test(line)) {
      foundImportType = true;
      console.log(`- ${rel(file)}:${i + 1}: ${line.trim()}`);
    }
  });
}
if (!foundImportType) console.log('No encontré imports directos de BusinessComplexitySettings. Puede estar en el mismo archivo o reexportado.');

console.log(`\n[5] Todas las apariciones de ${targetProp}`);
let foundProp = false;
for (const file of files) {
  const text = read(file);
  if (!text.includes(targetProp)) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(targetProp)) {
      foundProp = true;
      console.log(`- ${rel(file)}:${i + 1}: ${line.trim()}`);
    }
  });
}
if (!foundProp) console.log(`❌ No encontré ${targetProp} en src/.`);

console.log('\n[6] Permisos permissions.internal... usados en código');
const used = new Set();
const usedDetails = [];
const useRe = /\b(?:permissions|complexityPermissions)\.(internal[A-Za-z0-9_]+)/g;
for (const file of files) {
  const text = read(file);
  let m;
  while ((m = useRe.exec(text))) {
    used.add(m[1]);
    usedDetails.push({ prop: m[1], file, line: lineNo(text, m.index) });
  }
}
for (const prop of [...used].sort()) {
  const hits = usedDetails.filter((h) => h.prop === prop).map((h) => `${rel(h.file)}:${h.line}`).slice(0, 5).join(', ');
  console.log(`- ${prop}: ${hits}`);
}
if (used.size === 0) console.log('No encontré permissions.internal... en src/.');

const allDeclared = new Set();
for (const b of typeBlocks) {
  for (const prop of listInternalProps(b.block)) allDeclared.add(prop);
}
const missing = [...used].filter((p) => !allDeclared.has(p)).sort();
console.log('\n[7] Comparación permisos usados vs declarados en BusinessComplexitySettings');
if (missing.length === 0) {
  console.log('✅ No hay permisos internal usados sin declarar según este diagnóstico.');
} else {
  console.log('❌ Faltan en el tipo:', missing.join(', '));
}

console.log('\n[8] Próximo paso recomendado');
console.log('Copia y pega esta salida completa. Si TypeScript sigue fallando aunque aquí salga OK, hay que revisar el tipo de retorno exacto de getBusinessComplexityPermissions y el módulo que importa route.ts.');
console.log('='.repeat(90));
