import { Logger } from '@nestjs/common';

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'identity_token',
  'authorization',
  'secret',
  'api_key',
  'apikey',
  'private_key',
  'cookie',
  'otp',
  'code',
  'card',
  'cvv',
  'ssn',
];

export function redactSensitive(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(redactSensitive);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((k) => lower.includes(k))) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = redactSensitive(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export class SafeLogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  log(message: string, data?: unknown): void {
    this.logger.log(this.format(message, data));
  }

  warn(message: string, data?: unknown): void {
    this.logger.warn(this.format(message, data));
  }

  error(message: string, error?: unknown, data?: unknown): void {
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(this.format(message, data), stack);
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'production') return;
    this.logger.debug(this.format(message, data));
  }

  private format(message: string, data?: unknown): string {
    if (data === undefined) return message;
    try {
      return `${message} ${JSON.stringify(redactSensitive(data))}`;
    } catch {
      return message;
    }
  }
}
