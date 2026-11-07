// Tipos do texto lido de uma página. Puro: sem Chrome e sem DOM.
import { readName } from './profile/name.ts';

/** O que a função de leitura devolve: texto visível da página, endereço e título. */
export interface PageRead {
  text: string;
  url: string;
  title: string;
}

/**
 * O que fica em chrome.storage.session, na chave `pendingRead`. `windowId` é a janela do gesto: só o painel dela consome
 * (RF-64). Sem ele, qualquer painel consome.
 */
export type PendingRead =
  | { ok: true; read: PageRead; at: number; windowId?: number }
  | { ok: false; error: string; at: number; windowId?: number };

/** Leitura que ninguém consumiu em 2 minutos não vale mais: sai sem ser analisada. */
export const PENDING_READ_MAX_AGE_MS = 120_000;

/** Chave de chrome.storage.session com a leitura que o painel ainda não consumiu. */
export const PENDING_READ_KEY = 'pendingRead';

/** Endereço de perfil do LinkedIn: https://www.linkedin.com/in/<nome>, com ou sem o que vem depois (RF-31). */
export function isProfileAddress(address: string | undefined): boolean {
  return address !== undefined && /^https:\/\/www\.linkedin\.com\/in\/[^/?#\s]+(?:[/?#]|$)/u.test(address);
}

/**
 * Nome tirado do título da aba (RF-44, RF-42): sem o contador "(3) " do começo, só o trecho antes de " - ", " | " ou " · ",
 * e passado pelo mesmo limpador do texto do perfil (pronomes, selos, cargos e cidades não são nome). Vazio se não sobrar
 * um nome válido; aí a conversa pede o nome.
 */
export function nameFromTitle(title: string): string {
  const withoutCounter = title.replace(/^\s*\(\d+\+?\)\s*/u, '');
  const head = withoutCounter.split(/\s+[-–—|·]\s+|\s*\|\s*|\s*·\s*/u)[0] ?? '';
  return readName(head.trim()) ?? '';
}
