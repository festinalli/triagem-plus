import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalOf, findTerms } from '../../../src/core/dictionary/index.ts';

function names(text: string): string[] {
  return findTerms(text).map((hit) => hit.canonical);
}

function has(text: string, canonical: string): boolean {
  return names(text).includes(canonical);
}

describe('Go: o verbo e o go-live não são a linguagem', () => {
  const verbs = [
    'Experiência com go-live de SAP e Python',
    'Conduzi o go live com Java e o go-live do Python',
    'Plano de go live do projeto, Java e Docker',
    'I go to work and use Python and go home',
    "Let's go! Time de Python e Java",
    'Lets go com Python, Java e SQL',
    'Always on the go, Python and Java',
    'Python developer, ready to go',
    'Experience with Python. Go to the next level',
    'Equipe go-to para Python e Java',
  ];
  for (const text of verbs) test(`não é Go: ${text}`, () => assert.ok(!has(text, 'Go'), JSON.stringify(names(text))));

  test('o Go de verdade continua valendo ao lado do ruído', () => {
    assert.ok(has('Go-live em 2023. APIs em Go', 'Go'));
    assert.ok(has('Go to market e microsserviços em Go', 'Go'));
  });
});

describe('React: o verbo não é a biblioteca', () => {
  for (const text of ['I react quickly to incidents', 'Had to react fast in incidents', 'react to changes', 'Aprendi a reagir a incidentes', 'We react, we adapt']) {
    test(`não é React: ${text}`, () => assert.ok(!has(text, 'React'), JSON.stringify(names(text))));
  }
  for (const text of [
    'Interfaces em React',
    'Front-end com React e TypeScript',
    'React.js e Next.js',
    'ReactJS',
    'React 18 com hooks',
    'Senior React Developer',
    'Desenvolvedor React',
    'React, Vue e Angular',
    'Frontend (React)',
    'Built with React',
    'Experience with React',
    'Skills: React/Redux',
  ]) {
    test(`é React: ${text}`, () => assert.ok(has(text, 'React'), JSON.stringify(names(text))));
  }
  test('React Native não é React', () => {
    assert.deepEqual(names('Apps com React Native'), ['React Native']);
    assert.deepEqual(names('React Native'), ['React Native']);
  });
  test('um item isolado designa o termo', () => {
    assert.equal(canonicalOf('React'), 'React');
  });
});

describe('Node.js: nó de rede, de árvore e de cluster não é a tecnologia', () => {
  for (const text of [
    'Administrei cada worker node do Kubernetes e a API',
    'Cada node de blockchain tem API',
    'Cada node of the graph tem um valor e uma API',
    'The API node handles requests, backend',
    'Cada node da árvore tem um valor',
    'Root node, leaf node and parent node of the tree, JavaScript',
  ]) {
    test(`não é Node.js: ${text}`, () => assert.ok(!has(text, 'Node.js'), JSON.stringify(names(text))));
  }
  for (const text of ['Node.js', 'NodeJS', 'APIs em Node', 'APIs com Node', 'Usando Node', 'Built in Node', 'with Node', 'using Node', 'Node 18', 'Node, TypeORM e PostgreSQL', 'Node e React']) {
    test(`é Node.js: ${text}`, () => assert.ok(has(text, 'Node.js'), JSON.stringify(names(text))));
  }
});

describe('frases de contexto valem nas grafias reais, com e sem acento', () => {
  const languages: ReadonlyArray<readonly [string, string]> = [
    ['Go', 'Go'],
    ['Rust', 'Rust'],
    ['Ruby', 'Ruby'],
    ['Swift', 'Swift'],
    ['Dart', 'Dart'],
    ['R', 'R'],
    ['C', 'C'],
    ['Node', 'Node.js'],
  ];
  const leads = ['em', 'com', 'usando', 'utilizando', 'in', 'with', 'using', 'Em', 'COM', 'Usando', 'IN', 'With', 'Using'];
  for (const [word, canonical] of languages) {
    for (const lead of leads) {
      test(`"${lead} ${word}" dá ${canonical}`, () => {
        assert.ok(has(`Projetos ${lead} ${word}.`, canonical), JSON.stringify(names(`Projetos ${lead} ${word}.`)));
      });
    }
  }

  test('microsserviços em Go, com e sem acento e com uma ou duas letras s', () => {
    for (const text of ['microsserviços em Go', 'microsservicos em Go', 'microservicos em Go', 'Microserviços em Go', 'MICROSSERVIÇOS EM GO', 'Go microsserviços', 'Go microservices']) {
      assert.ok(has(text, 'Go'), `${text}: ${JSON.stringify(names(text))}`);
    }
  });

  test('forma acentuada e sem acento do ruído valem igual', () => {
    assert.ok(!has('Integração com código SWIFT e Python, ios', 'Swift'));
    assert.ok(!has('Integração com codigo SWIFT e Python, ios', 'Swift'));
    assert.ok(!has('Transferência Swift internacional, Python', 'Swift'));
  });
});

describe('outros ruídos de termos de uma letra', () => {
  test('R&D e R. de rua não são R', () => {
    assert.ok(!has('Experience in R & D with Python', 'R'));
    assert.ok(!has('Experience in R&D with Python', 'R'));
    assert.ok(!has('Escritório na R. Augusta, Python e SAS', 'R'));
    assert.ok(has('Modelos estatísticos em R.', 'R'));
  });

  test('C de classe, série e nível não é a linguagem', () => {
    assert.ok(!has('Série C com Python, inglês nível C e kernel', 'C'));
    assert.ok(!has('Cliente classe C, Python e Java', 'C'));
    assert.ok(has('Driver em C para Linux', 'C'));
  });

  test('Swift só conta com iOS ao lado dele', () => {
    assert.ok(!has('Swift resolution of iOS bugs', 'Swift'));
    assert.ok(has('Swift para apps iOS', 'Swift'));
    assert.ok(has('Swift e iOS', 'Swift'));
    assert.ok(has('Apps em Swift.', 'Swift'));
  });

  test('Java, a ilha (com a palavra ilha), e Java Script', () => {
    assert.ok(!has('Viagem à ilha de Java', 'Java'));
    assert.ok(!has('Java Script no front', 'Java'));
    assert.ok(has('Java Script no front', 'JavaScript'));
  });
});

describe('item isolado de lista designa o termo (canonicalOf)', () => {
  const items: ReadonlyArray<readonly [string, string]> = [
    ['Go', 'Go'],
    ['R', 'R'],
    ['C', 'C'],
    ['Swift', 'Swift'],
    ['Rust', 'Rust'],
    ['Ruby', 'Ruby'],
    ['Dart', 'Dart'],
    ['Node', 'Node.js'],
    ['React', 'React'],
    ['J2EE', 'Java EE'],
  ];
  for (const [item, canonical] of items) {
    test(`${item} -> ${canonical}`, () => assert.equal(canonicalOf(item), canonical));
  }
});

describe('versões contam como o próprio termo', () => {
  const versions: ReadonlyArray<readonly [string, string]> = [
    ['Vue 3', 'Vue.js'],
    ['Vue 2', 'Vue.js'],
    ['Vue3', 'Vue.js'],
    ['Vue.js 3 com Pinia', 'Vue.js'],
    ['Angular 17', 'Angular'],
    ['Angular 14', 'Angular'],
    ['React 18', 'React'],
    ['Node 20', 'Node.js'],
    ['Java 21', 'Java'],
    ['Java 8', 'Java'],
  ];
  for (const [text, canonical] of versions) {
    test(`${text} é ${canonical}`, () => {
      assert.ok(has(text, canonical), JSON.stringify(names(text)));
    });
  }
});
