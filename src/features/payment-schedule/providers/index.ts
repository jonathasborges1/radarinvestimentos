import type { PaymentScheduleProvider } from '../types';
import { ecoagroPaymentScheduleProvider } from './ecoagroPaymentScheduleProvider';
import { oliveiraTrustPaymentScheduleProvider } from './oliveiraTrustPaymentScheduleProvider';
import { pentagonoPaymentScheduleProvider } from './pentagonoPaymentScheduleProvider';
import { vortxPaymentScheduleProvider } from './vortxPaymentScheduleProvider';

/**
 * Lista de provedores ativos. Para adicionar um novo agente fiduciário:
 *   1. Crie `src/features/payment-schedule/providers/<nome>Provider.ts`
 *      implementando `PaymentScheduleProvider`.
 *   2. Importe e registre aqui.
 *
 * A ordem importa apenas em caso de empate em `canHandle` (primeiro vence).
 */
export const paymentScheduleProviders: PaymentScheduleProvider[] = [
  ecoagroPaymentScheduleProvider,
  vortxPaymentScheduleProvider,
  oliveiraTrustPaymentScheduleProvider,
  pentagonoPaymentScheduleProvider,
];
