// Preço dos ingressos, no paradigma funcional.
// Só funções puras: recebem valores, devolvem valores novos e não alteram nada fora delas.
import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

const TAXA_DE_SERVICO = 0.1;

// Arredonda em 2 casas decimais (centavos), devolvendo número.
const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

// Fábrica: guarda o preço base e devolve uma função que recebe o tipo do ingresso.
export function valorDoIngresso(precoBase: number): (tipo: TipoIngresso) => number {
  return (tipo) => (tipo === "meia" ? arredondar(precoBase / 2) : precoBase);
}

// Fábrica: guarda o percentual e devolve uma função que soma a taxa a um valor.
export function aplicarTaxa(percentual: number): (valor: number) => number {
  return (valor) => arredondar(valor * (1 + percentual));
}

// Um Ingresso por pessoa, na mesma ordem. A regra da meia vem de fora, como parâmetro.
export function montarIngressos(
  precoBase: number,
  pessoas: readonly Pessoa[],
  temDireitoAMeia: (pessoa: Pessoa) => boolean,
): Ingresso[] {
  const valorDe = valorDoIngresso(precoBase);
  return pessoas.map((pessoa) => {
    const tipo: TipoIngresso = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return { nome: pessoa.nome, poltrona: pessoa.poltrona, tipo, valor: valorDe(tipo) };
  });
}

// Soma os valores dos ingressos e aplica a taxa de serviço de 10%.
export function calcularTotal(ingressos: readonly Ingresso[]): number {
  const soma = ingressos.reduce((acumulado, ingresso) => acumulado + ingresso.valor, 0);
  return aplicarTaxa(TAXA_DE_SERVICO)(soma);
}
