// O outro lado do erro: uma trava que barra termo legítimo bloqueia vaga legítima. Nada daqui pode disparar, nem em frase.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerm, findForbidden } from '../../../src/core/guard/index.ts';

// A lista da especificação da fatia. "natal" só vale dentro de frase comum e tem caso próprio abaixo.
const LISTED = [
  'qualidade de software', 'velocidade', 'core banking', 'single sign-on', 'single page application', 'IP address', 'black box', 'white box', 'branch', 'componentes filhos', 'processos filhos',
  'child process', 'master/slave', 'Java', 'C++', 'page', 'agile', 'homem-máquina', 'interface homem-máquina', 'healthtech', 'setor de saúde', 'healthcare', 'código maduro', 'Inglês', 'Espanhol',
  'Japonês', 'Alemão', 'Português brasileiro', 'banco', 'Sênior', 'Júnior', 'Pleno',
];
const AGE_INSIDE_A_WORD = ['page', 'pages', 'package', 'manager', 'storage', 'image', 'language', 'message', 'agent', 'agile', 'engage', 'average', 'coverage', 'usage', 'stage', 'wage', 'mortgage'];
const WORD_INSIDE_A_WORD = ['identidade', 'corporativo', 'decorator', 'scorecard', 'homemade', 'filhote', 'paisagem', 'branching', 'sexta-feira'];
const NATAL_IN_A_SENTENCE = ['Cesta de Natal', 'Confraternização de Natal', 'Feriado de Natal', 'O recesso de natal é coletivo', 'Bônus de Natal', 'Campanha de Natal do e-commerce'];
const FRAMES: readonly ((term: string) => string)[] = [
  (term) => term,
  (term) => term.toUpperCase(),
  (term) => `Experiência com ${term} em projetos reais`,
  (term) => `- Sólidos conhecimentos em ${term}.`,
  (term) => `Solid knowledge of ${term}, please`,
];

// Linhas comuns em vagas de verdade: benefício, descrição da empresa, requisito técnico.
const COMMON_LINES = [
  'Vale-refeição e vale-alimentação', 'Plano de saúde e odontológico', 'Seguro de vida', 'Participação nos lucros', 'Day off no aniversário', 'Licença-maternidade estendida', 'Licença-paternidade de 20 dias',
  'Auxílio-creche', 'Fácil acesso ao metrô', 'Atendimento a clientes do setor de saúde', 'Salário atraente e bônus', 'Somos uma família', 'Empresa jovem e em crescimento', 'Sprints de até 2 semanas', 'Time com até 10 pessoas',
  'Experiência com race conditions', 'Cache-Control max-age', 'Trabalhar com paleta de cores', 'Teste de caixa preta e caixa branca', 'Validação com selfie', 'Programa de residência em software', 'Dados que residem em S3',
  'Good looking interfaces', 'Agnóstico de nuvem', 'Cloud agnostic', 'The logic resides in the service', 'Live in production', 'You will live in the code', 'God object', 'Campos em branco', 'Quadro branco', 'Black Friday', 'White label',
  'Whitelist', 'Lista negra', 'Sistema de cor', 'Interação homem-computador', 'Custo homem-hora', 'Master data', 'Startup nascida em 2015', 'Born in the cloud', 'Fit cultural', 'Componente pai e filho', 'Nó pai', 'Parent component',
  'Single responsibility', 'Single source of truth', 'Mentoria para juniores', 'Natural language processing', 'Processamento de linguagem natural', 'Processo natural de evolução', 'Língua materna', 'Língua estrangeira', 'Empresa brasileira',
  'Mercado americano', 'Cliente alemão', 'Vendas casadas', 'Desenvolvedora', 'Engenheira de software', 'Pessoa desenvolvedora', 'Tecnologia assistiva', 'Acessibilidade web', 'Saúde financeira', 'Código limpo', 'Formação em Ciência da Computação',
  'Ensino superior completo', 'Disponibilidade para viagens', 'CNH categoria B', 'Pretensão salarial', 'Salário de até 15 mil', 'Bônus de até 3 salários', 'Até 5 dias de folga', 'Banco de horas', 'English required', 'Cor primária', 'The age of AI',
  'Golden age of computing', 'Colaborar com o time do Natal', 'Política de privacidade', 'Política de segurança', 'Interface do usuário', 'Boa comunicação',
];

function firstHit(text: string): string | null {
  const term = checkTerm(text);
  if (!term.allowed) return `checkTerm: ${term.topic}[${term.matched}]`;
  const hit = findForbidden(text)[0];
  return hit === undefined ? null : `findForbidden: ${hit.topic}[${hit.matched}]`;
}

describe('falsos positivos', () => {
  for (const term of [...LISTED, ...AGE_INSIDE_A_WORD, ...WORD_INSIDE_A_WORD]) {
    test(term, () => {
      for (const frame of FRAMES) {
        const text = frame(term);
        assert.equal(firstHit(text), null, text);
      }
    });
  }

  test('"natal" dentro de frase comum não dispara', () => {
    for (const text of NATAL_IN_A_SENTENCE) assert.equal(firstHit(text), null, text);
  });

  test('linhas comuns de vaga não disparam em findForbidden', () => {
    const fired = COMMON_LINES.flatMap((line) => {
      const hit = findForbidden(line)[0];
      return hit === undefined ? [] : [`${line} => ${hit.topic}[${hit.matched}]`];
    });
    assert.deepEqual(fired, []);
  });

  test('a palavra ambígua sozinha é recusada como termo, mas a expressão técnica não', () => {
    const pairs: readonly (readonly [string, string])[] = [
      ['single', 'single sign-on'],
      ['black', 'black box'],
      ['white', 'white box'],
      ['filhos', 'processos filhos'],
      ['child', 'child process'],
      ['homem', 'interface homem-máquina'],
      ['age', 'page'],
      ['cor', 'core banking'],
      ['idade', 'qualidade de software'],
      ['maduro', 'código maduro'],
      ['saúde', 'setor de saúde'],
      ['address', 'IP address'],
      ['race', 'race condition'],
      ['agnóstico', 'agnóstico de nuvem'],
      ['Natal', 'cesta de natal'],
      ['branca', 'branch'],
      ['brasileiro', 'Português brasileiro'],
    ];
    for (const [word, expression] of pairs) {
      assert.equal(checkTerm(word).allowed, false, word);
      assert.equal(checkTerm(expression).allowed, true, expression);
    }
  });
});
