import type { SortableColumn } from './sort';

export type ColumnKey =
  | 'nickName'
  | 'code'
  | 'product'
  | 'fee'
  | 'maturityDate'
  | 'puMinValue'
  | 'paymentVsPuMin'
  | 'minimumQuantityForApplication'
  | 'quantityAvailable'
  | 'indexers'
  | 'ratingName'
  | 'agencyName'
  | 'riskScore'
  | 'descriptionInterestrates'
  | 'descriptionAmortization'
  | 'graceDate'
  | 'redemptionType'
  | 'incentive'
  | 'guaranteeFGC'
  | 'qualifiedInvestor'
  | 'professionalInvestor'
  | 'generalInvestor'
  | 'prefixedFeeValue'
  | 'b3Code'
  | 'fiduciaryAgentUrl'
  | 'notes'
  | 'favorite'
  | 'tags'
  | 'trackingStatus'
  | 'actions';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortable?: SortableColumn;
  defaultVisible: boolean;
  pinned?: boolean;
  group: 'original' | 'custom' | 'ui';
}
