import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('reconcile-live parseArgs', () => {
  it('resolves both positionals with no flags', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.stackId).toBe('blt123');
    expect(r.jsonOut).toBeNull();
    expect(r.ctPath).toBeNull();
  });

  it('resolves both positionals with only --json present', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123', '--json', 'out.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.stackId).toBe('blt123');
    expect(r.jsonOut).toBe('out.json');
    expect(r.ctPath).toBeNull();
  });

  it('resolves both positionals with only --content-types present', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123', '--content-types', 'ct.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.stackId).toBe('blt123');
    expect(r.jsonOut).toBeNull();
    expect(r.ctPath).toBe('ct.json');
  });

  it('resolves both positionals with both flags present, regardless of order', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123', '--content-types', 'ct.json', '--json', 'out.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.stackId).toBe('blt123');
    expect(r.jsonOut).toBe('out.json');
    expect(r.ctPath).toBe('ct.json');
  });

  it('defaults projectId/iteration to null when not passed (manual CLI usage)', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123']);
    expect(r.projectId).toBeNull();
    expect(r.iteration).toBeNull();
  });

  it('parses an explicit --project-id/--iteration override (automated caller, e.g. runCli.service.ts)', async () => {
    const { parseArgs } = await import('../../../scripts/reconcile-live.js');
    const r = parseArgs(['source.impex', 'blt123', '--project-id', 'proj1', '--iteration', '2', '--json', 'out.json']);
    expect(r.projectId).toBe('proj1');
    expect(r.iteration).toBe(2);
    expect(r.jsonOut).toBe('out.json');
  });
});

/**
 * Regression tests for mergeBatchFiles — the adapter that lets a LIVE
 * Contentstack export (which writes one or more `<random-id>-<suffix>.json`
 * batch files per folder) be merged before its uids get translated, exactly
 * like runCli.service.ts's readMappedEntryUids merges the SAME kind of
 * CLI-written batch files for a different (but structurally identical)
 * reason.
 */
describe('reconcile-live mergeBatchFiles', () => {
  const dir = path.join(process.cwd(), 'tests', '.tmp-merge-batch-files');

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('merges multiple batch files sharing the same suffix into one object', async () => {
    const { mergeBatchFiles } = await import('../../../scripts/reconcile-live.js');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'aaa-entries.json'), JSON.stringify({ blt1: { title: 'One' } }));
    fs.writeFileSync(path.join(dir, 'bbb-entries.json'), JSON.stringify({ blt2: { title: 'Two' } }));
    fs.writeFileSync(path.join(dir, 'unrelated.json'), JSON.stringify({ blt3: { title: 'Ignored' } }));

    const merged = mergeBatchFiles(dir, '-entries.json');

    expect(merged).toEqual({ blt1: { title: 'One' }, blt2: { title: 'Two' } });
  });

  it('returns an empty object when the directory has no matching batch files', async () => {
    const { mergeBatchFiles } = await import('../../../scripts/reconcile-live.js');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'unrelated.json'), '{}');

    expect(mergeBatchFiles(dir, '-entries.json')).toEqual({});
  });

  it('returns an empty object without throwing when the directory does not exist at all', async () => {
    const { mergeBatchFiles } = await import('../../../scripts/reconcile-live.js');
    expect(mergeBatchFiles(path.join(dir, 'nope'), '-entries.json')).toEqual({});
  });

  it('skips a corrupt batch file rather than failing the whole merge', async () => {
    const { mergeBatchFiles } = await import('../../../scripts/reconcile-live.js');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'good-entries.json'), JSON.stringify({ blt1: { title: 'Good' } }));
    fs.writeFileSync(path.join(dir, 'bad-entries.json'), '{ not valid json');

    expect(mergeBatchFiles(dir, '-entries.json')).toEqual({ blt1: { title: 'Good' } });
  });
});

/**
 * Regression test for a real bug caught mid-build: uid-mapper.utils.ts
 * writes {ourSourceUid: realContentstackUid}, but translating a LIVE export
 * back onto our own uids needs the OPPOSITE direction. Looking the real uid
 * up directly in that map (instead of inverting it first) silently returned
 * undefined for every single entry — confirmed live against a real export,
 * where it made every source row look "missing" and every real entry look
 * "extra" despite the migration being genuinely correct.
 */
describe('reconcile-live invertMap', () => {
  it('flips a {source: dest} map into {dest: source}', async () => {
    const { invertMap } = await import('../../../scripts/reconcile-live.js');
    expect(invertMap({ blt1: 'bltReal1', blt2: 'bltReal2' })).toEqual({
      bltReal1: 'blt1',
      bltReal2: 'blt2',
    });
  });

  it('returns an empty object for an empty map', async () => {
    const { invertMap } = await import('../../../scripts/reconcile-live.js');
    expect(invertMap({})).toEqual({});
  });
});

/**
 * Regression tests for resolveProjectForStack — the lookup that translates a
 * bare stack id into the project whose migration history holds the uid
 * translation map this whole script depends on (see the module-level comment
 * in reconcile-live.ts on why that translation is necessary at all: a real
 * Contentstack import assigns entries/assets NEW uids of its own, completely
 * unrelated to the ones our connector computed for them).
 */
describe('reconcile-live resolveProjectForStack', () => {
  const projects = [
    { id: 'proj-a', destination_stack_id: 'blt-final-a', current_test_stack_id: 'blt-test-a', iteration: 2 },
    { id: 'proj-b', destination_stack_id: 'blt-final-b', current_test_stack_id: '', iteration: 1 },
  ];

  vi.doMock('../../../src/models/project-lowdb.js', () => ({
    default: {
      read: vi.fn().mockResolvedValue(undefined),
      chain: {
        get: () => ({
          find: (predicate: (p: any) => boolean) => ({
            value: () => projects.find(predicate),
          }),
        }),
      },
    },
  }));

  it('resolves by the FINAL (destination) stack id', async () => {
    vi.resetModules();
    const { resolveProjectForStack } = await import('../../../scripts/reconcile-live.js');
    await expect(resolveProjectForStack('blt-final-a')).resolves.toEqual({ projectId: 'proj-a', iteration: 2 });
  });

  it('resolves by the TEST stack id too', async () => {
    vi.resetModules();
    const { resolveProjectForStack } = await import('../../../scripts/reconcile-live.js');
    await expect(resolveProjectForStack('blt-test-a')).resolves.toEqual({ projectId: 'proj-a', iteration: 2 });
  });

  it('defaults to iteration 1 when the project has never recorded one', async () => {
    vi.resetModules();
    const { resolveProjectForStack } = await import('../../../scripts/reconcile-live.js');
    await expect(resolveProjectForStack('blt-final-b')).resolves.toEqual({ projectId: 'proj-b', iteration: 1 });
  });

  it('throws a clear error when no project matches the given stack id', async () => {
    vi.resetModules();
    const { resolveProjectForStack } = await import('../../../scripts/reconcile-live.js');
    await expect(resolveProjectForStack('blt-does-not-exist')).rejects.toThrow(/No project found/);
  });
});
