// Encadeia `job` depois de `previous`, em série. Uma falha vai para `onError` e a fila
// continua utilizável: sem o catch, uma única exceção pularia todas as tarefas seguintes.
export function enqueue(
  previous: Promise<void>,
  job: () => Promise<void>,
  onError: (err: unknown) => void
): Promise<void> {
  return previous.then(job).catch(onError);
}
