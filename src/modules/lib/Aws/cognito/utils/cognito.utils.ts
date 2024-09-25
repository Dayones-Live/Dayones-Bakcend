import { CognitoJwtVerifier } from 'aws-jwt-verify';
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

export const cognitoJwtVerify = () => {
  return CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_POOL_ID || '', // Your User Pool ID
    tokenUse: 'access', // or 'id' based on your use case
    clientId: process.env.COGNITO_CLIENT_ID, // Your Client ID
    issuer: process.env.COGNITO_ISSUER_URL, // Expected issuer
    // Add additional options if needed
  });
};
