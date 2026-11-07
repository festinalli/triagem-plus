// Termos implícitos: quem cita o primeiro também está citando o segundo. "ASP.NET" conta como ".NET".
// Só entra aqui o que é parte do outro termo. Ficam de fora, de propósito: NoSQL (não é SQL), React Native (não é React),
// JavaScript e TypeScript (um não implica o outro) e Java e JavaScript (separados).
const IMPLIED: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['ASP.NET', ['.NET']],
  ['SQL Server', ['SQL']],
  ['PostgreSQL', ['SQL']],
  ['MySQL', ['SQL']],
  ['MariaDB', ['SQL']],
  ['Oracle', ['SQL']],
  ['SQLite', ['SQL']],
  ['T-SQL', ['SQL']],
  ['PL/SQL', ['SQL']],
  ['Spring Boot', ['Spring']],
  ['Java EE', ['Java']],
  ['Next.js', ['React']],
  ['Nuxt.js', ['Vue.js']],
]);

/** Nomes canônicos que o termo implica, sem incluir ele mesmo. */
export function impliedTerms(canonical: string): readonly string[] {
  return IMPLIED.get(canonical) ?? [];
}
