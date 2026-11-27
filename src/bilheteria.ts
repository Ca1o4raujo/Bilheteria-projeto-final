// A venda dos ingressos: onde a concorrência aparece.
// Vários pedidos chegam ao mesmo tempo; enquanto um espera a operadora no `await`,
// o Node atende os outros. Por isso as poltronas são marcadas ANTES do await.
import type { Comprovante, ConfigBilheteria, EventoInfo, Pedido } from "./tipos.ts";
import type { Pagamento } from "./pagamento.ts";
import { DadosInvalidosErro, Evento, NaoEncontradoErro, PagamentoErro } from "./dominio.ts";
import { calcularTotal, montarIngressos } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";

// Corrida entre a cobrança e um relógio: quem terminar primeiro decide.
// Se a operadora travar, o relógio rejeita depois de `ms` e o pedido não fica preso.
function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
  });
  // O finally desliga o relógio quando a cobrança termina antes.
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

export class Bilheteria {
  // Campos privados: ninguém de fora troca os eventos, a operadora, o limite ou o contador.
  #eventos: Evento[];
  #pagar: Pagamento;
  #limitePagamentoMs: number;
  #proximoReservaId = 1;

  constructor(config: ConfigBilheteria) {
    this.#eventos = config.eventos;
    this.#pagar = config.pagar;
    this.#limitePagamentoMs = config.limitePagamentoMs;
  }

  listarEventos(): EventoInfo[] {
    return this.#eventos.map((evento) => evento.info());
  }

  async reservar(pedido: Pedido): Promise<Comprovante> {
    // 1. Confere o pedido e procura o evento.
    if (!pedido || !Array.isArray(pedido.ingressos) || pedido.ingressos.length === 0) {
      throw new DadosInvalidosErro("o pedido precisa de pelo menos um ingresso");
    }
    const evento = this.#eventos.find((e) => e.id === pedido.eventoId);
    if (!evento) {
      throw new NaoEncontradoErro(`evento ${pedido.eventoId} não existe`);
    }

    // 2. Marca as poltronas AGORA, antes de qualquer await.
    // Este trecho roda inteiro sem pausa, então dois pedidos nunca pegam a mesma poltrona.
    // Poltrona inválida (400) ou ocupada (409) sai daqui, antes de cobrar alguém.
    const poltronas = pedido.ingressos.map((pessoa) => pessoa.poltrona);
    evento.reservar(poltronas);

    // 3. Preço: ingressos (meia ou inteira) e total com a taxa de 10%.
    const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
    const total = calcularTotal(ingressos);

    // 4. Cobra, com tempo limite. Aqui o pedido pausa e o Node atende outros.
    try {
      await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
    } catch (erro) {
      // Pagamento recusado ou operadora travada: devolve as poltronas para a venda.
      evento.liberar(poltronas);
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new PagamentoErro(`pagamento não aprovado: ${motivo}`);
    }

    // 5. Comprovante com um reservaId novo a cada venda.
    const reservaId = this.#proximoReservaId++;
    return { reservaId, eventoId: evento.id, ingressos, total };
  }
}

export function criarBilheteria(config: ConfigBilheteria): Bilheteria {
  return new Bilheteria(config);
}
