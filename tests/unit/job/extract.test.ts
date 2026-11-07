import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY_TERMS, findTerms, isKnownTerm } from '../../../src/core/dictionary/index.ts';
import { checkTerm, findForbidden, TOPIC_REASONS } from '../../../src/core/guard/index.ts';
import { extractRequirements, MAX_JOB_CHARS, MAX_JOB_LINES } from '../../../src/core/job/extract.ts';
import { MAX_REQUIREMENTS } from '../../../src/core/job/requirements.ts';
import type { Importance, Requirement, RequirementKind } from '../../../src/core/model.ts';

function known(kind: RequirementKind, key: string, label: string, importance: Importance, minYears?: number): Requirement {
  return { id: `${kind}:${key}`, kind, importance, label, canonical: label, ...(minYears === undefined ? {} : { minYears }) };
}

function total(minYears: number, importance: Importance = 'required'): Requirement {
  return { id: 'total_experience', kind: 'total_experience', importance, label: minYears === 1 ? '1 ano de experiência' : `${minYears} anos de experiência`, minYears };
}

/** O que importa de cada requisito numa linha só, para os casos curtos: "Java:required:5". */
function summary(jobText: string): string[] {
  return extractRequirements(jobText).requirements.map((r) => `${r.label}:${r.importance}${r.minYears === undefined ? '' : `:${r.minYears}`}`);
}

const VAGA_PT = `Pessoa Desenvolvedora Back-end Sênior

Sobre a empresa:
Somos uma fintech com mais de 10 anos de mercado e sede em São Paulo. Usamos Ruby em sistemas antigos.

Responsabilidades:
- Evoluir microsserviços em Java e participar de code review
- Cuidar da observabilidade com Grafana

Requisitos:
- Pelo menos 5 anos de experiência em desenvolvimento de software
- 5 anos de Java
- Spring Boot (3+ anos)
- Mínimo de 2 anos em Kubernetes
- PostgreSQL e Docker
- Inglês intermediário
- Até 35 anos
- Morar em São Paulo

Diferenciais:
- Kotlin
- 3 anos de Go
- Certificação AWS Certified Solutions Architect
- Java com mais de 8 anos

Benefícios:
- Plano de saúde e odontológico
- Curso de inglês
- Trabalho híbrido
`;

const VAGA_EN = `Senior Software Engineer

About us:
We are a SaaS company founded 12 years ago, with an office in Curitiba.

What you bring:
- 6+ years of professional experience
- 5 years with Kotlin
- 3+ years of Python
- Solid knowledge of AWS and Terraform
- English
- Must be under 35
- At most 8 years of experience with Java

Nice to have:
- Rust (2+ years)
- CKA
- Experience with Kafka

Benefits:
- Health insurance
- Spanish lessons
`;

describe('vagas fictícias completas', () => {
  test('em português, a extração bate exatamente com o esperado', () => {
    assert.deepEqual(extractRequirements(VAGA_PT), {
      requirements: [
        known('title_word', 'desenvolvedor back end', 'Desenvolvedor back-end', 'required'),
        known('title_word', 'senior', 'Sênior', 'required'),
        known('term', 'microsservicos', 'Microsserviços', 'required'),
        known('term', 'java', 'Java', 'required', 8),
        known('term', 'code review', 'Code review', 'required'),
        known('term', 'grafana', 'Grafana', 'required'),
        total(5),
        known('term', 'spring boot', 'Spring Boot', 'required', 3),
        known('term', 'kubernetes', 'Kubernetes', 'required', 2),
        known('term', 'postgresql', 'PostgreSQL', 'required'),
        known('term', 'docker', 'Docker', 'required'),
        known('language', 'ingles', 'Inglês', 'required'),
        known('term', 'kotlin', 'Kotlin', 'preferred'),
        known('term', 'go', 'Go', 'preferred', 3),
        known('certification', 'aws certified solutions architect', 'AWS Certified Solutions Architect', 'preferred'),
      ],
      ignored: [
        { line: 'Até 35 anos', topic: 'age', reason: TOPIC_REASONS.age },
        { line: 'Morar em São Paulo', topic: 'address_distance', reason: TOPIC_REASONS.address_distance },
      ],
      truncated: false,
      needsManualEntry: false,
    });
  });

  test('em inglês, a extração bate exatamente com o esperado', () => {
    assert.deepEqual(extractRequirements(VAGA_EN), {
      requirements: [
        known('title_word', 'senior', 'Sênior', 'required'),
        known('title_word', 'desenvolvedor de software', 'Desenvolvedor de software', 'required'),
        total(6),
        known('term', 'kotlin', 'Kotlin', 'required', 5),
        known('term', 'python', 'Python', 'required', 3),
        known('term', 'aws', 'AWS', 'required'),
        known('term', 'terraform', 'Terraform', 'required'),
        known('language', 'ingles', 'Inglês', 'required'),
        known('term', 'rust', 'Rust', 'preferred', 2),
        known('certification', 'certified kubernetes administrator', 'Certified Kubernetes Administrator', 'preferred'),
        known('term', 'apache kafka', 'Apache Kafka', 'preferred'),
      ],
      ignored: [
        { line: 'Must be under 35', topic: 'age', reason: TOPIC_REASONS.age },
        { line: 'At most 8 years of experience with Java', topic: 'max_experience', reason: TOPIC_REASONS.max_experience },
      ],
      truncated: false,
      needsManualEntry: false,
    });
  });

  test('nenhum requisito sugerido cai na trava, e todo termo veio da lista ou de "N anos de termo ambíguo"', () => {
    for (const text of [VAGA_PT, VAGA_EN]) {
      const { requirements } = extractRequirements(text);
      const inText = new Set(findTerms(text).map((hit) => hit.canonical));
      for (const requirement of requirements) {
        assert.equal(checkTerm(requirement.label).allowed, true, requirement.label);
        if (requirement.kind === 'total_experience') continue;
        assert.ok(isKnownTerm(requirement.label), requirement.label);
        assert.ok(inText.has(requirement.label) || requirement.minYears !== undefined, requirement.label);
      }
    }
  });
});

describe('linha proibida fica inteira de fora (RF-15)', () => {
  test('"Procuramos mulheres com Java até 35 anos": Java não vira requisito, e a linha aparece em ignored', () => {
    const line = 'Procuramos mulheres com Java até 35 anos';
    const result = extractRequirements(`Requisitos:\n- ${line}\n- Python`);
    assert.deepEqual(result.requirements.map((r) => r.label), ['Python']);
    assert.deepEqual(result.ignored, [{ line, topic: 'gender', reason: TOPIC_REASONS.gender }]);
    assert.deepEqual(extractRequirements(line), { requirements: [], ignored: [{ line, topic: 'gender', reason: TOPIC_REASONS.gender }], truncated: false, needsManualEntry: true });
  });

  test('o mesmo termo em outra linha limpa entra, sem herdar nada da linha barrada', () => {
    assert.deepEqual(summary('Java por 10 anos, somente homens\nJava (desejável)'), ['Java:preferred']);
  });

  test('anos e teto de experiência: a linha toda sai', () => {
    assert.deepEqual(extractRequirements('Java com no máximo 5 anos').requirements, []);
    assert.deepEqual(extractRequirements('3 a 5 anos de experiência com Java').requirements, []);
    assert.deepEqual(extractRequirements('up to 5 years of Python').requirements, []);
  });

  test('título de bloco proibido também é avisado, e o bloco continua valendo', () => {
    const result = extractRequirements('Vaga exclusiva para mulheres:\n- Java');
    assert.deepEqual(result.requirements.map((r) => r.label), ['Java']);
    assert.deepEqual(result.ignored.map((i) => [i.line, i.topic]), [['Vaga exclusiva para mulheres:', 'gender']]);
  });

  test('linha barrada não serve de contexto para termo ambíguo', () => {
    assert.deepEqual(summary('Ready to go\nMulheres com experiência com Go'), []);
    assert.deepEqual(summary('Ready to go\nExperiência com Go'), ['Go:required']);
  });

  test('frase de diversidade e cidade solta', () => {
    const result = extractRequirements('Valorizamos a diversidade de gênero e raça.\nSede em Natal.\nReact');
    assert.deepEqual(result.requirements.map((r) => r.label), ['React']);
    assert.deepEqual(result.ignored.map((i) => i.topic), ['gender']);
  });
});

describe('a trava vale por frase (RF-15)', () => {
  test('parágrafo único: a frase com o termo proibido sai inteira, e o resto fica', () => {
    const result = extractRequirements('Procuramos pessoa com Java, Spring e AWS. Valorizamos a diversidade e incentivamos mulheres a se candidatar.');
    assert.deepEqual(result.requirements.map((r) => r.label), ['Java', 'Spring', 'AWS']);
    assert.deepEqual(result.ignored, [{ line: 'Valorizamos a diversidade e incentivamos mulheres a se candidatar.', topic: 'gender', reason: TOPIC_REASONS.gender }]);
  });

  test('a mesma frase continua barrando tudo o que cita', () => {
    const result = extractRequirements('Procuramos mulheres com Java até 35 anos. Python e Docker.');
    assert.deepEqual(result.requirements.map((r) => r.label), ['Python', 'Docker']);
    assert.deepEqual(result.ignored.map((i) => i.line), ['Procuramos mulheres com Java até 35 anos.']);
  });

  test('ponto e vírgula, exclamação, interrogação e quebra de linha separam frases', () => {
    assert.deepEqual(summary('Java; somente homens; Python'), ['Java:required', 'Python:required']);
    assert.deepEqual(summary('Java! Somente homens! Python'), ['Java:required', 'Python:required']);
    assert.deepEqual(summary('Java? Somente homens? Python'), ['Java:required', 'Python:required']);
    assert.deepEqual(summary('Java\nSomente homens\nPython'), ['Java:required', 'Python:required']);
  });

  test('a mesma frase repetida gera um aviso só', () => {
    assert.equal(extractRequirements('Somente homens.\nJava.\nSomente homens.').ignored.length, 1);
  });

  test('vírgula não separa: a frase é a frase', () => {
    assert.deepEqual(summary('Java, somente homens, Python'), []);
  });

  test('ponto que não fecha frase não separa', () => {
    for (const [text, expected] of [['Node.js e ASP.NET', ['Node.js', 'ASP.NET']], ['Versão 1.5 do Java', ['Java']], ['Inglês, e.g. leitura, e Java', ['Inglês', 'Java']]] as const) {
      assert.deepEqual(extractRequirements(text).requirements.map((r) => r.label), [...expected], text);
    }
    assert.deepEqual(extractRequirements('Java e U.S. citizens only').requirements, []);
    assert.deepEqual(extractRequirements('Vaga para P.C.D. com Java').requirements, []);
  });

  test('a frase vale também para os anos: a empresa não empresta anos para a pessoa', () => {
    assert.deepEqual(summary('Somos uma empresa de tecnologia. 5 anos de experiência.'), ['5 anos de experiência:required:5']);
  });

  test('parágrafo com requisitos, local e teto', () => {
    const result = extractRequirements('Requisitos: Java, Spring, Docker e Kafka. Local: Campinas. Até 3 anos de experiência.');
    assert.deepEqual(result.requirements.map((r) => r.canonical), ['Java', 'Spring', 'Docker', 'Apache Kafka']);
    assert.deepEqual(result.ignored.map((i) => i.topic), ['max_experience']);
  });

  test('a frase barrada não confirma termo ambíguo, a limpa confirma', () => {
    assert.deepEqual(summary('Ready to go. Mulheres com experiência em Go.'), []);
    assert.deepEqual(summary('Ready to go. Experiência em Go.'), ['Go:required']);
  });
});

describe('item que é, inteiro, um termo designa o termo (RF-11)', () => {
  const names: readonly (readonly [string, string])[] = [['Go', 'Go'], ['Rust', 'Rust'], ['C', 'C'], ['R', 'R'], ['Swift', 'Swift'], ['Ruby', 'Ruby'], ['Dart', 'Dart'], ['Spring', 'Spring'], ['Node', 'Node.js'], ['Assembly', 'Assembly'], ['Julia', 'Julia']];
  for (const [text, canonical] of names) {
    test(`${text}, com e sem marcador`, () => {
      for (const job of [`Requisitos:\n- ${text}`, `Requisitos:\n• ${text}\n`, text, `${text}.`, `${text};`, `(${text})`, `**${text}**`, `1. ${text}`, `Stack: ${text}`]) {
        assert.deepEqual(extractRequirements(job).requirements.map((r) => r.canonical), [canonical], job);
      }
    });
  }

  test('lista curta', () => {
    assert.deepEqual(summary('Go, Rust, Kubernetes'), ['Go:required', 'Rust:required', 'Kubernetes:required']);
    assert.deepEqual(summary('Go e Rust'), ['Go:required', 'Rust:required']);
    assert.deepEqual(summary('Python ou Go'), ['Python:required', 'Go:required']);
    assert.deepEqual(summary('Rust, Go ou C'), ['Rust:required', 'Go:required', 'C:required']);
    assert.deepEqual(summary('Go / Rust'), ['Go:required', 'Rust:required']);
    assert.deepEqual(summary('Go and Rust'), ['Go:required', 'Rust:required']);
    assert.deepEqual(summary('Linguagens: Go, Rust ou R'), ['Go:required', 'Rust:required', 'R:required']);
    assert.deepEqual(summary('Diferenciais: Go, Rust'), ['Go:preferred', 'Rust:preferred']);
  });

  test('na vaga que só tem termos ambíguos', () => {
    assert.deepEqual(summary('Requisitos:\n- Go\n- Rust\n- C\n- R\n- Swift\n- Ruby'), ['Go:required', 'Rust:required', 'C:required', 'R:required', 'Swift:required', 'Ruby:required']);
  });

  test('o termo designado vale para a vaga inteira', () => {
    assert.deepEqual(summary('Requisitos:\n- Go\nDiferenciais:\n- Rust\nUsamos Rust e Go no dia a dia'), ['Go:required', 'Rust:preferred']);
    assert.deepEqual(summary('Requisitos:\n- Rust\nUsamos Go'), ['Rust:required']);
    assert.deepEqual(summary('Requisitos:\n- Rust\n- Go\nUsamos Go e Rust'), ['Rust:required', 'Go:required']);
  });

  test('item que tem outra palavra não designa nada', () => {
    for (const text of ['Go to market', 'Go live', 'R$ 5.000', 'C level', 'Swift ao decidir', 'Spring 2027', 'Vai com Julia', 'Time de Ruby Silva', 'Go, gestão e vendas']) {
      assert.deepEqual(summary(text), [], text);
    }
  });

  test('termo ambíguo logo depois de "em" ou "com", fechando a oração', () => {
    const cases: readonly (readonly [string, string])[] = [['Proficiência em Go', 'Go'], ['Experiência avançada em Go', 'Go'], ['Back-end em Go', 'Go'], ['Desenvolvimento de serviços em Rust', 'Rust'], ['Programação em Swift', 'Swift'], ['Vivência em Ruby', 'Ruby'], ['Modelagem estatística em R', 'R'], ['Experience in Rust', 'Rust'], ['Solid knowledge of Go', 'Go']];
    for (const [text, canonical] of cases) {
      assert.ok(extractRequirements(text).requirements.some((r) => r.canonical === canonical), text);
    }
    assert.ok(extractRequirements('APIs em Go e gRPC').requirements.some((r) => r.canonical === 'Go'));
  });
});

describe('classe do requisito', () => {
  test('título e item na mesma linha', () => {
    assert.deepEqual(summary('Diferenciais: Kafka'), ['Apache Kafka:preferred']);
    assert.deepEqual(summary('Diferenciais: Kafka, Docker'), ['Apache Kafka:preferred', 'Docker:preferred']);
    assert.deepEqual(summary('Requisitos:\n- Java\nDiferenciais: Kafka'), ['Java:required', 'Apache Kafka:preferred']);
    assert.deepEqual(summary('Diferenciais:\n- Java\nRequisitos: Kafka'), ['Java:preferred', 'Apache Kafka:required']);
    assert.deepEqual(summary('Requisitos: Java. Diferenciais: Kafka.'), ['Java:required', 'Apache Kafka:preferred']);
  });

  test('marcador na própria frase', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['Requisitos:\n- Docker (não obrigatório)', 'Docker:preferred'], ['Diferenciais:\n- Docker (não obrigatório)', 'Docker:preferred'], ['Nice to have:\n- Docker (not required)', 'Docker:preferred'], ['Requisitos:\n- Docker (não é obrigatório)', 'Docker:preferred'],
      ['Requisitos:\n- Kafka é um diferencial', 'Apache Kafka:preferred'], ['Requisitos:\n- desejável: Redis', 'Redis:preferred'], ['Requisitos:\n- nice to have: Terraform', 'Terraform:preferred'], ['Requisitos:\n- Docker (opcional)', 'Docker:preferred'], ['Requisitos:\n- Docker (optional)', 'Docker:preferred'],
    ];
    for (const [job, expected] of cases) assert.deepEqual(summary(job), [expected], job);
  });

  test('frases da mesma linha têm a própria classe', () => {
    assert.deepEqual(summary('Java é obrigatório. Docker é desejável.'), ['Java:required', 'Docker:preferred']);
  });

  test('títulos parecidos com os do léxico', () => {
    for (const title of ['Good to have:', 'Seria legal ter:', 'Extras:', 'Pontos extras:', 'Será um diferencial:', 'Bônus:', 'Desejável:', 'Diferencial:']) {
      assert.deepEqual(summary(`Requisitos:\n- Java\n${title}\n- Docker`), ['Java:required', 'Docker:preferred'], title);
    }
    assert.deepEqual(summary('Requisitos:\n- Java\nGood to have\n- Docker'), ['Java:required', 'Docker:preferred']);
  });

  test('"optional" que é nome de recurso não muda a classe', () => {
    assert.deepEqual(summary('Requisitos:\n- Optional chaining em TypeScript'), ['TypeScript:required']);
  });

  test('marcador obrigatório dentro de bloco desejável continua valendo', () => {
    assert.deepEqual(summary('Diferenciais:\n- Python (obrigatório)'), ['Python:required']);
  });

  test('benefício escrito na mesma linha não vira requisito', () => {
    assert.deepEqual(summary('Requisitos:\n- Java\nBenefícios: curso de inglês, Alura'), ['Java:required']);
  });

  test('sem bloco reconhecido, o padrão é obrigatório', () => {
    assert.deepEqual(summary('Java, Python e Docker'), ['Java:required', 'Python:required', 'Docker:required']);
  });

  test('blocos e marcador da frase', () => {
    assert.deepEqual(summary('Requisitos:\n- Java\n- Docker (desejável)\nDiferenciais:\n- Kotlin\n- Python (obrigatório)'), ['Java:required', 'Docker:preferred', 'Kotlin:preferred', 'Python:required']);
  });

  test('bloco fora de assunto não vira requisito, com ou sem dois-pontos', () => {
    assert.deepEqual(summary('Requisitos:\n- Java\nBenefícios:\n- Curso de inglês\n- Alura\nDiferenciais:\n- Docker'), ['Java:required', 'Docker:preferred']);
    assert.deepEqual(summary('Requisitos\n- Java\nBenefícios\n- Curso de inglês\nDiferenciais\n- Docker'), ['Java:required', 'Docker:preferred']);
    assert.deepEqual(summary('About us:\nWe use Ruby and Python.\nRequirements:\n- Java'), ['Java:required']);
  });

  test('a trava também lê o bloco fora de assunto', () => {
    assert.deepEqual(extractRequirements('Benefícios:\n- Só para mulheres').ignored.map((i) => i.topic), ['gender']);
  });

  test('título com termo conta', () => {
    assert.deepEqual(summary('Experiência com Java:\n- Spring Boot'), ['Java:required', 'Spring Boot:required']);
  });
});

describe('categoria vira tipo', () => {
  test('tecnologia, ferramenta e competência viram term; idioma, certificado e cargo têm tipo próprio', () => {
    const kinds = Object.fromEntries(extractRequirements('Java\nDocker\nCode review\nInglês\nCKA\nTech Lead').requirements.map((r) => [r.label, r.kind]));
    assert.deepEqual(kinds, {
      Java: 'term',
      Docker: 'term',
      'Code review': 'term',
      Inglês: 'language',
      'Certified Kubernetes Administrator': 'certification',
      'Tech Lead': 'title_word',
    });
  });

  test('idioma, certificado e cargo nunca recebem anos', () => {
    assert.deepEqual(extractRequirements('5 anos de inglês').requirements.map((r) => [r.kind, r.minYears]), [['language', undefined]]);
    assert.deepEqual(extractRequirements('Tech Lead (3 anos)').requirements.map((r) => [r.kind, r.minYears]), [['title_word', undefined]]);
  });
});

describe('anos', () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ['5 anos de Java', ['Java:required:5']],
    ['Java (5+ anos)', ['Java:required:5']],
    ['mínimo de 3 anos em React', ['React:required:3']],
    ['3+ years of Python', ['Python:required:3']],
    ['5 years with Kotlin', ['Kotlin:required:5']],
    ['5 anos de experiência com Java', ['Java:required:5']],
    ['5+ years of experience with Kotlin', ['Kotlin:required:5']],
    ['Experiência de 3 anos com Java', ['Java:required:3']],
    ['Experiência com Java por pelo menos 3 anos', ['Java:required:3']],
    ['Java: mínimo 3 anos', ['Java:required:3']],
    ['Java - 5 anos', ['Java:required:5']],
    ['React há 3 anos', ['React:required:3']],
    ['cinco anos de Java', ['Java:required:5']],
    ['5anos de Java', ['Java:required:5']],
    ['Python 3 (5 anos)', ['Python:required:5']],
    ['Python (3 anos)', ['Python:required:3']],
    ['Python: 3 anos', ['Python:required:3']],
    ['SQL: 5 anos, Python: 3 anos', ['SQL:required:5', 'Python:required:3']],
    ['Spring Boot 3 (5 anos)', ['Spring Boot:required:5']],
    ['5 anos de Java e 2 anos de React', ['Java:required:5', 'React:required:2']],
    ['Java 5 anos, React 3 anos', ['Java:required:5', 'React:required:3']],
    ['Experiência mínima de 3 anos em C#', ['C#:required:3']],
    ['2 anos de C++', ['C++:required:2']],
    ['5 anos de Go', ['Go:required:5']],
    ['Rust (2+ anos)', ['Rust:required:2']],
    // Decimal não vira 15: fica a parte inteira.
    ['1,5 ano de React', ['React:required:1']],
    ['2.5 years of Python', ['Python:required:2']],
    ['Java 17', ['Java:required']],
    ['Stack:Java,Kotlin;Docker', ['Java:required', 'Kotlin:required', 'Docker:required']],
    // Só o termo colado recebe os anos: é o erro que não reprova ninguém por engano.
    ['5 anos de Java e Spring Boot', ['Java:required:5', 'Spring Boot:required']],
    // Fora da faixa de 1 a 40, fica o termo sem mínimo.
    ['50 anos de Java', ['Java:required']],
    ['5 anos de experiência', ['5 anos de experiência:required:5']],
    ['pelo menos 5 anos na área', ['5 anos de experiência:required:5']],
    ['Experiência de 4 anos', ['4 anos de experiência:required:4']],
    ['Experiência profissional mínima de 4 anos', ['4 anos de experiência:required:4']],
    ['5+ years of experience', ['5 anos de experiência:required:5']],
    ['at least 5 years in the industry', ['5 anos de experiência:required:5']],
    ['1 ano de experiência', ['1 ano de experiência:required:1']],
    ['3 anos de experiência, Java e Docker', ['3 anos de experiência:required:3', 'Java:required', 'Docker:required']],
    ['5 anos de experiência (desejável)', ['5 anos de experiência:preferred:5']],
    // Anos sem termo nem "experiência" não geram requisito.
    ['5 anos', []],
    ['Contrato de 2 anos', []],
    ['Mais de 10 anos de história', []],
    ['Há mais de 20 anos no mercado', []],
    ['Somos uma empresa com 20 anos de experiência', []],
    ['Our team has 15 years of experience', []],
  ];
  for (const [text, expected] of cases) {
    test(text, () => assert.deepEqual(summary(text), expected));
  }
});

describe('sem duplicar', () => {
  test('o termo que aparece duas vezes fica uma vez, com a classe mais forte e o maior mínimo', () => {
    assert.deepEqual(summary('Requisitos:\n- Java\nDiferenciais:\n- Java (2 anos)'), ['Java:required:2']);
    assert.deepEqual(summary('Diferenciais:\n- Java (3 anos)\nRequisitos:\n- Java (2 anos)'), ['Java:required:3']);
    assert.deepEqual(summary('Diferenciais:\n- Java\n- Java'), ['Java:preferred']);
  });

  test('sinônimos contam como o mesmo termo, na posição da primeira aparição', () => {
    assert.deepEqual(summary('Postgres\nDocker\nPostgreSQL'), ['PostgreSQL:required', 'Docker:required']);
    assert.deepEqual(summary('K8s\nKubernetes (4 anos)'), ['Kubernetes:required:4']);
  });

  test('experiência total também se junta, e o rótulo acompanha o maior mínimo', () => {
    assert.deepEqual(summary('3 anos de experiência\n5 anos de experiência (desejável)'), ['5 anos de experiência:required:5']);
  });

  test('C, C++ e C# continuam separados', () => {
    assert.deepEqual(summary('C, C++ e C#'), ['C:required', 'C++:required', 'C#:required']);
  });
});

describe('termo ambíguo (Go, R, C...)', () => {
  test('sem contexto e dentro de uma frase qualquer não conta', () => {
    assert.deepEqual(summary('Ready to go'), []);
    assert.deepEqual(summary('Vamos go to market'), []);
    assert.deepEqual(summary('Início em spring 2027.'), []);
  });

  test('o contexto vale na vaga inteira, não só na linha', () => {
    assert.deepEqual(summary('- Go\n- Python'), ['Go:required', 'Python:required']);
    assert.deepEqual(summary('Requisitos:\n- Go\n\nSobre a vaga:\nUsamos golang'), ['Go:required']);
  });
});

describe('ordem e limite de 30', () => {
  const plain = DICTIONARY_TERMS.filter((term) => term.category === 'technology' && term.requires.length === 0).map((term) => term.canonical);

  test('mantém a ordem de leitura e para em 30', () => {
    const names = plain.slice(0, MAX_REQUIREMENTS + 8);
    const result = extractRequirements(names.join('\n')).requirements;
    assert.equal(result.length, MAX_REQUIREMENTS);
    assert.deepEqual(result.map((r) => r.canonical), names.slice(0, MAX_REQUIREMENTS));
  });

  test('depois do limite, termo já aceito ainda sobe de classe e de mínimo, e termo novo não entra', () => {
    const names = plain.slice(0, MAX_REQUIREMENTS);
    const first = names[0] ?? '';
    const extra = plain[MAX_REQUIREMENTS] ?? '';
    const text = `Diferenciais:\n${names.map((name) => `- ${name}`).join('\n')}\nRequisitos:\n- ${extra}\n- ${first} (7 anos)`;
    const result = extractRequirements(text).requirements;
    assert.equal(result.length, MAX_REQUIREMENTS);
    assert.equal(result[0]?.importance, 'required');
    assert.equal(result[0]?.minYears, 7);
    assert.equal(result.some((r) => r.canonical === extra), false);
  });
});

describe('títulos numa linha inteira, sem dois-pontos', () => {
  const lines: ReadonlyArray<readonly [string, Importance]> = [
    ['Requisitos desejáveis', 'preferred'],
    ['Diferenciais', 'preferred'],
    ['Desejável', 'preferred'],
    ['Nice to have', 'preferred'],
    ['Requisitos', 'required'],
    ['Requirements', 'required'],
    ['Obrigatório', 'required'],
  ];
  for (const [line, importance] of lines) {
    test(`"${line}" abre o bloco certo`, () => {
      assert.deepEqual(summary(`Kotlin (desejável)\n${line}\nKubernetes`), ['Kotlin:preferred', `Kubernetes:${importance}`]);
    });
  }

  test('a vaga inteira, com os títulos sem dois-pontos', () => {
    assert.deepEqual(summary('Requisitos\n- Java\n- Docker\nRequisitos desejáveis\n- Kotlin\nObrigatório\n- Git'), ['Java:required', 'Docker:required', 'Kotlin:preferred', 'Git:required']);
  });
});

describe('termos novos na vaga', () => {
  test('níveis viram palavra de cargo', () => {
    const { requirements } = extractRequirements('Desenvolvedor Java Pleno');
    assert.deepEqual(requirements.map((r) => [r.kind, r.canonical]), [['title_word', 'Desenvolvedor de software'], ['term', 'Java'], ['title_word', 'Pleno']]);
  });

  test('"em pleno crescimento" não pede nível nenhum', () => {
    assert.deepEqual(summary('Somos uma empresa em pleno crescimento.'), []);
  });

  test('Spring com contexto vira termo, e a estação do ano não', () => {
    assert.deepEqual(summary('Requisitos:\n- Java e Spring'), ['Java:required', 'Spring:required']);
    assert.deepEqual(summary('Início em spring 2027.'), []);
  });

  test('Oracle', () => {
    assert.deepEqual(summary('Banco Oracle'), ['Oracle:required']);
  });
});

describe('sinal de vaga sem requisito (RF-11)', () => {
  test('nada extraído pede preenchimento à mão', () => {
    for (const text of ['', 'Vaga incrível, venha fazer parte do nosso time!', 'Somente homens', 'Ready to go']) {
      const result = extractRequirements(text);
      assert.deepEqual(result.requirements, [], text);
      assert.equal(result.needsManualEntry, true, text);
    }
  });

  test('com um requisito, não pede', () => {
    assert.equal(extractRequirements('Java').needsManualEntry, false);
    assert.equal(extractRequirements('5 anos de experiência').needsManualEntry, false);
  });

  test('truncated e o sinal saem em todos os caminhos', () => {
    for (const value of ['', 'Java', 'x'.repeat(MAX_JOB_CHARS + 1), 'Somente homens', undefined as unknown as string]) {
      const result = extractRequirements(value);
      assert.equal(typeof result.truncated, 'boolean');
      assert.equal(typeof result.needsManualEntry, 'boolean');
    }
    assert.deepEqual(extractRequirements('x'.repeat(MAX_JOB_CHARS + 1)), { requirements: [], ignored: [], truncated: true, needsManualEntry: true });
  });
});

describe('robustez', () => {
  test('entrada vazia', () => {
    const empty = { requirements: [], ignored: [], truncated: false, needsManualEntry: true };
    for (const text of ['', '   ', '\n\n\n', '- \n- ', '...']) assert.deepEqual(extractRequirements(text), empty, JSON.stringify(text));
    for (const value of [undefined, null, 0, {}, []]) assert.deepEqual(extractRequirements(value as unknown as string), empty);
  });

  test('o começo de um texto enorme é lido, cortado em fim de linha', () => {
    const longLines = `Java\n${'Texto de enchimento sem termo.\n'.repeat(Math.ceil(MAX_JOB_CHARS / 31) + 10)}Python\nmulheres`;
    assert.deepEqual(extractRequirements(longLines), { requirements: extractRequirements('Java').requirements, ignored: [], truncated: true, needsManualEntry: false });
    const manyLines = `Java\n${'a\n'.repeat(MAX_JOB_LINES + 10)}Python`;
    assert.deepEqual(summary(manyLines), ['Java:required']);
    assert.equal(extractRequirements(manyLines).truncated, true);
  });

  test('truncated: só quando há texto depois do corte', () => {
    assert.equal(extractRequirements('Java').truncated, false);
    assert.equal(extractRequirements('x'.repeat(MAX_JOB_CHARS)).truncated, false);
    assert.equal(extractRequirements('x'.repeat(MAX_JOB_CHARS + 1)).truncated, true);
    assert.equal(extractRequirements(`Java\n${' '.repeat(MAX_JOB_CHARS + 10)}`).truncated, false);
    assert.equal(extractRequirements(`Java\n${'\n'.repeat(MAX_JOB_LINES + 10)}`).truncated, false);
    assert.equal(extractRequirements('a\n'.repeat(MAX_JOB_LINES - 1)).truncated, false);
    assert.equal(extractRequirements(`${'a\n'.repeat(MAX_JOB_LINES)}Python`).truncated, true);
  });

  const SIZE = 100_000;
  const LIMIT_MS = 100;
  const fill = (unit: string): string => unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);
  const shapes: Readonly<Record<string, string>> = {
    prosa: fill('Buscamos pessoa desenvolvedora com experiência em sistemas distribuídos, boa comunicação e vontade de aprender. '),
    'linhas de requisito': fill('- Java\n- 5 anos de Python\n- Docker (desejável)\n'),
    'linhas curtas': fill('a\n'),
    'linhas proibidas': fill('- Procuramos mulheres com Java até 35 anos\n'),
    termos: fill('Java, Python, C++, C#, .NET, Node.js, React, Docker, Kubernetes, '),
    anos: fill('até 5 anos de experiência no máximo 35 anos entre 25 e 35 anos '),
    'anos limpos': fill('5 anos de Java 3 anos de React mínimo 2 anos em Go '),
    'uma palavra só': 'a'.repeat(SIZE),
    'só dígitos': '1'.repeat(SIZE),
    'só espaços': `5${' '.repeat(SIZE - 1)}`,
    'só pontuação': fill('!?,;.'),
    títulos: fill('Requisitos:\n'),
    negrito: `**${fill('x**')}`,
  };

  // A melhor de cinco medições: mede o custo do código, não um pico de outro processo na máquina.
  function elapsed(run: () => unknown): number {
    let best = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < 5; attempt++) {
      const start = performance.now();
      run();
      best = Math.min(best, performance.now() - start);
    }
    return best;
  }

  for (const [name, text] of Object.entries(shapes)) {
    test(`100 mil caracteres (${name}): não lança erro e roda em menos de 100 ms`, () => {
      assert.equal(text.length >= SIZE, true);
      const extract = elapsed(() => extractRequirements(text));
      const forbidden = elapsed(() => findForbidden(text));
      const term = elapsed(() => checkTerm(text));
      assert.ok(extract < LIMIT_MS, `extractRequirements levou ${extract.toFixed(1)} ms`);
      assert.ok(forbidden < LIMIT_MS, `findForbidden levou ${forbidden.toFixed(1)} ms`);
      assert.ok(term < LIMIT_MS, `checkTerm levou ${term.toFixed(1)} ms`);
    });
  }
});
