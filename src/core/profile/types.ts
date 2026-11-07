// O que o leitor de perfil devolve. Puro: sem Chrome e sem DOM.
// Vive só na memória da sessão (RF-34, RF-45). O que é guardado é a ficha, ProfileCard em ../model.ts.
//
// Esta forma é a prova de RF-44 e RD-8: não existe campo para idade, gênero, raça, foto, religião, estado civil,
// deficiência, endereço, cidade, formação, empresa, contato, pronomes, título profissional livre ou seguidores.
import type { ProfileSection } from '../model.ts';
import type { MonthSpan } from '../time/types.ts';

export interface ParsedExperience {
  /**
   * A linha que parece o cargo, como escrita, e só em memória. Pode trazer empresa ou texto livre: a ficha guarda só o rótulo da
   * lista fechada (./work-titles.ts, DP-23). Vazio quando não houve linha confiável para ser o cargo.
   */
  title: string;
  /** Nulo quando não há linha de período, ela não é legível ou a entrada não tem sinal de trabalho (DP-24). */
  span: MonthSpan | null;
  /** Meses do período, medidos até `asOf`. Nulo junto com `span`. */
  months: number | null;
  /** Cargo, descrição e linha de competências. Sem as linhas de empresa, de local e modalidade, e de período. */
  text: string;
}

export interface ParsedProfile {
  name: string | null;
  /**
   * Texto livre, escrito pela pessoa, e pode conter dado pessoal. É a única exceção assumida em RF-44: não há como
   * limpar texto livre com segurança (DP-03). Fica só em memória, nunca vai para a ficha (seção 9), e a nota só
   * procura nele os termos da lista (DP-25).
   */
  about: string;
  experiences: ParsedExperience[];
  skillsText: string;
  certificationsText: string;
  languagesText: string;
  projectsText: string;
  /** Seções da lista fechada (RF-41) que trouxeram conteúdo, na ordem em que apareceram. */
  sectionsRead: ProfileSection[];
  /** Há sinal de que uma seção que conta veio cortada, ou de que o texto passou de um dos limites internos (RF-35). */
  truncated: boolean;
  /** União dos períodos, sem contar sobreposição duas vezes (RF-43). Nulo se nenhum período for legível. */
  totalMonths: number | null;
}
