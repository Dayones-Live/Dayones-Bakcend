jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
}));
jest.mock('jwks-rsa', () => jest.fn());
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: jest.fn(() => ({ verify: jest.fn() })) },
}));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn(), decode: jest.fn(), sign: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from './cognito.service';
import { UserService } from '@user/services/user.service';
import { User } from '@user/entities/user.entity';
import { Roles } from '@app/shared/constants/constants';

describe('CognitoService.signUp - DEMO_MODE duplicate-email rejection', () => {
  let service: CognitoService;
  let userService: {
    findUserByEmailOrNull: jest.Mock;
    createUser: jest.Mock;
  };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.DEMO_MODE = 'true';
    userService = {
      findUserByEmailOrNull: jest.fn(),
      createUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        { provide: UserService, useValue: userService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get(CognitoService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates a fresh DEMO_MODE user when email is not already in use', async () => {
    userService.findUserByEmailOrNull.mockResolvedValue(null);
    userService.createUser.mockResolvedValue({
      id: 'u1',
      email: 'fresh@example.com',
      role: [Roles.USER],
      user_sub: 'sub-1',
      password_hash: 'hash',
    });

    const res = await service.signUp({
      email: 'fresh@example.com',
      password: 'TestPass123!',
      role: Roles.USER,
      name: 'Fresh User',
      phoneNumber: undefined,
    } as any);

    expect(userService.findUserByEmailOrNull).toHaveBeenCalledWith('fresh@example.com');
    expect(userService.createUser).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.data.demo_confirmed).toBe(true);
  });

  it('throws 409 CONFLICT when email is already registered (DEMO_MODE)', async () => {
    userService.findUserByEmailOrNull.mockResolvedValue({
      id: 'existing-u',
      email: 'taken@example.com',
    });

    let caught: any = null;
    try {
      await service.signUp({
        email: 'taken@example.com',
        password: 'AnyPass1!',
        role: Roles.USER,
        name: 'Duplicate Attempt',
        phoneNumber: undefined,
      } as any);
    } catch (e) {
      caught = e;
    }

    expect(caught).not.toBeNull();
    expect(caught.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(caught.message).toMatch(/already exists/i);
    expect(userService.createUser).not.toHaveBeenCalled();
  });
});
