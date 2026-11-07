import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INPUT_CHARS } from '../../../src/core/profile/lines.ts';
import { mergeProfileText, profileKeyOf } from '../../../src/core/profile/merge.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { AS_OF, fixture } from './fixtures.ts';

const parse = (text: string) => parseProfileText(text, AS_OF);

describe('mergeProfileText (RF-34)', () => {
  const main = fixture('lista-cortada');
  const skills = fixture('detalhes-competencias');
  const experiences = fixture('detalhes-experiencias');

  test('a página "ver todas as competências" completa a lista', () => {
    const merged = parse(mergeProfileText(main, skills));
    assert.match(merged.skillsText, /CSS/);
    assert.match(merged.skillsText, /Testes automatizados/);
    assert.match(merged.skillsText, /Acessibilidade web/);
    assert.equal(merged.name, 'Olívia Fictícia Ramos');
  });

  test('o cabeçalho da página nova não cai na seção anterior', () => {
    // O texto anterior termina numa seção que conta: sem o corte, "Recife" e "Voltar" iriam parar em languagesText.
    const previous = 'Olívia Fictícia Ramos\nIdiomas\nPortuguês';
    const merged = parse(mergeProfileText(previous, skills));
    assert.equal(merged.languagesText, 'Português');
    assert.doesNotMatch(JSON.stringify(merged), /Recife|Pernambuco|Voltar/);
  });

  test('endosso com nome de terceiro não entra pela soma', () => {
    assert.doesNotMatch(JSON.stringify(parse(mergeProfileText(main, skills))), /Fulano|endosso/i);
  });

  test('a lista completa desfaz o sinal de lista cortada daquela seção', () => {
    assert.equal(parse(main).truncated, true);
    const withSkills = mergeProfileText(main, skills);
    assert.equal(parse(withSkills).truncated, true, 'as experiências ainda estão cortadas');
    assert.equal(parse(mergeProfileText(withSkills, experiences)).truncated, false);
  });

  test('a experiência repetida não duplica, e fica o texto mais completo', () => {
    const merged = parse(mergeProfileText(main, experiences));
    assert.deepEqual(merged.experiences.map((e) => e.title), ['Desenvolvedora Front-end', 'Desenvolvedora Júnior']);
    assert.match(merged.experiences[0]?.text ?? '', /Jest e Cypress/);
    assert.equal(merged.totalMonths, 70);
  });

  test('título do texto novo é reconhecido mesmo depois de uma seção ignorada', () => {
    const merged = parse(mergeProfileText('Recomendações\nFulano Inventado', 'Competências\nJava'));
    assert.equal(merged.skillsText, 'Java');
    assert.doesNotMatch(JSON.stringify(merged), /Fulano/);
  });

  test('a última linha do texto anterior não se cola no título novo', () => {
    assert.equal(parse(mergeProfileText('Idiomas\nPortuguês', 'Competências\nJava')).languagesText, 'Português');
  });

  test('quebra de linha de Windows no texto novo', () => {
    assert.equal(parse(mergeProfileText('Idiomas\nPortuguês', 'Competências\r\nJava\r\n')).skillsText, 'Java');
  });

  test('repetir o gesto na mesma página não muda nada', () => {
    assert.equal(mergeProfileText(main, main), main);
    const once = mergeProfileText(main, skills);
    assert.equal(mergeProfileText(once, skills), once);
    assert.equal(mergeProfileText(mergeProfileText(once, experiences), skills), mergeProfileText(once, experiences));
  });

  test('sem texto anterior, o novo entra inteiro, com o nome', () => {
    assert.equal(parse(mergeProfileText('', main)).name, 'Olívia Fictícia Ramos');
    assert.equal(parse(mergeProfileText('  \n ', main)).name, 'Olívia Fictícia Ramos');
  });

  test('o nome vem do texto novo quando o anterior não tinha', () => {
    const merged = parse(mergeProfileText(skills.replace(/^[\s\S]*?(?=Competências)/u, ''), main));
    assert.equal(merged.name, 'Olívia Fictícia Ramos');
    assert.match(merged.skillsText, /CSS/);
  });

  test('o nome do texto anterior tem preferência', () => {
    const merged = parse(mergeProfileText('Clara Fictícia\nSobre\nTexto.', main));
    assert.equal(merged.name, 'Clara Fictícia');
  });

  test('texto novo vazio ou sem nenhum título não muda nada, e quem chama pode perceber', () => {
    assert.equal(mergeProfileText(main, ''), main);
    assert.equal(mergeProfileText(main, 'Java\nSpring'), main);
  });

  test('os dois vazios', () => {
    assert.equal(mergeProfileText('', ''), '');
    assert.deepEqual(parse(mergeProfileText('', '')).sectionsRead, []);
  });

  test('entrada que não é texto não lança erro', () => {
    assert.equal(mergeProfileText(null as unknown as string, undefined as unknown as string), '');
  });

  test('o total respeita o limite, o texto antigo tem preferência e o resultado sai com aviso', () => {
    const big = `Clara Fictícia\nSobre\n${'x'.repeat(MAX_INPUT_CHARS - 100)}`;
    const merged = mergeProfileText(big, `Competências\nJava\n${'y'.repeat(MAX_INPUT_CHARS)}`);
    assert.equal(merged.length, MAX_INPUT_CHARS);
    assert.ok(merged.startsWith('Clara Fictícia'));
    assert.equal(parse(merged).truncated, true);
  });

  test('seção ignorada longa da primeira leitura não impede somar a segunda', () => {
    const first = `Clara Fictícia\nRecomendações\n${'Texto de enchimento sem nada que conte.\n'.repeat(5_000)}`;
    assert.equal(parse(mergeProfileText(first, 'Competências\nJava')).skillsText, 'Java');
  });

  const SIDE = MAX_INPUT_CHARS / 2;
  const sides: ReadonlyArray<readonly [string, string]> = [
    ['linhas diferentes', 'b\n'],
    ['linhas iguais às do primeiro texto', 'a\n'],
  ];
  for (const [label, unit] of sides) {
    test(`1 milhão de caracteres de cada lado não travam: ${label}`, () => {
      const startedAt = performance.now();
      mergeProfileText('a\n'.repeat(SIDE), `Sobre\n${unit.repeat(SIDE)}`);
      const elapsed = performance.now() - startedAt;
      assert.ok(elapsed < 5000, `${elapsed.toFixed(0)} ms`);
    });
  }
});

describe('profileKeyOf (RF-34)', () => {
  const good: ReadonlyArray<readonly [string, string]> = [
    ['https://www.linkedin.com/in/clara-ficticia/', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia-1a2b3c4d/', '/in/clara-ficticia-1a2b3c4d/'],
    ['https://www.linkedin.com/in/Clara-Ficticia/', '/in/clara-ficticia/'],
    ['HTTPS://WWW.LINKEDIN.COM/in/clara-ficticia/', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia/?originalSubdomain=br', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia?trk=exemplo', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia#experiencia', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia/details/skills/', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia/details/experience/?profileUrn=exemplo', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/clara-ficticia/overlay/contact-info/', '/in/clara-ficticia/'],
    ['https://www.linkedin.com/in/jo%C3%A3o-ficticio/', '/in/joão-ficticio/'],
    ['https://www.linkedin.com/in/JO%C3%83O-FICTICIO/', '/in/joão-ficticio/'],
    ['https://www.linkedin.com/in/joa%CC%83o-ficticio/', '/in/joão-ficticio/'],
    ['https://br.linkedin.com/in/clara-ficticia/', '/in/clara-ficticia/'],
    ['https://linkedin.com/in/clara-ficticia/', '/in/clara-ficticia/'],
    ['  https://www.linkedin.com/in/clara-ficticia/  ', '/in/clara-ficticia/'],
  ];
  for (const [url, expected] of good) {
    test(`${url} vira ${expected}`, () => {
      assert.equal(profileKeyOf(url), expected);
    });
  }

  test('o perfil e as subpáginas têm a mesma chave', () => {
    const key = profileKeyOf('https://www.linkedin.com/in/clara-ficticia/');
    assert.notEqual(key, null);
    assert.equal(profileKeyOf('https://www.linkedin.com/in/CLARA-ficticia/details/skills/?x=1'), key);
  });

  const bad = [
    '',
    'clara-ficticia',
    '/in/clara-ficticia/',
    'www.linkedin.com/in/clara-ficticia/',
    'http://www.linkedin.com/in/clara-ficticia/',
    'https://www.linkedin.com/',
    'https://www.linkedin.com/in/',
    'https://www.linkedin.com/in//',
    'https://www.linkedin.com/in',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/company/empresa-ficticia/',
    'https://www.linkedin.com/jobs/view/123/',
    'https://www.linkedin.com/pub/clara-ficticia/1/2/3',
    'https://www.linkedin.com/sales/in/clara-ficticia/',
    'https://www.linkedin.com.exemplo.test/in/clara-ficticia/',
    'https://www.linkedin.com@exemplo.test/in/clara-ficticia/',
    'https://usuario@www.linkedin.com/in/clara-ficticia/',
    'https://www.linkedin.com:8443/in/clara-ficticia/',
    'https://exemplo.test/www.linkedin.com/in/clara-ficticia/',
    'https://notlinkedin.com/in/clara-ficticia/',
    'https://www.linkedin.com/in/%2F..%2Fadmin/',
    'https://www.linkedin.com/in/../feed/',
    'https://www.linkedin.com/in/clara%20ficticia/',
    'https://www.linkedin.com/in/%E0%A4%A/',
    'https://www.linkedin.com/in/clara\nficticia/',
    'javascript:alert(1)//www.linkedin.com/in/clara-ficticia/',
  ];
  for (const url of bad) {
    test(`${JSON.stringify(url)} fica fora do padrão`, () => {
      assert.equal(profileKeyOf(url), null);
    });
  }

  test('entrada que não é texto, e endereço enorme', () => {
    assert.equal(profileKeyOf(undefined as unknown as string), null);
    assert.equal(profileKeyOf(`https://www.linkedin.com/in/${'a'.repeat(200_000)}/`), null);
  });
});
