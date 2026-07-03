# Guia de Deploy — API de Dados do Brasileirão (gratuito)

Este guia é para quem **nunca usou terminal/linha de comando**. Vai levar uns 15 minutos.

O que isso vai fazer: colocar no ar um pequeno "servidor" gratuito (chamado Cloudflare
Worker) que busca a tabela, a rodada e os escudos do Brasileirão (Séries A, B, C e D)
de forma 100% confiável — sem depender de IA "adivinhar" números.

Você **não vai pagar nada**. O plano gratuito da Cloudflare permite 100.000 requisições
por dia, muito mais do que você vai usar postando conteúdo diariamente.

---

## Parte 1 — Instalar o Node.js (só na primeira vez)

O Node.js é um programa que permite rodar códigos JavaScript no seu computador
(fora do navegador). Precisamos dele só para fazer o "upload" do Worker — depois
disso, o Worker roda na nuvem da Cloudflare, seu computador não precisa mais ficar ligado.

1. Acesse **https://nodejs.org**
2. Baixe a versão **LTS** (o botão maior, recomendado)
3. Abra o instalador baixado e clique em "Next" / "Avançar" em tudo, até finalizar
   (as opções padrão já servem, não precisa mudar nada)
4. Reinicie o computador depois de instalar (evita problemas de reconhecimento do comando)

---

## Parte 2 — Criar conta gratuita na Cloudflare

1. Acesse **https://dash.cloudflare.com/sign-up**
2. Crie a conta com seu e-mail (gratuito, não pede cartão de crédito para isso)
3. Confirme o e-mail que a Cloudflare vai te enviar

---

## Parte 3 — Abrir o terminal

- **Windows**: aperte a tecla Windows, digite `PowerShell`, aperte Enter
- **Mac**: aperte `Cmd + Espaço`, digite `Terminal`, aperte Enter

Vai abrir uma janela preta/escura com texto — é nela que você vai colar os comandos
abaixo, um de cada vez, apertando Enter depois de cada um.

---

## Parte 4 — Preparar a pasta do projeto

1. Localize a pasta `backend-worker` que veio dentro do zip que te enviei
   (`esportes-na-tela/backend-worker`)
2. Copie essa pasta inteira para um lugar fácil de achar, por exemplo a Área de Trabalho
3. No terminal que você abriu, digite o comando abaixo para "entrar" na pasta —
   **ajuste o caminho conforme onde você colocou a pasta**:

   No Windows (exemplo se você colocou na Área de Trabalho):
   ```
   cd Desktop\backend-worker
   ```

   No Mac (exemplo se você colocou na Área de Trabalho):
   ```
   cd Desktop/backend-worker
   ```

   Dica: se você não souber o caminho exato, arraste a pasta `backend-worker` para
   dentro da janela do terminal depois de digitar `cd ` (com o espaço) — o caminho
   completo aparece sozinho.

---

## Parte 5 — Instalar as dependências

Ainda no terminal, dentro da pasta `backend-worker`, digite:

```
npm install
```

Espere terminar (aparecem várias linhas de texto, é normal). Quando voltar pro "prompt"
normal (a linha onde você digita), terminou.

---

## Parte 6 — Login na Cloudflare

Digite:

```
npx wrangler login
```

Isso vai abrir uma aba no seu navegador pedindo pra você autorizar. Clique em
**"Allow"** / **"Permitir"**. Depois disso pode voltar pro terminal (pode fechar
a aba do navegador).

---

## Parte 7 — Publicar o Worker

Digite:

```
npx wrangler deploy
```

Espere alguns segundos. No final vai aparecer um texto parecido com este:

```
Uploaded esportes-na-tela-api
Published esportes-na-tela-api
  https://esportes-na-tela-api.SEU-USUARIO.workers.dev
```

**Copie essa última linha (o link que começa com https://)** — é o endereço da sua
API. Guarde ele, você vai usar no próximo passo.

---

## Parte 8 — Testar se funcionou

Cole esse link no seu navegador, adicionando `/tabela?serie=a` no final. Por exemplo:

```
https://esportes-na-tela-api.SEU-USUARIO.workers.dev/tabela?serie=a
```

Se aparecer um monte de texto no formato `{ "tables": [...] }` com nomes de times,
pontos, escudos etc., funcionou! Se aparecer erro, veja a seção de Problemas Comuns
no final deste guia.

---

## Parte 9 — Conectar ao sistema Esportes na Tela

1. Abra o `index.html` do sistema no navegador
2. Na seção **"Configuração IA"**, você vai ver um novo campo: **"URL da API de dados (opcional)"**
3. Cole ali o link que você copiou na Parte 7 (sem o `/tabela` no final, só até `.workers.dev`)
4. Clique em Salvar

A partir daí, o sistema vai usar essa API sempre que possível para tabela e
rodada do Brasileirão (Séries A/B/C/D) e para os escudos dos times — mais rápido
e 100% confiável, sem depender da IA para esses números. Para outros campeonatos
(estaduais, internacionais) e outros esportes, o sistema continua usando IA + busca,
normalmente.

---

## Problemas comuns

**"comando não reconhecido" ao digitar `npm` ou `npx`**
→ O Node.js não foi instalado corretamente, ou o computador não foi reiniciado depois
da instalação. Reinstale o Node.js (Parte 1) e reinicie o computador.

**`npx wrangler deploy` pede pra escolher conta**
→ Se você tiver mais de uma conta Cloudflare, use as setas do teclado para escolher
e aperte Enter.

**Depois de um tempo a API parece "lenta" na primeira consulta do dia**
→ É normal — Workers gratuitos "dormem" quando não são usados e acordam na primeira
requisição, isso leva um segundo a mais. As consultas seguintes ficam rápidas.

**Quero atualizar o Worker depois (ex: eu te mandar uma versão nova do código)**
→ Substitua o conteúdo de `src/index.js` pelo novo código, e rode `npx wrangler deploy`
de novo dentro da pasta. Não precisa repetir os passos de login/instalação.
