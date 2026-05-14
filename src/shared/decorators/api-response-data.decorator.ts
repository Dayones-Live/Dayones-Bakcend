import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { GlobalServiceResponse } from '@app/shared/types/types';

/**
 * Decorator that advertises a typed `{message, data: T}` envelope on an endpoint.
 *
 * Usage:
 *   @ApiOkResponseData(UserProfileDto)
 *   @Get('me')
 *   async getMe() { ... }
 *
 * The generated OpenAPI schema becomes:
 *   { allOf: [
 *       { $ref: '#/components/schemas/GlobalServiceResponse' },
 *       { properties: { data: { $ref: '#/components/schemas/UserProfileDto' } } }
 *   ] }
 */
export const ApiOkResponseData = <T extends Type<unknown>>(
  model: T,
  options: { description?: string; isArray?: boolean } = {},
) => {
  const dataSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(GlobalServiceResponse, model),
    ApiOkResponse({
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(GlobalServiceResponse) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
};

/**
 * Same as ApiOkResponseData but for endpoints where `data` is a primitive (string/number/boolean)
 * or has no real shape (e.g., delete endpoints that return `data: { id: string }`).
 */
export const ApiOkResponseEnvelope = (
  options: { description?: string; data?: Record<string, unknown> } = {},
) =>
  applyDecorators(
    ApiExtraModels(GlobalServiceResponse),
    ApiOkResponse({
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(GlobalServiceResponse) },
          ...(options.data
            ? [{ properties: { data: { type: 'object', properties: options.data } } }]
            : []),
        ],
      },
    }),
  );
