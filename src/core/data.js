/*
 * Data — loads the game's content files (chapters, story beats, level
 * definitions) once at boot. Content is data, not code: adding a level
 * means adding a JSON file, which keeps the pipeline vibe-codeable and
 * portable to any future engine.
 */
export const Data = {
  chapters: null,   // data/chapters.json
  story: {},        // id -> { lines: [...] }
  levels: {},       // id -> level definition

  async loadAll() {
    this.chapters = await fetchJson('data/chapters.json');

    const storyIds = new Set(['prologue']);
    const levelIds = [];
    for (const ch of Object.values(this.chapters.chapters)) {
      if (ch.story) storyIds.add(ch.story);
      for (const id of ch.levels) levelIds.push(id);
    }
    await Promise.all([
      ...[...storyIds].map(async id => { this.story[id] = await fetchJson(`data/story/${id}.json`); }),
      ...levelIds.map(async id => { this.levels[id] = await fetchJson(`data/levels/${id}.json`); }),
    ]);
  },
};

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
  return res.json();
}
