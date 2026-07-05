// ========================================
// ESCUDOS DOS TIMES (beta) - via Wikipédia (gratuito, sem chave)
// ========================================
// Funciona pra qualquer esporte que tenha o formato "Time A x Time B" no nome
// do evento (futebol, NBA, vôlei, futsal etc.) — não é específico de futebol.
//
// Importante: usamos a foto de capa da página da Wikipédia do time como
// "melhor esforço". Na maioria dos clubes grandes é o escudo, mas em times
// menores pode não ser (às vezes é o estádio, um jogador etc.) — por isso
// é uma função opcional (checkbox), não fica ligada por padrão.

// Importante: o prefixo tem uma versão (v2). Sempre que a lógica de busca do
// escudo mudar de um jeito que pode ter corrigido resultados errados
// anteriores (como aconteceu aqui — times ambíguos tipo "Tubarão" traziam a
// imagem errada), aumentar essa versão invalida o cache antigo automaticamente,
// sem precisar cada pessoa limpar o localStorage manualmente.
const ESCUDO_CACHE_PREFIX = 'escudoCache:v3:';
const ESCUDO_CACHE_DIAS = 14;

function normalizarChaveTime(nome) {
    return normalizarTexto(nome);
}

// Palavras que indicam que a página da Wikipédia é realmente sobre um
// time/clube ESPORTIVO específico. Importante: evitar palavras genéricas
// demais como "clube" ou "equipe" sozinhas — um "clube náutico" (de vela)
// também usa a palavra "clube", e isso já causou imagem errada pra times
// com nomes ambíguos ("Tubarão", "Náutico"). Exigimos o nome do esporte
// em si, não só "é algum tipo de clube".
const PALAVRAS_CONTEXTO_ESPORTIVO = [
    'futebol', 'futsal', 'basquete', 'basquetebol', 'volei', 'handebol',
    'clube de futebol', 'agremiacao de futebol', 'time de futebol'
];

function pareceTimeEsportivo(data) {
    const texto = normalizarTexto(`${data.description || ''} ${data.extract || ''}`);
    return PALAVRAS_CONTEXTO_ESPORTIVO.some((p) => texto.includes(p));
}

// Consulta a API pública da Wikipédia (REST, sem chave, com CORS liberado).
// Só aceita a imagem se a página encontrada realmente parecer ser sobre um
// time/clube esportivo (ver pareceTimeEsportivo) — caso contrário, descarta
// e tenta a próxima variação do nome, em vez de arriscar uma foto errada.
async function consultarWikipediaResumo(nomeTime) {
    const tentativas = [`${nomeTime} (futebol)`, `${nomeTime} (clube de futebol)`, `${nomeTime} (basquete)`, nomeTime];

    for (const termo of tentativas) {
        try {
            const resp = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(termo)}`);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (!data.thumbnail || !data.thumbnail.source) continue;
            if (!pareceTimeEsportivo(data)) continue; // provavelmente página errada (cidade, animal etc.)
            return data.thumbnail.source;
        } catch (e) {
            // tenta a próxima variação do nome
        }
    }
    return null;
}

// Busca o escudo com cache local (evita repetir a mesma consulta por 14 dias).
// Ordem de tentativa: 1) API dedicada do Brasileirão (se configurada e o time
// for encontrado nela) → 2) Wikipédia (cobre qualquer outro time/esporte).
async function buscarEscudoTime(nomeTime) {
    const chave = ESCUDO_CACHE_PREFIX + normalizarChaveTime(nomeTime);

    try {
        const cacheStr = localStorage.getItem(chave);
        if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            if (Date.now() - cache.ts < ESCUDO_CACHE_DIAS * 24 * 60 * 60 * 1000) {
                return cache.url; // pode ser null (já pesquisado e não encontrado)
            }
        }
    } catch (e) {
        // cache corrompido, ignora e busca de novo
    }

    let url = null;
    if (typeof buscarEscudoAPI === 'function' && typeof apiDadosUrl !== 'undefined' && apiDadosUrl) {
        url = await buscarEscudoAPI(nomeTime);
    }
    if (!url) {
        url = await consultarWikipediaResumo(nomeTime);
    }

    try {
        localStorage.setItem(chave, JSON.stringify({ url, ts: Date.now() }));
    } catch (e) {
        // localStorage cheio — tudo bem, só não fica em cache desta vez
    }

    return url;
}

// Extrai "Time A" e "Time B" de um texto como "Palmeiras x Corinthians"
// (também aceita "vs", "×"). Retorna null se o padrão não bater — nesse
// caso simplesmente não tentamos buscar escudo (ex: "GP de Mônaco").
function extrairTimesDoEvento(texto) {
    const partes = texto.split(/\s+(?:x|vs\.?|×)\s+/i);
    if (partes.length === 2 && partes[0].trim() && partes[1].trim()) {
        return [partes[0].trim(), partes[1].trim()];
    }
    return null;
}

// Percorre os cards já renderizados e injeta o escudo dos dois times
// (mandante e visitante) quando encontrados. Roda de forma assíncrona/
// progressiva: os cards já aparecem com texto, os escudos "chegam" depois,
// sem travar nada.
async function carregarEscudosVisiveis() {
    const toggle = document.getElementById('toggleEscudos');
    if (!toggle || !toggle.checked) return;

    const elementos = document.querySelectorAll('.event-name[data-evento-nome]');

    for (const el of elementos) {
        if (el.dataset.escudosCarregados) continue; // já processado

        const times = extrairTimesDoEvento(el.dataset.eventoNome || '');
        if (!times) continue;

        el.dataset.escudosCarregados = '1';

        try {
            const [urlA, urlB] = await Promise.all([
                buscarEscudoTime(times[0]),
                buscarEscudoTime(times[1])
            ]);

            if (!urlA && !urlB) continue; // nenhum dos dois encontrado — mantém o texto como estava

            const imgHtml = (url) => url
                ? `<img src="${url}" class="escudo-time" alt="" loading="lazy" crossorigin="anonymous" onerror="this.remove()" />`
                : '';

            // Preserva o ícone do esporte (ex: 🎾) que já estava na frente do
            // nome do evento, em vez de sobrescrever tudo ao adicionar os escudos.
            const icone = el.dataset.eventoIcone
                ? `<span class="event-icone">${el.dataset.eventoIcone}</span>`
                : '';

            el.innerHTML = `
                ${icone}${imgHtml(urlA)}<span class="time-nome">${times[0]}</span>
                <span class="evento-x">x</span>
                ${imgHtml(urlB)}<span class="time-nome">${times[1]}</span>
            `;
        } catch (e) {
            // falha silenciosa — o card já está ok sem os escudos
        }
    }
}

// Liga/desliga escudos e re-renderiza os cards
function alternarEscudos() {
    if (typeof gerarCards === 'function') gerarCards();
}

// Limpa manualmente o cache de escudos salvos no navegador — útil se algum
// time específico ficou com uma imagem errada em cache e você não quer
// esperar os 14 dias, ou não quer esperar uma atualização de versão do sistema.
function limparCacheEscudos() {
    const chaves = Object.keys(localStorage).filter((k) => k.startsWith(ESCUDO_CACHE_PREFIX));
    chaves.forEach((k) => localStorage.removeItem(k));
    mostrarToast(`🗑️ Cache de escudos limpo (${chaves.length} time(s)). Gerando cards de novo...`, 'info');
    if (typeof gerarCards === 'function') gerarCards();
}
