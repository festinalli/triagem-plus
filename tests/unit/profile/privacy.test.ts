// Prova do que fica de fora (RF-44, RD-8, DP-05, DP-06).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as parseModule from '../../../src/core/profile/parse.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import type { ParsedProfile } from '../../../src/core/profile/types.ts';
import { AS_OF, fixture } from './fixtures.ts';

const profile = parseProfileText(fixture('dados-pessoais'), AS_OF);

/** Tudo o que o leitor devolve, exceto `about`, que é a exceção assumida e tem teste próprio. */
function everythingButAbout(parsed: ParsedProfile): string {
  const { about: _about, ...rest } = parsed;
  return JSON.stringify(rest);
}

describe('Dados pessoais ficam de fora', () => {
  const absent: ReadonlyArray<readonly [string, string]> = [
    ['pronomes', 'Ela/Dela'],
    ['pronomes, parte', 'Dela'],
    ['grau de conexão', '2º'],
    ['selo de verificação', 'verificado'],
    ['título profissional livre', 'apaixonada'],
    ['cidade', 'Curitiba'],
    ['estado', 'Paraná'],
    ['país', 'Brasil'],
    ['seguidores', 'seguidores'],
    ['conexões', 'conexões'],
    ['selo de disponibilidade', 'Disponível'],
    ['cargos procurados', 'Cargos de engenheira'],
    ['contato', 'exemplo.test'],
    ['telefone', '90000'],
    ['idade escrita', '32 anos'],
    ['estado civil', 'casada'],
    ['formação', 'Universidade'],
    ['curso', 'Bacharelado'],
    ['ano de início da formação', '2008'],
    ['ano de formatura', '2012'],
    ['grupo da formação', 'Associação'],
    ['competência escrita na formação', 'Fortran'],
    ['voluntariado', 'Voluntária'],
    ['organização do voluntariado', 'ONG'],
    ['recomendação, autor', 'Fulano'],
    ['recomendação, texto', 'Cobol'],
    ['causas', 'Direitos'],
    ['interesses', 'Igreja'],
    ['empresa', 'Empresa Fictícia'],
    ['tipo de contrato', 'Tempo integral'],
    ['modalidade', 'Híbrida'],
  ];
  for (const [label, text] of absent) {
    test(`${label} não aparece em nenhum campo`, () => {
      assert.ok(!everythingButAbout(profile).includes(text), `"${text}" apareceu`);
    });
  }

  test('o que conta continua lá', () => {
    assert.equal(profile.name, 'Zuleica Inventada Ficção');
    assert.deepEqual(profile.experiences.map((e) => e.title), ['Engenheira de Dados']);
    assert.equal(profile.experiences[0]?.text, 'Engenheira de Dados\nPipelines de dados em Python.\nCompetências: Python, Airflow');
    assert.equal(profile.skillsText, 'Python\nSQL');
    assert.equal(profile.languagesText, 'Português\nNativo ou bilíngue');
    assert.deepEqual(profile.sectionsRead, ['about', 'experience', 'skills', 'languages']);
  });

  test('o período do voluntariado não entra no tempo total', () => {
    assert.equal(profile.totalMonths, 69);
  });

  test('o mesmo perfil, mudando só o que é descartado, dá o mesmo resultado', () => {
    const other = fixture('dados-pessoais')
      .replace('(Ela/Dela) · 2º', '(He/Him) · 1st')
      .replace('Curitiba, Paraná, Brasil · Informações de contato', 'Manaus, Amazonas, Brasil')
      .replace('Curitiba, Paraná, Brasil · Híbrida', 'Manaus, Amazonas, Brasil · Presencial')
      .replace('Universidade Inventada', 'Faculdade Imaginária')
      .replace('2008 - 2012', '1985 - 1989')
      .replace('ONG Imaginária', 'Associação Fictícia')
      .replace('Fulano Inventado', 'Sicrano Inventado')
      .replace('Disponível para trabalhar', '')
      .replace('Igreja Imaginária', 'Templo Imaginário');
    assert.notEqual(other, fixture('dados-pessoais'));
    assert.deepEqual(parseProfileText(other, AS_OF), profile);
  });

  test('o resultado tem só os campos previstos', () => {
    assert.deepEqual(Object.keys(profile).sort(), [
      'about', 'certificationsText', 'experiences', 'languagesText', 'name', 'projectsText', 'sectionsRead', 'skillsText',
      'totalMonths', 'truncated',
    ]);
    assert.deepEqual(Object.keys(profile.experiences[0] ?? {}).sort(), ['months', 'span', 'text', 'title']);
  });

  test('o módulo só expõe a leitura: nenhuma função extrai dado pessoal', () => {
    assert.deepEqual(Object.keys(parseModule), ['parseProfileText']);
  });
});

/*
 * Exceção assumida: `about` é texto livre e pode conter o que a pessoa escreveu, inclusive idade ou estado civil. Não
 * tentamos achar e apagar esses dados, porque isso protege menos do que não usá-los (DP-03). `about` fica só em memória,
 * nunca vai para a ficha (DP-10, seção 9 da especificação), e a fatia F05 só procura nele os termos da vaga. O teste
 * registra a exceção: se ela mudar, o teste precisa mudar junto, de propósito.
 */
describe('Exceção assumida: about é texto livre', () => {
  test('about guarda o que a pessoa escreveu, e só about', () => {
    assert.match(profile.about, /Tenho 32 anos, sou casada, mãe de dois/);
    assert.ok(!everythingButAbout(profile).includes('32 anos'));
    assert.ok(!everythingButAbout(profile).includes('casada'));
  });
});

describe('Nome (RF-44)', () => {
  const name = (line: string) => parseProfileText(`${line}\nSobre\nTexto.`, AS_OF).name;

  const clean: ReadonlyArray<readonly [string, string]> = [
    ['Clara Fictícia', 'Clara Fictícia'],
    ['Clara Fictícia (Ela/Dela)', 'Clara Fictícia'],
    ['Clara Fictícia (ela/dela)', 'Clara Fictícia'],
    ['Clara Fictícia · Ela/Dela', 'Clara Fictícia'],
    ['Clara Fictícia - Ela/Dela', 'Clara Fictícia'],
    ['Clara Fictícia | Ela / Dela', 'Clara Fictícia'],
    ['Clara Fictícia, Ela/Dela', 'Clara Fictícia'],
    ['Clara Fictícia Ela/Dela', 'Clara Fictícia'],
    ['Bento Imaginário (Ele/Dele)', 'Bento Imaginário'],
    ['Bento Imaginário He/Him', 'Bento Imaginário'],
    ['Ivy Madeup (She/Her)', 'Ivy Madeup'],
    ['Ivy Madeup · She/Her · 2nd', 'Ivy Madeup'],
    ['Ivy Madeup They/Them', 'Ivy Madeup'],
    ['Ivy Madeup He/Him/His', 'Ivy Madeup'],
    ['Lu Inventade (Elu/Delu)', 'Lu Inventade'],
    ['Clara Fictícia · 1º', 'Clara Fictícia'],
    ['Clara Fictícia · 2nd', 'Clara Fictícia'],
    ['Clara Fictícia 3º+', 'Clara Fictícia'],
    ['Clara Fictícia 2nd degree connection', 'Clara Fictícia'],
    ['Clara Fictícia ✓', 'Clara Fictícia'],
    ['Clara Fictícia 🛡\uFE0F', 'Clara Fictícia'],
    ['Clara Fictícia Verificada', 'Clara Fictícia'],
    ['Ivy Madeup Verified', 'Ivy Madeup'],
    ['Clara Fictícia (Ela/Dela) ✓ · 2º', 'Clara Fictícia'],
    ['Clara Fictícia | Desenvolvedora Java', 'Clara Fictícia'],
    ['Clara Fictícia - Disponível para trabalhar', 'Clara Fictícia'],
    ['João Pedro de Souza Fictício', 'João Pedro de Souza Fictício'],
    ['Ana-Maria D\'Ávila', 'Ana-Maria D\'Ávila'],
    ['Maria d\'Ávila', 'Maria d\'Ávila'],
    ['Dr. Bento Imaginário', 'Dr. Bento Imaginário'],
    ['CLARA FICTÍCIA', 'CLARA FICTÍCIA'],
    ['Ela Fictícia', 'Ela Fictícia'],
    ['山田太郎', '山田太郎'],
  ];
  for (const [line, expected] of clean) {
    test(`"${line}" vira "${expected}"`, () => {
      assert.equal(name(line), expected);
    });
  }

  const notName = [
    'Desenvolvedora Sênior',
    'Senior Software Engineer',
    'Engenheiro de Software',
    'São Paulo, Brasil',
    'São Paulo',
    'Belo Horizonte',
    'Rio de Janeiro',
    'clara fictícia',
    'Clara',
    'Exibir todas',
    'Show All',
    'Experiência',
    'Mensagem',
    'Pular para o conteúdo principal',
    '500+ conexões',
    '1.234 seguidores',
    'clara@exemplo.test',
    'https://exemplo.test/clara',
    'Clara Fictícia, 32 anos',
    'Clara Fictícia 32',
    'Tenho muitos anos de experiência em Java.',
    'A'.repeat(200),
  ];
  for (const line of notName) {
    test(`"${line.slice(0, 40)}" não é nome`, () => {
      assert.equal(name(line), null);
    });
  }

  test('só a primeira linha é olhada', () => {
    assert.equal(parseProfileText('Desenvolvedora Sênior\nClara Fictícia\nSobre\nTexto.', AS_OF).name, null);
  });

  test('sem cabeçalho, o nome é nulo', () => {
    assert.equal(parseProfileText('Sobre\nClara Fictícia', AS_OF).name, null);
  });

  test('linha repetida e linhas em branco antes do nome', () => {
    assert.equal(parseProfileText('\n\nClara Fictícia\nClara Fictícia\nSobre\nTexto.', AS_OF).name, 'Clara Fictícia');
  });
});

describe('O código do leitor', () => {
  for (const folder of ['profile', 'time']) {
    const base = new URL(`../../../src/core/${folder}/`, import.meta.url);
    for (const file of readdirSync(base)) {
      test(`src/core/${folder}/${file} não escreve no console nem usa Chrome ou relógio`, () => {
        const source = readFileSync(new URL(file, base), 'utf8');
        assert.doesNotMatch(source, /\bconsole\s*\./);
        assert.doesNotMatch(source, /\bchrome\s*\./);
        assert.doesNotMatch(source, /\b(?:document|window)\s*\./);
        assert.doesNotMatch(source, /\bDate\.now\b|\bnew Date\b/);
      });
    }
  }
});

describe('Nome: sufixo de condição, pronome ou selo sai (RF-44)', () => {
  const name = (line: string) => parseProfileText(`${line}\nSobre\nTexto.`, AS_OF).name;

  const cases: ReadonlyArray<readonly [string, string]> = [
    ['Ana Souza PCD', 'Ana Souza'],
    ['Ana Souza Pcd Deficiente', 'Ana Souza'],
    ['Ana Souza Ela Dela', 'Ana Souza'],
    ['Ana Souza Ela', 'Ana Souza'],
    ['Ana Souza She Her', 'Ana Souza'],
    ['Bento Souza He Him', 'Bento Souza'],
    ['Ana Souza Mãe', 'Ana Souza'],
    ['Ana Souza Negra', 'Ana Souza'],
    ['Ana Souza Solteira', 'Ana Souza'],
    ['Ana Souza Casada', 'Ana Souza'],
    ['Ana Souza Autista', 'Ana Souza'],
    ['Ana Souza LGBTQIA', 'Ana Souza'],
    ['Ana Souza Premium', 'Ana Souza'],
    ['Ana Souza PCD Verificada', 'Ana Souza'],
    ['Ana Souza São Paulo', 'Ana Souza'],
    ['Ana Souza de São Paulo', 'Ana Souza'],
    ['Ana Souza Campinas', 'Ana Souza'],
  ];
  for (const [line, expected] of cases) {
    test(`"${line}" vira "${expected}"`, () => assert.equal(name(line), expected));
  }

  test('sobrenome igual a uma palavra de cor continua, quando é o único sobrenome', () => {
    assert.equal(name('João Branco'), 'João Branco');
    assert.equal(name('Maria Preto'), 'Maria Preto');
  });

  test('sobra uma palavra só: nome nulo, e a pessoa digita', () => {
    assert.equal(name('Ana PCD'), null);
    assert.equal(name('Campinas São Paulo'), null);
  });

  test('o pronome no começo é nome', () => {
    assert.equal(name('Ela Fictícia'), 'Ela Fictícia');
  });
});
