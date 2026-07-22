import { ExpenseCategory, ExpenseRecurrenceType } from '../entities/expense.entity';

export interface UpdateExpenseDto {
  amount?: unknown;
  currency?: unknown;
  category?: ExpenseCategory;
  date?: unknown;
  note?: unknown;
  isRecurring?: unknown;
  recurrenceType?: ExpenseRecurrenceType | null;
}
