// Pausa na carreira dentro da seção Experiência (RD-8, RF-44, DP-24). "Licença-maternidade" ou "Tratamento de câncer" são dado de
// família ou de saúde, com cara de emprego: têm título e período. Se fossem lidas, somariam tempo e mudariam a nota. A entrada
// inteira é descartada, com o que estiver escrito nela. Nada é deduzido nem guardado sobre isso.
//
// Nenhuma lista cobre tudo. Pausa que escapar daqui cai na regra do sinal de trabalho: sem cargo, contrato ou tecnologia, o tempo
// não conta. Esta lista serve para a pausa que cita tecnologia ou contrato não contar também.
import { normalize } from '../text/normalize.ts';
import { MAX_SHORT_LINE } from './lines.ts';
import { hasWorkWord } from './work-titles.ts';

const MAX_LABEL_WORDS = 8;
const BRACKETED = /[(\[{][^)\]}]*[)\]}]/gu;
const DASHES = /[–—]/gu; // `normalize` só trata o hífen como separador.
const SENTENCE_END = /[.!?;]$/u;

// Raízes no começo da linha. "Licenciatura", "Licenciamento" e "Pattern" não batem, e "Cobri a licença médica" não começa com a raiz.
const STARTS_WITH_ROOT = new RegExp(
  `^(?:em |ano |periodo de )?(?:${[
    'matern', 'patern', 'licenc[ae]s?(?: |$)', 'pausas?(?: |$)', 'sabatic', 'sabbatical', 'parental', 'cuid(?:ador|ando|ados?|ar)', 'caregiv',
    'mae(?: |$)', 'pai(?: |$)', 'gestante', 'gravidez', 'gestacao', 'adocao', 'puerperio', 'afastad', 'afastamento', 'aposentad',
    'desempreg', 'luto(?: |$)', 'bereavement', 'homemaker', 'housewife', 'househusband', 'pregnan',
    'tratamento (?:de saude|de cancer|medico|oncologico|psiquiatrico|psicologico)', 'recuperacao (?:de cirurgia|de saude|medica|pos)',
    'motivos? (?:pessoa|de saude|de familia|familiar|medic)', 'saude e bem estar', 'bem estar',
    '(?:dona|dono) de casa', 'do lar$', 'transicao de carreira', 'recolocacao',
    'career (?:break|pause|gap|transition)', 'leave of absence', 'gap year', 'stay at home', 'full time (?:parent|mom|dad|mother|father|caregiver)',
    '(?:family|elder|child|parent) ?care', 'health and well', 'unemployed', 'layoff', 'laid off', 'relocation', 'retire',
  ].join('|')})`,
  'u',
);
const ENDS_IN_LEAVE = / leave$/u; // "Mat leave", "Sick leave", "Personal leave"
const WHOLE_LINE: ReadonlySet<string> = new Set(['health', 'wellness']);

function isLabel(text: string): boolean {
  const key = normalize(text);
  if (key === '' || key.split(' ').length > MAX_LABEL_WORDS) return false;
  return STARTS_WITH_ROOT.test(key) || ENDS_IN_LEAVE.test(key) || WHOLE_LINE.has(key);
}

/**
 * A linha é um rótulo de pausa: "Licença-maternidade", "Licença para cuidar de filho", "Career break · Parental leave", "Pausa na
 * carreira: luto". Vale pela linha inteira do cargo: com palavra de cargo da lista, é emprego, como em "Dev - Saúde e bem-estar".
 * Só o cabeçalho da entrada é conferido, nunca a descrição.
 */
export function isCareerBreakLine(line: string): boolean {
  if (line.length > MAX_SHORT_LINE || SENTENCE_END.test(line) || hasWorkWord(line)) return false;
  return isLabel(line.replace(BRACKETED, ' ').replace(DASHES, ' '));
}
