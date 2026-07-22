import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Expense, ExpenseCategory, ExpenseRecurrenceType } from './entities/expense.entity';

export interface ExpenseInput {
  amount?: string;
  currency?: string;
  category?: ExpenseCategory;
  date?: Date;
  note?: string | null;
  isRecurring?: boolean;
  recurrenceType?: ExpenseRecurrenceType | null;
}

export interface ExpenseFilters {
  search?: string;
  category?: ExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: string;
  maxAmount?: string;
  view?: 'daily' | 'weekly' | 'monthly';
  page: number;
  limit: number;
}

export interface ExpenseListResult {
  data: Expense[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expensesRepository: Repository<Expense>,
  ) {}

  async createForUser(user: User, input: Required<ExpenseInput>): Promise<Expense> {
    const expense = this.expensesRepository.create({
      user,
      userId: user.id,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      date: input.date,
      note: input.note,
      isRecurring: input.isRecurring,
      recurrenceType: input.isRecurring ? input.recurrenceType : null,
    });

    return this.expensesRepository.save(expense);
  }

  async findForUser(user: User, filters: ExpenseFilters): Promise<ExpenseListResult> {
    const query = this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId: user.id })
      .orderBy('expense.date', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    this.applyFilters(query, filters);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findRecentForUser(user: User): Promise<Expense[]> {
    return this.expensesRepository.find({
      where: { userId: user.id },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 5,
    });
  }

  async getSummaryForUser(user: User, now = new Date()) {
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    const current = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.userId = :userId', { userId: user.id })
      .andWhere('expense.date >= :from', { from: currentMonthStart })
      .andWhere('expense.date < :to', { to: nextMonthStart })
      .getRawOne<{ total: string; count: string }>();

    const previous = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId: user.id })
      .andWhere('expense.date >= :from', { from: previousMonthStart })
      .andWhere('expense.date < :to', { to: currentMonthStart })
      .getRawOne<{ total: string }>();

    const categories = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.userId = :userId', { userId: user.id })
      .andWhere('expense.date >= :from', { from: currentMonthStart })
      .andWhere('expense.date < :to', { to: nextMonthStart })
      .groupBy('expense.category')
      .orderBy('total', 'DESC')
      .getRawMany<{ category: ExpenseCategory; total: string }>();

    const totalSpentThisMonth = this.toMoneyNumber(current?.total);
    const previousMonthTotal = this.toMoneyNumber(previous?.total);

    return {
      totalSpentThisMonth,
      transactionCountThisMonth: Number(current?.count ?? 0),
      spendingByCategory: categories.map((item) => ({
        category: item.category,
        total: this.toMoneyNumber(item.total),
      })),
      previousMonthTotal,
      monthOverMonthChange: totalSpentThisMonth - previousMonthTotal,
    };
  }

  async findOneForUser(user: User, id: string): Promise<Expense> {
    const expense = await this.expensesRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!expense) {
      throw new NotFoundException('Expense was not found.');
    }

    return expense;
  }

  async updateForUser(user: User, id: string, input: ExpenseInput): Promise<Expense> {
    const expense = await this.findOneForUser(user, id);

    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.currency !== undefined) expense.currency = input.currency;
    if (input.category !== undefined) expense.category = input.category;
    if (input.date !== undefined) expense.date = input.date;
    if (input.note !== undefined) expense.note = input.note;

    if (input.isRecurring !== undefined) {
      expense.isRecurring = input.isRecurring;
      expense.recurrenceType = input.isRecurring ? (input.recurrenceType ?? expense.recurrenceType) : null;
    } else if (input.recurrenceType !== undefined) {
      expense.recurrenceType = expense.isRecurring ? input.recurrenceType : null;
    }

    return this.expensesRepository.save(expense);
  }

  async deleteForUser(user: User, id: string): Promise<void> {
    const result = await this.expensesRepository.delete({ id, userId: user.id });

    if (!result.affected) {
      throw new NotFoundException('Expense was not found.');
    }
  }

  private applyFilters(query: ReturnType<Repository<Expense>['createQueryBuilder']>, filters: ExpenseFilters): void {
    if (filters.search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('expense.note ILIKE :search', { search: `%${filters.search}%` }).orWhere(
            'expense.category::text ILIKE :search',
            { search: `%${filters.search}%` },
          );
        }),
      );
    }

    if (filters.category) {
      query.andWhere('expense.category = :category', { category: filters.category });
    }

    if (filters.dateFrom) {
      query.andWhere('expense.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('expense.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters.minAmount) {
      query.andWhere('expense.amount >= :minAmount', { minAmount: filters.minAmount });
    }

    if (filters.maxAmount) {
      query.andWhere('expense.amount <= :maxAmount', { maxAmount: filters.maxAmount });
    }

    if (filters.view) {
      const truncUnit = {
        daily: 'day',
        weekly: 'week',
        monthly: 'month',
      }[filters.view];
      query.andWhere('date_trunc(:view, expense.date) = date_trunc(:view, now())', { view: truncUnit });
    }
  }

  private toMoneyNumber(value?: string | null): number {
    return Number(Number(value ?? 0).toFixed(2));
  }
}
