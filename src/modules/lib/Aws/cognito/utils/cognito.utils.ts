import * as crypto from 'crypto';

// Helper function to compute SECRET_HASH
/**
 * Service to compute hash on the basis of cognito client secret
 * @param data
 * @returns {String}
 */
export const computeSecretHash = (data: string): string => {
  const hmac = crypto.createHmac(
    'sha256',
    process.env.COGNITO_CLIENT_SECRET || '',
  );
  hmac.update(data + process.env.COGNITO_CLIENT_ID);
  return hmac.digest('base64');
};
