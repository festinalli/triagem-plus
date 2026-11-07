// Pelo menos 15 casos recusados por assunto, com variação de acento, maiúsculas, plural, feminino e inglês (RF-13, RF-14).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerm, FORBIDDEN_TOPICS, TOPIC_REASONS } from '../../../src/core/guard/index.ts';
import type { ForbiddenTopic } from '../../../src/core/guard/index.ts';

const REFUSED: Readonly<Record<ForbiddenTopic, readonly string[]>> = {
  age: [
    'Até 35 anos', 'ATÉ 35 ANOS', 'ate 35 anos', 'até os 35 anos', 'até trinta e cinco anos', 'no máximo 35 anos', 'idade', 'IDADE', 'Idades', 'idade máxima', 'faixa etária', 'FAIXA ETARIA',
    'entre 25 e 35 anos', 'Entre 25 e 35 Anos', '25-35 anos', '25–35 anos', '25 a 35 anos', 'de 25 a 35 anos', 'menor de 30', 'menores de 30', 'menor de 30 anos', 'under 35', 'Under 35', 'under 35 years',
    'between 25 and 35 years', '25 to 35 years old', 'up to 35 years old', '30 years old', '30 anos de idade', '35 anos', 'mais de 40 anos', 'over 40', 'maior de 18 anos', 'maiores de 18', 'nascido em', 'Nascida em 1990',
    'nascidos em 1990', 'nascidas entre 1990 e 2000', 'nascido(a) em', 'born in 1990', 'date of birth', 'data de nascimento', 'geração Z', 'Geracao Y', 'geração X', 'Gen Z', 'generation z', 'millennials', 'Millennial', 'boomers',
    'jovem', 'Jovens', 'jovens talentos', 'perfil jovem', 'young', 'young professionals', 'idoso', 'idosa', 'idosos', 'velho', 'velha', 'maduro', 'madura', 'recém-formado', 'Recém-Formada', 'recem formados', 'recém-formadas',
    'recém formado(a)', 'recent graduate', 'new grad', 'fresh graduates', 'formado há no máximo 2 anos', 'age', 'AGE', 'aged 25', 'age limit', 'jovem aprendiz',
  ],
  gender: [
    'mulher', 'Mulher', 'mulheres', 'MULHERES', 'somente mulheres', 'apenas homens', 'homem', 'homens', 'Homens', 'gênero', 'genero', 'GÊNERO', 'gêneros', 'sexo', 'sexo feminino', 'sexo masculino', 'feminino', 'Feminina',
    'femininas', 'masculino', 'masculina', 'masculinas', 'vaga feminina', 'woman', 'women', 'Women', 'man', 'men', 'female', 'Females', 'male', 'gender', 'transgênero', 'transgender', 'transexual', 'travesti', 'non-binary', 'nonbinary',
    'não binário', 'não binária', 'trans', 'moça', 'moças', 'rapaz', 'rapazes', 'girls', 'boy',
  ],
  orientation: [
    'orientação sexual', 'ORIENTACAO SEXUAL', 'orientacao sexual', 'orientações sexuais', 'sexual orientation', 'gay', 'Gay', 'gays', 'lésbica', 'lesbica', 'lésbicas', 'lesbian', 'bissexual', 'bissexuais', 'bisexual', 'homossexual',
    'homossexuais', 'homosexual', 'heterossexual', 'heterosexual', 'hétero', 'LGBT', 'lgbt', 'LGBTQ', 'lgbtqia+', 'LGBTQIAP+', 'queer', 'pansexual', 'assexual', 'sexualidade', 'sexuality', 'straight', 'homoafetivo', 'homoafetiva',
  ],
  race: [
    'raça', 'Raça', 'RACA', 'raças', 'racial', 'raciais', 'cor', 'Cor', 'cor da pele', 'COR DA PELE', 'tom de pele', 'pessoa de cor', 'etnia', 'Etnias', 'étnico', 'étnica', 'etnicos', 'negro', 'Negra', 'negros', 'NEGRAS', 'preto', 'pretas',
    'branco', 'Brancas', 'pardo', 'pardas', 'amarelo', 'indígena', 'indigenas', 'afrodescendente', 'afrodescendentes', 'afro-brasileira', 'quilombola', 'mestiço', 'mulata', 'moreno', 'somente brancos', 'apenas negras', 'pessoas negras',
    'race', 'Race', 'ethnicity', 'ethnic', 'black', 'Black', 'white', 'WHITE', 'asian', 'hispanic', 'caucasian', 'latino', 'latina', 'people of color', 'skin color', 'african american',
  ],
  appearance: [
    'boa aparência', 'BOA APARENCIA', 'boa aparencia', 'boas aparências', 'aparência', 'Aparencia', 'aparência física', 'good appearance', 'physical appearance', 'good looking', 'foto', 'Foto', 'fotos', 'com foto', 'currículo com foto',
    'CV com foto', 'foto no currículo', 'photo', 'headshot', 'bonito', 'bonita', 'bonitas', 'magro', 'magra', 'gorda', 'bem apresentado', 'bem apresentada', 'sem tatuagem', 'tatuagens', 'tattoo', 'piercing', 'atraente', 'attractive',
    'altura', 'peso', 'beautiful', 'loira', 'ruivo', 'cabelo liso', 'sem barba',
  ],
  religion: [
    'religião', 'RELIGIAO', 'Religiões', 'religioso', 'religiosa', 'religiosos', 'religion', 'religious', 'crença', 'crenças', 'crença religiosa', 'cristão', 'cristã', 'cristãos', 'christian', 'católico', 'Católica', 'catolicos', 'catholic',
    'evangélico', 'Evangélicas', 'protestante', 'espírita', 'espiritas', 'judeu', 'judia', 'judeus', 'jewish', 'muçulmano', 'muculmana', 'muslim', 'ateu', 'ateia', 'atheist', 'budista', 'umbanda', 'candomblé', 'igreja', 'church', 'faith',
    'agnóstico',
  ],
  politics: [
    'partido político', 'PARTIDO POLITICO', 'partidos políticos', 'partido', 'política', 'Politica', 'político', 'filiação partidária', 'opinião política', 'posicionamento político', 'ideologia política', 'sindicato', 'Sindicatos', 'SINDICATO',
    'sindicalizado', 'sindicalizada', 'sindicalista', 'political party', 'political views', 'politics', 'union member', 'trade union', 'labor union', 'bolsonarista', 'petista', 'lulistas', 'de esquerda', 'de direita', 'comunista', 'socialistas',
    'conservador', 'conservadora', 'liberal', 'ativista', 'activist',
  ],
  marital_family: [
    'solteiro', 'Solteira', 'SOLTEIROS', 'solteiras', 'solteiro(a)', 'solteiro/a', 'solteirx', 'casado', 'casada', 'Casados', 'casadas', 'divorciado', 'divorciada', 'viúvo', 'viuva', 'noiva', 'estado civil', 'ESTADO CIVIL', 'união estável',
    'sem filhos', 'com filhos', 'tem filhos', 'filhos', 'Filho', 'filha', 'filhas', 'mãe', 'mães', 'pai', 'mãe solo', 'dependentes', 'sem dependentes', 'cônjuge', 'esposa', 'marido', 'família', 'married', 'single', 'SINGLE', 'divorced', 'widow',
    'children', 'child', 'kids', 'no kids', 'marital status', 'spouse', 'wife', 'husband', 'family', 'single mother', 'childless', 'planejamento familiar',
  ],
  disability_health: [
    'PCD', 'pcd', 'PcD', 'PCDs', 'pessoa com deficiência', 'Pessoas com deficiência', 'pessoas com deficiencia', 'deficiência', 'DEFICIENCIA', 'deficiente', 'Deficientes', 'necessidades especiais', 'special needs', 'disability', 'disabilities',
    'disabled', 'cadeirante', 'cadeirantes', 'wheelchair', 'surdo', 'surda', 'deaf', 'cego', 'cega', 'blind', 'autista', 'autistas', 'autism', 'TDAH', 'ADHD', 'neurodivergente', 'saúde', 'Saude', 'boa saúde', 'problema de saúde', 'problemas de saude',
    'saúde mental', 'mental health', 'health', 'good health', 'grávida', 'gravidas', 'gravidez', 'gestante', 'pregnant', 'doença', 'doenças', 'doente', 'fumante', 'non-smoker', 'obeso', 'obesa', 'atestado médico', 'laudo médico',
  ],
  nationality_origin: [
    'nacionalidade', 'NACIONALIDADE', 'nacionalidades', 'nationality', 'national origin', 'brasileiro', 'Brasileira', 'brasileiros', 'BRASILEIRAS', 'brasileiro(a)', 'somente brasileiros', 'apenas brasileiras', 'ser brasileiro', 'estrangeiro', 'estrangeira',
    'estrangeiros', 'naturalidade', 'natural de São Paulo', 'natural de SP', 'naturais de Minas', 'país de origem', 'country of origin', 'cidadania', 'citizenship', 'us citizen', 'US citizens only', 'americano', 'americana', 'american', 'brazilian',
    'argentinos', 'venezuelana', 'haitiano', 'indiano', 'nordestino', 'nordestina', 'paulista', 'carioca', 'gaúcho', 'alemã', 'japonesa', 'italianos', 'franceses', 'imigrante', 'immigrants', 'refugiado', 'refugiada', 'foreigner', 'sem sotaque',
  ],
  address_distance: [
    'mora perto', 'MORA PERTO', 'Mora Perto', 'morar perto', 'more perto', 'morando perto', 'mora próximo', 'morar próximo', 'próximo ao metrô', 'PROXIMO AO METRO', 'próxima ao metrô', 'perto do metrô', 'reside em', 'Reside em São Paulo', 'residir em', 'resida em',
    'residente em', 'residentes em', 'morar em', 'morador de', 'moradora da', 'moradores do', 'CEP 01310-100', 'seu CEP', 'informe o CEP', 'zona sul', 'Zona Norte', 'ZONA LESTE', 'zona oeste', 'zona sul de SP', 'ZS', 'ZN', 'bairro', 'Bairros', 'endereço', 'enderecos',
    'address', 'home address', 'zip code', 'distância', 'distance', 'até 10 km', 'raio de 5 km', 'within 10 km', 'São Paulo', 'Sao Paulo', 'SÃO PAULO', 'Natal', 'Belém', 'Curitiba - PR', 'em Recife', 'Rio de Janeiro', 'BH', 'SP', 'RJ', 'Floripa', 'Sampa',
    'live near', 'must live in', 'reside in', 'near the subway', 'presencial em São Paulo',
  ],
  max_experience: [
    'no máximo 5 anos', 'NO MAXIMO 5 ANOS', 'no maximo 5 anos', 'máximo de 5 anos de experiência', 'máximo 5 anos', 'até 5 anos de experiência', 'Até 5 anos', 'até 1 ano de experiência', 'até dois anos de experiência', 'no máximo cinco anos', 'menos de 3 anos de experiência',
    'menos de 3 anos', 'at most 5 years', 'AT MOST 5 YEARS', 'up to 5 years of experience', 'up to 5 years', 'no more than 5 years', 'maximum of 5 years', 'max 5 years', 'less than 3 years of experience', 'under 5 years of experience', '5 anos ou menos',
    '5 years or less', '5 anos no máximo', '5 anos de experiência no máximo', 'entre 3 e 5 anos de experiência', '3 a 5 anos de experiência', '2-4 years of experience', '3 to 5 years of experience', 'até 20 anos de experiência', 'experiência máxima de 5 anos',
    'até 5 anos de Java', 'no máximo 3 anos em React', 'até 3,5 anos', 'overqualified', 'sobrequalificado', 'superqualificada',
  ],
};

describe('trava por assunto', () => {
  for (const topic of FORBIDDEN_TOPICS) {
    test(`${topic}: recusa com pelo menos 15 casos, e sempre pelo mesmo assunto`, () => {
      const cases = REFUSED[topic];
      assert.ok(cases.length >= 15, `${topic} só tem ${cases.length} casos`);
      const wrong = cases.flatMap((text) => {
        const result = checkTerm(text);
        return !result.allowed && result.topic === topic ? [] : [`${text} => ${result.allowed ? 'passou' : result.topic}`];
      });
      assert.deepEqual(wrong, []);
    });

    test(`${topic}: a recusa traz o trecho e o motivo do assunto`, () => {
      const result = checkTerm(REFUSED[topic][0] ?? '');
      assert.equal(result.allowed, false);
      if (result.allowed) return;
      assert.equal(result.reason, TOPIC_REASONS[topic]);
      assert.ok(result.matched.length > 0);
      assert.ok(result.reason.length > 20);
    });
  }
});
