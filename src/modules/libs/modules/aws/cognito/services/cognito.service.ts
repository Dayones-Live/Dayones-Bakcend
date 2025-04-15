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
  MessageActionType,
  AdminRespondToAuthChallengeCommand
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
import { OAuth2Client } from 'google-auth-library';
import { User } from '@user/entities/user.entity';
import { UserUpdateInput } from '@user/dto/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class CognitoService {
  private clientId = process.env.COGNITO_CLIENT_ID; // Replace with your App Client ID
  private cognitoClient;
  private jwksClient: jwksClient.JwksClient;

  constructor(
    private userService: UserService,
    private configService: ConfigService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
    this.jwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
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
    console.log('Starting Google sign-in process...');
    try {
      // Initialize Google OAuth client with explicit client ID
      console.log('Initializing Google OAuth client...');
      const client = new OAuth2Client('918802616844-2rkeh1hqa9jga6r90g0tpphqoocs0rm3.apps.googleusercontent.com');
      
      // 1. Verify the Google token
      console.log('Verifying Google token...');
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: '918802616844-2rkeh1hqa9jga6r90g0tpphqoocs0rm3.apps.googleusercontent.com',
      });
      
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        console.error('Invalid Google token payload:', payload);
        throw new HttpException('Invalid Google token payload', HttpStatus.UNAUTHORIZED);
      }

      const userEmail = payload.email;
      const userName = payload.name || '';
      const userPicture = payload.picture;
      const userSub = payload.sub;

      console.log(`Google token verified successfully for user: ${userEmail}`);

      // 2. Check if user exists in Cognito
      console.log(`Checking if user ${userEmail} exists in Cognito...`);
      let cognitoUserExists = false;
      let cognitoUserSub = '';
      try {
        const listUsersCommand = new ListUsersCommand({
          UserPoolId: process.env.COGNITO_POOL_ID,
          Filter: `email = \"${userEmail}\"`,
          Limit: 1,
        });
        const listUsersResult = await this.cognitoClient.send(listUsersCommand);
        cognitoUserExists = (listUsersResult.Users?.length || 0) > 0;
        if (cognitoUserExists && listUsersResult.Users?.[0]?.Username) {
          cognitoUserSub = listUsersResult.Users[0].Username;
          console.log(`Found existing Cognito user with sub: ${cognitoUserSub}`);
        } else {
          console.log(`No existing Cognito user found for ${userEmail}`);
        }
      } catch (error) {
        console.error('Error checking Cognito user existence:', error);
        throw error;
      }

      // 3. Create user in Cognito if they don't exist
      if (!cognitoUserExists) {
        console.log(`Creating new Cognito user for ${userEmail}...`);
        try {
          const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1!';

          const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_POOL_ID,
            Username: userEmail,
            UserAttributes: [
              { Name: 'email', Value: userEmail },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: userName },
              { Name: 'phone_number', Value: userSub },
              { Name: 'phone_number_verified', Value: 'true' },
              { Name: 'custom:role', Value: Roles.USER }
            ],
            TemporaryPassword: randomPassword,
            MessageAction: 'SUPPRESS',
            DesiredDeliveryMediums: [],
          });

          const createResult = await this.cognitoClient.send(createUserCommand);
          cognitoUserSub = createResult.User?.Username || '';
          console.log('Cognito user created successfully:', {
            username: cognitoUserSub,
            userSub: cognitoUserSub
          });

          // Create user in local database
          console.log('Creating local database user...');
          const newUserInput = {
            email: userEmail,
            name: userName,
            role: Roles.USER,
            userSub: cognitoUserSub,
            isConfirmed: true,
            avatarUrl: userPicture
          };
          console.log('Local user input:', newUserInput);
          
          try {
            const localUser = await this.userService.createUser(newUserInput);
            if (!localUser) {
              console.error('Failed to create local user: userService.createUser returned null');
              throw new Error('userService.createUser did not return a user object.');
            }
            console.log(`Local user created successfully with ID: ${localUser.id}`);
          } catch (createError) {
            console.error('Failed to create local user:', createError);
            throw new HttpException(`Failed to create local user: ${createError.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
          }
        } catch (error) {
          console.error(`Failed to create Cognito user ${userEmail}:`, error);
          throw new HttpException(`Failed to provision user in Cognito: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      // 4. Find or create user in local database
      console.log('Checking local database for user...');
      let localUser: User | null = null;
      try {
        if (cognitoUserSub) {
          console.log(`Looking for local user by userSub: ${cognitoUserSub}`);
          try {
            localUser = await this.userService.findUserByUserSub(cognitoUserSub);
            console.log(`Found local user by userSub: ${cognitoUserSub}`);
          } catch (error) {
            console.log(`No local user found by userSub ${cognitoUserSub}, trying email...`);
          }
        }

        if (!localUser) {
          console.log(`Looking for local user by email: ${userEmail}`);
          localUser = await this.userService.findUserByEmail(userEmail);
          console.log(`Found local user by email: ${userEmail}`);
        }

        if (localUser && (!localUser.user_sub || localUser.user_sub !== cognitoUserSub)) {
          console.log(`Updating local user ${userEmail} with Cognito userSub: ${cognitoUserSub}`);
          const updateData: UserUpdateInput = {};
          if (!localUser.avatar_url && userPicture) {
            updateData.avatarUrl = userPicture;
          }
          if (localUser.full_name !== userName && userName) {
            updateData.fullName = userName;
          }
          
          try {
            console.log('Updating local user with data:', updateData);
            const updatedUserResponse = await this.userService.updateUser(updateData, localUser.id);
            if (updatedUserResponse && updatedUserResponse.data) {
              localUser = updatedUserResponse.data;
              console.log('Local user updated successfully');
            } else {
              console.log('No update response, fetching user again');
              localUser = await this.userService.findUserByEmail(userEmail);
            }
          } catch (updateError) {
            console.error(`Failed to update local user ${userEmail}:`, updateError);
          }
        }
      } catch (error) {
        if (error instanceof HttpException && (error.getStatus() === HttpStatus.NOT_FOUND || error.message.includes('User not found') || error.message.includes('User is deleted'))) {
          console.log(`Creating new local user for ${userEmail}...`);
          const newUserInput = {
            email: userEmail,
            name: userName,
            role: Roles.USER,
            userSub: cognitoUserSub,
            isConfirmed: true,
            avatarUrl: userPicture
          };
          console.log('Creating local user with input:', newUserInput);
          try {
            localUser = await this.userService.createUser(newUserInput);
            if (!localUser) {
              console.error('Failed to create local user: userService.createUser returned null');
              throw new Error('userService.createUser did not return a user object.');
            }
            console.log(`Local user created successfully with ID: ${localUser.id}`);
          } catch (createError) {
            console.error(`Failed to create local user ${userEmail}:`, createError);
            throw new HttpException(`Failed to create local user: ${createError.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
          }
        } else {
          console.error('Unexpected error finding local user:', error);
          throw error;
        }
      }

      // 5. Get Cognito tokens
      console.log(`Initiating CUSTOM_AUTH flow for ${userEmail}...`);
      const authParams = {
        AuthFlow: AuthFlowType.CUSTOM_AUTH,
        ClientId: this.clientId || '',
        UserPoolId: process.env.COGNITO_POOL_ID || '',
        AuthParameters: {
          USERNAME: userEmail,
          SECRET_HASH: computeSecretHash(userEmail)
        },
      };

      const authCommand = new AdminInitiateAuthCommand(authParams);
      const authResult = await this.cognitoClient.send(authCommand);
      console.log('Auth result:', authResult);

      // 6. Respond to CUSTOM_CHALLENGE
      if (authResult.ChallengeName === 'CUSTOM_CHALLENGE') {
        console.log('7. Responding to CUSTOM_CHALLENGE...');
        try {
          const challengeResponse = await this.cognitoClient.send(
            new AdminRespondToAuthChallengeCommand({
              ChallengeName: 'CUSTOM_CHALLENGE',
              ClientId: this.clientId || '',
              UserPoolId: process.env.COGNITO_POOL_ID || '',
              ChallengeResponses: {
                USERNAME: userEmail,
                ANSWER: googleToken,
                SECRET_HASH: computeSecretHash(userEmail)
              },
              Session: authResult.Session
            })
          );
          console.log('Challenge response:', challengeResponse);

          if (challengeResponse?.AuthenticationResult?.AccessToken && localUser) {
            console.log(`Authentication successful for ${userEmail}`);
            const userDataForResponse = {
              full_name: localUser.full_name,
              email: localUser.email,
              role: localUser.role?.[0] || null,
              phone_number: localUser.phone_number,
              is_confirmed: localUser.is_confirmed,
              is_deleted: localUser.is_deleted,
              latitude: localUser.latitude,
              longitude: localUser.longitude,
              notifications_enabled: localUser.notifications_enabled,
              notification_status_valid_till: localUser.notification_status_valid_till,
              created_at: localUser.created_at,
              updated_at: localUser.updated_at,
              id: localUser.id,
              avatar_url: localUser.avatar_url,
              user_sub: localUser.user_sub
            };

            return {
              statusCode: HttpStatus.OK,
              message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
              data: {
                access_token: challengeResponse.AuthenticationResult.AccessToken,
                expires_in: challengeResponse.AuthenticationResult.ExpiresIn,
                refresh_token: challengeResponse.AuthenticationResult.RefreshToken,
                token_type: challengeResponse.AuthenticationResult.TokenType,
                user: userDataForResponse
              }
            };
          } else {
            console.error('Authentication failed: No access token or local user');
            throw new HttpException('CUSTOM_AUTH challenge response failed.', HttpStatus.UNAUTHORIZED);
          }
        } catch (error) {
          console.error('Error during challenge response:', error);
          // If the challenge response fails, try to get tokens using AdminInitiateAuth
          try {
            console.log('Attempting AdminInitiateAuth...');
            const adminAuthParams = {
              AuthFlow: AuthFlowType.CUSTOM_AUTH,
              ClientId: this.clientId || '',
              UserPoolId: process.env.COGNITO_POOL_ID || '',
              AuthParameters: {
                USERNAME: userEmail,
                SECRET_HASH: computeSecretHash(userEmail)
              },
            };
            
            const adminAuthCommand = new AdminInitiateAuthCommand(adminAuthParams);
            const adminAuthResult = await this.cognitoClient.send(adminAuthCommand);
            
            if (adminAuthResult?.AuthenticationResult?.AccessToken && localUser) {
              console.log('AdminInitiateAuth successful!');
              return {
                statusCode: HttpStatus.OK,
                message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
                data: {
                  access_token: adminAuthResult.AuthenticationResult.AccessToken,
                  expires_in: adminAuthResult.AuthenticationResult.ExpiresIn,
                  refresh_token: adminAuthResult.AuthenticationResult.RefreshToken,
                  token_type: adminAuthResult.AuthenticationResult.TokenType,
                  user: {
                    ...localUser,
                    role: localUser.role[0] || null,
                  },
                },
              };
            }
            throw new HttpException('AdminInitiateAuth failed - no access token', HttpStatus.UNAUTHORIZED);
          } catch (adminAuthError) {
            console.error('AdminInitiateAuth failed:', adminAuthError);
            throw new HttpException(
              'Authentication failed after all attempts',
              HttpStatus.UNAUTHORIZED
            );
          }
        }
      } else {
        console.error(`Unexpected challenge or response from AdminInitiateAuth for ${userEmail}:`, authResult);
        if (!authResult?.AuthenticationResult?.AccessToken) {
          throw new HttpException('Expected CUSTOM_CHALLENGE, but received none or failed to authenticate.', HttpStatus.UNAUTHORIZED);
        }
        console.log(`CUSTOM_AUTH bypassed? Direct authentication result for ${userEmail}.`);
        if (!localUser) {
          throw new HttpException('User not found in local database.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const userDataForResponse = {
          full_name: localUser.full_name,
          email: localUser.email,
          role: localUser.role?.[0] || null,
          phone_number: localUser.phone_number,
          is_confirmed: localUser.is_confirmed,
          is_deleted: localUser.is_deleted,
          latitude: localUser.latitude,
          longitude: localUser.longitude,
          notifications_enabled: localUser.notifications_enabled,
          notification_status_valid_till: localUser.notification_status_valid_till,
          created_at: localUser.created_at,
          updated_at: localUser.updated_at,
          id: localUser.id,
          avatar_url: localUser.avatar_url,
          user_sub: localUser.user_sub
        };
        return {
          statusCode: HttpStatus.OK,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: authResult.AuthenticationResult.AccessToken,
            expires_in: authResult.AuthenticationResult.ExpiresIn,
            refresh_token: authResult.AuthenticationResult.RefreshToken,
            token_type: authResult.AuthenticationResult.TokenType,
            user: userDataForResponse
          }
        };
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      const errorMessage = error instanceof HttpException ? error.message : `Google sign-in failed: ${error.message}`;
      const errorStatus = error instanceof HttpException ? error.getStatus() : HttpStatus.UNAUTHORIZED;
      throw new HttpException(errorMessage, errorStatus);
    }
    throw new HttpException('Unexpected error during Google sign-in', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * This service handles Sign In with Apple
   * @param appleIdToken The ID token received from Apple
   * @returns {GlobalServiceResponse}
   */
  async signInWithApple(appleIdToken: string): Promise<GlobalServiceResponse> {
    console.log('🚀 Starting Apple sign-in process...');
    try {
      // 1. Verify the Apple token
      console.log('1. Verifying Apple token...');
      let applePayload: any;
      try {
        const decodedToken = jwt.decode(appleIdToken, { complete: true });
        console.log('Decoded token header:', decodedToken?.header);
        
        if (!decodedToken?.header?.kid) {
          console.error('Missing kid in token header');
          throw new HttpException('Invalid Apple token format', HttpStatus.UNAUTHORIZED);
        }

        console.log('Getting signing key for kid:', decodedToken.header.kid);
        const key = await this.jwksClient.getSigningKey(decodedToken.header.kid);
        const signingKey = key.getPublicKey();
        
        applePayload = jwt.verify(appleIdToken, signingKey, {
          algorithms: ['RS256'],
          audience: this.configService.get<string>('APPLE_CLIENT_ID'),
          issuer: 'https://appleid.apple.com',
          ignoreExpiration: false,
        });
        console.log('Apple payload verified successfully:', {
          email: applePayload.email,
          sub: applePayload.sub,
          email_verified: applePayload.email_verified
        });
      } catch (error) {
        console.error('Apple token verification failed:', error);
        throw new HttpException(
          `Apple token verification failed: ${error.message}`,
          HttpStatus.UNAUTHORIZED
        );
      }
      
      if (!applePayload || !applePayload.sub) {
        console.error('Invalid Apple payload:', applePayload);
        throw new HttpException('Invalid Apple token payload', HttpStatus.UNAUTHORIZED);
      }

      const userEmail = applePayload.email || `apple_${applePayload.sub}@apple.com`;
      const userName = 'Apple User';
      const userSub = applePayload.sub;
      console.log('2. Extracted user info:', { userEmail, userName, userSub });

      // 2. Check if user exists in Cognito
      console.log('3. Checking if user exists in Cognito...');
      let cognitoUserExists = false;
      let cognitoUsername = '';
      try {
        const listUsersCommand = new ListUsersCommand({
          UserPoolId: process.env.COGNITO_POOL_ID,
          Filter: `email = \"${userEmail}\"`,
          Limit: 1,
        });
        const listUsersResult = await this.cognitoClient.send(listUsersCommand);
        cognitoUserExists = (listUsersResult.Users?.length || 0) > 0;
        if (cognitoUserExists && listUsersResult.Users?.[0]?.Username) {
          cognitoUsername = listUsersResult.Users[0].Username;
          console.log('Found existing Cognito user:', cognitoUsername);
        } else {
          console.log('No existing Cognito user found');
        }
      } catch (error) {
        console.error('Error checking Cognito user existence:', error);
        throw new HttpException(
          `Failed to check user existence: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // 3. Create user in Cognito if they don't exist
      if (!cognitoUserExists) {
        console.log('4. Creating new Cognito user...');
        try {
          const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1!';
          const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_POOL_ID,
            Username: userEmail,
            UserAttributes: [
              { Name: 'email', Value: userEmail },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: userName },
              { Name: 'phone_number', Value: userSub },
              { Name: 'phone_number_verified', Value: 'true' },
              { Name: 'custom:role', Value: Roles.USER }
            ],
            TemporaryPassword: randomPassword,
            MessageAction: 'SUPPRESS',
            DesiredDeliveryMediums: [],
          });

          const createResult = await this.cognitoClient.send(createUserCommand);
          cognitoUsername = createResult.User?.Username || userEmail;
          console.log('Cognito user created successfully:', cognitoUsername);

          // Create user in local database
          const newUserInput = {
            email: userEmail,
            name: userName,
            role: Roles.USER,
            userSub: cognitoUsername,
            isConfirmed: true
          };
          
          try {
            await this.userService.createUser(newUserInput);
            console.log('Local user created successfully');
          } catch (createError) {
            console.error('Error creating local user:', createError);
            if (!(createError instanceof HttpException && createError.getStatus() === HttpStatus.CONFLICT)) {
              throw new HttpException(
                `Failed to create local user: ${createError.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }
          }
        } catch (error) {
          console.error('Error creating Cognito user:', error);
          throw new HttpException(
            `Failed to provision user in Cognito: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }

      // 4. Find user in local database
      console.log('5. Finding user in local database...');
      let localUser: User | null = null;
      try {
        if (cognitoUsername) {
          try {
            localUser = await this.userService.findUserByUserSub(cognitoUsername);
            console.log('Found local user by userSub:', cognitoUsername);
          } catch (error) {
            console.log('User not found by userSub, trying email...');
            localUser = await this.userService.findUserByEmail(userEmail);
          }
        }
      } catch (error) {
        console.error('Error finding local user:', error);
        throw new HttpException(
          'Failed to find local user record',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      if (!localUser) {
        console.log('User not found by userSub, trying email...');
        localUser = await this.userService.findUserByEmail(userEmail);
      }
      if (!localUser) {
        console.error('Could not find user in local database');
        throw new HttpException(
          'Could not retrieve final local user data',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      console.log('Found local user:', { id: localUser.id, email: localUser.email });

      // 5. Get Cognito tokens using regular authentication
      console.log('6. Initiating regular authentication flow...');
      const authParams = {
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId || '',
        AuthParameters: {
          USERNAME: userEmail,
          PASSWORD: userSub, // Using the Apple sub as a temporary password
          SECRET_HASH: computeSecretHash(userEmail)
        },
      };

      console.log('Auth params:', { ...authParams, AuthParameters: { ...authParams.AuthParameters, PASSWORD: '[REDACTED]', SECRET_HASH: '[REDACTED]' } });
      const authCommand = new InitiateAuthCommand(authParams);
      const authResult = await this.cognitoClient.send(authCommand);
      console.log('Auth result:', { 
        ChallengeName: authResult.ChallengeName,
        Session: authResult.Session ? '[PRESENT]' : '[MISSING]',
        AuthenticationResult: authResult.AuthenticationResult ? '[PRESENT]' : '[MISSING]'
      });

      if (authResult?.AuthenticationResult?.AccessToken && localUser) {
        console.log('7. Authentication successful!');
        return {
          statusCode: HttpStatus.OK,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: authResult.AuthenticationResult.AccessToken,
            expires_in: authResult.AuthenticationResult.ExpiresIn,
            refresh_token: authResult.AuthenticationResult.RefreshToken,
            token_type: authResult.AuthenticationResult.TokenType,
            user: {
              ...localUser,
              role: localUser.role[0] || null,
            },
          },
        };
      }

      // If regular auth fails, try admin auth
      console.log('Regular auth failed, attempting admin auth...');
      const adminAuthParams = {
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        ClientId: this.clientId || '',
        UserPoolId: process.env.COGNITO_POOL_ID || '',
        AuthParameters: {
          USERNAME: userEmail,
          PASSWORD: userSub,
          SECRET_HASH: computeSecretHash(userEmail)
        },
      };

      const adminAuthCommand = new AdminInitiateAuthCommand(adminAuthParams);
      const adminAuthResult = await this.cognitoClient.send(adminAuthCommand);

      if (adminAuthResult?.AuthenticationResult?.AccessToken && localUser) {
        console.log('Admin auth successful!');
        return {
          statusCode: HttpStatus.OK,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: adminAuthResult.AuthenticationResult.AccessToken,
            expires_in: adminAuthResult.AuthenticationResult.ExpiresIn,
            refresh_token: adminAuthResult.AuthenticationResult.RefreshToken,
            token_type: adminAuthResult.AuthenticationResult.TokenType,
            user: {
              ...localUser,
              role: localUser.role[0] || null,
            },
          },
        };
      }

      throw new HttpException(
        'Authentication failed after all attempts',
        HttpStatus.UNAUTHORIZED
      );
    } catch (error) {
      console.error('Apple sign-in process failed:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Apple sign-in failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
