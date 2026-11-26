// Domínio da bilheteria, no paradigma orientado a objetos.
// Os erros formam uma hierarquia de classes e o Evento esconde as poltronas vendidas.
import type { EventoInfo } from "./tipos.ts";

// ------------------------------------------------------------------ Erros de negócio

// Classe base abstrata: ninguém lança um "ErroDeNegocio" genérico, só as filhas.
// Cada erro guarda o seu status HTTP, e o servidor.ts usa esse status na resposta.
export abstract class ErroDeNegocio extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
    this.name = new.target.name; // o nome da classe filha, ex.: "PoltronaOcupadaErro"
  }
}

// 400: pedido ou poltrona inválidos.
export class DadosInvalidosErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 400);
  }
}

// 404: o evento não existe.
export class NaoEncontradoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 404);
  }
}

// 409: a poltrona já foi vendida.
export class PoltronaOcupadaErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 409);
  }
}

// 502: a operadora não aprovou o pagamento.
export class PagamentoErro extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem, 502);
  }
}

// ------------------------------------------------------------------ Evento

export class Evento {
  readonly id: number;
  readonly nome: string;
  readonly preco: number;
  readonly capacidade: number;

  // Campo privado (#): só o código dentro da classe enxerga a lista de poltronas vendidas.
  #vendidas: number[] = [];

  constructor(id: number, nome: string, preco: number, capacidade: number) {
    this.id = id;
    this.nome = nome;
    this.preco = preco;
    this.capacidade = capacidade;
  }

  // Só leitura: sem setter, ninguém muda o disponível por fora.
  get disponivel(): number {
    return this.capacidade - this.#vendidas.length;
  }

  // Tudo ou nada: primeiro confere TODAS as poltronas, só depois marca.
  // Se alguma falhar, o erro sai antes de marcar qualquer uma.
  reservar(poltronas: number[]): void {
    if (!Array.isArray(poltronas) || poltronas.length === 0) {
      throw new DadosInvalidosErro("nenhuma poltrona informada");
    }
    poltronas.forEach((p, i) => {
      if (!Number.isInteger(p) || p < 1 || p > this.capacidade) {
        throw new DadosInvalidosErro(`poltrona ${p} não existe neste evento`);
      }
      if (poltronas.indexOf(p) !== i) {
        throw new DadosInvalidosErro(`poltrona ${p} repetida no pedido`);
      }
      if (this.#vendidas.includes(p)) {
        throw new PoltronaOcupadaErro(`poltrona ${p} já foi vendida`);
      }
    });
    // Só chega aqui se todas passaram: agora marca.
    this.#vendidas.push(...poltronas);
  }

  // Devolve as poltronas para a venda (a bilheteria usa quando o pagamento falha).
  liberar(poltronas: number[]): void {
    for (const p of poltronas) {
      if (!this.#vendidas.includes(p)) {
        throw new DadosInvalidosErro(`poltrona ${p} não estava vendida`);
      }
    }
    this.#vendidas = this.#vendidas.filter((p) => !poltronas.includes(p));
  }

  // Os 5 campos do evento, no formato do EventoInfo.
  info(): EventoInfo {
    return {
      id: this.id,
      nome: this.nome,
      preco: this.preco,
      capacidade: this.capacidade,
      disponivel: this.disponivel,
    };
  }
}
