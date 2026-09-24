// Só o nome (ex.: "TypeError") — `.message` pode conter conteúdo do usuário ou detalhe interno do provedor.
export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : 'unknown';
}
