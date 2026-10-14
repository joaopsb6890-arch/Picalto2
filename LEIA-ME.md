# Picalta v4.3 — Edição corrigida (estrutura Vercel)

## O que mudou nesta edição

### Reorganização para a Vercel reconhecer os ficheiros

Antes, todos os ficheiros (index.html, app.js, etc.) estavam soltos na raiz do repositório. Num projeto Vercel sem framework ("Other"), a raiz não é servida como conteúdo estático — só a pasta `public/` (ou a que indicares em `outputDirectory`) é publicada, juntamente com as funções em `api/`. Por isso a Vercel "não reconhecia os arquivos".

Estrutura nova:

```
picalta/
├── api/
│   └── picalai.js        (função serverless da PicalAi)
├── public/               ← TODO o conteúdo estático
│   ├── index.html
│   ├── app.js
│   ├── auth.js
│   ├── config.js
│   ├── config.example.js
│   ├── data.js
│   ├── firebase.js
│   ├── games.js
│   ├── groups.js
│   ├── loading.css
│   ├── music-player.js
│   ├── picalai.js
│   └── progress.js
├── package.json
├── vercel.json           (novo: outputDirectory + functions + rewrites)
├── .env.example          (na raiz, NÃO em public/)
└── LEIA-ME.md
```

O `vercel.json` novo:

- `"outputDirectory": "public"` — diz à Vercel onde está o conteúdo estático.
- `"functions": { "api/picalai.js": { "maxDuration": 30 } }` — a função e o limite de 30 s.
- `"rewrites"` — `/api/picalai/status` e `/api/picalai/chat` continuam a apontar para `/api/picalai`.

**Não** tem `builds`/`routes` nem fallback SPA — desnecessários e podem partir os pedidos `/api/*`.

## Correções de código desta edição

Três ficheiros foram alterados relativamente ao zip original. Todos os outros ficaram como estavam (apenas movidos para `public/`).

### `games.js`

1. **Contrato de `gameBoard()` corrigido.** Antes devolvia só o elemento `#game-canvas-wrap`; os cinco jogos novos (Minesweeper, Breakout, Tetris, Pong, Connect4) faziam `const { board, footer } = gameBoard(...)` e crashavam (`Cannot set properties of undefined`). Agora devolve `{ wrap, board, footer }`. Os seis jogos antigos não usavam o retorno.
2. **Loops `requestAnimationFrame` e listeners sem cancelamento** em Breakout, Tetris e Pong — agora param via `registerGameCleanup()` quando o jogador sai.

### `data.js`

3. **Oito observadores devolviam uma `Promise` em vez da função de cancelamento** (`dbWatchSongs`, `dbWatchChats`, `dbWatchPosts`, `dbWatchComments`, `dbWatchFavorites`, `dbWatchFollowers`, `dbWatchMessages`, `dbWatchStories`). O código guardava-os como `musicUnsub = dbWatchSongs(...)` e chamava-os como função — `TypeError: not a function` — deixando subscrições activas. Agora devolvem directamente o cancelamento do `onSnapshot()`. Foi também normalizado em `dbWatchLeaderboard`, `dbWatchMyScores` e `dbWatchHashtag`.
4. Testado: chamar `renderMusicView()` cinco vezes deixa exactamente um listener activo de `songs`.

### `api/picalai.js` (função serverless)

5. **`verifyFirebaseToken` sem timeout** — podia exceder o `maxDuration: 30` combinado com os 25 s da IA. Adicionado `fetchWithTimeout()` com `AbortController` de 4 s activo durante o fetch **e** a leitura do corpo.

## Como publicar na Vercel

1. Faz upload do zip (ou `git push`) deste projeto.
2. No painel da Vercel, o projecto deve ser detectado como **Other** (sem framework).
3. Nas variáveis de ambiente (Settings → Environment Variables), define:

```
OVERCONTROL_API_KEY=...
OVERCONTROL_BASE_URL=https://api.overcontrolgroup.com/v1
OVERCONTROL_MODEL=lume-3.5
FIREBASE_API_KEY=...   (opcional — tem fallback no código)
```

4. Deploy. A app fica em `/` e a API em `/api/picalai/*`.

## Limites desta validação

- Testes locais com serviços Firebase/IA **simulados** (mocks). 32 asserções passaram (22 na app em DOM real com Firebase simulado, 10 na função serverless com `require` real).
- Estrutura estática validada localmente: `public/index.html`, `public/app.js`, `public/firebase.js`, `public/loading.css` todos servidos com 200.
- **Não validado:** publicação real na Vercel (o utilizador dispensou a conexão do conector Vercel), execução num browser real (falhou por conectividade), os rewrites do Vercel em produção, nem o Firebase/Cloudinary reais.
- O erro `500 FUNCTION_INVOCATION_FAILED` original **não foi reproduzido**. A reorganização para `public/` + `api/` deve resolver o "Vercel não reconhece os arquivos", mas se o 500 voltar a aparecer, são precisos os logs da função (Vercel → Deployments → `api/picalai.js` → Runtime Logs) para diagnóstico.
