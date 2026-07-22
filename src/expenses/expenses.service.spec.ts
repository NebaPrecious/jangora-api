import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Expense, ExpenseCategory } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const user = { id: 'user-id' } as any;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: getRepositoryToken(Expense),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('creates expenses with the authenticated user id', async () => {
    const created = { userId: user.id, amount: '100.00' };
    repository.create.mockReturnValue(created);
    repository.save.mockResolvedValue(created);

    await expect(
      service.createForUser(user, {
        amount: '100.00',
        currency: 'XAF',
        category: ExpenseCategory.FOOD,
        date: new Date('2026-07-21T00:00:00.000Z'),
        note: null,
        isRecurring: false,
        recurrenceType: null,
      }),
    ).resolves.toEqual(created);

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ user, userId: user.id }));
  });

  it('lists expenses by user and applies category/date filters', async () => {
    const qb = createQueryBuilderMock();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'expense-id' }], 1]);
    repository.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.findForUser(user, {
        category: ExpenseCategory.FOOD,
        dateFrom: new Date('2026-07-01T00:00:00.000Z'),
        dateTo: new Date('2026-07-31T23:59:59.000Z'),
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [{ id: 'expense-id' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(qb.where).toHaveBeenCalledWith('expense.userId = :userId', { userId: user.id });
    expect(qb.andWhere).toHaveBeenCalledWith('expense.category = :category', { category: ExpenseCategory.FOOD });
    expect(qb.andWhere).toHaveBeenCalledWith('expense.date >= :dateFrom', expect.any(Object));
    expect(qb.andWhere).toHaveBeenCalledWith('expense.date <= :dateTo', expect.any(Object));
  });

  it('returns no more than five recent expenses', async () => {
    repository.find.mockResolvedValue([]);

    await service.findRecentForUser(user);

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: user.id },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 5,
    });
  });

  it('calculates monthly summary totals', async () => {
    const currentQb = createQueryBuilderMock();
    currentQb.getRawOne.mockResolvedValue({ total: '1250.50', count: '2' });
    const previousQb = createQueryBuilderMock();
    previousQb.getRawOne.mockResolvedValue({ total: '500.00' });
    const categoryQb = createQueryBuilderMock();
    categoryQb.getRawMany.mockResolvedValue([{ category: ExpenseCategory.FOOD, total: '1250.50' }]);
    repository.createQueryBuilder
      .mockReturnValueOnce(currentQb)
      .mockReturnValueOnce(previousQb)
      .mockReturnValueOnce(categoryQb);

    await expect(service.getSummaryForUser(user, new Date('2026-07-21T12:00:00.000Z'))).resolves.toEqual({
      totalSpentThisMonth: 1250.5,
      transactionCountThisMonth: 2,
      spendingByCategory: [{ category: ExpenseCategory.FOOD, total: 1250.5 }],
      previousMonthTotal: 500,
      monthOverMonthChange: 750.5,
    });
  });

  it('returns 404 instead of exposing another user expense', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOneForUser(user, 'expense-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'expense-id', userId: user.id } });
  });

  it('updates and deletes only user-owned expenses', async () => {
    const expense = { id: 'expense-id', userId: user.id, isRecurring: true, recurrenceType: 'Monthly' };
    repository.findOne.mockResolvedValue(expense);
    repository.save.mockImplementation(async (value) => value);
    repository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.updateForUser(user, 'expense-id', { note: 'Updated' })).resolves.toEqual({
      ...expense,
      note: 'Updated',
    });
    await expect(service.deleteForUser(user, 'expense-id')).resolves.toBeUndefined();

    expect(repository.delete).toHaveBeenCalledWith({ id: 'expense-id', userId: user.id });
  });

  it('returns 404 when deleting another user expense', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.deleteForUser(user, 'expense-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createQueryBuilderMock() {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  return qb;
}
