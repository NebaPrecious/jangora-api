export type ExpenseView = 'daily' | 'weekly' | 'monthly';

export interface ExpenseQueryDto {
  search?: unknown;
  category?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  minAmount?: unknown;
  maxAmount?: unknown;
  view?: unknown;
  page?: unknown;
  limit?: unknown;
}
