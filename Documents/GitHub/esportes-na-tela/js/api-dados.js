// ========================================
// API DE DADOS (opcional) - integração com o Worker do Brasileirão
// ========================================
// Se configurada (Parte 9 do GUIA-DEPLOY.md), essa API é usada para dados
// de Série A/B/C/D do Brasileirão (tabela e escudos), que são mais confiáveis
// vindo de uma fonte estruturada do que pedindo pra IA "lembrar" números.
// Se não estiver configurada, ou se algo não bater, o sistema cai de volta
// para IA automaticamente — nada quebra por causa disso.

let apiDadosUrl = (localStorage.getItem('apiDadosUrl') || '').trim().replace(/\/$/, '');

function salvarApiDadosUrl() {
    const input = document.getElementById('apiDadosUrlInput');
    const valor = input.value.trim().replace(/\/$/, '');

    apiDadosUrl = valor;
    localStorage.setItem('apiDadosUrl', valor);

    if (valor) {
        mostrarToast('URL da API de dados salva! Tabela do Brasileirão e escudos vão usar ela quando possível.', 'success');
    } else {
        mostrarToast('URL removida. O sistema volta a usar só IA para tabelas.', 'info');
    }
    input.value = '';
    input.placeholder = valor ? '🔗 URL salva' : 'ex: https://esportes-na-tela-api.SEU-USUARIO.workers.dev';
}

document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('apiDadosUrlInput');
    if (input && apiDadosUrl) {
        input.placeholder = '🔗 URL salva';
    }
});

// Detecta se o texto digitado pelo usuário se refere ao Brasileirão (Série A/B/C/D),
// já que só esses são cobertos pela API dedicada. Qualquer outro campeonato
// (estadual, internacional) continua indo direto para a IA.
function detectarSerieBrasileirao(texto) {
    const t = normalizarTexto(texto);
    if (!t.includes('brasileir') && !t.includes('serie')) return null;

    if (/serie\s*d|quarta\s*divisao/.test(t)) return 'd';
    if (/serie\s*c|terceira\s*divisao/.test(t)) return 'c';
    if (/serie\s*b|segunda\s*divisao/.test(t)) return 'b';
    return 'a';
}

// Pega o primeiro valor definido entre várias chaves possíveis — usado porque
// não temos 100% de certeza dos nomes exatos dos campos do pacote de origem.
function pegarCampo(obj, chaves, padrao = undefined) {
    for (const chave of chaves) {
        if (obj && obj[chave] !== undefined && obj[chave] !== null && obj[chave] !== '') return obj[chave];
    }
    return padrao;
}

function mapearVariacaoAPI(bruta) {
    const t = normalizarTexto(String(bruta || ''));
    if (['up', 'subiu', 'rise', '+'].includes(t)) return 'subiu';
    if (['down', 'caiu', 'fall', '-'].includes(t)) return 'caiu';
    return 'manteve';
}

function normalizarZonaAPI(bruta) {
    const t = normalizarTexto(String(bruta || ''));
    if (!t) return '';
    if (t.includes('libertadores') && t.includes('pre')) return 'pre-libertadores';
    if (t.includes('libertadores')) return 'libertadores';
    if (t.includes('sul americana')) return 'sul-americana';
    if (t.includes('rebaix')) return 'rebaixamento';
    if (t.includes('playoff')) return 'playoff';
    if (t.includes('acesso')) return 'acesso';
    return '';
}

// Busca a tabela na API dedicada e normaliza pro mesmo formato que a IA usa
// (js/outros-conteudos.js). Retorna null se a API não estiver configurada,
// se falhar, ou se o formato vier diferente do esperado — nesses casos o
// chamador cai de volta para a IA automaticamente.
async function buscarTabelaAPI(serie) {
    if (!apiDadosUrl) return null;

    try {
        const resp = await fetch(`${apiDadosUrl}/tabela?serie=${serie}`);
        if (!resp.ok) return null;
        const bruto = await resp.json();
        return normalizarTabelaAPI(bruto, serie);
    } catch (e) {
        console.warn('[API de dados] Falha ao buscar tabela, caindo para IA:', e);
        return null;
    }
}

function normalizarTabelaAPI(bruto, serie) {
    try {
        const tabelas = bruto.tables || bruto.tabelas || [];
        const todasEntradas = tabelas.flatMap((t) => t.entries || t.entradas || []);
        if (todasEntradas.length === 0) return null;

        const times = todasEntradas.map((entrada, indice) => {
            const team = entrada.team || entrada.time || {};
            const nome = pegarCampo(team, ['name', 'nome']) || pegarCampo(entrada, ['name', 'nome']);
            if (!nome) return null;

            const pontos = Number(pegarCampo(entrada, ['points', 'pontos', 'pts'], 0));
            const jogos = Number(pegarCampo(entrada, ['played', 'jogos', 'matchesPlayed', 'games'], 0));
            const golsPro = Number(pegarCampo(entrada, ['goalsFor', 'golsPro', 'gf'], 0));
            const golsContra = Number(pegarCampo(entrada, ['goalsAgainst', 'golsContra', 'ga'], 0));
            const aproveitamentoBruto = pegarCampo(entrada, ['efficiency', 'aproveitamento', 'percentual']);

            return {
                posicao: Number(pegarCampo(entrada, ['position', 'pos', 'rank'], indice + 1)),
                time: nome,
                pontos,
                jogos,
                vitorias: Number(pegarCampo(entrada, ['wins', 'vitorias', 'w'], 0)),
                empates: Number(pegarCampo(entrada, ['draws', 'empates', 'd'], 0)),
                derrotas: Number(pegarCampo(entrada, ['losses', 'derrotas', 'l'], 0)),
                golsPro,
                golsContra,
                saldoGols: Number(pegarCampo(entrada, ['goalDifference', 'saldoGols', 'gd'], golsPro - golsContra)),
                aproveitamento: aproveitamentoBruto !== undefined
                    ? Math.round(Number(aproveitamentoBruto))
                    : (jogos > 0 ? Math.round((pontos / (jogos * 3)) * 100) : 0),
                variacao: mapearVariacaoAPI(pegarCampo(entrada, ['trend', 'variation', 'movement', 'variacao'], '')),
                // Zona pode não existir nessa fonte — nesse caso fica "" e o
                // card simplesmente não colore a posição (melhor que arriscar
                // uma faixa errada).
                zona: normalizarZonaAPI(pegarCampo(entrada, ['zone', 'zona'], ''))
            };
        }).filter(Boolean);

        if (times.length === 0) return null;

        return {
            campeonato: pegarCampo(bruto.competition || {}, ['name', 'nome'], `Brasileirão Série ${serie.toUpperCase()}`),
            atualizadoEm: 'dados oficiais',
            legenda: [],
            times
        };
    } catch (e) {
        console.warn('[API de dados] Formato inesperado na tabela, caindo para IA:', e);
        return null;
    }
}

// Busca o escudo de um time na API dedicada (cobre Séries A/B/C/D do
// Brasileirão). Para outros esportes/campeonatos, js/escudos.js recorre à
// Wikipédia como nas versões anteriores.
async function buscarEscudoAPI(nomeTime) {
    if (!apiDadosUrl) return null;

    try {
        const resp = await fetch(`${apiDadosUrl}/escudo?time=${encodeURIComponent(nomeTime)}`);
        if (!resp.ok) return null;
        const dados = await resp.json();
        return dados.escudo || null;
    } catch (e) {
        console.warn('[API de dados] Falha ao buscar escudo, tentando Wikipédia:', e);
        return null;
    }
}
