// Domínio da bilheteria, no paradigma orientado a objetos.
// Os erros formam uma hierarquia de classes e o Evento esconde as poltronas vendidas.
import type { EventoInfo } from "./tipos.ts";

// ------------------------------------------------------------------ Erros de negócio

// Classe base abstrata: ninguém lança um "ErroDeNegocio" genérico, só as filhas.
// Cada filha diz o seu status HTTP, e o servidor.ts usa esse status na resposta.
export abstract class ErroDeNegocio extends Error {
  abstract readonly status: number;

  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name; // o nome da classe filha, ex.: "PoltronaOcupadaErro"
  }
}

// 400: o pedido veio errado (lista vazia, poltrona que não existe, poltrona repetida...).
export class DadosInvalidosErro extends ErroDeNegocio {
  readonly status = 400;
}

// 404: o evento pedido não existe.
export class NaoEncontradoErro extends ErroDeNegocio {
  readonly status = 404;
}

// 409: a poltrona já foi vendida para outra pessoa (conflito).
export class PoltronaOcupadaErro extends ErroDeNegocio {
  readonly status = 409;
}

// 502: a operadora de pagamento recusou ou não respondeu a tempo.
export class PagamentoErro extends ErroDeNegocio {
  readonly status = 502;
}

// ------------------------------------------------------------------ Evento

export class Evento {
  // Campo privado de verdade (#): nada fora da classe consegue ler ou mudar as poltronas.
  #vendidas = new Set<number>();

  constructor(
    readonly id: number,
    readonly nome: string,
    readonly preco: number,
    readonly capacidade: number,
  ) {}

  // Só leitura: sem setter, ninguém muda o disponível por fora.
  get disponivel(): number {
    return this.capacidade - this.#vendidas.size;
  }

  // Tudo ou nada: primeiro confere TODAS as poltronas, só depois marca.
  // Se alguma falhar, o erro sai antes de marcar qualquer uma.
  reservar(poltronas: number[]): void {
    this.#conferirLista(poltronas);
    if (new Set(poltronas).size !== poltronas.length) {
      throw new DadosInvalidosErro("a mesma poltrona aparece duas vezes no pedido");
    }
    for (const p of poltronas) {
      if (this.#vendidas.has(p)) throw new PoltronaOcupadaErro(`poltrona ${p} já está ocupada`);
    }
    for (const p of poltronas) this.#vendidas.add(p);
  }

  // Devolve poltronas para a venda (ex.: quando o pagamento falha). Também é tudo ou nada.
  liberar(poltronas: number[]): void {
    this.#conferirLista(poltronas);
    for (const p of poltronas) {
      if (!this.#vendidas.has(p)) throw new DadosInvalidosErro(`poltrona ${p} não estava vendida`);
    }
    for (const p of poltronas) this.#vendidas.delete(p);
  }

  // Os dados públicos do evento, no formato do EventoInfo.
  info(): EventoInfo {
    return {
      id: this.id,
      nome: this.nome,
      preco: this.preco,
      capacidade: this.capacidade,
      disponivel: this.disponivel,
    };
  }

  // Método privado: a lista não pode ser vazia e cada poltrona vai de 1 até a capacidade.
  #conferirLista(poltronas: number[]): void {
    if (!Array.isArray(poltronas) || poltronas.length === 0) {
      throw new DadosInvalidosErro("nenhuma poltrona informada");
    }
    for (const p of poltronas) {
      if (!Number.isInteger(p) || p < 1 || p > this.capacidade) {
        throw new DadosInvalidosErro(`poltrona ${p} não existe neste evento`);
      }
    }
  }
}
