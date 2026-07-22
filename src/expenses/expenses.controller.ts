import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { ExpenseQueryDto, ExpenseView } from './dto/expense-query.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseInput, ExpensesService } from './expenses.service';
import { ExpenseCategory, ExpenseRecurrenceType } from './entities/expense.entity';

interface AuthenticatedRequest extends Request {
  user: DecodedIdToken;
}

const ALLOWED_EXPENSE_KEYS = ['amount', 'currency', 'category', 'date', 'note', 'isRecurring', 'recurrenceType'];
const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);
const RECURRENCE_TYPES = Object.values(ExpenseRecurrenceType);
const EXPENSE_VIEWS: ExpenseView[] = ['daily', 'weekly', 'monthly'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('expenses')
@UseGuards(FirebaseAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async createExpense(@Req() request: AuthenticatedRequest, @Body() body: CreateExpenseDto) {
    const user = await this.getAuthenticatedUser(request);
    const input = this.validateCreateBody(body);
    return this.expensesService.createForUser(user, input);
  }

  @Get()
  async getExpenses(@Req() request: AuthenticatedRequest, @Query() query: ExpenseQueryDto) {
    const user = await this.getAuthenticatedUser(request);
    return this.expensesService.findForUser(user, this.validateQuery(query));
  }

  @Get('recent')
  async getRecentExpenses(@Req() request: AuthenticatedRequest) {
    const user = await this.getAuthenticatedUser(request);
    return this.expensesService.findRecentForUser(user);
  }

  @Get('summary')
  async getExpenseSummary(@Req() request: AuthenticatedRequest) {
    const user = await this.getAuthenticatedUser(request);
    return this.expensesService.getSummaryForUser(user);
  }

  @Get(':id')
  async getExpenseById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request);
    return this.expensesService.findOneForUser(user, this.validateId(id));
  }

  @Patch(':id')
  async updateExpense(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateExpenseDto,
  ) {
    const user = await this.getAuthenticatedUser(request);
    const input = this.validateUpdateBody(body);
    return this.expensesService.updateForUser(user, this.validateId(id), input);
  }

  @Delete(':id')
  async deleteExpense(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request);
    await this.expensesService.deleteForUser(user, this.validateId(id));
    return { message: 'Expense deleted successfully.' };
  }

  private async getAuthenticatedUser(request: AuthenticatedRequest): Promise<User> {
    const user = await this.usersService.findByFirebaseUid(request.user.uid);

    if (!user) {
      throw new NotFoundException('Authenticated user has not been synchronized.');
    }

    return user;
  }

  private validateCreateBody(body: CreateExpenseDto): Required<ExpenseInput> {
    this.rejectUnsupportedBodyKeys(body);

    const amount = this.validateAmount(body.amount);
    const currency = this.validateCurrency(body.currency);
    const category = this.validateCategory(body.category);
    const date = this.validateDate(body.date);
    const note = this.validateNote(body.note);
    const isRecurring = this.validateBoolean(body.isRecurring, 'Recurring expense must be true or false.');
    const recurrenceType = this.validateRecurrenceType(body.recurrenceType, isRecurring);

    return { amount, currency, category, date, note, isRecurring, recurrenceType };
  }

  private validateUpdateBody(body: UpdateExpenseDto): ExpenseInput {
    this.rejectUnsupportedBodyKeys(body);

    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Please provide at least one expense field to update.');
    }

    const input: ExpenseInput = {};

    if (body.amount !== undefined) input.amount = this.validateAmount(body.amount);
    if (body.currency !== undefined) input.currency = this.validateCurrency(body.currency);
    if (body.category !== undefined) input.category = this.validateCategory(body.category);
    if (body.date !== undefined) input.date = this.validateDate(body.date);
    if (body.note !== undefined) input.note = this.validateNote(body.note);
    if (body.isRecurring !== undefined) {
      input.isRecurring = this.validateBoolean(body.isRecurring, 'Recurring expense must be true or false.');
    }

    if (body.recurrenceType !== undefined || input.isRecurring !== undefined) {
      input.recurrenceType = this.validateRecurrenceType(body.recurrenceType, input.isRecurring ?? true);
    }

    return input;
  }

  private validateQuery(query: ExpenseQueryDto) {
    const page = this.validatePositiveInteger(query.page, 1, 1, 100000);
    const limit = this.validatePositiveInteger(query.limit, 20, 1, 50);
    const category = query.category === undefined ? undefined : this.validateCategory(query.category);
    const view = query.view === undefined || query.view === '' ? undefined : String(query.view);

    if (view !== undefined && !EXPENSE_VIEWS.includes(view as ExpenseView)) {
      throw new BadRequestException('Please choose a valid expense view.');
    }

    return {
      search: typeof query.search === 'string' ? query.search.trim().slice(0, 80) || undefined : undefined,
      category,
      dateFrom: query.dateFrom === undefined || query.dateFrom === '' ? undefined : this.validateDate(query.dateFrom),
      dateTo: query.dateTo === undefined || query.dateTo === '' ? undefined : this.validateDate(query.dateTo),
      minAmount: query.minAmount === undefined || query.minAmount === '' ? undefined : this.validateAmount(query.minAmount),
      maxAmount: query.maxAmount === undefined || query.maxAmount === '' ? undefined : this.validateAmount(query.maxAmount),
      view: view as ExpenseView | undefined,
      page,
      limit,
    };
  }

  private rejectUnsupportedBodyKeys(body: object | null | undefined): void {
    const unsupportedKey = Object.keys(body ?? {}).find((key) => !ALLOWED_EXPENSE_KEYS.includes(key));

    if (unsupportedKey) {
      throw new BadRequestException('Unsupported expense field was provided.');
    }
  }

  private validateId(id: string): string {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException('Expense was not found.');
    }

    return id;
  }

  private validateAmount(value: unknown): string {
    const amountText = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) {
      throw new BadRequestException('Please enter a valid positive amount.');
    }

    return Number(amountText).toFixed(2);
  }

  private validateCurrency(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
      throw new BadRequestException('Please choose a valid currency.');
    }

    return value.trim().toUpperCase();
  }

  private validateCategory(value: unknown): ExpenseCategory {
    if (!EXPENSE_CATEGORIES.includes(value as ExpenseCategory)) {
      throw new BadRequestException('Please choose a valid expense category.');
    }

    return value as ExpenseCategory;
  }

  private validateDate(value: unknown): Date {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      throw new BadRequestException('Please choose a valid expense date.');
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Please choose a valid expense date.');
    }

    return date;
  }

  private validateNote(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Expense note must be text.');
    }

    const note = value.trim();

    if (note.length > 240) {
      throw new BadRequestException('Expense note must be 240 characters or fewer.');
    }

    return note || null;
  }

  private validateBoolean(value: unknown, message: string): boolean {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(message);
    }

    return value;
  }

  private validateRecurrenceType(value: unknown, isRecurring: boolean): ExpenseRecurrenceType | null {
    if (!isRecurring) {
      return null;
    }

    if (!RECURRENCE_TYPES.includes(value as ExpenseRecurrenceType)) {
      throw new BadRequestException('Please choose a valid recurrence type.');
    }

    return value as ExpenseRecurrenceType;
  }

  private validatePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < min) {
      throw new BadRequestException('Please choose valid pagination values.');
    }

    return Math.min(parsed, max);
  }
}
