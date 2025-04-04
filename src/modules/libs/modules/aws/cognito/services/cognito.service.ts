import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AdminUpdateUserAttributesCommand,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GetUserAttributeVerificationCodeCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoJwtVerify } from '../constants/cognito.constants';
import { computeSecretHash } from '../utils/cognito.utils';
import { signupUserAttributes } from '../dto/constants';
import {
  ConfirmForgotPasswordInput,
  SignInUserInput,
  UpdatePasswordInput,
  UserSignUpInput,
} from '../dto/types';
import { GlobalServiceResponse } from '@app/shared/types/types';
import { UserService } from '@user/services/user.service';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@app/shared/constants/constants';
import { Roles } from '@app/shared/constants/constants';
import * as crypto from 'crypto';

@Injectable()
export class CognitoService {
  private clientId = process.env.COGNITO_CLIENT_ID; // Replace with your App Client ID
  private cognitoClient;

  constructor(private userService: UserService) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
  }

  /**
   * Service for user signup on the basis of user data
   * @param email
   * @param password
   * @param role
   * @param name
   * @param phone_number
   * @returns {User}
   */
  async signUp(userData: UserSignUpInput): Promise<GlobalServiceResponse> {
    const { email, password, role, name: userFullName, phoneNumber } = userData;

    const params = {
      ClientId: this.clientId || '',
      SecretHash: computeSecretHash(email),
      Username: email,
      Password: password,
      UserAttributes: signupUserAttributes(
        email,
        role,
        userFullName,
        phoneNumber || '',
      ),
    };
    try {
      const command = new SignUpCommand(params);
      const result = await this.cognitoClient.send(command);
      const newUser = await this.userService.createUser({
        name: userFullName,
        email,
        phoneNumber,
        role: role, // Assuming role is of type ROLES
        userSub: result.UserSub || '', // UserSub returned by Cognito
        isConfirmed: false, // Assuming the user is not confirmed immediately
      });
      const { user_sub, ...extractedUserData } = newUser;
      return {
        message: SUCCESS_MESSAGES.USER_SIGNUP_SUCCESS,
        statusCode: 200,
        data: { ...extractedUserData, role: extractedUserData?.role[0] },
      };
    } catch (error) {
      console.error('🚀 ~ CognitoService ~ error:', error);
      throw new HttpException(
        `User Creation Error: ${error.message}`,
        error['$metadata']?.httpStatusCode ||
          error.status ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * This service will confirm the user signup after verifying the code
   * @param username
   * @param confirmationCode
   * @returns {GlobalServiceResponse}
   */
  async confirmSignUp(
    username: string,
    confirmationCode: string,
  ): Promise<GlobalServiceResponse> {
    const params = {
      ClientId: this.clientId || '',
      Username: username,
      SecretHash: computeSecretHash(username),
      ConfirmationCode: confirmationCode,
    };
    try {
      const command = new ConfirmSignUpCommand(params);
      const result = await this.cognitoClient.send(command);
      const paramsForVerifyEmail = {
        UserPoolId: process.env.COGNITO_POOL_ID, // Replace with your user pool ID
        Username: username,
        UserAttributes: [
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
      };
      const commandForVerifyEmail = new AdminUpdateUserAttributesCommand(
        paramsForVerifyEmail,
      );
      await this.cognitoClient.send(commandForVerifyEmail);
      // Check if the response is successful (HTTP 200)
      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: SUCCESS_MESSAGES.USER_CONFIRMATION_CODE_SUCCESS,
          statusCode: result['$metadata'].httpStatusCode,
        };
      }
      // In case of an unexpected response code
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('🚀 ~ CognitoService ~ error:', error);
      throw new HttpException(
        `User Code Verification Error: ${error.message}`,
        error['$metadata'].httpStatusCode ||
          error.status ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * This service will send the signup verify code again
   * @param username
   * @returns {}
   */
  async resendSignUpCode(username: string): Promise<GlobalServiceResponse> {
    try {
      const params = {
        ClientId: this.clientId || '',
        Username: username,
        SecretHash: computeSecretHash(username),
      };
      const command = new ResendConfirmationCodeCommand(params);
      const result = await this.cognitoClient.send(command);
      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: SUCCESS_MESSAGES.USER_CONFIRMATION_EMAIL_SUCCESS,
          statusCode: result['$metadata'].httpStatusCode,
          data: {
            attribute_name: result?.CodeDeliveryDetails?.AttributeName,
            delivery_medium: result?.CodeDeliveryDetails?.DeliveryMedium,
            destination: result?.CodeDeliveryDetails?.Destination,
          },
        };
      }
      // In case of an unexpected response code
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('error resending registration code', error);
      throw new HttpException(
        `${ERROR_MESSAGES.USER_CONFIRMATION_EMAIL_FAILED}  ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * This service will authenticate the user credentials using aws cognito
   * @param username
   * @param password
   * @returns {AccessToken}
   */
  async signIn(signInData: SignInUserInput): Promise<GlobalServiceResponse> {
    await this.userService.checkUserActiveByEmail(signInData.username);
    const params = {
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: this.clientId || '',
      AuthParameters: {
        USERNAME: signInData.username,
        PASSWORD: signInData.password,
        SECRET_HASH: computeSecretHash(signInData.username), // Include SecretHash here
      },
    };

    try {
      const command = new InitiateAuthCommand(params);
      const result = await this.cognitoClient.send(command);
      if (
        result['$metadata']?.httpStatusCode === HttpStatus.OK &&
        result?.AuthenticationResult?.AccessToken
      ) {
        const payload = await cognitoJwtVerify.verify(
          result?.AuthenticationResult?.AccessToken || '',
          {
            tokenUse: 'access',
            clientId: process.env.COGNITO_CLIENT_ID || '',
          },
        );
        const user = await this.userService.findUserByUserSub(
          payload?.username,
        );
        return {
          statusCode: result['$metadata'].httpStatusCode,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: result?.AuthenticationResult?.AccessToken,
            expires_in: result?.AuthenticationResult?.ExpiresIn,
            refresh_token: result?.AuthenticationResult?.RefreshToken,
            token_type: result?.AuthenticationResult?.TokenType,
            user: {
              ...user, // spread the existing user data
              role: user?.role?.[0] || null, // set role as the first element in the array, or null if undefined
            },
          },
        }; // Contains the JWT tokens (ID, Access, and Refresh)
      }
      // Handle cases where authentication is unsuccessful
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed: Invalid credentials',
      };
    } catch (error) {
      throw new HttpException(`${error.message}`, HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Service to signout the aes cognito user
   * @param accessToken
   * @returns {}
   */
  async signOut(accessToken: string): Promise<GlobalServiceResponse> {
    const params = {
      AccessToken: accessToken,
    };
    try {
      // Global sign out logs the user out from all devices
      const command = new GlobalSignOutCommand(params);
      const result = await this.cognitoClient.send(command);
      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: SUCCESS_MESSAGES.MESSAGE_SENT_SUCCESS,
          statusCode: result['$metadata'].httpStatusCode,
          data: '',
        };
      }
      // In case of an unexpected response code
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('🚀 ~ CognitoService ~ signOut error:', error);
      throw new HttpException(
        `${error.message}`,
        error['$metadata']?.httpStatusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Service to get current logged in user info
   * @param id
   * @returns {GlobalServiceResponse}
   */
  async getUser(id: string): Promise<GlobalServiceResponse> {
    try {
      const response = await this.userService.findUserById(id);
      if (response) {
        return {
          message: SUCCESS_MESSAGES.USER_FETCH_SUCCESS,
          statusCode: 200,
          data: { ...response, role: response?.role[0] },
        };
      }
      // Handle cases where authentication is unsuccessful
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed: Invalid credentials',
      };
    } catch (error) {
      console.error('🚀 ~ CognitoService ~ signOut error:', error);
      throw new HttpException(
        `Unauthorized user: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Service to change the password for a Cognito user
   *
   * @param accessToken - User's access token
   * @param previousPassword - Current password of the user
   * @param proposedPassword - New password to set
   * @returns {Promise<GlobalServiceResponse>}
   *
   * @throws Error if current password entered wrong or new password doesn't match password policy
   */
  async updatePassword(
    updatePasswordInput: UpdatePasswordInput,
  ): Promise<GlobalServiceResponse> {
    const params = {
      AccessToken: updatePasswordInput.accessToken,
      PreviousPassword: updatePasswordInput.previousPassword,
      ProposedPassword: updatePasswordInput.newPassword,
    };

    try {
      const command = new ChangePasswordCommand(params);
      const result = await this.cognitoClient.send(command);

      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: 'Password changed successfully',
          statusCode: result['$metadata'].httpStatusCode,
        };
      }

      // Handle unexpected response codes
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('🚀 ~ CognitoService ~ error:', error);
      throw new HttpException(
        `Change Password Error: ${error.message}`,
        error['$metadata']?.httpStatusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Service to send a password reset code to the user's email
   *
   * @param username
   * @returns {GlobalServiceResponse}
   */
  async forgotPassword(username: string): Promise<GlobalServiceResponse> {
    const params = {
      ClientId: this.clientId || '',
      Username: username,
      SecretHash: computeSecretHash(username),
    };
    try {
      const command = new ForgotPasswordCommand(params);
      const result = await this.cognitoClient.send(command);
      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: SUCCESS_MESSAGES.FORGOT_PASSWORD_EMAIL_SENT,
          statusCode: result['$metadata'].httpStatusCode,
        };
      }
      // Handle unexpected response
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('Error in forgotPassword service:', error);
      throw new HttpException(
        `${ERROR_MESSAGES.FORGOT_PASSWORD_FAILED} ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Service to confirm password reset and set a new password
   *
   * @param username
   * @param confirmationCode
   * @param newPassword
   * @returns {GlobalServiceResponse}
   *
   * @throws Error if Confirmation code is wrong or the password doesn't match the password policy
   */
  async confirmForgotPassword(
    confirmForgotPasswordInput: ConfirmForgotPasswordInput,
  ): Promise<GlobalServiceResponse> {
    const params = {
      ClientId: this.clientId || '',
      Username: confirmForgotPasswordInput?.userName,
      SecretHash: computeSecretHash(confirmForgotPasswordInput?.userName),
      ConfirmationCode: confirmForgotPasswordInput?.confirmationCode,
      Password: confirmForgotPasswordInput?.newPassword,
    };

    try {
      const command = new ConfirmForgotPasswordCommand(params);
      const result = await this.cognitoClient.send(command);
      if (result['$metadata']?.httpStatusCode === HttpStatus.OK) {
        return {
          message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESS,
          statusCode: result['$metadata'].httpStatusCode,
        };
      }
      // Handle unexpected response
      return {
        message: 'Unexpected response from Cognito',
        statusCode:
          result['$metadata'].httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      console.error('Error in confirmForgotPassword service:', error);
      throw new HttpException(
        `${ERROR_MESSAGES.PASSWORD_RESET_FAILED} ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Service to handle Google Sign-In
   * @param googleToken - The ID token from Google
   * @returns {GlobalServiceResponse}
   */
  async signInWithGoogle(googleToken: string): Promise<GlobalServiceResponse> {
    try {
      // 1. Verify the Google token
      const { OAuth2Client } = require('google-auth-library');
      
      if (!process.env.GOOGLE_CLIENT_ID) {
        console.error('GOOGLE_CLIENT_ID environment variable is not set');
        throw new HttpException(
          'Server configuration error: Google authentication is not properly configured',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      console.log('Verifying Google token');
      
      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch (verifyError) {
        console.error('Google token verification failed:', verifyError);
        throw new HttpException(
          'Invalid Google token. Please try again.',
          HttpStatus.UNAUTHORIZED
        );
      }
      
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new HttpException('Invalid Google token: missing email', HttpStatus.UNAUTHORIZED);
      }
      
      console.log('Google token verified for email:', payload.email);
      
      // 2. Create a deterministic password for this Google account
      const googleUserId = payload.sub;
      const secretKey = process.env.COGNITO_CLIENT_SECRET || '';
      const deterministicPassword = crypto
        .createHmac('sha256', secretKey)
        .update(googleUserId)
        .digest('hex')
        .substring(0, 20) + 'Aa1!';
      
      // 3. Try to sign in with USER_PASSWORD_AUTH flow
      try {
        const signInParams = {
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId || '',
          AuthParameters: {
            USERNAME: payload.email,
            PASSWORD: deterministicPassword,
            SECRET_HASH: computeSecretHash(payload.email)
          }
        };
        
        console.log('Attempting to sign in user');
        const signInCommand = new InitiateAuthCommand(signInParams);
        const result = await this.cognitoClient.send(signInCommand);
        console.log('Successfully signed in user');
        
        // 4. Find or create user in our database
        let user;
        try {
          console.log('Looking for user in database');
          user = await this.userService.findUserByUserSub(payload.email);
          console.log('Found existing user');
        } catch (findError) {
          console.log('User not found, creating new user');
          try {
            user = await this.userService.createUser({
              name: payload.name || '',
              email: payload.email,
              phoneNumber: '+10000000000',
              role: Roles.USER,
              userSub: payload.email,
              isConfirmed: true,
              avatarUrl: payload.picture
            });
            console.log('Created new user');
          } catch (createError) {
            console.error('Failed to create user in database:', createError);
            // Just return the authentication tokens without user info in worst case
            if (result?.AuthenticationResult) {
              return {
                statusCode: 200,
                message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                data: {
                  access_token: result.AuthenticationResult.AccessToken,
                  expires_in: result.AuthenticationResult.ExpiresIn,
                  refresh_token: result.AuthenticationResult.RefreshToken,
                  token_type: result.AuthenticationResult.TokenType
                }
              };
            }
            throw new HttpException('Failed to process user record', HttpStatus.INTERNAL_SERVER_ERROR);
          }
        }
        
        // 5. Return successful response with tokens
        return {
          statusCode: 200,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: result.AuthenticationResult?.AccessToken,
            expires_in: result.AuthenticationResult?.ExpiresIn,
            refresh_token: result.AuthenticationResult?.RefreshToken,
            token_type: result.AuthenticationResult?.TokenType,
            user: {
              ...user,
              role: user?.role?.[0] || null
            }
          }
        };
      } catch (signInError) {
        // If sign-in fails, user doesn't exist - try to create one
        console.error('Sign-in failed, creating user:', signInError);
        
        try {
          // 6. Try to create a user in Cognito
          console.log('Creating new Cognito user');
          const signUpParams = {
            ClientId: this.clientId || '',
            Username: payload.email,
            Password: deterministicPassword,
            SecretHash: computeSecretHash(payload.email),
            UserAttributes: [
              { Name: 'email', Value: payload.email },
              { Name: 'phone_number', Value: '+10000000000' }
            ]
          };
          
          const signUpCommand = new SignUpCommand(signUpParams);
          await this.cognitoClient.send(signUpCommand);
          console.log('User created in Cognito');
          
          // 7. Auto-confirm the email
          if (process.env.COGNITO_POOL_ID) {
            try {
              console.log('Auto-confirming user email');
              const confirmParams = {
                UserPoolId: process.env.COGNITO_POOL_ID,
                Username: payload.email,
                UserAttributes: [
                  { Name: 'email_verified', Value: 'true' }
                ]
              };
              
              const confirmCommand = new AdminUpdateUserAttributesCommand(confirmParams);
              await this.cognitoClient.send(confirmCommand);
              console.log('User email confirmed');
            } catch (confirmError) {
              console.error('Failed to confirm email:', confirmError);
              // Continue anyway, this isn't critical
            }
          }
          
          // 8. Now try to sign in with the newly created user
          console.log('Signing in with new user');
          const newSignInParams = {
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            ClientId: this.clientId || '',
            AuthParameters: {
              USERNAME: payload.email,
              PASSWORD: deterministicPassword,
              SECRET_HASH: computeSecretHash(payload.email)
            }
          };
          
          const newSignInCommand = new InitiateAuthCommand(newSignInParams);
          const result = await this.cognitoClient.send(newSignInCommand);
          console.log('Successfully signed in new user');
          
          // 9. Create user in our database
          try {
            console.log('Creating user in our database');
            const user = await this.userService.createUser({
              name: payload.name || '',
              email: payload.email,
              phoneNumber: '+10000000000',
              role: Roles.USER,
              userSub: payload.email,
              isConfirmed: true,
              avatarUrl: payload.picture
            });
            console.log('User created in database');
            
            return {
              statusCode: 200,
              message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
              data: {
                access_token: result.AuthenticationResult?.AccessToken,
                expires_in: result.AuthenticationResult?.ExpiresIn,
                refresh_token: result.AuthenticationResult?.RefreshToken,
                token_type: result.AuthenticationResult?.TokenType,
                user: {
                  ...user,
                  role: user?.role?.[0] || null
                }
              }
            };
          } catch (createUserError) {
            console.error('Failed to create user in database:', createUserError);
            // Still return tokens even if database user creation fails
            if (result?.AuthenticationResult) {
              return {
                statusCode: 200,
                message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                data: {
                  access_token: result.AuthenticationResult.AccessToken,
                  expires_in: result.AuthenticationResult.ExpiresIn,
                  refresh_token: result.AuthenticationResult.RefreshToken,
                  token_type: result.AuthenticationResult.TokenType
                }
              };
            }
          }
        } catch (signUpError) {
          console.error('Failed to create user in Cognito:', signUpError);
          
          // Handle case where user already exists but sign-in failed for some reason
          if (signUpError.name === 'UsernameExistsException') {
            console.log('User already exists, trying admin sign-in');
            
            // Try admin sign-in as last resort
            if (process.env.COGNITO_POOL_ID) {
              try {
                const adminAuthParams = {
                  UserPoolId: process.env.COGNITO_POOL_ID,
                  ClientId: this.clientId || '',
                  AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
                  AuthParameters: {
                    USERNAME: payload.email,
                    PASSWORD: deterministicPassword
                  }
                };
                
                const adminAuthCommand = new AdminInitiateAuthCommand(adminAuthParams);
                const result = await this.cognitoClient.send(adminAuthCommand);
                console.log('Admin authentication successful');
                
                // Just return tokens in this case
                return {
                  statusCode: 200,
                  message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                  data: {
                    access_token: result.AuthenticationResult?.AccessToken,
                    expires_in: result.AuthenticationResult?.ExpiresIn,
                    refresh_token: result.AuthenticationResult?.RefreshToken,
                    token_type: result.AuthenticationResult?.TokenType
                  }
                };
              } catch (adminAuthError) {
                console.error('Admin authentication failed:', adminAuthError);
              }
            }
          }
          
          throw new HttpException(
            'Failed to authenticate with Google. Please try again.',
            HttpStatus.UNAUTHORIZED
          );
        }
      }
      
      // This should never be reached but is here as a fallback
      throw new HttpException(
        'Google authentication failed due to unknown reason',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    } catch (error) {
      console.error('Google authentication error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error.message || 'Google authentication failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
