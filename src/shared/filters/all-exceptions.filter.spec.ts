import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(): { host: ArgumentsHost; res: { statusCode: number | null; body: any } } {
  const captured = { statusCode: null as number | null, body: null as any };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: any) {
      captured.body = body;
      return this;
    },
  };
  const req = { url: '/api/v1/test', method: 'POST' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, res: captured };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('passes through a 503 HttpException message (regression: prior behaviour clobbered to generic)', () => {
    const friendlyMsg =
      'Payouts are not yet enabled for this DayOnes account. The DayOnes team needs to activate Stripe Connect before artists can onboard. Please contact support.';
    const { host, res } = buildHost();

    filter.catch(new HttpException(friendlyMsg, HttpStatus.SERVICE_UNAVAILABLE), host);

    expect(res.statusCode).toBe(503);
    expect(res.body.message).toBe(friendlyMsg);
  });

  it('passes through a 502 HttpException message (BadGateway with detail)', () => {
    const { host, res } = buildHost();
    filter.catch(
      new HttpException('Printful order creation failed: rate limited', HttpStatus.BAD_GATEWAY),
      host,
    );
    expect(res.statusCode).toBe(502);
    expect(res.body.message).toMatch(/rate limited/);
  });

  it('masks generic non-HttpException 500 errors with friendly text', () => {
    const { host, res } = buildHost();
    filter.catch(new Error('Database connection refused'), host);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Something went wrong. Please try again.');
  });

  it('passes through HttpException 500 messages (explicit signal vs unhandled crash)', () => {
    const { host, res } = buildHost();
    filter.catch(
      new HttpException('Webhook not configured', HttpStatus.INTERNAL_SERVER_ERROR),
      host,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Webhook not configured');
  });

  it('formats validation 422 with errors._form array', () => {
    const { host, res } = buildHost();
    filter.catch(
      new HttpException({ message: ['Email is required', 'Password must be longer'] }, HttpStatus.UNPROCESSABLE_ENTITY),
      host,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors._form).toEqual(['Email is required', 'Password must be longer']);
  });

  it('passes through 4xx messages', () => {
    const { host, res } = buildHost();
    filter.catch(new HttpException('Order not found', HttpStatus.NOT_FOUND), host);
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Order not found');
  });
});
