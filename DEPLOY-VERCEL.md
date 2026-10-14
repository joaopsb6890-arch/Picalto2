# Deploy no Vercel — Picalta v4

## 1. Subir para o Vercel

```bash
# na raiz do projeto (pasta "picalta")
npx vercel --prod
```

O `vercel.json` já direciona `/api/*` para a função serverless e o resto para a pasta `public/`.

## 2. Variáveis de ambiente (Dashboard Vercel → Settings → Environment Variables)

| Nome | Valor |
|---|---|
| `OVERCONTROL_API_KEY` | a tua chave (recomendo criar uma nova — a antiga foi partilhada) |
| `OVERCONTROL_BASE_URL` | `https://api.overcontrolgroup.com/v1` |
| `OVERCONTROL_MODEL` | `lume-3.5` |
| `FIREBASE_PROJECT_ID` | `picala-a212f` |

## 3. Firebase Firestore

Atualiza as regras do Firestore com o novo `firestore.rules` (tem agora regras para `groups`):

```bash
firebase deploy --only firestore:rules
```

## 4. O que estava a falhar na IA

O `server.js` não corre no Vercel — a app chamava `/api/picalai/*` e o Vercel respondia 404, daí o erro. A nova função `api/picalai.js` substitui esse servidor e funciona só como função serverless. A chave fica no ambiente do Vercel, nunca no browser.

## Limitações

- A verificação do token usa a API pública do Google (não Admin SDK).
- O rate limiting da função é por instância (Vercel cria instâncias separadas) — é um throttle simples, não rígido.
- Playlists guardam-se localmente (localStorage do dispositivo), não na nuvem.
- O YouTube IFrame API exige que o player esteja visível para autoplay — ao sair da vista Música, o vídeo pausa.

## Estrutura nova

```
picalta/
├── api/picalai.js        # função serverless Vercel (proxy IA)
├── vercel.json            # roteamento Vercel
├── public/groups.js       # módulo Grupos
├── public/index.html      # novas vistas + modais
├── public/games.js        # +6 jogos novos
├── public/music-player.js # playlists
└── firestore.rules        # regras grupos
```
