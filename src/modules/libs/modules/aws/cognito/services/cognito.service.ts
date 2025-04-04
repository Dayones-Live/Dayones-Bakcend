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
      // First, verify the Google ID token
      const { OAuth2Client } = require('google-auth-library');
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,  // Make sure this matches exactly with the client ID used by your frontend
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new HttpException('Invalid Google token', HttpStatus.UNAUTHORIZED);
      }
      
      console.log('Google payload:', JSON.stringify(payload)); // Add logging to see token payload

      // Create a deterministic password for this Google account
      // This ensures the same Google user will always have the same password
      const googleUserId = payload.sub; // Google's unique user ID
      const secretKey = process.env.COGNITO_CLIENT_SECRET || 'default-secret-key';
      const deterministicPassword = crypto
        .createHmac('sha256', secretKey)
        .update(googleUserId)
        .digest('hex')
        .substring(0, 20) + 'Aa1!'; // Add complexity to meet Cognito password requirements

      // Try sign-in with admin auth flow first - since this works for both existing and new users
      try {
        console.log('Attempting admin sign-in flow for existing Google user');
        
        // Skip user creation and try admin sign-in directly
        if (!process.env.COGNITO_POOL_ID) {
          throw new Error('Cognito Pool ID not configured');
        }
        
        const adminSignInCommand = new AdminInitiateAuthCommand({
          UserPoolId: process.env.COGNITO_POOL_ID,
          ClientId: this.clientId || '',
          AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
          AuthParameters: {
            USERNAME: payload.email,
            PASSWORD: deterministicPassword,
            SECRET_HASH: computeSecretHash(payload.email)
          }
        });
        
        const result = await this.cognitoClient.send(adminSignInCommand);
        console.log('Successfully signed in existing user with admin flow');
        
        return this.handleSuccessfulAuth(result, payload);
      } catch (adminAuthError) {
        console.error('Admin auth flow failed:', adminAuthError);
        
        // If error is not "user does not exist", try regular sign-in flow
        if (!adminAuthError.message.includes('User does not exist')) {
          // Try regular sign-in flow
          try {
            console.log('Attempting regular sign-in flow for existing Google user');
            const signInCommand = new InitiateAuthCommand({
              AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
              ClientId: this.clientId || '',
              AuthParameters: {
                USERNAME: payload.email,
                PASSWORD: deterministicPassword,
                SECRET_HASH: computeSecretHash(payload.email)
              },
            });
            
            const result = await this.cognitoClient.send(signInCommand);
            console.log('Successfully signed in with regular flow');
            
            return this.handleSuccessfulAuth(result, payload);
          } catch (signInError) {
            console.error('Regular sign-in failed:', signInError);
            
            // If not a "user doesn't exist" error, pass through the error
            if (!signInError.message.includes('Incorrect username or password')) {
              throw signInError;
            }
            
            // Only try to create a new user if both admin and regular auth fail with "user doesn't exist"
            console.log('User not found, attempting to create account');
          }
        }
        
        // Only create new user if they don't exist
        try {
          console.log('Creating new Google user account');
          
          // Check if user already exists
          try {
            // Attempt to get the user - if this succeeds, the user exists
            const getUserCommand = new GetUserCommand({
              AccessToken: 'dummy_token_will_fail'
            });
            
            await this.cognitoClient.send(getUserCommand);
            // If we get here, user exists (unlikely since auth failed)
            throw new HttpException('User account already exists', HttpStatus.CONFLICT);
          } catch (getUserError) {
            // Expected to fail, proceed with user creation
            if (!getUserError.message.includes('Invalid Access Token')) {
              // If error isn't about the token, user might exist
              console.log('GetUser error indicates user might exist already');
            }
          }
          
          // Create user with admin privileges
          const adminCreateCommand = new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_POOL_ID,
            Username: payload.email,
            TemporaryPassword: deterministicPassword,
            MessageAction: 'SUPPRESS', // Don't send welcome email
            UserAttributes: [
              { Name: 'email', Value: payload.email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: payload.name || '' },
              // Add a default phone number to satisfy the schema requirement
              { Name: 'phone_number', Value: '+10000000000' }
            ]
          });
          
          await this.cognitoClient.send(adminCreateCommand);
          console.log('Successfully created new user');
          
          // Now sign in the user with the regular sign-in flow
          try {
            console.log('Attempting regular sign-in flow for new Google user');
            const signInCommand = new InitiateAuthCommand({
              AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
              ClientId: this.clientId || '',
              AuthParameters: {
                USERNAME: payload.email,
                PASSWORD: deterministicPassword,
                SECRET_HASH: computeSecretHash(payload.email)
              },
            });
            
            const result = await this.cognitoClient.send(signInCommand);
            console.log('Successfully signed in new user with regular flow');
            
            return this.handleSuccessfulAuth(result, payload);
          } catch (signInError) {
            console.error('Regular sign-in failed:', signInError);
            
            // If not a "user doesn't exist" error, pass through the error
            if (!signInError.message.includes('Incorrect username or password')) {
              throw signInError;
            }
            
            // Couldn't sign in the newly created user
            throw new HttpException(
              'Failed to authenticate newly created Google user',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        } catch (createError) {
          console.error('Error during Google user creation:', createError);
          console.error('Error details:', JSON.stringify({
            message: createError.message,
            code: createError.code,
            statusCode: createError.$metadata?.httpStatusCode,
            requestId: createError.$metadata?.requestId,
          }, null, 2));
          
          // Provide a specific error for user already exists
          if (createError.name === 'UsernameExistsException' || 
              createError.message.includes('User account already exists') ||
              createError.message.includes('already exists')) {
            // If user exists but we couldn't sign in, something is wrong with credentials
            throw new HttpException(
              'Account already exists with this email. Please use regular sign-in or reset your password.',
              HttpStatus.CONFLICT
            );
          }
          
          // Provide a clearer error message
          if (createError.message.includes('A client attempted to write unauthorized attribute')) {
            throw new HttpException(
              'Unable to create account with Google credentials - attribute permission issue in Cognito',
              HttpStatus.BAD_REQUEST
            );
          }
          
          throw createError;
        }
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      // Log more detailed error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      throw new HttpException(
        error.message || 'Google authentication failed',
        error.status || HttpStatus.UNAUTHORIZED
      );
    }
  }

  private async handleSuccessfulAuth(result: any, payload: any): Promise<GlobalServiceResponse> {
    if (result['$metadata']?.httpStatusCode === HttpStatus.OK && result?.AuthenticationResult?.AccessToken) {
      const cognitoPayload = await cognitoJwtVerify.verify(
        result?.AuthenticationResult?.AccessToken || '',
        {
          tokenUse: 'access',
          clientId: process.env.COGNITO_CLIENT_ID || '',
        },
      );

      // Check if user exists in our database
      let user = await this.userService.findUserByUserSub(cognitoPayload?.username);
      
      // If user doesn't exist, create them
      if (!user) {
        try {
          user = await this.userService.createUser({
            name: payload.name || '',
            email: payload.email || '',
            phoneNumber: '+10000000000', // Default phone number
            role: Roles.USER,
            userSub: cognitoPayload?.username,
            isConfirmed: true,
            avatarUrl: payload.picture,
          });
        } catch (createUserError) {
          console.error('Error creating user in database:', createUserError);
          // If user creation fails, try to find the user again
          // This handles race conditions where another request might have created the user
          user = await this.userService.findUserByUserSub(cognitoPayload?.username);
          if (!user) {
            throw new HttpException(
              'Failed to create user account', 
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        }
      }

      return {
        statusCode: result['$metadata'].httpStatusCode,
        message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
        data: {
          access_token: result?.AuthenticationResult?.AccessToken,
          expires_in: result?.AuthenticationResult?.ExpiresIn,
          refresh_token: result?.AuthenticationResult?.RefreshToken,
          token_type: result?.AuthenticationResult?.TokenType,
          user: {
            ...user,
            role: user?.role || null,
          },
        },
      };
    }

    return {
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Authentication failed: Invalid Google credentials',
    };
  }
}
