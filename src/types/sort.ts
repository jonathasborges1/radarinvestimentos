export type SortDirection = 'asc' | 'desc';

export type SortableColumn =
  | 'nickName'
  | 'product'
  | 'fee'
  | 'maturityDate'
  | 'puMinValue'
  | 'quantityAvailable'
  | 'riskScore'
  | 'ratingName'
  | 'code'
  | 'b3Code';

export interface SortConfig {
  column: SortableColumn | null;
  direction: SortDirection;
}
