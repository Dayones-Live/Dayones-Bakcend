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

@Injectable()
export class CognitoService {
  private clientId = process.env.COGNITO_CLIENT_ID; // Replace with your App Client ID
  private cognitoClient;

  constructor(
    private userService: UserService,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {
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
      // Initialize Google OAuth client with explicit client ID
      const client = new OAuth2Client('918802616844-2rkeh1hqa9jga6r90g0tpphqoocs0rm3.apps.googleusercontent.com');
      
      // 1. Verify the Google token
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: '918802616844-2rkeh1hqa9jga6r90g0tpphqoocs0rm3.apps.googleusercontent.com',
      });
      
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new HttpException('Invalid Google token payload', HttpStatus.UNAUTHORIZED);
      }

      const userEmail = payload.email;
      const userName = payload.name || '';
      const userPicture = payload.picture;
      const userSub = payload.sub; // Google's unique identifier

      // 2. Check if user exists in Cognito and get their userSub
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
        }
      } catch (error) {
        console.error('Error checking Cognito user existence:', error);
      }

      // 3. If user doesn't exist in Cognito, create them
      if (!cognitoUserExists) {
        console.log(`User ${userEmail} not found in Cognito. Creating...`);
        try {
          // Generate a secure random password (required but not used for login)
          const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1!';

          const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_POOL_ID,
            Username: userEmail,
            UserAttributes: [
              { Name: 'email', Value: userEmail },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: userName },
            ],
            TemporaryPassword: randomPassword,
            MessageAction: 'SUPPRESS',
            DesiredDeliveryMediums: [],
          });

          const createResult = await this.cognitoClient.send(createUserCommand);
          cognitoUserSub = createResult.User?.Username || '';
          console.log(`Cognito user ${userEmail} created successfully with UserSub: ${cognitoUserSub}`);

          // Ensure the user is also created in the local database
          const newUserInput = {
            email: userEmail,
            name: userName,
            role: Roles.USER,
            userSub: cognitoUserSub,
            isConfirmed: true,
            avatarUrl: userPicture
          };
          console.log('Creating local user with input:', newUserInput);
          let localUser: User;
          localUser = await this.userService.createUser(newUserInput);
          if (!localUser) {
              throw new Error('userService.createUser did not return a user object.');
          }
          console.log(`Local user ${userEmail} created successfully.`);
        } catch (error) {
          console.error(`Failed to create Cognito user ${userEmail}:`, error);
          throw new HttpException(`Failed to provision user in Cognito: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        console.log(`User ${userEmail} already exists in Cognito with sub: ${cognitoUserSub}`);
      }

      // 4. Find or create user in our local database
      let localUser: User | null = null;
      try {
        // First try to find by userSub if we have it
        if (cognitoUserSub) {
          try {
            localUser = await this.userService.findUserByUserSub(cognitoUserSub);
            console.log(`Found local user by userSub: ${cognitoUserSub}`);
          } catch (error) {
            console.log(`No local user found by userSub ${cognitoUserSub}, trying email...`);
          }
        }

        // If not found by userSub, try by email
        if (!localUser) {
          localUser = await this.userService.findUserByEmail(userEmail);
          console.log(`Found local user by email: ${userEmail}`);
        }

        // If user exists but has no userSub or different userSub, update it
        if (localUser && (!localUser.user_sub || localUser.user_sub !== cognitoUserSub)) {
          console.log(`Updating local user ${userEmail} with Cognito userSub: ${cognitoUserSub}`);
          const updateData: UserUpdateInput = {};
          if (localUser.avatar_url === null && userPicture) {
            updateData.avatarUrl = userPicture;
          }
          if (localUser.full_name !== userName && userName) {
            updateData.fullName = userName;
          }
          
          try {
            // First update the user_sub directly in the database
            await this.userRepository.update(localUser.id, { user_sub: cognitoUserSub });
            
            // Then update other fields if needed
            if (Object.keys(updateData).length > 0) {
              const updatedUserResponse = await this.userService.updateUser(updateData, localUser.id);
              if (updatedUserResponse && updatedUserResponse.data) {
                localUser = updatedUserResponse.data;
                console.log('Local user updated successfully with new userSub');
              } else {
                console.warn('Update response structure unexpected. Refetching user.');
                localUser = await this.userService.findUserByEmail(userEmail);
              }
            } else {
              // If no other fields to update, just refetch the user
              localUser = await this.userService.findUserByEmail(userEmail);
            }
          } catch (updateError) {
            console.error(`Failed to update local user ${userEmail}:`, updateError);
          }
        }
      } catch (error) {
        // Create user in our database if they don't exist locally
        if (error instanceof HttpException && (error.getStatus() === HttpStatus.NOT_FOUND || error.message.includes('User not found') || error.message.includes('User is deleted'))) {
          console.log(`User ${userEmail} not found locally. Creating...`);
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
              throw new Error('userService.createUser did not return a user object.');
            }
            console.log(`Local user ${userEmail} created successfully.`);
          } catch (createError) {
            console.error(`Failed to create local user ${userEmail}:`, createError);
            throw new HttpException('Failed to create local user record.', HttpStatus.INTERNAL_SERVER_ERROR);
          }
        } else {
          console.error('Unexpected error finding local user:', error);
          throw error;
        }
      }

      // 5. Get Cognito tokens using CUSTOM_AUTH flow
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

      // 6. Respond to the CUSTOM_CHALLENGE
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

        // 7. Return tokens and user info
        if (challengeResponse?.AuthenticationResult?.AccessToken && localUser) {
          console.log(`CUSTOM_AUTH successful for ${userEmail}. Returning tokens.`);
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
          console.error(`CUSTOM_AUTH challenge response failed for ${userEmail}. Response:`, challengeResponse);
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
}
