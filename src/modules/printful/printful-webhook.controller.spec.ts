import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { PrintfulWebhookController } from './printful-webhook.controller';
import { PrintfulWebhookService } from './printful-webhook.service';
import { WebhookDedupService } from '@app/shared/services/webhook-dedup.service';

type MockRes = {
  status: jest.Mock;
  json: jest.Mock;
};

function buildMockRes(): MockRes {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PrintfulWebhookController', () => {
  let controller: PrintfulWebhookController;
  let webhookService: { handleEvent: jest.Mock };
  let dedup: { claim: jest.Mock };
  const SECRET = 'test-secret-d8f096dfd4a3b219754bf0f55b18788e';
  const STORE_ID = '17777137';
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    webhookService = { handleEvent: jest.fn().mockResolvedValue(undefined) };
    dedup = { claim: jest.fn().mockResolvedValue(true) };

    process.env.PRINTFUL_WEBHOOK_SECRET = SECRET;
    process.env.PRINTFUL_STORE_ID = STORE_ID;
    process.env.NODE_ENV = 'production';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrintfulWebhookController],
      providers: [
        { provide: PrintfulWebhookService, useValue: webhookService },
        { provide: WebhookDedupService, useValue: dedup },
      ],
    }).compile();

    controller = module.get<PrintfulWebhookController>(PrintfulWebhookController);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  function buildReq(opts: {
    body: any;
    signature?: string;
    sharedSecret?: string;
    rawBody?: Buffer;
  }): any {
    const headers: Record<string, string> = {};
    if (opts.signature) headers['x-pf-webhook-signature'] = opts.signature;
    if (opts.sharedSecret) headers['x-printful-webhook-secret'] = opts.sharedSecret;
    return { body: opts.body, headers, rawBody: opts.rawBody };
  }

  it('accepts webhook with valid HMAC signature', async () => {
    const body = { type: 'shipment_sent', store: Number(STORE_ID), data: { order: { id: 1 } } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const sig = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const req = buildReq({ body, signature: sig, rawBody });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(webhookService.handleEvent).toHaveBeenCalledWith('shipment_sent', body.data);
  });

  it('rejects webhook with tampered HMAC signature', async () => {
    const body = { type: 'shipment_sent', store: Number(STORE_ID), data: { order: { id: 1 } } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const validSig = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const tamperedSig = validSig.slice(0, -2) + 'ff';
    const req = buildReq({ body, signature: tamperedSig, rawBody });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(webhookService.handleEvent).not.toHaveBeenCalled();
  });

  it('accepts unsigned webhook when payload store matches PRINTFUL_STORE_ID', async () => {
    const body = { type: 'order_created', store: Number(STORE_ID), data: { order: { id: 2 } } };
    const req = buildReq({ body });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(webhookService.handleEvent).toHaveBeenCalledWith('order_created', body.data);
  });

  it('rejects unsigned webhook when payload store does NOT match PRINTFUL_STORE_ID', async () => {
    const body = { type: 'order_created', store: 99999999, data: { order: { id: 3 } } };
    const req = buildReq({ body });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(webhookService.handleEvent).not.toHaveBeenCalled();
  });

  it('returns 200 + deduped flag for already-processed event', async () => {
    dedup.claim.mockResolvedValueOnce(false);
    const body = { type: 'shipment_sent', store: Number(STORE_ID), data: { order: { id: 42 } } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const sig = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const req = buildReq({ body, signature: sig, rawBody });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ deduped: true }));
    expect(webhookService.handleEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when type is missing', async () => {
    const body = { data: {} };
    const rawBody = Buffer.from(JSON.stringify(body));
    const sig = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const req = buildReq({ body, signature: sig, rawBody });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects in production when no signature header AND store_id mismatch', async () => {
    const body = { type: 'order_created', store: 11111111, data: { order: { id: 4 } } };
    const req = buildReq({ body });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('500 in production when PRINTFUL_WEBHOOK_SECRET is missing', async () => {
    delete process.env.PRINTFUL_WEBHOOK_SECRET;
    const body = { type: 'order_created', store: Number(STORE_ID), data: { order: { id: 5 } } };
    const req = buildReq({ body });
    const res = buildMockRes();

    await controller.handleWebhook(req, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
