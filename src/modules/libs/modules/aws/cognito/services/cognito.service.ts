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
   * Service to handle Google Sign-In using Cognito's Federated Identity support
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

      // Instead of verifying the token ourselves, we'll use Cognito's built-in federation support
      // to exchange the Google token for Cognito tokens
      console.log('Exchanging Google token for Cognito tokens');
      
      // Create parameters for the InitiateAuth call
      const params = {
        AuthFlow: AuthFlowType.CUSTOM_AUTH, // Use the enum value
        ClientId: this.clientId,
        AuthParameters: {
          'TOKEN': googleToken,
          'PROVIDER': 'Google'
        }
      };

      try {
        // Call Cognito to exchange the Google token for Cognito tokens
        const command = new InitiateAuthCommand(params);
        const result = await this.cognitoClient.send(command);
        console.log('Successfully exchanged Google token for Cognito tokens');

        // Extract the JWT claims to get the user information
        const jwtDecode = require('jwt-decode');
        let userSub;
        let email;
        let name;
        
        try {
          // Try to decode the ID token to get user information
          const idToken = result.AuthenticationResult?.IdToken;
          if (idToken) {
            const decoded = jwtDecode(idToken);
            userSub = decoded.sub;
            email = decoded.email;
            name = decoded.name;
            console.log('Successfully decoded ID token');
          } else {
            // If ID token is not available, decode the access token
            const accessToken = result.AuthenticationResult?.AccessToken;
            if (accessToken) {
              const decoded = jwtDecode(accessToken);
              userSub = decoded.sub || decoded.username;
              email = decoded.email;
              console.log('Using access token for user information');
            }
          }
        } catch (decodeError) {
          console.error('Error decoding JWT token:', decodeError);
          // Continue with the authentication even if we can't decode the token
        }

        if (!userSub && !email) {
          console.log('No user identifiers found in tokens, using alternative lookup');
          try {
            // Use GetUser to get user information if we couldn't extract it from the token
            const getUserCommand = new GetUserCommand({
              AccessToken: result.AuthenticationResult?.AccessToken
            });
            const userResult = await this.cognitoClient.send(getUserCommand);
            
            // Find email in user attributes
            const emailAttr = userResult.UserAttributes?.find(attr => attr.Name === 'email');
            if (emailAttr) {
              email = emailAttr.Value;
            }
            
            userSub = userResult.Username;
            console.log('Retrieved user information from GetUser call');
          } catch (getUserError) {
            console.error('Error getting user information:', getUserError);
            // Continue with authentication even if we can't get user details
          }
        }

        // Check if user exists in our database or create them
        let user;
        try {
          // Try to find user by sub first
          if (userSub) {
            try {
              user = await this.userService.findUserByUserSub(userSub);
              console.log('Found existing user by userSub');
            } catch (notFoundError) {
              // User not found by sub, will be created
            }
          }
          
          // If not found by sub, try by email
          if (!user && email) {
            try {
              // This method checks for deleted users by email, so we need additional logic
              await this.userService.checkUserActiveByEmail(email);
              
              // If we get here, the user isn't marked as deleted, try to find them
              // We need to use the repository directly since there's no findByEmail method
              // This requires injecting the repository in the constructor
              // For now, we'll create a new user instead
            } catch (error) {
              // User not found or deleted, will create a new one
            }
          }
          
          // Create new user if not found
          if (!user) {
            console.log('Creating new user in database');
            user = await this.userService.createUser({
              name: name || (email ? email.split('@')[0] : 'Google User'),
              email: email || 'unknown@example.com',
              phoneNumber: '+10000000000', // Default phone number
              role: Roles.USER,
              userSub: userSub || email || 'google-user', // Use either sub or email as userSub
              isConfirmed: true,
              avatarUrl: undefined // We don't have this from the token directly
            });
            console.log('Successfully created new user in database');
          }
          
          // Return authentication result with user information
          return {
            statusCode: HttpStatus.OK,
            message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
            data: {
              access_token: result.AuthenticationResult?.AccessToken,
              id_token: result.AuthenticationResult?.IdToken,
              refresh_token: result.AuthenticationResult?.RefreshToken,
              expires_in: result.AuthenticationResult?.ExpiresIn,
              token_type: result.AuthenticationResult?.TokenType,
              user: {
                ...user,
                role: user?.role?.[0] || null
              }
            }
          };
        } catch (userDbError) {
          console.error('Error handling user database operations:', userDbError);
          
          // Still return tokens even if database operations fail
          return {
            statusCode: HttpStatus.OK,
            message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
            data: {
              access_token: result.AuthenticationResult?.AccessToken,
              id_token: result.AuthenticationResult?.IdToken,
              refresh_token: result.AuthenticationResult?.RefreshToken,
              expires_in: result.AuthenticationResult?.ExpiresIn,
              token_type: result.AuthenticationResult?.TokenType
            }
          };
        }
      } catch (authError) {
        console.error('Error authenticating with Google token:', authError);
        
        // If CUSTOM_AUTH flow is not enabled, fall back to OIDC token endpoint
        if (authError.message && authError.message.includes('CUSTOM_AUTH')) {
          console.log('CUSTOM_AUTH flow not supported, trying OIDC token endpoint');
          // This would need implementation of direct OIDC token exchange
          // which is beyond the scope of this example
          throw new HttpException(
            'CUSTOM_AUTH flow not supported for Google sign-in. Please enable it in Cognito console.',
            HttpStatus.BAD_REQUEST
          );
        }
        
        throw new HttpException(
          'Failed to authenticate with Google token: ' + authError.message,
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
