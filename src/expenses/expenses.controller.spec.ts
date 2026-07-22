import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FirebaseAdminService } from '../firebase-admin/firebase-admin.service';
import { UsersService } from '../users/users.service';
import { ExpenseCategory } from './entities/expense.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('ExpensesController', () => {
  let controller: ExpensesController;
  const user = { id: 'user-id', firebaseUid: 'firebase-uid' };
  const usersService = {
    findByFirebaseUid: jest.fn(),
  };
  const expensesService = {
    createForUser: jest.fn(),
    findForUser: jest.fn(),
    findRecentForUser: jest.fn(),
    getSummaryForUser: jest.fn(),
    findOneForUser: jest.fn(),
    updateForUser: jest.fn(),
    deleteForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    usersService.findByFirebaseUid.mockResolvedValue(user);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: ExpensesService, useValue: expensesService },
        { provide: FirebaseAdminService, useValue: { verifyIdToken: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
  });

  it('creates an expense for the authenticated user only', async () => {
    const expense = { id: 'expense-id', userId: user.id };
    expensesService.createForUser.mockResolvedValue(expense);

    await expect(
      controller.createExpense({ user: { uid: 'firebase-uid' } } as any, {
        amount: '1250',
        currency: 'xaf',
        category: ExpenseCategory.FOOD,
        date: '2026-07-21T08:00:00.000Z',
        note: 'Lunch',
        isRecurring: false,
        recurrenceType: 'Monthly' as any,
      }),
    ).resolves.toEqual(expense);

    expect(usersService.findByFirebaseUid).toHaveBeenCalledWith('firebase-uid');
    expect(expensesService.createForUser).toHaveBeenCalledWith(user, {
      amount: '1250.00',
      currency: 'XAF',
      category: ExpenseCategory.FOOD,
      date: new Date('2026-07-21T08:00:00.000Z'),
      note: 'Lunch',
      isRecurring: false,
      recurrenceType: null,
    });
  });

  it('lists only authenticated user expenses with filters', async () => {
    const result = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    expensesService.findForUser.mockResolvedValue(result);

    await expect(
      controller.getExpenses({ user: { uid: 'firebase-uid' } } as any, {
        category: ExpenseCategory.TRANSPORT,
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        page: '1',
        limit: '20',
      }),
    ).resolves.toEqual(result);

    expect(expensesService.findForUser).toHaveBeenCalledWith(user, expect.objectContaining({
      category: ExpenseCategory.TRANSPORT,
      page: 1,
      limit: 20,
    }));
  });

  it('returns recent and summary for the authenticated user', async () => {
    expensesService.findRecentForUser.mockResolvedValue([{ id: 'one' }]);
    expensesService.getSummaryForUser.mockResolvedValue({ totalSpentThisMonth: 1000 });

    await expect(controller.getRecentExpenses({ user: { uid: 'firebase-uid' } } as any)).resolves.toEqual([
      { id: 'one' },
    ]);
    await expect(controller.getExpenseSummary({ user: { uid: 'firebase-uid' } } as any)).resolves.toEqual({
      totalSpentThisMonth: 1000,
    });
  });

  it('uses user-scoped lookup, update, and delete operations', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expensesService.findOneForUser.mockResolvedValue({ id, userId: user.id });
    expensesService.updateForUser.mockResolvedValue({ id, note: 'Updated' });
    expensesService.deleteForUser.mockResolvedValue(undefined);

    await controller.getExpenseById({ user: { uid: 'firebase-uid' } } as any, id);
    await controller.updateExpense({ user: { uid: 'firebase-uid' } } as any, id, { note: 'Updated' });
    await controller.deleteExpense({ user: { uid: 'firebase-uid' } } as any, id);

    expect(expensesService.findOneForUser).toHaveBeenCalledWith(user, id);
    expect(expensesService.updateForUser).toHaveBeenCalledWith(user, id, { note: 'Updated' });
    expect(expensesService.deleteForUser).toHaveBeenCalledWith(user, id);
  });

  it('returns 404 for invalid or other-user expense access', async () => {
    await expect(controller.getExpenseById({ user: { uid: 'firebase-uid' } } as any, 'not-an-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const id = '11111111-1111-4111-8111-111111111111';
    expensesService.findOneForUser.mockRejectedValue(new NotFoundException('Expense was not found.'));
    await expect(controller.getExpenseById({ user: { uid: 'firebase-uid' } } as any, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects malformed amount, category, date, recurrence, and unsupported fields', async () => {
    const base = {
      amount: '10',
      currency: 'XAF',
      category: ExpenseCategory.FOOD,
      date: '2026-07-21',
      isRecurring: false,
    };

    await expect(controller.createExpense({ user: { uid: 'firebase-uid' } } as any, { ...base, amount: '-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.createExpense({ user: { uid: 'firebase-uid' } } as any, { ...base, category: 'Rent' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.createExpense({ user: { uid: 'firebase-uid' } } as any, { ...base, date: 'bad-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.createExpense({ user: { uid: 'firebase-uid' } } as any, {
        ...base,
        isRecurring: true,
        recurrenceType: 'Yearly' as any,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.createExpense({ user: { uid: 'firebase-uid' } } as any, { ...base, userId: 'bad' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not create records for repeated read requests', async () => {
    expensesService.findForUser.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    await controller.getExpenses({ user: { uid: 'firebase-uid' } } as any, {});
    await controller.getExpenses({ user: { uid: 'firebase-uid' } } as any, {});

    expect(expensesService.createForUser).not.toHaveBeenCalled();
  });
});
