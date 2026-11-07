// Assuntos que nunca viram critério de seleção (RF-13, RF-14, RD-8) e o motivo mostrado na tela. Puro.

export const FORBIDDEN_TOPICS = [
  'age',
  'gender',
  'orientation',
  'race',
  'appearance',
  'religion',
  'politics',
  'marital_family',
  'disability_health',
  'nationality_origin',
  'address_distance',
  'max_experience',
] as const;
export type ForbiddenTopic = (typeof FORBIDDEN_TOPICS)[number];

/** Motivo em português simples, um por assunto: a recusa sempre explica por quê (RF-13). */
export const TOPIC_REASONS: Readonly<Record<ForbiddenTopic, string>> = Object.freeze({
  age: 'Idade ou faixa etária não entra como critério: excluir alguém pela idade é discriminação. Descreva o que a vaga exige, como tecnologias e anos mínimos de experiência.',
  gender: 'Gênero ou sexo não entra como critério: a seleção olha o que a vaga exige, não quem a pessoa é.',
  orientation: 'Orientação sexual não entra como critério: é dado pessoal e não diz nada sobre o trabalho.',
  race: 'Raça, cor ou etnia não entra como critério: filtrar por isso é discriminação.',
  appearance: 'Aparência ou foto não entra como critério: não diz nada sobre a capacidade de fazer o trabalho.',
  religion: 'Religião ou crença não entra como critério: é dado pessoal e não tem relação com o trabalho.',
  politics: 'Posição política ou ligação com sindicato não entra como critério: é dado pessoal e filtrar por isso é discriminação.',
  marital_family: 'Estado civil, filhos ou família não entra como critério: a vida familiar da pessoa não tem relação com o trabalho.',
  disability_health: 'Deficiência, saúde ou ação afirmativa não entra como critério na nota nem nos filtros. Vaga afirmativa é legítima, mas esse tratamento fica fora da ferramenta: conduza esse ponto por fora.',
  nationality_origin: 'Nacionalidade ou origem não entra como critério. Se a vaga pede um idioma, cadastre o idioma como requisito.',
  address_distance: 'Endereço, bairro ou distância não entra como critério: a ferramenta não lê nem pontua onde a pessoa mora. Em vaga presencial, use o filtro de local do próprio LinkedIn.',
  max_experience: 'Não existe teto de experiência: "no máximo N anos" funciona como filtro de idade. Cadastre só o mínimo de anos que a vaga exige.',
});
