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
  ListUsersCommand,
  MessageActionType
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
   * Service to handle Google Sign-In with AWS Cognito
   * @param googleToken - The ID token from Google
   * @returns {GlobalServiceResponse}
   */
  async signInWithGoogle(googleToken: string): Promise<GlobalServiceResponse> {
    try {
      if (!process.env.COGNITO_CLIENT_ID) {
        throw new HttpException(
          'Server configuration error: Cognito client ID is not configured',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // First, verify the Google ID token
      const { OAuth2Client } = require('google-auth-library');
      
      // Verify Google Client ID is configured
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
          'Invalid Google token: ' + verifyError.message,
          HttpStatus.UNAUTHORIZED
        );
      }
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new HttpException('Invalid Google token: empty payload', HttpStatus.UNAUTHORIZED);
      }
      
      console.log('Google authentication successful for email:', payload.email);
      
      // For Cognito integration, we'll use the Admin APIs to handle federated sign-in
      // This pattern works when your backend server is trusted and has admin privileges
      
      if (!process.env.COGNITO_POOL_ID) {
        throw new HttpException(
          'Server configuration error: Cognito pool ID is not configured',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // We'll search for the user in Cognito to see if they already exist
      let userExists = false;
      try {
        // Try to find the user in Cognito by email
        const listUsersCommand = {
          UserPoolId: process.env.COGNITO_POOL_ID,
          Filter: `email = "${payload.email}"`,
          Limit: 1
        };
        
        const listUsersResponse = await this.cognitoClient.send(
          new ListUsersCommand(listUsersCommand)
        );
        
        userExists = !!(listUsersResponse.Users && listUsersResponse.Users.length > 0);
        console.log(`User ${userExists ? 'exists' : 'does not exist'} in Cognito`);
      } catch (listError) {
        console.error('Error checking if user exists:', listError);
        // Continue even if we couldn't check if user exists
      }
      
      // If the user doesn't exist, create them in Cognito
      if (!userExists) {
        try {
          console.log('Creating user in Cognito');
          // Create the user with admin APIs
          const createUserCommand = {
            UserPoolId: process.env.COGNITO_POOL_ID,
            Username: payload.email,
            UserAttributes: [
              { Name: 'email', Value: payload.email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: payload.name || '' },
              // Using a Google sub claim as an external ID to link with Google
              { Name: 'custom:googleId', Value: payload.sub },
            ],
            MessageAction: MessageActionType.SUPPRESS // Use the enum value
          };
          
          await this.cognitoClient.send(
            new AdminCreateUserCommand(createUserCommand)
          );
          console.log('User created successfully in Cognito');
        } catch (createError) {
          // If user already exists (race condition or other error), continue
          if (createError.name !== 'UsernameExistsException') {
            console.error('Error creating user in Cognito:', createError);
            throw new HttpException(
              'Error creating user account: ' + createError.message,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        }
      }
      
      // Now, we'll authenticate the user with admin APIs
      try {
        console.log('Initiating admin auth for user');
        const initiateAuthResponse = await this.cognitoClient.send(
          new AdminInitiateAuthCommand({
            UserPoolId: process.env.COGNITO_POOL_ID,
            ClientId: this.clientId || '',
            AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
            AuthParameters: {
              USERNAME: payload.email,
              // For federated users, we need to either:
              // 1. Set a password when creating them
              // 2. Or use a passwordless authentication method
              // For this implementation, we'll use an admin auth flow since passwords aren't used
              // in federated identities
            }
          })
        );
        
        // If we get here, authentication succeeded and we have tokens
        console.log('Admin auth successful, got tokens');
        
        // Let's get or create the user in our database
        let user;
        try {
          // Try to find the user by email in our database
          try {
            user = await this.userService.findUserByUserSub(payload.email);
            console.log('Found existing user in database');
          } catch (notFoundError) {
            console.log('User not found in database, creating new user');
            // Create the user in our database
            user = await this.userService.createUser({
              name: payload.name || '',
              email: payload.email,
              phoneNumber: '+10000000000', // Default phone number
              role: Roles.USER,
              userSub: payload.email, // Using email as the userSub
              isConfirmed: true,
              avatarUrl: payload.picture
            });
            console.log('User created in database');
          }
          
          // Return successful response with tokens
          return {
            statusCode: HttpStatus.OK,
            message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
            data: {
              access_token: initiateAuthResponse.AuthenticationResult?.AccessToken,
              id_token: initiateAuthResponse.AuthenticationResult?.IdToken,
              refresh_token: initiateAuthResponse.AuthenticationResult?.RefreshToken,
              expires_in: initiateAuthResponse.AuthenticationResult?.ExpiresIn,
              token_type: initiateAuthResponse.AuthenticationResult?.TokenType,
              user: {
                ...user,
                role: user?.role?.[0] || null
              }
            }
          };
        } catch (dbError) {
          console.error('Error handling user in database:', dbError);
          
          // Still return tokens even if database operations fail
          return {
            statusCode: HttpStatus.OK,
            message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
            data: {
              access_token: initiateAuthResponse.AuthenticationResult?.AccessToken,
              id_token: initiateAuthResponse.AuthenticationResult?.IdToken,
              refresh_token: initiateAuthResponse.AuthenticationResult?.RefreshToken,
              expires_in: initiateAuthResponse.AuthenticationResult?.ExpiresIn,
              token_type: initiateAuthResponse.AuthenticationResult?.TokenType
            }
          };
        }
      } catch (authError) {
        console.error('Error during admin authentication:', authError);
        
        // Special handling for invalid password (expected for federated users)
        if (authError.message && authError.message.includes('Incorrect username or password')) {
          // For federated users, we need to set a password or use a different auth flow
          // Let's set a password for this user
          try {
            console.log('Setting password for federated user');
            // Create a deterministic password based on Google ID
            const googleUserId = payload.sub;
            const secretKey = process.env.COGNITO_CLIENT_SECRET || '';
            const password = crypto
              .createHmac('sha256', secretKey)
              .update(googleUserId)
              .digest('hex')
              .substring(0, 20) + 'Aa1!';
            
            // Set the password using admin APIs
            await this.cognitoClient.send(
              new AdminSetUserPasswordCommand({
                UserPoolId: process.env.COGNITO_POOL_ID,
                Username: payload.email,
                Password: password,
                Permanent: true
              })
            );
            
            // Now try to authenticate again
            console.log('Trying authentication again after setting password');
            const retryAuthResponse = await this.cognitoClient.send(
              new AdminInitiateAuthCommand({
                UserPoolId: process.env.COGNITO_POOL_ID,
                ClientId: this.clientId || '',
                AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
                AuthParameters: {
                  USERNAME: payload.email,
                  PASSWORD: password
                }
              })
            );
            
            // Now let's get or create the user in our database
            let user;
            try {
              // Try to find the user by email in our database
              try {
                user = await this.userService.findUserByUserSub(payload.email);
                console.log('Found existing user in database');
              } catch (notFoundError) {
                console.log('User not found in database, creating new user');
                // Create the user in our database
                user = await this.userService.createUser({
                  name: payload.name || '',
                  email: payload.email,
                  phoneNumber: '+10000000000', // Default phone number
                  role: Roles.USER,
                  userSub: payload.email, // Using email as the userSub
                  isConfirmed: true,
                  avatarUrl: payload.picture
                });
                console.log('User created in database');
              }
              
              // Return successful response with tokens
              return {
                statusCode: HttpStatus.OK,
                message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                data: {
                  access_token: retryAuthResponse.AuthenticationResult?.AccessToken,
                  id_token: retryAuthResponse.AuthenticationResult?.IdToken,
                  refresh_token: retryAuthResponse.AuthenticationResult?.RefreshToken,
                  expires_in: retryAuthResponse.AuthenticationResult?.ExpiresIn,
                  token_type: retryAuthResponse.AuthenticationResult?.TokenType,
                  user: {
                    ...user,
                    role: user?.role?.[0] || null
                  }
                }
              };
            } catch (dbError) {
              console.error('Error handling user in database:', dbError);
              
              // Still return tokens even if database operations fail
              return {
                statusCode: HttpStatus.OK,
                message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                data: {
                  access_token: retryAuthResponse.AuthenticationResult?.AccessToken,
                  id_token: retryAuthResponse.AuthenticationResult?.IdToken,
                  refresh_token: retryAuthResponse.AuthenticationResult?.RefreshToken,
                  expires_in: retryAuthResponse.AuthenticationResult?.ExpiresIn,
                  token_type: retryAuthResponse.AuthenticationResult?.TokenType
                }
              };
            }
          } catch (passwordError) {
            console.error('Error setting user password:', passwordError);
            throw new HttpException(
              'Could not set up federated user authentication: ' + passwordError.message,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        }
        
        throw new HttpException(
          'Failed to authenticate with Google credentials: ' + authError.message,
          HttpStatus.UNAUTHORIZED
        );
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Google authentication failed: ' + error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
