const mockAccountsCreate = jest.fn();
const mockAccountsRetrieve = jest.fn();
const mockAccountLinksCreate = jest.fn();
jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    accounts: { create: mockAccountsCreate, retrieve: mockAccountsRetrieve },
    accountLinks: { create: mockAccountLinksCreate },
  }));
  return { __esModule: true, default: StripeMock };
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeAccount } from './entities/stripe-account.entity';

describe('StripeService.createConnectAccount + getConnectStatus', () => {
  let service: StripeService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    process.env.STRIPE_CONNECT_RETURN_URL = 'https://dayones.app/stripe/return';
    process.env.STRIPE_CONNECT_REFRESH_URL = 'https://dayones.app/stripe/refresh';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: getRepositoryToken(StripeAccount), useValue: repo },
      ],
    }).compile();

    service = module.get(StripeService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('createConnectAccount - success path', () => {
    it('creates a fresh Stripe Express account when none exists, then returns onboarding url', async () => {
      repo.findOne.mockResolvedValue(null);
      mockAccountsCreate.mockResolvedValue({ id: 'acct_TESTbrand' });
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/e/test',
      });

      const result = await service.createConnectAccount('user-1', 'artist@test.com');

      expect(mockAccountsCreate).toHaveBeenCalledWith({
        type: 'express',
        email: 'artist@test.com',
        capabilities: { transfers: { requested: true } },
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', stripe_account_id: 'acct_TESTbrand' }),
      );
      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_TESTbrand',
        refresh_url: 'https://dayones.app/stripe/refresh',
        return_url: 'https://dayones.app/stripe/return',
        type: 'account_onboarding',
      });
      expect(result.url).toBe('https://connect.stripe.com/setup/e/test');
    });

    it('reuses the existing Stripe account_id when one is on file but not yet completed', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        stripe_account_id: 'acct_EXISTING',
        onboarding_complete: false,
      });
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/c/continue',
      });

      const result = await service.createConnectAccount('user-1', 'artist@test.com');

      expect(mockAccountsCreate).not.toHaveBeenCalled();
      expect(mockAccountLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'acct_EXISTING' }),
      );
      expect(result.url).toBe('https://connect.stripe.com/setup/c/continue');
    });

    it('rejects with 400 when artist is already fully onboarded', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        stripe_account_id: 'acct_DONE',
        onboarding_complete: true,
      });

      await expect(service.createConnectAccount('user-1', 'artist@test.com')).rejects.toMatchObject(
        { status: HttpStatus.BAD_REQUEST },
      );
      expect(mockAccountsCreate).not.toHaveBeenCalled();
    });
  });

  describe('createConnectAccount - failure paths', () => {
    it('returns friendly 503 when platform has not signed up for Connect', async () => {
      repo.findOne.mockResolvedValue(null);
      mockAccountsCreate.mockRejectedValue(
        new Error(
          'You can only create new accounts if you have signed up for Connect, which you can do at https://dashboard.stripe.com/connect.',
        ),
      );

      let caught: HttpException | null = null;
      try {
        await service.createConnectAccount('user-1', 'artist@test.com');
      } catch (e) {
        caught = e as HttpException;
      }
      expect(caught).not.toBeNull();
      expect(caught!.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(caught!.message).toMatch(/Payouts are not yet enabled/);
    });
  });

  describe('getConnectStatus', () => {
    it('returns connected=false when no stripe_account row exists', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.getConnectStatus('user-1');

      expect(result).toEqual({
        connected: false,
        onboarding_complete: false,
        payouts_enabled: false,
      });
      expect(mockAccountsRetrieve).not.toHaveBeenCalled();
    });

    it('persists newly-completed onboarding back to DB on status check', async () => {
      const row: any = {
        user_id: 'user-1',
        stripe_account_id: 'acct_TESTbrand',
        onboarding_complete: false,
        payouts_enabled: false,
      };
      repo.findOne.mockResolvedValue(row);
      mockAccountsRetrieve.mockResolvedValue({
        id: 'acct_TESTbrand',
        details_submitted: true,
        payouts_enabled: true,
      });

      const result = await service.getConnectStatus('user-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ onboarding_complete: true, payouts_enabled: true }),
      );
      expect(result).toEqual({
        connected: true,
        onboarding_complete: true,
        payouts_enabled: true,
        stripe_account_id: 'acct_TESTbrand',
      });
    });

    it('returns false flags when Stripe says onboarding still incomplete', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        stripe_account_id: 'acct_PARTIAL',
        onboarding_complete: false,
        payouts_enabled: false,
      });
      mockAccountsRetrieve.mockResolvedValue({
        id: 'acct_PARTIAL',
        details_submitted: false,
        payouts_enabled: false,
      });

      const result = await service.getConnectStatus('user-1');

      expect(result.connected).toBe(true);
      expect(result.onboarding_complete).toBe(false);
      expect(result.payouts_enabled).toBe(false);
    });
  });
});
