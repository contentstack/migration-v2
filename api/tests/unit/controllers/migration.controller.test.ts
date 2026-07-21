import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMigrationService } = vi.hoisted(() => ({
  mockMigrationService: {
    createTestStack: vi.fn(),
    deleteTestStack: vi.fn(),
    startTestMigration: vi.fn(),
    startMigration: vi.fn(),
    getLogs: vi.fn(),
    createSourceLocales: vi.fn(),
    updateLocaleMapper: vi.fn(),
    getAuditData: vi.fn(),
  },
}));

vi.mock('../../../src/services/migration.service.js', () => ({
  migrationService: mockMigrationService,
}));

import { migrationController } from '../../../src/controllers/migration.controller.js';

describe('migration.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: { projectId: 'proj-123' }, body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('createTestStack should return awaited service response', async () => {
    mockMigrationService.createTestStack.mockResolvedValue({ status: 200, data: { stack: {} } });

    await migrationController.createTestStack(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getAuditData should return awaited service response', async () => {
    mockMigrationService.getAuditData.mockResolvedValue({ status: 200, data: [] });

    await migrationController.getAuditData(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deleteTestStack should return 200', async () => {
    mockMigrationService.deleteTestStack.mockResolvedValue({ ok: true });

    await migrationController.deleteTestStack(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getLogs should return 200', async () => {
    mockMigrationService.getLogs.mockResolvedValue({ logs: [] });

    await migrationController.getLogs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('saveLocales should return 200', async () => {
    mockMigrationService.createSourceLocales.mockResolvedValue({ ok: true });

    await migrationController.saveLocales(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('saveMappedLocales should return 200', async () => {
    mockMigrationService.updateLocaleMapper.mockResolvedValue({ ok: true });

    await migrationController.saveMappedLocales(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  describe('long-running migration handlers', () => {
    it('startTestMigration should await service and send its status/body', async () => {
      const payload = { status: 200, data: { message: 'Test migration completed successfully' } };
      mockMigrationService.startTestMigration.mockResolvedValue(payload);

      await migrationController.startTestMigration(req, res);

      expect(mockMigrationService.startTestMigration).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
    });

    it('startMigration should await service and send its status/body', async () => {
      const payload = { status: 200, data: { message: 'ok' } };
      mockMigrationService.startMigration.mockResolvedValue(payload);

      await migrationController.startMigration(req, res);

      expect(mockMigrationService.startMigration).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
    });
  });
});
