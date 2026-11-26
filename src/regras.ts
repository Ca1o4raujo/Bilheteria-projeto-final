// Regra de negócio da meia-entrada.
import type { Pessoa } from "./tipos.ts";

// Estudante, PcD ou quem tem 60 anos ou mais paga meia.
export function direitoAMeia(pessoa: Pessoa): boolean {
  return pessoa.estudante || pessoa.pcd || pessoa.idade >= 60;
}
