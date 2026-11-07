// Auxiliar de escrita dos dados do dicionário. Cada chamada é um termo escrito à mão: categoria, nome canônico,
// sinônimos e grafias, formas protegidas e, só para termos ambíguos, o contexto declarado (`requires`).
import type { CuratedTerm, TermCategory } from '../types.ts';

export function curated(
  category: TermCategory,
  canonical: string,
  synonyms: readonly string[] = [],
  protectedForms: readonly string[] = [],
  requires: readonly string[] = [],
): CuratedTerm {
  return { canonical, synonyms: [...synonyms], category, protectedForms: [...protectedForms], requires: [...requires] };
}

// Linguagens que, ao lado de um termo ambíguo, mostram que ele é tecnologia ("Python, R", "Java e Go").
export const COMPANIONS: readonly string[] = [
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'sql', 'ruby', 'php', 'kotlin', 'scala', 'html', 'css', 'bash',
  'kubernetes', 'docker', 'aws', 'azure', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka', 'git', 'linux', 'react', 'angular', 'django',
  'node.js', '.net', 'spring', 'terraform',
];

/**
 * Frases de vizinhança de um termo ambíguo: "python r", "r e python", "python and r". A pontuação some na
 * normalização, então "Python, R" e "Python R" dão a mesma frase. Com `loose` falso só entram a vizinhança direta e
 * "e", "y" e "and" (para "go", onde "or" e "ou" aparecem demais em inglês comum). `extra` soma companheiros próprios do termo.
 */
export function adjacent(word: string, loose = true, extra: readonly string[] = []): string[] {
  const joiners = loose ? ['', 'e', 'y', 'and', 'or', 'ou'] : ['', 'e', 'y', 'and'];
  const out: string[] = [];
  for (const c of [...COMPANIONS, ...extra]) {
    for (const j of joiners) {
      const mid = j === '' ? ' ' : ` ${j} `;
      out.push(`${c}${mid}${word}`, `${word}${mid}${c}`);
    }
  }
  return out;
}

/** Frases de uso ("experiência com go", "knowledge of r"): a pessoa diz que usa a linguagem. */
export function usage(word: string): string[] {
  const leads = [
    'experiencia com', 'experiencia em', 'conhecimento em', 'conhecimento de', 'dominio de', 'dominio em', 'programar em', 'desenvolvimento em',
    'experience with', 'experience in', 'knowledge of', 'proficiency in', 'programming in', 'development in', 'skills in',
  ];
  return leads.map((lead) => `${lead} ${word}`);
}

/**
 * Preposição direta antes do nome: "APIs em Go", "microsserviços com Go", "built in Go", "using Go". Fica de fora de
 * `usage` porque nem todo termo aceita: "in spring" é a estação do ano.
 */
export function inLanguage(word: string): string[] {
  return ['em', 'com', 'usando', 'utilizando', 'in', 'with', 'using'].map((lead) => `${lead} ${word}`);
}

/** Frases comuns que contêm a palavra de um termo ambíguo mas não são tecnologia. Trocadas por um símbolo neutro. */
export const NOISE: readonly string[] = [
  // Moeda: "R$ 5.000"
  'r$', 'us$',
  // "C level", "C-suite"
  'c-level', 'c level', 'c-suite', 'c suite', 'c-levels',
  // "Go to market"
  'go-to-market', 'go to market', 'go to-market', 'go-to market', 'go to markets',
  // Swift como rede bancária (decisão: não é a linguagem)
  'swift payment', 'swift payments', 'swift code', 'swift codes', 'swift transfer', 'swift transfers', 'swift message', 'swift messages',
  'swift network', 'pagamento swift', 'pagamentos swift', 'transferencia swift', 'transferencias swift', 'codigo swift',
  // "react to", verbo comum
  'react to', 'reacts to', 'reacted to', 'reacting to',
  // "react" como verbo: "I react quickly", "able to react fast". React continua valendo sem contexto, porque aparece sozinho em
  // lista de vaga; por isso o verbo é barrado pelas frases em que ele aparece, e não por falta de contexto.
  'to react', 'i react', 'we react', 'they react', 'you react', 'can react', 'must react', 'will react', 'react quickly', 'react fast',
  'react well', 'react rapidly', 'react promptly', 'react accordingly', 'react immediately', 'react positively', 'react calmly', 'react under',
  'react when', 'react in time', 'react and adapt',
  // "go live", "go to", "let's go": o verbo, não a linguagem ("go-live", "go-to person")
  'go-live', 'go live', 'go lives', 'go to', 'go home', 'go ahead', 'go back', 'go through', 'go beyond', 'go further', "let's go", 'lets go',
  'on the go', 'good to go', 'ready to go',
  // "R&D", e "R." de rua (endereço não é termo)
  'r&d', 'r & d', 'r and d', 'na r.', 'nas r.', 'à r.',
  // "C" que é classe, nível ou opção, não a linguagem
  'serie c', 'nivel c', 'classe c', 'level c', 'class c', 'grau c', 'plano c', 'plan c', 'opcao c', 'option c', 'vitamina c', 'hepatite c',
  'tipo c', 'type c', 'usb c', 'categoria c', 'category c', 'grupo c', 'group c', 'tier c', 'bloco c', 'torre c', 'sala c', 'ala c',
  // "node" que é nó de rede, de árvore ou de cluster
  'worker node', 'worker nodes', 'master node', 'master nodes', 'leaf node', 'leaf nodes', 'root node', 'root nodes', 'child node', 'child nodes',
  'parent node', 'parent nodes', 'head node', 'compute node', 'compute nodes', 'control plane node', 'api node', 'api nodes', 'blockchain node',
  'blockchain nodes', 'node of', 'nodes of', 'node pool', 'node pools', 'node group', 'node groups', 'tree node', 'graph node', 'dom node', 'xml node',
  // Java, a ilha, só com a palavra "ilha" ou "island" ao lado; "Java, Indonésia" como local fica contando (limite conhecido).
  'ilha de java', 'java island', 'island of java',
  // "spring" como estação do ano
  'spring break', 'spring breaks', 'spring semester', 'spring term', 'spring season', 'spring cleaning',
  ...Array.from({ length: 41 }, (_, index) => `spring ${2000 + index}`),
  // "pleno" como adjetivo comum: "empresa em pleno crescimento"
  'em pleno', 'em plena', 'pleno funcionamento', 'plena capacidade', 'plena autonomia', 'pleno conhecimento', 'pleno domínio', 'pleno dominio',
];
