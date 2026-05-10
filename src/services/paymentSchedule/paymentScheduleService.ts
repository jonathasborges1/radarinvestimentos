import { isLocalhost } from '../../utils/scraper-client';
import { paymentScheduleProviders } from './providers';
import type {
  FetchScheduleInput,
  FetchScheduleResult,
  PaymentScheduleProvider,
} from './types';

/**
 * A funcionalidade só pode operar em localhost. Em deploy a UI esconde
 * a seção e este serviço retorna `unsupported`.
 */
export function isPaymentScheduleAvailable(): boolean {
  return isLocalhost();
}

export function findProviderFor(
  input: FetchScheduleInput,
  list: PaymentScheduleProvider[] = paymentScheduleProviders,
): PaymentScheduleProvider | null {
  for (const provider of list) {
    try {
      if (provider.canHandle(input)) return provider;
    } catch {
      // canHandle não deveria lançar; ignoramos para não quebrar a fila.
    }
  }
  return null;
}

export async function fetchPaymentScheduleViaProvider(
  input: FetchScheduleInput,
): Promise<FetchScheduleResult> {
  if (!isPaymentScheduleAvailable()) {
    return {
      ok: false,
      unsupported: true,
      error: 'Funcionalidade disponível apenas em localhost.',
    };
  }

  const provider = findProviderFor(input);
  if (!provider) {
    return {
      ok: false,
      unsupported: true,
      error: 'Nenhum provedor de agente fiduciário reconhece esta URL.',
    };
  }

  try {
    const items = await provider.fetchSchedule(input);
    return { ok: true, provider: provider.name, items };
  } catch (err) {
    return {
      ok: false,
      provider: provider.name,
      error: err instanceof Error ? err.message : 'Erro desconhecido.',
    };
  }
}
