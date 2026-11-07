// Liga e desliga a leitura por clique em Ajustes (RF-32, DP-20). Ligar mostra o aviso próprio e só grava depois do aceite,
// com a data. Desligar é um clique. O service worker percebe a mudança em settings e cria ou tira o item do menu.
import type { Store } from '../core/store/store.ts';
import type { UiState } from './app.ts';
import { CLICK_READ } from './click-strings.ts';

/** Versão do texto do aviso (RF-32). Se subir, o aceite é pedido de novo. */
export const CLICK_READ_VERSION = 1;

export interface ClickReadControl {
  /** O aviso está na tela, esperando o aceite. */
  readonly asking: boolean;
  ask(): void;
  cancel(): void;
  accept(): Promise<void>;
  disable(): Promise<void>;
  /** Fecha o aviso sem gravar nada (ao sair da tela). */
  reset(): void;
}

export interface ClickReadContext {
  readonly store: Store;
  readonly ui: UiState;
  readonly now: () => number;
  readonly load: () => Promise<void>;
  readonly redraw: () => void;
}

export function createClickReadControl(ctx: ClickReadContext): ClickReadControl {
  const state = { asking: false };

  async function write(patch: 'on' | 'off'): Promise<void> {
    try {
      const current = await ctx.store.getSettings();
      if (patch === 'on') {
        await ctx.store.updateSettings({ clickReadEnabled: true, acceptances: { ...current.acceptances, clickRead: { version: CLICK_READ_VERSION, at: ctx.now() } } });
      } else {
        await ctx.store.updateSettings({ clickReadEnabled: false });
      }
      await ctx.load();
      ctx.ui.banner = null;
    } catch {
      ctx.ui.banner = CLICK_READ.failed;
    }
    state.asking = false;
    ctx.redraw();
  }

  return {
    get asking() {
      return state.asking;
    },
    ask: () => {
      state.asking = true;
      ctx.redraw();
    },
    cancel: () => {
      state.asking = false;
      ctx.redraw();
    },
    accept: () => write('on'),
    disable: () => write('off'),
    reset: () => {
      state.asking = false;
    },
  };
}
