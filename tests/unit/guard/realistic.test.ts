// Frases de vaga escritas por gente, não palavras soltas (RF-13, R-03). Vieram da revisão independente e dos vizinhos delas.
// A lista nunca vai pegar tudo: isto só impede que voltem a passar as que já foram vistas.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY_TERMS } from '../../../src/core/dictionary/index.ts';
import { checkTerm, findForbidden, FORBIDDEN_TOPICS } from '../../../src/core/guard/index.ts';
import type { ForbiddenTopic } from '../../../src/core/guard/index.ts';
import { extractRequirements } from '../../../src/core/job/extract.ts';

const REVIEW: Readonly<Record<ForbiddenTopic, readonly string[]>> = {
  age: ['Vaga para pessoas de 20 a 30 anos', 'Preferência por candidatos com menos de 35', 'Looking for young and hungry engineers', 'Recent college graduates preferred', 'Buscamos desenvolvedor jovem para time dinâmico'],
  gender: ['Vaga exclusiva para mulheres', 'Preferencialmente do sexo masculino', 'Buscamos uma desenvolvedora para compor o time', 'We are looking for a guy who loves to code', 'Female developers only'],
  orientation: ['Vaga afirmativa para pessoas LGBTQIAPN+', 'LGBTQIA+ only', 'Candidatos heterossexuais', 'Desenvolvedora trans ou não binária', 'Preferência por pessoas héteros'],
  race: ['Vaga afirmativa para pessoas negras', 'Exclusiva para profissionais pretos e pardos', 'Desenvolvedora negra para programa de diversidade', 'Black engineers only', 'Asian candidates preferred'],
  appearance: ['Exige-se boa aparência', 'Ter boa apresentação', 'Enviar currículo com foto', 'Excelente apresentação pessoal', 'Send your CV with a recent photo'],
  religion: ['Empresa cristã busca profissional que compartilhe da nossa fé', 'Pessoa de fé', 'Must share our Christian values', 'Membro ativo de igreja evangélica', 'Que guarde o sábado'],
  politics: ['Não sindicalizados', 'Alinhado aos valores conservadores da empresa', 'Sem filiação partidária', 'Profissional de direita', 'Sem envolvimento com movimentos sociais'],
  marital_family: ['Solteiro, sem filhos', 'Preferência por quem não tem filhos pequenos', 'Filhos já criados', 'No kids, able to travel', 'Must be single'],
  disability_health: ['Vaga exclusiva PCD', 'Não fumante', 'Saúde em dia', 'Vaga para PNE', 'Must be fully vaccinated'],
  nationality_origin: ['Somente brasileiros', 'Brasileiro nato', 'Native English speaker', 'US citizens only', 'Nordestinos não serão considerados'],
  address_distance: ['Residir em Campinas', 'Morar na Zona Sul de SP', 'Candidatos da região de Campinas', 'Preferência para quem é da Zona Leste', 'Até 30 minutos do escritório'],
  max_experience: ['No máximo 5 anos de experiência', '3-5 YOE', 'Experiência entre 2 e 4 anos', 'Less than 10 years of experience', 'Max 5 YOE'],
};

// Os vizinhos: a mesma construção, com outras palavras, para a correção ser padrão e não lista de frases.
const NEIGHBORS: Readonly<Record<ForbiddenTopic, readonly string[]>> = {
  age: [
    'Candidatos abaixo de 30', 'Profissionais de até 35', 'Pessoas entre 25 e 35', 'Candidates between 25 and 35', 'Looking for a young developer', 'Young talented software engineers', 'Desenvolvedora jovem', 'Programador Java jovem', 'Jovem desenvolvedor', 'Dev jovem',
    'Dev maduro', 'New college grads', 'Fresh university graduates', 'Fresh out of college', 'Class of 2020', 'Turma de 2022', 'Formado em 2020', 'Graduada em 2021', 'Graduated in 2019', 'Nascidos nos anos 90', 'Geração 90', 'A 25-year-old developer', 'Must be young', 'Deve ser jovem', 'Older workers', 'Profissionais 50+',
  ],
  gender: ['Procuramos uma engenheira de dados', 'Contratamos programadoras', 'Vaga para desenvolvedora back-end', 'Looking for guys', 'Dev trans', 'Trans developers', 'Must be a woman', 'Girls only', 'Ladies only', 'Feministas', 'Boys club'],
  orientation: ['LGBT+ apenas', 'Pessoas LGBTQIA+', 'GLBT', 'Straight candidates', 'LGBTQIAP+ only'],
  race: ['Engenheira preta', 'Analista pardo', 'Engenheira de software negra', 'Desenvolvedor Python negro', 'Desenvolvedora back-end negra', 'White developers', 'Black software engineers', 'Latino candidates', 'Asian engineers preferred', 'Preferência por negros', 'Prioridade para pardos', 'Must be white', 'Deve ser branco', 'Asians only'],
  appearance: ['Ótima apresentação pessoal', 'Boa imagem pessoal', 'Well groomed', 'CV with a photo', 'Include a photo of yourself', 'Foto recente no currículo', 'Attach your resume and a recent picture', 'Attractive candidates', 'Recepcionista: pessoa bonita'],
  religion: ['Profissional de fé', 'Pessoa temente a Deus', 'Compartilhe da nossa fé', 'Que guardem o sábado', 'Person of faith', 'Our faith guides us', 'Share our faith', 'Crentes', 'Com fé'],
  politics: ['Valores conservadores', 'Pessoa de esquerda', 'Conservative values', 'Sem vínculo sindical', 'Movimento sindical', 'Sem militância', 'Non-union', 'Perfil conservador', 'Eleitores de direita'],
  marital_family: ['Filhos adultos', 'Filhos já crescidos', 'No children', 'Must have no kids', 'Should be married', 'Deve ser solteira', 'Sem vínculos familiares', 'No family obligations', 'Preferably single', 'Have kids?'],
  disability_health: ['PNE', 'Vaccinated', 'Vacinação em dia', 'Exames em dia', 'Sem comorbidades', 'Pessoa saudável', 'Must be healthy', 'Deve ser saudável', 'Proof of vaccination', 'Neurotípicos', 'Preparo físico', 'Ação afirmativa', 'Vaga afirmativa'],
  nationality_origin: ['Brasileira nata', 'Brasileiros natos', 'Native speaker', 'Native Portuguese speakers', 'Falante nativo', 'Inglês nativo', 'Nativo em inglês', 'Dev brasileiro', 'Desenvolvedor nordestino', 'Engenheira de dados brasileira', 'Canadian engineers', 'German candidates', 'Preferência por brasileiros', 'Estrangeiros não serão aceitos', 'Argentinos não', 'EU citizen', 'Cidadão europeu', 'Naturalizados', 'Americans preferred', 'Must be American'],
  address_distance: ['Pessoas da região de Sorocaba', 'Profissionais da zona norte', 'Quem é do bairro', 'Candidatos do interior', 'Quem mora em Osasco', 'Que more perto', 'People from the area', 'Candidates from the region', 'Local candidates', 'Locals only', 'Local engineers', 'Até 1 hora do escritório', '30 minutes from the office', 'Within 20 minutes of our office', 'Must be local', 'Informe o CEP', 'Seu CEP', 'CEP 01310-100', '01310-100'],
  max_experience: ['Até 5 YOE', '2-4 YOE', '<5 anos de experiência', '< 3 years of experience', 'Não pode ter mais de 5 anos de experiência', 'Must not have more than 5 years of experience', 'Up to 3 YOE', '3 YOE max', 'Experience capped at 5 years', 'Experiência limitada a 3 anos'],
};

// Vieram da medição às cegas: uma pessoa escreveu 60 frases sem ver a lista, e estas passaram. A lista cresce assim, e nunca acaba.
const FROM_THE_BLIND_RUN: readonly (readonly [string, ForbiddenTopic])[] = [
  ['Cor: branca', 'race'],
  ['Attractive appearance required', 'appearance'],
  ['Não contratamos quem apoia partido de esquerda', 'politics'],
  ['Alinhamento político com a direção da empresa', 'politics'],
  ['Single candidates preferred', 'marital_family'],
  ['Candidato deve ter saúde perfeita, sem histórico de doenças', 'disability_health'],
  ['Brazilian-born only', 'nationality_origin'],
  ['Candidate address must be in Zona Sul', 'address_distance'],
];

const SHORT_TERMS = ['Dev jovem', 'Programador jovem', 'Dev maduro', 'Dev trans', 'Desenvolvedora negra', 'Engenheira preta', 'Analista pardo', 'Dev brasileiro', 'Desenvolvedor brasileiro', 'Dev nordestino', 'Campinas', 'Guarulhos', 'Osasco', 'Santos', 'Niterói', 'Alphaville', 'Vale do Paraíba', 'São José dos Campos', 'Lisboa', 'Portugal', 'Pausa na carreira', 'Career break', 'Licença maternidade', 'Maternity leave', 'Girls in Tech', 'Black in AI', 'Rails Girls', 'PyLadies', 'Reprograma', 'Cotista', 'Ação afirmativa', 'Vaga afirmativa', 'Afirmativa', 'Diversidade', 'Minorias', 'Grupos minorizados', 'Underrepresented', 'Fé', 'Feminista', '50+', '60+', '+50', 'Nascido nos anos 90', 'Geração 90', 'Anos 80', 'Class of 2020', 'Turma 2020', 'Formado em 2020', 'Formatura 2023', 'Graduado em 2022', 'Formação 2023', 'Native speaker', 'Nativo em inglês', 'Falante nativo', 'PT-BR nativo', 'EU citizen', 'Cidadão europeu', '5 km', '10km', 'Moro perto', 'Local', 'Locals only', 'Local candidates', 'Presencial em Campinas', 'Campinas e região', 'Saudável', 'Healthy', 'Vaccinated', 'Foto no perfil', 'Jovem(ns)'];

// O outro lado: nada disto pode disparar, porque é vaga normal. Cada linha existe porque um padrão acima poderia pegá-la.
const LEGITIMATE_LINES = [
  // Idade, fora de pessoa.
  'We are a young and growing company', 'Young startup with a strong culture', 'Empresa jovem em crescimento', 'Old developer tools', 'Modernize old legacy code', 'Our mature engineering culture', 'Mature codebase', 'We are a 20-year-old company', 'Modernize our 15-year-old Java monolith to Kotlin', 'Keep latency under 50', 'Scale to over 50', 'Time size over 50', 'Run Kubernetes over 50', 'Candidatos com até 3 certificações', 'Time de 20 a 30 pessoas', 'Profissional com até 20 clientes', 'Pessoas com até 30 tabelas', 'Reuniões com até 30 pessoas', 'Fundada nos anos 90', 'Formado em Ciência da Computação', 'Graduação em 2 etapas', 'Formação em dados', 'Cache-Control: max-age=60', 'Header max-age=3600 no Nginx',
  // Gênero, com a forma inclusiva.
  'Pessoa Desenvolvedora Back-end', 'Vaga: Desenvolvedora Back-end', 'Buscamos uma pessoa desenvolvedora', 'Buscamos pessoa engenheira de dados', 'Buscamos desenvolvedor(a) Python', 'Buscamos engenheira(o) de dados', 'Procuramos desenvolvedora ou desenvolvedor', 'Boy Scout rule', 'Engenheira de software', 'Trans-Atlantic team',
  // Raça e cor, em sentido técnico.
  'Testes de caixa preta', 'Testes de caixas negras com Selenium', 'Analista de testes de caixa preta', 'Analista de caixa branca', 'Black box testing', 'White-box testing', 'Black box engineers', 'White label developers', 'White hat hackers', 'Experience debugging data race and deadlock issues', 'Race conditions', 'Black Friday', 'Black Duck', 'Quadro branco', 'Campos em branco', 'Lista negra', 'Analista de mercado brasileiro', 'Especialista em mercado americano', 'Asian market analysts', 'American Express engineers',
  // Aparência e fé.
  'Boa apresentação de resultados', 'Boa apresentação em público', 'Boa apresentação oral', 'Apresentação técnica', 'Upload de fotos para S3', 'Fotos de produto', 'Sua FE e BE em TypeScript', 'Dev de FE', 'FE e BE', 'Time de FE',
  // Política.
  'Menu à direita', 'Alinhamento à direita', 'Movimentos de dados', 'Profissional liberal', 'Abordagem conservadora de risco', 'Política de privacidade',
  // Família e saúde, em benefício e em técnica.
  'Seguro de vida extensivo a cônjuge', 'Plano de saúde extensivo a dependentes', 'Plano de saúde para você e sua família', 'Auxílio-creche para filhos', 'Processos filhos', 'Single-threaded', 'Must be single-threaded', 'Must be single sign-on compatible', 'Single page application', 'Preferably single page apps', 'Investigate cluster health issues', 'System health metrics', 'Diagnosticar problemas de saúde dos serviços', 'Identificar deficiência de performance em APIs', 'Deficiências de segurança', 'Healthy codebase', 'Healthy candidate pipeline', 'Blind candidate review', 'Plataforma de saúde da mulher com Django', 'Somos referência em saúde da mulher e do idoso', 'App em Flutter para idosos', 'Sistema de pré-natal para gestantes em React', 'Experiência com CMS para igrejas em PHP', 'Processamento de nuvens de pontos (PCD, LAS) com Python',
  // Origem e idioma.
  'React Native', 'Native Android', 'Cloud native', 'Native mobile apps', 'Native or bilingual proficiency', 'Inglês fluente', 'Fluent English', 'Língua materna', 'Empresa brasileira', 'Clientes brasileiros', 'Empresas americanas', 'Americanas S.A. é uma varejista', 'Pessoa física brasileira', 'Citizen developer', 'Citizen developers program',
  // Endereço.
  'Local development environment', 'Local dev environment', 'Local developer setup', 'Local administrator account', 'Must be near real-time', 'Near real-time', 'Temos profissionais de São Paulo, Recife e Porto Alegre', 'Pessoas de todas as regiões do Brasil', 'Profissional de grande experiência', 'Profissionais de capital humano', 'Profissional de alto nível', 'Escritório a 5 minutos do metrô', 'Reuniões de 30 minutos', 'Deploy em até 30 minutos', '40 horas de trabalho semanais', 'Registro de horas do trabalho', 'Flink CEP', 'Apache Flink CEP', 'CEP', 'Complex Event Processing (CEP)', 'Autonomia de até 400 km', 'Telemetria de veículos elétricos com autonomia de até 400 km em Kafka', 'Av. Paulista, 1000, CEP 01310-100',
  // Teto que não é da pessoa.
  'Manter histórico de até 10 anos no PostgreSQL', 'Retenção de logs de até 5 anos no Elasticsearch', 'Migração de dados de até 5 anos para Snowflake', 'Sustentação de sistema com histórico de até 10 anos de dados', 'Stock options com vesting de até 4 anos',
  // Declaração de igualdade não pede nada.
  'Valorizamos a diversidade: todas as pessoas são bem-vindas, independentemente de gênero, raça, idade, orientação sexual ou deficiência.', 'We are an equal opportunity employer and do not discriminate on the basis of race, religion, gender, age or disability.', 'Regardless of race, color, religion, sex, national origin or disability', 'Contratamos sem distinção de gênero, raça ou idade', 'All qualified applicants will receive consideration without regard to race, gender identity, sexual orientation or age',
  // Produto e análise que falam do assunto.
  'Dashboards de gênero e diversidade em Power BI', 'Segmentação de clientes por idade com Python e SQL', 'Fairness em modelos: viés de raça e gênero com Python',
];

// A declaração de igualdade não pode esconder o pedido que vem depois dela.
const AFTER_THE_STATEMENT: readonly (readonly [string, ForbiddenTopic])[] = [
  ['Independentemente de gênero, só aceitamos mulheres', 'gender'],
  ['Independentemente de raça, exigimos boa aparência', 'appearance'],
  ['Regardless of age, men only', 'gender'],
  ['Sem distinção de idade, até 35 anos', 'age'],
  ['Vaga para idosos', 'age'],
  ['Programa de trainee para mulheres', 'gender'],
  ['Saúde da mulher: vaga só para homens', 'gender'],
];

describe('as 60 frases da revisão', () => {
  for (const topic of FORBIDDEN_TOPICS) {
    test(`${topic}: nenhuma passa, nem como termo nem em frase`, () => {
      const leaks = REVIEW[topic].flatMap((text) => {
        const passed = [checkTerm(text).allowed ? 'checkTerm' : '', findForbidden(text).length === 0 ? 'findForbidden' : ''].filter((name) => name !== '');
        return passed.length === 0 ? [] : [`${text} => ${passed.join(', ')}`];
      });
      assert.deepEqual(leaks, []);
    });
  }
});

describe('as 60 frases, dentro de uma vaga', () => {
  for (const topic of FORBIDDEN_TOPICS) {
    test(`${topic}: a frase sai com aviso, e o que vem antes dela fica`, () => {
      const wrong = REVIEW[topic].flatMap((text) => {
        const result = extractRequirements(`Requisitos:\n- Java. ${text}`);
        const fine = result.ignored.length > 0 && result.requirements[0]?.label === 'Java';
        return fine ? [] : [`${text} => ${JSON.stringify(result.requirements.map((r) => r.label))}, ${result.ignored.length} aviso(s)`];
      });
      assert.deepEqual(wrong, []);
    });
  }
});

describe('os vizinhos das frases', () => {
  for (const topic of FORBIDDEN_TOPICS) {
    test(`${topic}: são recusados`, () => {
      assert.deepEqual(NEIGHBORS[topic].filter((text) => checkTerm(text).allowed), []);
    });
  }
});

describe('o que a medição às cegas achou', () => {
  for (const [text, topic] of FROM_THE_BLIND_RUN) {
    test(text, () => {
      assert.ok(findForbidden(text).map((hit) => hit.topic).includes(topic), findForbidden(text).map((hit) => hit.topic).join(','));
      assert.equal(checkTerm(text).allowed, false);
    });
  }

  test('e o que ela disparou à toa', () => {
    for (const line of [
      'Desenvolvimento de formulários de cadastro de estado civil e endereço no sistema de RH',
      'Work with sensitive data such as race and gender fields while staying compliant with privacy laws',
      'Ensure the platform religious holiday calendar feature works in all regions',
      'Vaga aberta para todas as pessoas, incluindo PCD, com adaptações no processo seletivo',
      'Logo na cor branca',
    ]) {
      assert.deepEqual(findForbidden(line), [], line);
    }
  });
});

describe('termos curtos', () => {
  test('nenhum passa', () => {
    assert.deepEqual(SHORT_TERMS.filter((term) => checkTerm(term).allowed), []);
  });
});

describe('o outro lado: linha normal de vaga não dispara', () => {
  test('nenhuma, em findForbidden', () => {
    const fired = LEGITIMATE_LINES.flatMap((line) => {
      const hit = findForbidden(line)[0];
      return hit === undefined ? [] : [`${line} => ${hit.topic}[${hit.matched}]`];
    });
    assert.deepEqual(fired, []);
  });

  test('o que vem depois da declaração continua disparando', () => {
    for (const [text, topic] of AFTER_THE_STATEMENT) {
      const topics = findForbidden(text).map((hit) => hit.topic);
      assert.ok(topics.includes(topic), `${text} => ${topics.join(',')}`);
    }
  });

  test('a declaração digitada como termo continua recusada: quem digita critério não está declarando nada', () => {
    for (const term of ['independentemente de gênero', 'regardless of age']) assert.equal(checkTerm(term).allowed, false, term);
  });

  test('siglas técnicas que colidem com endereço não são recusadas', () => {
    for (const term of ['Flink CEP', 'CEP', 'cep', 'Complex Event Processing', 'Apache Flink CEP']) assert.deepEqual(checkTerm(term), { allowed: true }, term);
  });

  test('a lista de termos segue limpa nas construções novas', () => {
    // O feminino logo depois de quem contrata dispara de propósito ("buscamos uma desenvolvedora"), e tem caso próprio.
    const feminine = /^(?:desenvolvedora|engenheira|arquiteta|programadora|administradora|estagiaria)/u;
    const names = [...new Set(DICTIONARY_TERMS.flatMap((term) => [term.canonical, ...term.synonyms]))].filter((name) => !feminine.test(name));
    const frames = (name: string): string[] => [`Must be ${name}`, `Buscamos ${name}`, `Preferência por ${name}`, `Looking for ${name}`, `Candidatos com ${name}`];
    const fired = names.flatMap(frames).flatMap((text) => {
      const hit = findForbidden(text)[0];
      return hit === undefined ? [] : [`${text} => ${hit.topic}[${hit.matched}]`];
    });
    assert.deepEqual(fired, []);
  });
});
