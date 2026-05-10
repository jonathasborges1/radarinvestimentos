import type { PaymentScheduleProvider } from '../types';
import { ecoagroPaymentScheduleProvider } from './ecoagroPaymentScheduleProvider';

/**
 * Lista de provedores ativos. Para adicionar um novo agente fiduciário:
 *   1. Crie `src/services/paymentSchedule/providers/<nome>Provider.ts`
 *      implementando `PaymentScheduleProvider`.
 *   2. Importe e registre aqui.
 *
 * A ordem importa apenas em caso de empate em `canHandle` (primeiro vence).
 */
export const paymentScheduleProviders: PaymentScheduleProvider[] = [
  ecoagroPaymentScheduleProvider,
];
