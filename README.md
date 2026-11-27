# Bilheteria concorrente

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** 

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| Caio Araujo Belo | [Ca1o4raujo](https://github.com/Ca1o4raujo) | Configuração do repositório, meia-entrada (`regras.ts`) e preço funcional (`preco.ts`) |
| João Gabriel | [joaogabriel33](https://github.com/joaogabriel33) | Erros de negócio e classe `Evento`, orientado a objetos (`dominio.ts`) |
| Josy Marcos | [JosyMarcos](https://github.com/JosyMarcos) | Venda concorrente (`bilheteria.ts`) e servidor no ar (`main.ts`) |

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   O `bilheteria.reservar` marca as poltronas com `evento.reservar(poltronas)` **antes** do
   `await` do pagamento. O Node só troca de pedido num `await`. Por isso, o trecho que confere se a
   poltrona está livre e a marca como vendida roda inteiro, sem que outro pedido entre no meio. O
   primeiro pedido que chega a esse trecho fica com a poltrona. Os outros recebem
   `PoltronaOcupadaErro` (409) na hora, sem serem cobrados.

   O `await` perigoso é o da cobrança, `await pagar(total)`. Se ele viesse antes de marcar as
   poltronas, vários pedidos conferiam a mesma poltrona livre, todos pausavam no pagamento e todos eram
   cobrados. Só depois cada um tentaria marcar: ou a poltrona seria vendida duas vezes, ou alguém
   pagaria sem receber poltrona.

   Mais dois cuidados:
   - **Tempo limite:** a cobrança corre contra um relógio com `Promise.race` (`comTempoLimite`). Se a
     operadora travar, o pedido desiste depois de `limitePagamentoMs`.
   - **Pagamento que falha:** se a cobrança falha ou passa do tempo, o `catch` devolve as poltronas com
     `evento.liberar(poltronas)`, para não ficarem presas, e lança `PagamentoErro` (502).

2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   **O que o `Evento` esconde.** A lista de poltronas vendidas fica no campo privado `#vendidas`. Ela
   só muda pelos métodos `reservar` e `liberar`, que validam tudo antes de mexer. Fora da classe, só dá
   para ler `evento.disponivel`, que é um `get` sem `set`:
   - tentar `evento.disponivel = 999` lança `TypeError`;
   - escrever `evento.#vendidas` nem compila.

   Assim ninguém consegue "vender por fora" e deixar o evento num estado inválido, como uma poltrona
   vendida duas vezes ou um disponível negativo.

   **Por que o `reservar` é tudo ou nada.** Um pedido é uma família comprando junta. Se uma das
   poltronas estiver ocupada, não faz sentido vender as outras e separar a família. O `reservar`
   confere todas as poltronas primeiro e só marca se todas passarem. Se der erro, nenhuma fica marcada.

   **Por que os erros são uma hierarquia.** Todos herdam de `ErroDeNegocio`, e cada filha já guarda o
   seu `status` HTTP. O `servidor.ts` só precisa de um `instanceof ErroDeNegocio` para responder com
   `erro.status`, sem um `if` para cada tipo de erro. Um erro novo é só mais uma classe filha, sem mudar
   o servidor. A classe base é abstrata porque não existe um erro de negócio "genérico".

3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   As funções do `preco.ts` são puras: o resultado depende só dos parâmetros, e elas não alteram nada
   fora delas. Não usam `let` nem `push` e não mexem nas listas que recebem. O `map` cria uma lista nova
   de ingressos e o `reduce` soma os valores sem uma variável acumuladora mutável.

   O que ganhamos com isso:
   - **Previsibilidade:** a mesma entrada dá sempre o mesmo resultado, então dá para confiar no preço
     mesmo com centenas de pedidos ao mesmo tempo.
   - **Composição:** as fábricas (`valorDoIngresso` e `aplicarTaxa`) devolvem funções prontas para
     reutilizar, como `aplicarTaxa(0.1)` dentro do `calcularTotal`.
   - **Flexibilidade:** o `montarIngressos` recebe a regra da meia como parâmetro, então dá para trocar
     a regra sem mexer na função.

   Para testar, basta importar as funções e comparar a saída com o valor esperado, sem servidor, sem
   eventos e sem pagamento. Por exemplo:
   - `valorDoIngresso(80)("meia")` tem que dar `40`;
   - `aplicarTaxa(0.1)(100)` tem que dar `110`;
   - `calcularTotal` de ingressos de 50 e 100 tem que dar `165`;
   - passando uma lista congelada com `Object.freeze`, dá para confirmar que a função não altera a
     entrada.

   É o que os testes de `testes/projeto.ts` já fazem.

4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   Escolhemos o `Evento` no paradigma **funcional**. Em vez de uma classe com estado privado, o evento
   seria um objeto imutável `{ id, nome, preco, capacidade, vendidas }`. O `reservar(evento, poltronas)`
   não alteraria nada: devolveria um **evento novo** com as poltronas acrescentadas, ou um erro.

   O que ficaria melhor: dá para testar cada reserva isoladamente e guardar o histórico de versões do
   evento.

   O que ficaria pior: o problema exige um estado que muda (quais poltronas estão vendidas agora), e
   esse estado precisa ficar num lugar só, visto por todos os pedidos. No funcional, alguém ainda teria
   que guardar "a versão atual" do evento e trocá-la a cada venda, e é justamente aí que a concorrência
   aparece. O encapsulamento da OO resolve isso de forma mais direta: o objeto guarda o estado e só
   deixa mudar pelos métodos que validam. Por isso achamos que, para o `Evento`, a OO é a melhor escolha.

5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   Hoje a garantia vem de o JavaScript rodar numa linha só: o trecho síncrono de `evento.reservar`
   (conferir e marcar) nunca é interrompido. Com vários núcleos rodando ao mesmo tempo, essa garantia
   acaba. Duas threads poderiam conferir a mesma poltrona no mesmo instante, as duas veriam a poltrona
   livre e as duas marcariam. Seria uma condição de corrida, e a poltrona seria vendida duas vezes.

   Para evitar isso, o trecho de conferir e marcar teria que virar uma operação atômica:
   - uma **trava** (mutex) por evento ou por poltrona;
   - operações atômicas, como compare-and-swap;
   - ou, num sistema real, um banco de dados com transação ou restrição de unicidade na poltrona.

   Além disso, com vários processos, cada um teria a sua própria memória. A lista de poltronas vendidas
   precisaria ficar num lugar compartilhado, como um banco de dados, e não mais dentro do objeto
   `Evento`.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 193 | 92 | 100 | 8 |

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram:

- **Nenhuma poltrona foi vendida duas vezes.** O bench manda dois pedidos para cada uma das 100
  poltronas, e exatamente 100 receberam 409 (poltrona ocupada), um para cada poltrona disputada. O
  segundo pedido foi recusado na hora, antes de ser cobrado.
- **Os pedidos não esperam uns pelos outros.** Cada cobrança demora 80 ms, e mesmo assim os 200
  pedidos terminaram em cerca de 193 ms, mais de 1000 pedidos por segundo. Em fila, um depois do outro,
  as 100 cobranças levariam pelo menos 8 segundos. Enquanto um pedido espera a operadora no `await`, o
  Node atende os outros.
- **Pagamento que falha devolve a poltrona.** A operadora falsa falha cerca de 10% das vezes: 8 pedidos
  receberam 502, e as 8 poltronas voltaram para a venda. Por isso, depois do bench, o evento 1 mostra
  `disponivel: 8`, e 92 + 8 = 100 poltronas.

Os números mudam um pouco a cada execução, porque a falha do pagamento é aleatória. O que não muda é
que nenhuma poltrona é vendida duas vezes e ninguém é cobrado sem poltrona.
