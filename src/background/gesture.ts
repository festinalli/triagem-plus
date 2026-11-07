// A decisão do gesto de leitura, separada do Chrome para ser testada sozinha (RF-31, RF-32, DP-20).
import { isProfileAddress } from '../core/page-read.ts';
import type { Settings } from '../core/model.ts';

export const MESSAGES = {
  off: 'A leitura por clique está desligada. Ligue em Ajustes ou cole o texto do perfil. Depois de ligar, use o botão direito sobre o perfil ou o atalho Alt+Shift+T.',
  notProfile: 'Esta aba não é um perfil do LinkedIn (endereço começando por linkedin.com/in/). Nada foi lido. Abra um perfil e use o botão direito ou o atalho Alt+Shift+T, ou cole o texto.',
  failed: 'Não foi possível ler a página.',
  blocked: 'A Triagem+ não pode ler esta página.',
} as const;

export type GestureDecision = 'read' | 'off' | 'not_profile';

/** A leitura só vale ligada e com o aviso aceito. */
export function clickReadActive(settings: Pick<Settings, 'clickReadEnabled' | 'acceptances'>): boolean {
  return settings.clickReadEnabled && settings.acceptances.clickRead !== undefined;
}

/** Desligada, nada é lido nem o endereço é olhado. Ligada, só perfil do LinkedIn é lido. */
export function decideGesture(input: { enabled: boolean; tabUrl: string | undefined }): GestureDecision {
  if (!input.enabled) return 'off';
  return isProfileAddress(input.tabUrl) ? 'read' : 'not_profile';
}
