import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Regression tests for making reconciliation automatic instead of opt-in:
 * previously `/reconcile` only ran if someone remembered to invoke it, so a
 * genuine silent import bug could go undetected for an entire migration.
 * triggerPostMigrationReconciliation now fires automatically once a SAP
 * SmartEdit migration completes. These tests pin: (1) it reads the report
 * file itself to decide success/failure, NOT the subprocess's exit code
 * (reconcile-live.ts legitimately exits non-zero on real findings, which is
 * a completed run, not a crash); (2) it never throws, so a reconciliation
 * bug can never be mistaken for the migration itself failing; (3) runCli
 * does not await it, so a slow reconciliation never delays runCli's own
 * return; (4) it only fires for SAP SmartEdit projects.
 */
const {
  mockSpawn,
  mockAppendFileSync,
  mockReadFileSync,
  mockAuthRead,
  mockAuthChainGet,
  mockSetLogFilePath,
  mockSetOAuthConfig,
  mockSetBasicAuthConfig,
  mockCopyDirectory,
  mockCreateDirectoryAndFile,
  mockProjectRead,
  mockProjectChainGet,
  mockProjectWrite,
  mockWriteUidMapping,
  mockWritePerLocaleEntryUidMapping,
  mockExistsSync,
  mockWriteReconciliationWorkbook,
} = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockAuthRead: vi.fn(),
  mockAuthChainGet: vi.fn(),
  mockSetLogFilePath: vi.fn(),
  mockSetOAuthConfig: vi.fn(),
  mockSetBasicAuthConfig: vi.fn(),
  mockCopyDirectory: vi.fn(),
  mockCreateDirectoryAndFile: vi.fn(),
  mockProjectRead: vi.fn(),
  mockProjectChainGet: vi.fn(),
  mockProjectWrite: vi.fn(),
  mockWriteUidMapping: vi.fn(),
  mockWritePerLocaleEntryUidMapping: vi.fn(),
  mockExistsSync: vi.fn(),
  // Real xlsx generation is covered separately (reconciliation-xlsx.utils.test.ts)
  // against real fs/exceljs — the blanket `fs` mock below only stubs the handful
  // of methods this file itself needs, and would silently break exceljs's own
  // file writing (masking whether the WIRING below is correct), so it's mocked
  // directly here instead.
  mockWriteReconciliationWorkbook: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs', () => ({
  default: {
    appendFileSync: mockAppendFileSync,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: mockExistsSync,
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isDirectory: () => false })),
    readFileSync: mockReadFileSync,
  },
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: mockExistsSync,
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  readFileSync: mockReadFileSync,
}));

vi.mock('../../../src/utils/index.js', () => ({
  copyDirectory: mockCopyDirectory,
  createDirectoryAndFile: mockCreateDirectoryAndFile,
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: { get: mockAuthChainGet },
  },
}));

// projects array is a real array so index-based writes in the source (e.g.
// ProjectModelLowdb.data.projects[idx].reconciliation = ...) are directly observable.
let projectsData: any[] = [];

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockProjectChainGet },
    get data() {
      return { projects: projectsData };
    },
    write: mockProjectWrite,
  },
}));

vi.mock('../../../src/server.js', () => ({
  setLogFilePath: mockSetLogFilePath,
}));

vi.mock('../../../src/utils/config-handler.util.js', () => ({
  setOAuthConfig: mockSetOAuthConfig,
  setBasicAuthConfig: mockSetBasicAuthConfig,
}));

vi.mock('../../../src/utils/uid-mapper.utils.js', () => ({
  default: mockWriteUidMapping,
  writePerLocaleEntryUidMapping: mockWritePerLocaleEntryUidMapping,
}));

vi.mock('../../../src/utils/reconciliation-xlsx.utils.js', () => ({
  writeReconciliationWorkbook: mockWriteReconciliationWorkbook,
}));

import { triggerPostMigrationReconciliation, utilsCli } from '../../../src/services/runCli.service.js';

const makeChild = (exitCode: number | null = 0, neverCloses = false) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  if (!neverCloses) queueMicrotask(() => child.emit('close', exitCode));
  return child;
};

const setUser = (user: any) => {
  mockAuthChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(user) }),
  });
};

const setProjectByIndex = (project: any) => {
  projectsData = [project];
  mockProjectChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(project) }),
    findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  projectsData = [];
  mockProjectRead.mockResolvedValue(undefined);
  mockProjectWrite.mockResolvedValue(undefined);
  mockWriteReconciliationWorkbook.mockResolvedValue(undefined);
});

describe('triggerPostMigrationReconciliation', () => {
  it('marks reconciliation completed with the report summary even when the subprocess exits non-zero (real findings, not a crash)', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(1)); // reconcile-live.ts exits 1 on critical/error findings
    mockReadFileSync.mockReturnValue(JSON.stringify({ summary: { critical: 1, error: 2, warning: 3 } }));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    expect(projectsData[0].reconciliation).toMatchObject({
      status: 'completed',
      summary: { critical: 1, error: 2, warning: 3 },
    });
  });

  it('marks reconciliation completed (clean) when the subprocess exits 0 and the report shows no findings', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0));
    mockReadFileSync.mockReturnValue(JSON.stringify({ summary: { critical: 0, error: 0, warning: 0 } }));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    expect(projectsData[0].reconciliation).toMatchObject({
      status: 'completed',
      summary: { critical: 0, error: 0, warning: 0 },
    });
  });

  it('marks reconciliation failed when no readable report file is produced, regardless of exit code', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0)); // "succeeds" per exit code, but never wrote a report
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    expect(projectsData[0].reconciliation).toMatchObject({ status: 'failed' });
  });

  it('never throws even when the reconcile-live subprocess itself cannot be spawned', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(
      triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log')
    ).resolves.toBeUndefined();
    expect(projectsData[0].reconciliation?.status).toBe('failed');
  });

  it('eventually settles as failed instead of leaving reconciliation stuck at "running" forever when reconcile-live hangs', async () => {
    // Real bug: the runCommand call for reconcile-live.ts had no timeout, unlike the
    // entries-retry loop's call to the same function. A hung live export/diff meant this
    // promise never settled, so the "running" status already written to the project record
    // just above was never corrected — with no watchdog anywhere else to recover it.
    vi.useFakeTimers();
    try {
      setProjectByIndex({ id: 'proj1' });
      mockSpawn.mockImplementation(() => makeChild(0, true)); // never closes — a hung export
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT'); // never wrote a report, since the export never finished
      });

      const promise = triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

      // Flush the 20-minute runCommand timeout so the hung call actually settles.
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
      await promise;

      expect(projectsData[0].reconciliation?.status).toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('records the generated .xlsx path as the report — not the raw JSON — once reconciliation completes', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0));
    const parsed = { summary: { critical: 0, error: 0, warning: 0 } };
    mockReadFileSync.mockReturnValue(JSON.stringify(parsed));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    expect(mockWriteReconciliationWorkbook).toHaveBeenCalledWith(
      parsed,
      { stackId: 'stack1', sourcePath: '/src.impex' },
      expect.stringMatching(/\.xlsx$/)
    );
    expect(projectsData[0].reconciliation.reportPath).toMatch(/\.xlsx$/);
  });

  it('writes the report into a dedicated "Reconcile files" folder, named <stackId>.reconcile.xlsx', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0));
    mockReadFileSync.mockReturnValue(JSON.stringify({ summary: { critical: 0, error: 0, warning: 0 } }));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    const [, , outPath] = mockWriteReconciliationWorkbook.mock.calls[0];
    expect(outPath).toMatch(/Reconcile files[\\/]stack1\.reconcile\.xlsx$/);
    expect(projectsData[0].reconciliation.reportPath).toBe(outPath);
  });

  it('passes --project-id/--iteration to reconcile-live.ts explicitly, instead of letting it search by stack id', async () => {
    // Real production bug: reconcile-live.ts's own resolveProjectForStack searches
    // ALL projects for one whose destination/test stack id matches — and can match
    // the WRONG project when a stale current_test_stack_id from an earlier, abandoned
    // attempt happens to reference the same (reused) stack. Since the caller here
    // already knows exactly which project/iteration this is, it must hand that over
    // explicitly rather than let the script re-derive it.
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0));
    mockReadFileSync.mockReturnValue(JSON.stringify({ summary: { critical: 0, error: 0, warning: 0 } }));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log', 3);

    const reconcileCall = mockSpawn.mock.calls.find(
      ([, args]) => Array.isArray(args) && args.some((a) => String(a).includes('reconcile-live'))
    );
    expect(reconcileCall).toBeDefined();
    const args = reconcileCall![1] as string[];
    expect(args).toContain('--project-id');
    expect(args[args.indexOf('--project-id') + 1]).toBe('proj1');
    expect(args).toContain('--iteration');
    expect(args[args.indexOf('--iteration') + 1]).toBe('3');
  });

  it('falls back to the JSON report path if Excel generation itself fails, without losing the reconciliation result', async () => {
    setProjectByIndex({ id: 'proj1' });
    mockSpawn.mockImplementation(() => makeChild(0));
    mockReadFileSync.mockReturnValue(JSON.stringify({ summary: { critical: 2, error: 0, warning: 0 } }));
    mockWriteReconciliationWorkbook.mockRejectedValue(new Error('disk full'));

    await triggerPostMigrationReconciliation('proj1', 'stack1', '/src.impex', '/tmp/log.log');

    expect(projectsData[0].reconciliation).toMatchObject({
      status: 'completed',
      summary: { critical: 2, error: 0, warning: 0 },
    });
    expect(projectsData[0].reconciliation.reportPath).toMatch(/\.json$/);
  });
});

describe('runCli — reconciliation trigger integration', () => {
  beforeEach(() => {
    mockAuthRead.mockResolvedValue(undefined);
    mockSetLogFilePath.mockResolvedValue(undefined);
    mockCopyDirectory.mockResolvedValue(undefined);
    mockCreateDirectoryAndFile.mockResolvedValue(undefined);
    setUser({ email: 'u@x.com', authtoken: 'tok', region: 'NA', user_id: 'u1' });
    mockExistsSync.mockReturnValue(false); // no entries dir -> findIncompleteLocalePairs is a no-op
  });

  it('does not delay its own return waiting for reconciliation, even if reconciliation hangs', async () => {
    setProjectByIndex({
      id: 'proj1',
      legacy_cms: { cms: 'sap-smartedit', file_path: '/src.impex' },
    });
    let reconcileSpawnedAndHanging = false;
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (Array.isArray(args) && args.some((a) => String(a).includes('reconcile-live'))) {
        reconcileSpawnedAndHanging = true;
        return makeChild(0, true); // never closes — simulates a slow/hung reconciliation
      }
      return makeChild(0);
    });

    await expect(
      utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log'),
    ).resolves.toBeUndefined();

    expect(reconcileSpawnedAndHanging).toBe(true);
  });

  it("passes the project's own iteration through to reconcile-live.ts, not a hardcoded default", async () => {
    setProjectByIndex({
      id: 'proj1',
      iteration: 4,
      legacy_cms: { cms: 'sap-smartedit', file_path: '/src.impex' },
    });
    let reconcileArgs: string[] | undefined;
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (Array.isArray(args) && args.some((a) => String(a).includes('reconcile-live'))) {
        reconcileArgs = args;
      }
      return makeChild(0);
    });

    await utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log');
    // The trigger is fire-and-forget (runCli does not await it) — give its own pending
    // awaits (ProjectModelLowdb.read/write, etc.) a chance to reach the spawn call.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(reconcileArgs).toBeDefined();
    expect(reconcileArgs![reconcileArgs!.indexOf('--iteration') + 1]).toBe('4');
  });

  it('does not fire reconciliation for non-SAP-SmartEdit projects', async () => {
    setProjectByIndex({
      id: 'proj1',
      legacy_cms: { cms: 'wordpress', file_path: '/src.xml' },
    });
    mockSpawn.mockImplementation(() => makeChild(0));

    await utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log');

    const reconcileCalls = mockSpawn.mock.calls.filter(([, args]) =>
      Array.isArray(args) && args.some((a: any) => String(a).includes('reconcile-live')),
    );
    expect(reconcileCalls).toHaveLength(0);
  });
});
