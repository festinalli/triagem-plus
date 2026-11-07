// Termos de tecnologia (linguagens, frameworks, bibliotecas, bancos e conceitos técnicos). Escritos à mão.
import { adjacent, curated, inLanguage, usage } from './curated.ts';
import type { CuratedTerm } from '../types.ts';

const T = (canonical: string, synonyms: readonly string[] = [], protectedForms: readonly string[] = [], requires: readonly string[] = []): CuratedTerm =>
  curated('technology', canonical, synonyms, protectedForms, requires);

// Ambíguos: a palavra comum não basta; o texto precisa trazer um dos contextos declarados (ou uma linguagem vizinha).
/** Versões escritas "nome N": "vue 3", "node 18", "react 18". Contam como o próprio termo. */
function versions(name: string, numbers: readonly number[]): string[] {
  return numbers.map((n) => `${name} ${n}`);
}

const GO_CONTEXT = [
  'golang', 'linguagem go', 'go language', 'lenguaje go', 'go developer', 'desenvolvedor go', 'desenvolvedora go', 'desarrollador go',
  'programming in go', 'microsservicos em go', 'microservicos em go', 'go microservices', 'go microsservicos', 'go microservicos', 'goroutine', 'goroutines',
  'go modules', ...usage('go'), ...inLanguage('go'), ...adjacent('go', false),
];
const R_CONTEXT = [
  'linguagem r', 'r language', 'lenguaje r', 'rstudio', 'r studio', 'tidyverse', 'ggplot2', 'dplyr', 'estatistica com r', 'analise em r',
  'cran', 'sas', 'spss', 'stata', 'matlab', ...usage('r'), ...inLanguage('r'), ...adjacent('r'),
];
// iOS só vale ao lado de Swift ("Swift e iOS", "Swift para apps iOS"): a palavra solta no mesmo texto não basta.
const IOS = ['ios', 'iphone'];
const SWIFT_IOS = ['swift para ios', 'swift para apps ios', 'swift para iphone', 'swift for ios', 'swift for ios apps', 'swift ios apps', 'apps ios em swift', 'ios apps in swift'];
const SWIFT_CONTEXT = [
  'swift language', 'linguagem swift', 'swiftui', 'xcode', ...SWIFT_IOS, 'uikit', 'cocoa', 'objective c', 'swift developer',
  'desenvolvedor swift', 'desenvolvedora swift', 'swift programming', 'swift 5', ...usage('swift'), ...inLanguage('swift'), ...adjacent('swift', true, IOS),
];
const C_CONTEXT = [
  'linguagem c', 'c language', 'lenguaje c', 'programacao em c', 'c programming', 'sistemas embarcados', 'embedded systems', 'c99', 'c11',
  'ponteiros', 'pointers', 'firmware', 'kernel', ...usage('c'), ...inLanguage('c'), ...adjacent('c'),
];
const RUST_CONTEXT = [
  'rustlang', 'rust lang', 'linguagem rust', 'rust language', 'lenguaje rust', 'rust developer', 'desenvolvedor rust', 'desenvolvedora rust',
  'rust programming', 'rustup', 'tokio', ...usage('rust'), ...inLanguage('rust'), ...adjacent('rust'),
];
const DART_CONTEXT = [
  'dart language', 'linguagem dart', 'flutter', 'dart developer', 'desenvolvedor dart', 'desenvolvedora dart', 'dart sdk', ...usage('dart'), ...inLanguage('dart'), ...adjacent('dart'),
];
const RUBY_CONTEXT = [
  'ruby on rails', 'rails', 'ruby 3', 'linguagem ruby', 'ruby language', 'rubygems', 'ruby developer', 'desenvolvedor ruby', 'desenvolvedora ruby',
  'rspec', ...usage('ruby'), ...inLanguage('ruby'), ...adjacent('ruby'),
];
const REACT_VERSIONS = versions('react', [16, 17, 18, 19]);
const JULIA_CONTEXT = ['julia lang', 'julialang', 'linguagem julia', 'julia language', 'julia developer', ...usage('julia'), ...adjacent('julia')];
// "node" sozinho é nó de rede, de árvore, de cluster. O contexto é o nome inteiro, a linguagem vizinha ou a preposição direta
// ("APIs em Node"); "api" ou "backend" soltos no texto não bastam ("worker node do Kubernetes e a API").
const NODE_VERSIONS = versions('node', [12, 14, 16, 18, 20, 22]);
const NODE_CONTEXT = [
  'nodejs', 'node js', 'node.js', 'npm', 'nestjs', 'express js', 'expressjs', 'express.js', 'node developer', 'node engineer', 'desenvolvedor node',
  'desenvolvedora node', 'node backend', 'backend node', 'back end node', 'node back end', ...NODE_VERSIONS, ...usage('node'), ...inLanguage('node'),
  ...adjacent('node', true, ['express', 'nestjs', 'npm', 'api', 'apis', 'backend', 'back end', 'typeorm', 'prisma', 'sequelize', 'mongoose', 'fastify']),
];
const UNITY_CONTEXT = ['unity3d', 'unity 3d', 'unity engine', 'game development', 'desenvolvimento de jogos', 'jogos', 'games', 'c#', 'unreal'];
// "spring" sozinho é a estação do ano em inglês ("spring 2020", "this spring"). Em lista de competências, a pessoa já disse o
// que é. Em texto corrido, precisa de uma destas frases. "java" solto no mesmo texto não basta, por isso a vizinhança direta.
const SPRING_CONTEXT = [
  'spring framework', 'spring mvc', 'spring boot', 'spring data', 'spring security', 'spring cloud', 'spring batch', 'spring webflux',
  'em spring', 'com spring', 'with spring', 'using spring', ...usage('spring'), ...adjacent('spring', false),
];
const ASSEMBLY_CONTEXT = ['assembly x86', 'assembly arm', 'x86', 'linguagem assembly', 'assembly language', 'baixo nivel', 'low level', ...usage('assembly'), ...adjacent('assembly')];

export const TECHNOLOGY: readonly CuratedTerm[] = [
  // Linguagens de programação
  T('Python', ['python3', 'python 3']),
  T('Java', ['java se', ...versions('java', [8, 11, 17, 21])]),
  T('Java EE', ['j2ee', 'jakarta ee', 'java enterprise edition']),
  T('JavaScript', ['js', 'java script', 'ecmascript', 'es6', 'es2015', 'javascript es6']),
  T('TypeScript', ['ts', 'typescript 5']),
  T('C', ['linguagem c'], [], C_CONTEXT),
  T('C++', ['cpp', 'cplusplus', 'c plus plus'], ['c++']),
  T('C#', ['csharp', 'c sharp'], ['c#']),
  T('F#', ['fsharp', 'f sharp'], ['f#']),
  T('Go', ['golang'], [], GO_CONTEXT),
  T('Rust', ['rustlang'], [], RUST_CONTEXT),
  T('Ruby', ['ruby 3'], [], RUBY_CONTEXT),
  T('PHP', ['php 8', 'php7', 'php8']),
  T('Kotlin', ['kotlin jvm']),
  T('Swift', ['swift 5'], [], SWIFT_CONTEXT),
  T('Objective-C', ['objc', 'objective c']),
  T('Scala', ['scala 3']),
  T('Dart', [], [], DART_CONTEXT),
  T('Elixir', []),
  T('Erlang', []),
  T('Haskell', []),
  T('Clojure', []),
  T('Lua', []),
  T('Perl', []),
  T('Julia', ['julia lang'], [], JULIA_CONTEXT),
  T('R', [], [], R_CONTEXT),
  T('MATLAB', ['matlab simulink']),
  T('Groovy', []),
  T('Solidity', ['solidity smart contracts']),
  T('COBOL', []),
  T('Fortran', []),
  T('Assembly', ['assembly x86', 'assembly arm'], [], ASSEMBLY_CONTEXT),
  T('Bash', ['shell script', 'shell scripting', 'scripts bash']),
  T('PowerShell', ['powershell scripting']),
  T('SQL', ['linguagem sql', 'structured query language']),
  T('PL/SQL', ['pl sql', 'plsql']),
  T('T-SQL', ['tsql', 't sql']),
  T('Visual Basic', ['vba', 'visual basic for applications']),
  // Web e interface
  T('HTML', ['html5', 'html 5']),
  T('CSS', ['css3', 'css 3']),
  T('Sass', ['scss', 'sass scss']),
  T('Tailwind CSS', ['tailwind', 'tailwindcss']),
  T('Bootstrap', ['bootstrap css']),
  T('jQuery', ['jquery ui']),
  T('React', ['reactjs', 'react js', 'react hooks', ...REACT_VERSIONS], ['react.js']),
  T('Vue.js', ['vue', 'vuejs', 'vue js', 'vue2', 'vue3', ...versions('vue', [2, 3])], ['vue.js']),
  T('Angular', ['angularjs', ...versions('angular', [2, 4, 8, 12, 14, 15, 16, 17, 18])]),
  T('Svelte', ['sveltekit']),
  T('Next.js', ['nextjs', 'next js'], ['next.js']),
  T('Nuxt.js', ['nuxtjs', 'nuxt js'], ['nuxt.js']),
  T('Redux', ['redux toolkit']),
  T('Webpack', ['webpack 5']),
  T('Vite', ['vitejs']),
  T('Storybook', []),
  T('Aplicações web progressivas', ['pwa', 'progressive web apps', 'aplicacoes web progressivas']),
  T('WebAssembly', ['wasm']),
  T('WebSockets', ['websocket', 'web sockets']),
  // Back-end e frameworks
  T('Node.js', ['node', 'nodejs', 'node js', ...NODE_VERSIONS], ['node.js'], NODE_CONTEXT),
  T('Express.js', ['expressjs', 'express js'], ['express.js']),
  T('NestJS', ['nest js', 'nestjs framework']),
  T('Django', ['django rest framework', 'drf']),
  T('Flask', ['flask python']),
  T('FastAPI', ['fast api']),
  T('Spring', ['spring framework', 'spring mvc'], [], SPRING_CONTEXT),
  T('Spring Boot', ['springboot']),
  T('Ruby on Rails', ['rails', 'ruby rails']),
  T('Laravel', ['laravel framework']),
  T('ASP.NET', ['asp net', 'asp net core'], ['asp.net']),
  T('.NET', ['dotnet', 'net core', 'dot net'], ['.net']),
  T('Entity Framework', ['ef core', 'entity framework core']),
  T('Hibernate', ['hibernate orm']),
  T('Ktor', []),
  T('Phoenix Framework', ['phoenix elixir']),
  // Mobile e jogos
  T('Flutter', ['flutter sdk']),
  T('React Native', ['react-native', 'reactnative']),
  T('Android', ['android sdk', 'android nativo']),
  T('iOS', ['ios sdk', 'iphone development']),
  T('Xamarin', ['xamarin forms']),
  T('Unity', ['unity3d', 'unity 3d'], [], UNITY_CONTEXT),
  T('Unreal Engine', ['unreal', 'ue5', 'unreal engine 5']),
  // Dados, IA e ciência de dados
  T('Pandas', ['pandas python', 'dataframes pandas'], [], ['python', 'dataframe', 'numpy', 'dataframes']),
  T('NumPy', ['numpy python']),
  T('scikit-learn', ['sklearn', 'scikit learn']),
  T('TensorFlow', ['tensorflow 2', 'tensorflow keras']),
  T('PyTorch', ['pytorch lightning']),
  T('Keras', ['keras tensorflow']),
  T('Apache Spark', ['spark', 'pyspark', 'spark sql', 'spark streaming']),
  T('Apache Hadoop', ['hadoop', 'hdfs', 'mapreduce']),
  T('Apache Kafka', ['kafka', 'kafka streams']),
  T('Apache Airflow', ['airflow', 'dags airflow']),
  T('dbt', ['dbt core', 'data build tool']),
  T('LangChain', ['langchain framework']),
  T('Hugging Face', ['huggingface', 'hugging face transformers']),
  T('OpenAI API', ['openai', 'api openai', 'gpt api']),
  T('Machine Learning', ['aprendizado de maquina', 'aprendizagem de maquina', 'aprendizaje automatico', 'ml engineering']),
  T('Deep Learning', ['aprendizado profundo', 'aprendizado de maquina profundo', 'aprendizaje profundo']),
  T('Processamento de linguagem natural', ['nlp', 'natural language processing', 'procesamiento de lenguaje natural']),
  T('Visão computacional', ['computer vision', 'visao computacional', 'vision por computador']),
  T('Data Science', ['ciencia de dados', 'ciencia de datos']),
  T('Engenharia de dados', ['data engineering', 'ingenieria de datos', 'engenharia de dados batch']),
  T('Big Data', ['bigdata', 'big data processing']),
  T('Estatística', ['estatistica aplicada', 'estadistica', 'statistics']),
  T('Google BigQuery', ['bigquery', 'big query']),
  T('Snowflake', ['snowflake data warehouse', 'snowflake cloud']),
  T('Amazon Redshift', ['redshift']),
  T('Databricks', ['databricks lakehouse', 'delta lake']),
  T('Power Query', ['m language power query']),
  // Bancos de dados
  T('PostgreSQL', ['postgres', 'postgre sql']),
  T('MySQL', ['mysql 8', 'my sql']),
  T('MariaDB', ['maria db']),
  T('SQLite', ['sqlite3']),
  T('Oracle', ['oracle database', 'oracle db', 'oracle sql']),
  T('SQL Server', ['microsoft sql server', 'mssql', 'ms sql']),
  T('MongoDB', ['mongo', 'mongo db']),
  T('Redis', ['redis cache']),
  T('Elasticsearch', ['elastic search', 'elastic stack']),
  T('Apache Cassandra', ['cassandra']),
  T('Amazon DynamoDB', ['dynamodb', 'dynamo db']),
  // Arquitetura, APIs e redes
  T('GraphQL', ['graph ql', 'apollo graphql']),
  T('REST', ['rest api', 'apis rest', 'restful', 'api rest', 'restful api'], [], ['api', 'apis', 'rest api', 'restful', 'endpoints', 'microsservicos']),
  T('gRPC', ['grpc', 'protocol buffers', 'protobuf']),
  T('Microsserviços', ['microservices', 'microservicos', 'microservices architecture', 'arquitetura de microsservicos']),
  T('Computação em nuvem', ['cloud computing', 'computacao em nuvem', 'computacion en la nube']),
  T('TCP/IP', ['tcp ip', 'redes de computadores', 'networking']),
  T('OAuth', ['oauth2', 'oauth 2 0']),
  T('OpenID Connect', ['oidc', 'open id connect']),
  T('Linux', ['gnu linux', 'ubuntu', 'debian', 'red hat', 'centos']),
  T('Windows Server', ['windows server 2019', 'windows server 2022', 'active directory']),
  T('Blockchain', ['blockchain ethereum', 'smart contracts ethereum']),
  T('Realidade aumentada', ['augmented reality']),
  T('Programação orientada a objetos', ['poo', 'oop', 'object oriented programming', 'programacao orientada a objetos']),
  T('Programação funcional', ['functional programming', 'programacao funcional']),
  T('Testes de unidade', ['unit tests', 'testes unitarios', 'testes unitarios automatizados']),
  T('Estruturas de dados', ['data structures', 'estrutura de dados']),
  T('Padrões de projeto', ['design patterns', 'padroes de projeto']),
  T('Integração contínua', ['cicd', 'continuous integration', 'continuous delivery', 'entrega continua'], ['ci/cd']),
  T('Ferramentas de CLI', ['cli', 'command line tools', 'aplicativos cli']),
  T('Web scraping', ['raspagem de dados', 'scraping']),
  T('Automação de testes', ['test automation', 'automatizacion de pruebas']),
  T('Computação quântica', ['quantum computing', 'computacao quantica']),
  T('Internet das Coisas', ['iot', 'internet of things']),
  T('Sistemas embarcados', ['embedded systems', 'firmware']),
  T('Arduino', ['arduino ide']),
  T('Raspberry Pi', ['raspberry']),
];
