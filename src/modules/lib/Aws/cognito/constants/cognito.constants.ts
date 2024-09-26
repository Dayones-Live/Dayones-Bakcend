import { CognitoJwtVerifier } from 'aws-jwt-verify';

export const cognitoJwtVerify = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_POOL_ID || '', // Your User Pool ID
  tokenUse: 'access', // or 'id' based on your use case
  clientId: process.env.COGNITO_CLIENT_ID, // Your Client ID
  issuer: process.env.COGNITO_ISSUER_URL, // Expected issuer
  // Add additional options if needed
});
