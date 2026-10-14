# Deploy no Vercel — Picalta v4.1

## 1. Ficheiros que mudaram (se já fizeste upload, substitui estes)

```
picalta/api/picalai.js      # reescrito: formato Vercel Node correto
picalta/vercel.json          # reescrito: rewrites em vez de routes
picalta/public/app.js        # +partilhar, +online, +busca hashtags
picalta/public/index.html    # +campo busca hashtags
```

## 2. Problema da IA — o que estava mal

Antes: `api/picalai.js` usava `export default { async fetch(req, env, ctx) }` — formato Cloudflare Worker, não Vercel. O Vercel esperava `export default async function handler(req, res)`. Por isso a função carregava mas não respondia.

Além disso `vercel.json` usava `routes` (legado) que podia conflitar. Agora usa `rewrites`.

### Estrutura do ficheiro

`api/picalai.js` é UM único ficheiro. O `vercel.json` mapeia:

```
/api/picalai/status  →  api/picalai.js  (GET)
/api/picalai/chat    →  api/picalai.js  (POST)
```

## 3. Variáveis de ambiente (Dashboard Vercel → Settings → Environment Variables)

| Nome | Valor |
|---|---|
| `OVERCONTROL_API_KEY` | a tua chave |
| `OVERCONTROL_BASE_URL` | `https://api.overcontrolgroup.com/v1` |
| `OVERCONTROL_MODEL` | `lume-3.5` |
| `FIREBASE_PROJECT_ID` | `picala-a212f` |

## 4. Testar depois do deploy

```bash
curl https://teu-projeto.vercel.app/api/picalai/status
# deve devolver {"configured":true,"model":"lume-3.5"}
```

Se devolver `configured: false`, falta uma variável de ambiente. Se devolver 404, o build não incluiu a pasta `api/`.

## 5. Firestore

Atualiza as regras:

```bash
firebase deploy --only firestore:rules
```

## Novidades nesta versão

- **IA no Vercel** — corrigida para o formato Node handler do Vercel.
- **Grupos** — criar, entrar/sair, membros, publicações.
- **6 jogos novos** — Minesweeper, Breakout, Tetris, Pong, Campo Minado, 4 em Linha.
- **Playlists** — criar, adicionar, tocar.
- **Stories** — navegação ←/→ com auto-avanço.
- **Partilhar post** — usa a API `navigator.share` nativa ou copia o link.
- **Badge online** — heartbeat a cada 2 min, mostra "online" se o utilizador esteve ativo nos últimos 5 min.
- **Busca de hashtags** — campo dedicado na vista Pesquisar.
