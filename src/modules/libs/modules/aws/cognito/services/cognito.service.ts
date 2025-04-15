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
              { Name: 'name.formatted', Value: userName },
              { Name: 'phone_number', Value: userSub },
              { Name: 'custom:role', Value: Roles.USER }
            ],
            TemporaryPassword: randomPassword,
            MessageAction: 'SUPPRESS',
            DesiredDeliveryMediums: [],
          });

          const createResult = await this.cognitoClient.send(createUserCommand);
          cognitoUserSub = createResult.User?.Username || '';
          console.log(`Cognito user created successfully with UserSub: ${cognitoUserSub}`);

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
        console.log(`Responding to CUSTOM_CHALLENGE for ${userEmail}...`);
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
  }

  /**
   * This service handles Sign In with Apple
   * @param appleIdToken The ID token received from Apple
   * @returns {GlobalServiceResponse}
   */
  async signInWithApple(appleIdToken: string): Promise<GlobalServiceResponse> {
    console.log('Starting Apple sign-in process...');
    try {
      // 1. Verify the Apple token
      console.log('Verifying Apple token...');
      let applePayload: any;
      try {
        const decodedToken = jwt.decode(appleIdToken, { complete: true });
        if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
          console.error('Invalid Apple token format:', decodedToken);
          throw new HttpException('Invalid Apple token format', HttpStatus.UNAUTHORIZED);
        }

        const key = await this.jwksClient.getSigningKey(decodedToken.header.kid);
        const signingKey = key.getPublicKey();
        
        applePayload = jwt.verify(appleIdToken, signingKey, {
          algorithms: ['RS256'],
          audience: this.configService.get<string>('APPLE_CLIENT_ID'),
          issuer: 'https://appleid.apple.com',
          ignoreExpiration: false,
        });

        console.log('Apple token verified successfully');
      } catch (verificationError) {
        console.error('Apple token verification failed:', verificationError);
        throw new HttpException(
          `Apple token verification failed: ${verificationError.message}`,
          HttpStatus.UNAUTHORIZED
        );
      }
      
      if (!applePayload || !applePayload.email || !applePayload.sub) {
        console.error('Invalid Apple token payload:', applePayload);
        throw new HttpException('Invalid Apple token payload', HttpStatus.UNAUTHORIZED);
      }

      const userEmail = applePayload.email;
      const userName = applePayload.name || 'Apple User'; // Provide a default name if not provided
      const userSub = applePayload.sub;

      // Format the Apple sub into a valid phone number format
      // Take the first 10 characters of the sub and format as +1XXXXXXXXXX
      const formattedPhoneNumber = `+1${userSub.replace(/[^0-9]/g, '').substring(0, 10)}`;

      console.log(`Processing Apple sign-in for user: ${userEmail}`);

      // 2. Check if user exists in Cognito
      console.log(`Checking if user ${userEmail} exists in Cognito...`);
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
          console.log(`Found existing Cognito user with Username: ${cognitoUsername}`);
        } else {
          console.log(`No existing Cognito user found for ${userEmail}`);
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
              { Name: 'name.formatted', Value: userName },
              { Name: 'phone_number', Value: formattedPhoneNumber }, // Use formatted phone number
              { Name: 'custom:role', Value: Roles.USER }
            ],
            TemporaryPassword: randomPassword,
            MessageAction: 'SUPPRESS',
            DesiredDeliveryMediums: [],
          });

          const createResult = await this.cognitoClient.send(createUserCommand);
          cognitoUsername = createResult.User?.Username || userEmail;
          console.log(`Cognito user created successfully with Username: ${cognitoUsername}`);

          // Create user in local database
          console.log('Creating local database user...');
          const newUserInput = {
            email: userEmail,
            name: userName,
            role: Roles.USER,
            userSub: cognitoUsername,
            isConfirmed: true,
            phoneNumber: formattedPhoneNumber // Use formatted phone number
          };
          
          try {
            const localUser = await this.userService.createUser(newUserInput);
            if (!localUser) {
              throw new Error('Failed to create local user: userService.createUser returned null');
            }
            console.log(`Local user created successfully with ID: ${localUser.id}`);
          } catch (createError) {
            console.error('Failed to create local user:', createError);
            if (createError instanceof HttpException && createError.getStatus() === HttpStatus.CONFLICT) {
              console.log(`Local user ${userEmail} already exists. Proceeding to link.`);
            } else {
              throw new HttpException(
                `Failed to create local user: ${createError.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }
          }
        } catch (error) {
          console.error(`Failed to create Cognito user ${userEmail}:`, error);
          throw new HttpException(
            `Failed to provision user in Cognito: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }

      // 4. Find or update user in local database
      console.log('Checking local database for user...');
      let localUser: User | null = null;
      try {
        if (cognitoUsername) {
          try {
            localUser = await this.userService.findUserByUserSub(cognitoUsername);
            console.log(`Found local user by userSub: ${cognitoUsername}`);
          } catch (error) {
            console.log(`No local user found by userSub ${cognitoUsername}, trying email...`);
            localUser = await this.userService.findUserByEmail(userEmail);
            console.log(`Found local user by email: ${userEmail}`);
          }
        }

        if (localUser && userName && localUser.full_name !== userName) {
          console.log(`Updating local user name to: ${userName}`);
          const updateData: UserUpdateInput = { fullName: userName };
          await this.userService.updateUser(updateData, localUser.id);
          localUser.full_name = userName;
        }
      } catch (error) {
        console.error('Error finding/updating local user:', error);
        throw new HttpException(
          'Failed to find or update local user record',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Ensure we have the user object for the response
      if (!localUser) {
        console.log('Refetching local user after potential creation/update...');
        localUser = await this.userService.findUserByEmail(userEmail);
      }
      if (!localUser) {
        throw new HttpException(
          'Could not retrieve final local user data',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // 5. Get Cognito tokens using CUSTOM_AUTH flow
      console.log(`Initiating CUSTOM_AUTH flow for ${cognitoUsername}...`);
      const authParams = {
        AuthFlow: AuthFlowType.CUSTOM_AUTH,
        ClientId: this.clientId || '',
        UserPoolId: process.env.COGNITO_POOL_ID || '',
        AuthParameters: {
          USERNAME: cognitoUsername,
          SECRET_HASH: computeSecretHash(cognitoUsername)
        },
      };

      const authCommand = new AdminInitiateAuthCommand(authParams);
      const authResult = await this.cognitoClient.send(authCommand);
      console.log('Auth result:', authResult);

      // 6. Respond to CUSTOM_CHALLENGE
      if (authResult.ChallengeName === 'CUSTOM_CHALLENGE') {
        console.log(`Responding to CUSTOM_CHALLENGE for ${cognitoUsername}...`);
        const challengeResponse = await this.cognitoClient.send(
          new AdminRespondToAuthChallengeCommand({
            ChallengeName: 'CUSTOM_CHALLENGE',
            ClientId: this.clientId || '',
            UserPoolId: process.env.COGNITO_POOL_ID || '',
            ChallengeResponses: {
              USERNAME: cognitoUsername,
              SECRET_HASH: computeSecretHash(cognitoUsername),
              ANSWER: appleIdToken
            },
            Session: authResult.Session,
          }),
        );
        console.log('Challenge response:', challengeResponse);

        if (challengeResponse.AuthenticationResult) {
          const finalLocalUser = await this.userService.findUserByUserSub(cognitoUsername);
          return {
            statusCode: HttpStatus.OK,
            message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
            data: {
              access_token: challengeResponse.AuthenticationResult.AccessToken,
              expires_in: challengeResponse.AuthenticationResult.ExpiresIn,
              refresh_token: challengeResponse.AuthenticationResult.RefreshToken,
              token_type: challengeResponse.AuthenticationResult.TokenType,
              user: {
                ...finalLocalUser,
                role: finalLocalUser.role[0] || null,
              },
            },
          };
        } else {
          throw new HttpException(
            'CUSTOM_AUTH challenge response failed',
            HttpStatus.UNAUTHORIZED
          );
        }
      } else if (authResult.AuthenticationResult) {
        const finalLocalUser = await this.userService.findUserByUserSub(cognitoUsername);
        return {
          statusCode: HttpStatus.OK,
          message: SUCCESS_MESSAGES.USER_SIGN_IN_SUCCESS,
          data: {
            access_token: authResult.AuthenticationResult.AccessToken,
            expires_in: authResult.AuthenticationResult.ExpiresIn,
            refresh_token: authResult.AuthenticationResult.RefreshToken,
            token_type: authResult.AuthenticationResult.TokenType,
            user: {
              ...finalLocalUser,
              role: finalLocalUser.role[0] || null,
            },
          },
        };
      } else {
        throw new HttpException(
          'Cognito authentication failed after Apple verification',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      console.error('Apple sign-in error:', error);
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
