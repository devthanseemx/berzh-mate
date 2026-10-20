// One-shot patch: adds the floating <BackButton /> to every pushed screen
// (the Stack no longer renders a header) and bumps content top padding so
// content clears the button.
const fs = require('fs');

const patches = [
  {
    file: 'src/app/navigate.tsx',
    rel: '../',
    anchor: "<View style={styles.root}>",
  },
  {
    file: 'src/app/meter/estimate.tsx',
    rel: '../../',
    anchor: "<View style={styles.root}>",
    also: [
      ['top: { position: \'absolute\', left: 12, right: 12 }', "top: { position: 'absolute', left: 64, right: 12 }"],
    ],
  },
  { file: 'src/app/account.tsx', rel: '../', anchor: '<SafeAreaView style={styles.safe}>',
    also: [['content: { padding: 20, gap: 4 }', 'content: { padding: 20, paddingTop: 64, gap: 4 }']] },
  { file: 'src/app/usage.tsx', rel: '../', anchor: '<SafeAreaView style={styles.safe}>',
    also: [['content: { padding: 20, gap: 14 }', 'content: { padding: 20, paddingTop: 64, gap: 14 }']] },
  { file: 'src/app/meter/history.tsx', rel: '../../', anchor: '<SafeAreaView style={styles.safe}>',
    also: [['content: { padding: 20, gap: 10 }', 'content: { padding: 20, paddingTop: 64, gap: 10 }']] },
  { file: 'src/app/meter/rates.tsx', rel: '../../', anchor: '<SafeAreaView style={styles.safe}>',
    also: [['content: { padding: 20, gap: 10 }', 'content: { padding: 20, paddingTop: 64, gap: 10 }']] },
  { file: 'src/app/meter/[id].tsx', rel: '../../', anchor: '<SafeAreaView style={styles.safe} edges={[\'bottom\']}>', all: true },
  { file: 'src/app/join/[token].tsx', rel: '../../', anchor: '<SafeAreaView style={styles.safe}>' },
  { file: 'src/app/groups/[id].tsx', rel: '../../', anchor: '<SafeAreaView style={styles.safe}>', all: true,
    also: [['content: { padding: 20, gap: 14, paddingBottom: 40 }', 'content: { padding: 20, paddingTop: 64, gap: 14, paddingBottom: 40 }']] },
  { file: 'src/app/groups/live/[id].tsx', rel: '../../../', anchor: '<SafeAreaView style={styles.safe} edges={[\'bottom\']}>' },
];

for (const p of patches) {
  let src = fs.readFileSync(p.file, 'utf8');
  if (src.includes('components/BackButton')) {
    console.log('skip (already patched):', p.file);
    continue;
  }
  const importLine = `import { BackButton } from '${p.rel}components/BackButton';`;
  // Insert import after the theme/colors import (present in every target file).
  const themeRe = new RegExp(`^import \{[^}]*\} from '${p.rel.replace(/\//g, '\\/')}theme/colors';$`, 'm');
  const m = src.match(themeRe);
  if (!m) throw new Error('import anchor missing in ' + p.file);
  src = src.replace(themeRe, m[0] + '\n' + importLine);

  // Insert usage after the root element.
  const usage = p.all
    ? p.anchor
    : p.anchor;
  if (!src.includes(usage)) throw new Error('root anchor missing in ' + p.file);
  src = src.split(usage).join(usage + '\n      <BackButton />');

  for (const [a, b] of p.also || []) {
    if (!src.includes(a)) throw new Error(`style anchor missing in ${p.file}: ${a}`);
    src = src.replace(a, b);
  }
  fs.writeFileSync(p.file, src);
  console.log('patched:', p.file);
}
