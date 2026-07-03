import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

test('flow: builds the node spine from the real chapters.json', async () => {
  const { Flow } = await import('../../src/core/flow.js');
  const { Data } = await import('../../src/core/data.js');
  Data.chapters = JSON.parse(fs.readFileSync(new URL('../../data/chapters.json', import.meta.url)));

  Flow.build();
  const types = Flow.nodes.map(n => n.type);

  // prologue -> its story -> calm (story + 3 levels + unlock)
  //          -> hope (story + 3 levels + unlock) -> end
  assert.deepEqual(types, [
    'prologue', 'story',
    'story', 'level', 'level', 'level', 'unlock',
    'story', 'level', 'level', 'level', 'unlock',
    'end',
  ]);

  const hopeLevels = Flow.nodes.filter(n => n.type === 'level' && n.chapter === 'hope');
  assert.deepEqual(hopeLevels.map(n => n.index), [0, 1, 2]);

  // advancing from the last calm level lands on the calm unlock
  const lastCalm = Flow.indexOf({ type: 'level', chapter: 'calm', index: 2 });
  assert.deepEqual(Flow.nodes[lastCalm + 1], { type: 'unlock', chapter: 'calm' });

  // the end node is terminal: advancing clamps rather than overflowing
  const endIdx = Flow.indexOf({ type: 'end' });
  assert.equal(endIdx, Flow.nodes.length - 1);

  // every level id referenced by the flow has a definition file
  for (const node of Flow.nodes.filter(n => n.type === 'level')) {
    const id = Data.chapters.chapters[node.chapter].levels[node.index];
    assert.ok(fs.existsSync(new URL(`../../data/levels/${id}.json`, import.meta.url)), `missing level file ${id}`);
  }
});
