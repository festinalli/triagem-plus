// Termos de ferramenta de trabalho de desenvolvimento (controle de versão, CI, nuvem, observabilidade, testes, dados).
import { curated } from './curated.ts';
import type { CuratedTerm } from '../types.ts';

const F = (canonical: string, synonyms: readonly string[] = [], protectedForms: readonly string[] = [], requires: readonly string[] = []): CuratedTerm =>
  curated('tool', canonical, synonyms, protectedForms, requires);

export const TOOLS: readonly CuratedTerm[] = [
  // Controle de versão e colaboração de código
  F('Git', ['git scm', 'controle de versao', 'version control', 'control de versiones']),
  F('GitHub', ['github actions', 'github pages']),
  F('GitLab', ['gitlab ci', 'gitlab ci cd']),
  F('Bitbucket', ['bitbucket pipelines']),
  F('GitHub Copilot', ['copilot']),
  // Integração e entrega contínuas
  F('Jenkins', ['jenkins ci']),
  F('CircleCI', ['circle ci']),
  F('Azure DevOps', ['azure pipelines', 'azure devops services']),
  F('Argo CD', ['argocd', 'argo cd gitops']),
  F('Tekton', []),
  // Contêineres e orquestração
  F('Docker', ['docker compose', 'docker container', 'containers docker']),
  F('Kubernetes', ['k8s', 'kube', 'kubectl']),
  F('Helm', ['helm charts']),
  F('Podman', []),
  // Infraestrutura como código e configuração
  F('Terraform', ['terraform hcl', 'infraestrutura como codigo']),
  F('Ansible', ['ansible playbooks']),
  F('Vagrant', []),
  F('Puppet', []),
  // `chef` (a própria grafia) não é contexto: a palavra sozinha não basta. `chef infra` é sinônimo e já casa.
  F('Chef', ['chef infra'], [], ['cookbook', 'cookbooks', 'infra']),
  // Nuvem
  F('AWS', ['amazon web services', 'aws cloud']),
  F('Microsoft Azure', ['azure', 'azure cloud']),
  F('Google Cloud Platform', ['gcp', 'google cloud', 'google cloud platform gcp']),
  F('AWS Lambda', ['lambda aws', 'aws lambda functions']),
  F('Amazon S3', ['s3', 'aws s3']),
  F('Amazon EC2', ['ec2']),
  F('Amazon ECS', ['ecs fargate']),
  F('Amazon EKS', ['eks']),
  F('Azure Functions', ['azure function apps']),
  F('Google Cloud Run', ['cloud run']),
  F('Cloudflare', ['cloudflare workers']),
  F('Heroku', []),
  F('Vercel', []),
  F('Netlify', []),
  // Servidores, proxies e mensageria
  F('Nginx', ['nginx reverse proxy']),
  F('Apache HTTP Server', ['apache httpd', 'apache web server']),
  F('RabbitMQ', ['rabbit mq', 'amqp']),
  // Celery e Poetry são palavras comuns: só contam com contexto de Python.
  F('Celery', ['celery worker'], [], ['celery worker', 'python', 'django', 'rabbitmq', 'redis', 'fila', 'queue']),
  F('Amazon SQS', ['sqs']),
  F('Redis Queue', ['rq worker']),
  // Observabilidade e monitoramento
  F('Prometheus', ['prometheus metrics']),
  F('Grafana', ['grafana dashboards']),
  F('Datadog', ['datadog apm']),
  F('New Relic', ['newrelic']),
  F('Sentry', ['sentry io']),
  F('Kibana', []),
  F('Logstash', []),
  F('Splunk', []),
  F('OpenTelemetry', ['open telemetry']),
  // Testes e qualidade
  F('Selenium', ['selenium webdriver']),
  F('Cypress', ['cypress io']),
  F('Playwright', ['playwright test']),
  F('Jest', ['jest testing']),
  F('JUnit', ['junit 5']),
  F('pytest', ['py test']),
  F('Cucumber', ['gherkin', 'cucumber js']),
  F('Postman', ['postman collections']),
  F('SonarQube', ['sonar qube', 'sonarcloud']),
  F('ESLint', ['eslint plugins']),
  F('Swagger', ['openapi', 'swagger ui', 'open api']),
  F('JMeter', ['apache jmeter']),
  F('k6', ['grafana k6']),
  // Gerenciadores de pacotes e build
  F('npm', ['npm install']),
  F('Yarn', ['yarn berry'], [], ['yarn berry', 'npm', 'node', 'javascript', 'pnpm', 'package json']),
  F('Maven', ['apache maven']),
  F('Gradle', ['gradle build']),
  F('pip', ['pip install']),
  F('Poetry', ['python poetry'], [], ['python poetry', 'python', 'pyproject', 'pip']),
  // IDEs e editores
  F('Visual Studio Code', ['vs code', 'vscode']),
  F('IntelliJ IDEA', ['intellij', 'jetbrains intellij']),
  F('PyCharm', []),
  F('Xcode', []),
  F('Android Studio', []),
  F('Eclipse IDE', []),
  F('Jupyter Notebook', ['jupyter', 'jupyter lab', 'jupyterlab']),
  F('Google Colab', ['colab', 'colaboratory']),
  // Gestão de trabalho de times de tecnologia
  F('Jira', ['jira software', 'atlassian jira']),
  F('Confluence', ['atlassian confluence']),
  // Design usado na entrega para o front-end
  F('Figma', ['figma design']),
  // Dados e BI
  F('Power BI', ['powerbi', 'microsoft power bi']),
  F('Tableau', ['tableau desktop']),
  F('Looker', ['looker studio', 'google data studio']),
  F('Metabase', []),
  F('Power Pivot', []),
  F('SPSS', ['ibm spss']),
  F('SAS', ['sas base']),
  F('Stata', []),
  // Plataformas e serviços com API ou desenvolvimento próprio
  F('Salesforce', ['sales force', 'salesforce crm']),
  F('Shopify', ['shopify apps']),
  F('WordPress', ['wordpress cms']),
  F('SAP', ['sap erp', 'sap s4hana', 'sap s/4hana', 'abap']),
  F('Totvs Protheus', ['protheus', 'totvs']),
  F('Stripe', ['stripe payments']),
  F('Twilio', ['twilio sms']),
  // Automação e integração
  F('Zapier', []),
  F('n8n', []),
];
