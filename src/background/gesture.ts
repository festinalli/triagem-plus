// A decisão do gesto de leitura, separada do Chrome para ser testada sozinha (RF-31, RF-32, DP-20).
import { isProfileAddress, isResultsAddress } from '../core/page-read.ts';
import type { Settings } from '../core/model.ts';

export const MESSAGES = {
  off: 'A leitura por clique está desligada. Ligue em Ajustes ou cole o texto do perfil. Depois de ligar, use o botão direito ou o atalho Alt+Shift+T num perfil ou na página de resultados.',
  notProfile: 'Esta aba não é um perfil do LinkedIn nem a página de resultados de pessoas. Nada foi lido. Abra uma delas e use o botão direito ou o atalho Alt+Shift+T, ou cole o texto.',
  failed: 'Não foi possível ler a página.',
  blocked: 'A Triagem+ não pode ler esta página.',
} as const;

export type GestureDecision = 'read' | 'read_results' | 'off' | 'not_profile';

/** Versão do texto do aviso (RF-32). Subiu quando a leitura passou a incluir a página de resultados: o aceite é pedido de novo. */
export const CLICK_READ_VERSION = 2;

/** A leitura só vale ligada e com o aviso atual aceito. */
export function clickReadActive(settings: Pick<Settings, 'clickReadEnabled' | 'acceptances'>): boolean {
  return settings.clickReadEnabled && (settings.acceptances.clickRead?.version ?? 0) >= CLICK_READ_VERSION;
}

/** Desligada, nada é lido nem o endereço é olhado. Ligada, só perfil do LinkedIn e página de resultados de pessoas são lidos. */
export function decideGesture(input: { enabled: boolean; tabUrl: string | undefined }): GestureDecision {
  if (!input.enabled) return 'off';
  if (isResultsAddress(input.tabUrl)) return 'read_results';
  return isProfileAddress(input.tabUrl) ? 'read' : 'not_profile';
}
