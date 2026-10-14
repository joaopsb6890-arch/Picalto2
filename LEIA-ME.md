# Picalta v4.3 — Correções (edição "erros corrigidos")

## O que foi corrigido

Três ficheiros foram alterados. Todos os outros quinze ficaram exatamente como estavam.

### `games.js`

1. **Contrato de `gameBoard()` corrigido.** Antes, a função devolvia apenas o elemento `#game-canvas-wrap`. Os cinco jogos adicionados (Minesweeper, Breakout, Tetris, Pong, Connect4) faziam `const { board, footer } = gameBoard(...)` e depois usavam `board.appendChild` / `board.innerHTML` — o que lançava `Cannot set properties of undefined` mal o utilizador os abria. Agora `gameBoard()` devolve `{ wrap, board, footer }` (com `board` = `#game-area` e `footer` = `#game-instructions`). Os seis jogos antigos não usavam o valor de retorno, por isso não foram afetados.
2. **Loops `requestAnimationFrame` e listeners sem cancelamento.** Breakout, Tetris e Pong mantinham o loop de animação a correr (e o Tetris mantinha um listener de teclado em `document`) mesmo depois de o utilizador sair da vista de jogos — continuavam a desenhar num canvas já removido. Agora esses loops/listeners estão registados em `registerGameCleanup()` e param quando o jogador sai.

### `data.js`

3. **Oito observadores devolviam uma `Promise` em vez da função de cancelamento.** `dbWatchSongs`, `dbWatchChats`, `dbWatchPosts`, `dbWatchComments`, `dbWatchFavorites`, `dbWatchFollowers`, `dbWatchMessages` e `dbWatchStories` estavam embrulhados em IIFE `return (async () => ...)();`, o que fazia com que o código que os guardava (por exemplo `musicUnsub = dbWatchSongs(...)`, `pollsUnsub = dbWatchPolls(...)`) recebesse uma Promise. Ao tentar chamar essa Promise como função (`musicUnsub()`) lançava `TypeError: not a function`, e a subscrição real ficava activa para sempre (zombies). Foi também normalizado o mesmo padrão em `dbWatchLeaderboard`, `dbWatchMyScores` e `dbWatchHashtag`. **Todos devolvem agora directamente o `onSnapshot()`'s cancel function.**
4. Foi testado especificamente: chamar `renderMusicView()` cinco vezes seguidas deixa **exactamente um** listener activo de `songs` (não cinco).

### `api/picalai.js` (função serverless da Vercel)

5. **`verifyFirebaseToken` sem timeout.** A chamada ao Firebase Identity Toolkit podia ficar pendurada sem limite; combinada com os 25 s permitidos para a IA, podia exceder o `maxDuration: 30` do `vercel.json` e derrubar a função. Foi adicionado `fetchWithTimeout()` com `AbortController` de 4 s que se mantém activo durante o fetch **e** a leitura do corpo (não só até chegarem os headers).

## O que não foi alterado

- Os imports dinâmicos do Firebase no browser (`firebase.js`) — são correctos para browser e não afectam a função serverless.
- `.env.example`, `config.js`, `config.example.js` — placeholders teus.
- `vercel.json` — os rewrites estão sintacticamente válidos (nota: validar o JSON não executa os rewrites; não houve teste de encaminhamento).
- `dbWatchPlayer` — mantido como estava (o erro que aparecia num teste inicial vinha do mock do Firebase, não do código).

## Como correr

A app é estática (HTML + JS) — basta abrir o `index.html` ou publicar a pasta num host estático (Vercel, Netlify, etc.). A função `api/picalai.js` precisa das variáveis de ambiente no Vercel:

```
OVERCONTROL_API_KEY=...
OVERCONTROL_BASE_URL=https://api.overcontrolgroup.com/v1
OVERCONTROL_MODEL=lume-3.5
FIREBASE_API_KEY=...   (opcional — tem um fallback)
```

## Limites desta validação

Os testes foram **locais**, com os serviços Firebase/IA **simulados** (mocks):

- 22 asserções na app (jsdom + canvas) — todas passaram.
- 10 asserções na função `api/picalai.js` (Node + `require` real) — todas passaram, incluindo o cenário "headers imediatos, corpo bloqueado" que aborta em ~4 s.

**Não foi validado:** execução num browser real (a tentativa falhou por conectividade), os rewrites do Vercel em produção, nem o Firebase/Cloudinary reais. O erro `500 FUNCTION_INVOCATION_FAILED` que motivaste este pedido **não foi reproduzido localmente** — os cenários testados do handler passaram, mas isso não prova que o erro em produção esteja resolvido. Para diagnosticá-lo são precisos o URL afectado e a primeira excepção dos logs da função no Vercel.
