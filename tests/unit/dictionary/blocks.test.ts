import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHeading, classifyItem, splitRequirementBlocks } from '../../../src/core/dictionary/index.ts';

describe('blocos de vaga', () => {
  test('títulos de requisitos e diferenciais', () => {
    assert.equal(classifyHeading('Requisitos'), 'required');
    assert.equal(classifyHeading('Requisitos obrigatórios:'), 'required');
    assert.equal(classifyHeading('Diferenciais'), 'preferred');
    assert.equal(classifyHeading('Nice to have'), 'preferred');
    assert.equal(classifyHeading('Benefícios'), 'mentioned');
  });

  const wholeLines: ReadonlyArray<readonly [string, 'required' | 'preferred']> = [
    ['Requisitos desejáveis', 'preferred'],
    ['Diferenciais', 'preferred'],
    ['Desejável', 'preferred'],
    ['Nice to have', 'preferred'],
    ['Requisitos', 'required'],
    ['Requirements', 'required'],
    ['Obrigatório', 'required'],
    ['REQUISITOS DESEJÁVEIS', 'preferred'],
    ['requisitos desejaveis', 'preferred'],
    ['Desejáveis', 'preferred'],
    ['Obrigatórios', 'required'],
    ['obrigatorio', 'required'],
    ['NICE TO HAVE', 'preferred'],
  ];
  for (const [line, cls] of wholeLines) {
    test(`"${line}" sozinho na linha, sem dois-pontos, abre um bloco ${cls}`, () => {
      const blocks = splitRequirementBlocks(`Texto solto\n${line}\nItem da lista\n`);
      assert.deepEqual(blocks.map((block) => [block.heading, block.class]), [[null, 'mentioned'], [line, cls]]);
      assert.deepEqual(blocks[1]?.items, [{ text: 'Item da lista', class: cls }]);
    });
  }

  test('um título logo depois do outro troca a classe', () => {
    const blocks = splitRequirementBlocks('Requisitos\nJava\nRequisitos desejáveis\nKotlin\nObrigatório\nGit');
    assert.deepEqual(blocks.map((block) => block.class), ['required', 'preferred', 'required']);
  });

  test('marcador dentro da frase prevalece sobre o título do bloco', () => {
    assert.equal(classifyItem('Docker (desejável)', 'required'), 'preferred');
    assert.equal(classifyItem('Python obrigatório', 'preferred'), 'required');
    assert.equal(classifyItem('Git', 'required'), 'required');
  });

  test('divide a descrição em blocos e itens', () => {
    const text = ['Sobre a vaga', 'Time de pagamentos.', 'Requisitos:', '- Java 17', '- Spring Boot', 'Diferenciais:', '• Kubernetes', '• Go (obrigatório para o time de plataforma)'].join('\n');
    const blocks = splitRequirementBlocks(text);
    const required = blocks.find((b) => b.class === 'required');
    const preferred = blocks.find((b) => b.class === 'preferred');
    assert.deepEqual(required?.items.map((i) => i.text), ['Java 17', 'Spring Boot']);
    assert.deepEqual(preferred?.items.map((i) => [i.text, i.class]), [
      ['Kubernetes', 'preferred'],
      ['Go (obrigatório para o time de plataforma)', 'required'],
    ]);
  });
});
