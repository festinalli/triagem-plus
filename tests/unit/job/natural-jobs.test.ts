// Cinco vagas no estilo real, escritas sem mirar na trava: benefício, declaração de igualdade, empresa falando de si. Nenhuma pede
// critério proibido, então nenhuma pode gerar aviso, e nenhum termo técnico delas pode sumir.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRequirements } from '../../../src/core/job/extract.ts';

const JOBS: Readonly<Record<string, string>> = {
  'back-end em Go': `Pessoa Desenvolvedora Back-end Pleno
Sobre a vaga:
Vamos construir a plataforma de pagamentos da empresa, que processa milhões de transações por dia.
Responsabilidades:
- Projetar e manter microsserviços em Go
- Escrever testes automatizados
- Participar das revisões de código
- Monitorar a saúde dos serviços com Grafana e Prometheus
Requisitos:
- Experiência com Go ou Java
- 3+ anos de experiência com back-end
- PostgreSQL ou MySQL
- Docker e Kubernetes
- Mensageria (Kafka ou RabbitMQ)
Diferenciais:
- Terraform
- Experiência em fintechs
- AWS
Benefícios:
- Plano de saúde e odontológico
- Vale-alimentação
- Auxílio-creche para filhos de até 6 anos
- Licença-maternidade estendida
- Day off no aniversário
Valorizamos a diversidade: todas as pessoas são bem-vindas, independentemente de gênero, raça, idade, orientação sexual ou deficiência.`,
  'front-end em inglês': `Senior Frontend Engineer
About the role
We are a 20-year-old company rebuilding its customer portal.
What you will do
- Build accessible UI with React and TypeScript
- Own design system components in Storybook
- Work closely with product and design
- Keep an eye on bundle size and web vitals
Requirements
- 5+ years of experience with JavaScript
- 3+ years with React
- Solid understanding of HTML and CSS
- Experience with REST and GraphQL APIs
- Fluent English
Nice to have
- Next.js
- Node.js
- Experience with Cypress or Playwright
What we offer
- Health insurance for you and your family
- Parental leave
- Remote-first
We are an equal opportunity employer and do not discriminate on the basis of race, religion, gender, age or disability.`,
  dados: `Engenheira(o) de Dados Sênior
Responsabilidades
Construir pipelines de dados com Airflow e Spark
Modelar dados no Snowflake usando dbt
Garantir qualidade e governança dos dados, inclusive dados de saúde sensíveis
Requisitos
Mínimo de 5 anos de experiência em engenharia de dados
Python e SQL avançados
Experiência com AWS (S3, Glue, Redshift)
Conhecimento de modelagem dimensional
Inglês intermediário
Desejável
Kafka
Certificação AWS Data Engineer
R ou Scala
Sobre nós
Somos uma healthtech com mais de 15 anos de mercado, referência em saúde da mulher e do idoso.`,
  'mobile iOS': `Desenvolvedor(a) iOS
O que você vai fazer:
• Desenvolver novas funcionalidades do nosso app em Swift
• Manter código legado em Objective-C
• Trabalhar com SwiftUI e UIKit
O que esperamos:
• Pelo menos 4 anos com desenvolvimento iOS
• Conhecimento de arquitetura MVVM
• CI/CD com Fastlane
• Testes de unidade
Será um diferencial:
• Kotlin Multiplatform
• Publicação na App Store
Benefícios:
• Seguro de vida extensivo a cônjuge
• Gympass
• Stock options com vesting de até 4 anos`,
  '.NET': `Analista Desenvolvedor .NET Pl/Sr
Atividades:
Desenvolvimento de APIs em C# / .NET 8
Manutenção de sistemas legados em ASP.NET MVC e WebForms
Banco de dados SQL Server (procedures, views, tuning)
Sustentação de sistema com histórico de até 10 anos de dados
Requisitos obrigatórios:
Experiência comprovada com C#
Entity Framework
Azure DevOps
Git
Requisitos desejáveis:
Angular
Docker
RabbitMQ
Certificação AZ-204
Local: híbrido em Barueri/SP, 2x por semana`,
};

const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  'back-end em Go': ['Go', 'Grafana', 'Prometheus', 'Java', 'PostgreSQL', 'MySQL', 'Docker', 'Kubernetes', 'Apache Kafka', 'RabbitMQ', 'Terraform', 'AWS'],
  'front-end em inglês': ['React', 'TypeScript', 'Storybook', 'JavaScript', 'HTML', 'CSS', 'REST', 'GraphQL', 'Inglês', 'Next.js', 'Node.js', 'Cypress', 'Playwright'],
  // "Spark" sozinho ainda não é nome na lista de termos, só "Spark SQL" e "PySpark": fica para quem cuida da lista.
  dados: ['Apache Airflow', 'Snowflake', 'dbt', 'Python', 'SQL', 'AWS', 'Inglês', 'Apache Kafka', 'R', 'Scala'],
  'mobile iOS': ['Swift', 'Objective-C', 'Kotlin'],
  '.NET': ['C#', '.NET', 'ASP.NET', 'SQL Server', 'Entity Framework', 'Azure DevOps', 'Git', 'Angular', 'Docker', 'RabbitMQ'],
};

describe('vagas naturais', () => {
  for (const [name, text] of Object.entries(JOBS)) {
    test(`${name}: nenhum aviso falso`, () => {
      assert.deepEqual(extractRequirements(text).ignored, []);
    });

    test(`${name}: nenhum termo técnico some`, () => {
      const got = new Set(extractRequirements(text).requirements.map((r) => r.canonical ?? r.label));
      assert.deepEqual((EXPECTED[name] ?? []).filter((term) => !got.has(term)), []);
    });
  }

  test('a declaração de igualdade não some quando vem com um pedido', () => {
    const result = extractRequirements('Java. Independentemente de raça, somente homens.');
    assert.deepEqual(result.requirements.map((r) => r.label), ['Java']);
    assert.deepEqual(result.ignored.map((i) => i.topic), ['gender']);
  });
});
