// ========================================
// EVENTOS UTILS - Funções compartilhadas
// (usado por jogos-manager, ia-buscar, cards-renderer e textos-gerador)
// ========================================

// Escapa HTML para prevenir injeção de código ao renderizar dados
// vindos da IA ou digitados pelo usuário (nomes de eventos, canais etc.)
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Normaliza texto para comparação tolerante (remove acentos, caixa e espaços extras)
function normalizarTexto(str) {
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

// Palavras-chave para inferir a "prioridade" (subcategoria) a partir do
// campeonato/nome do evento. Usado tanto para eventos manuais quanto como
// fallback para eventos vindos da IA sem prioridade definida.
const MAPA_PRIORIDADE = {
    f1: ['formula 1', 'f1', 'gp de', 'grande premio', 'gp da'],
    indy: ['indy', 'indycar', 'formula indy'],
    motogp: ['motogp', 'moto gp'],
    stockcar: ['stock car', 'stockcar'],
    nba: ['nba'],
    nbb: ['nbb', 'novo basquete brasil'],
    volei: ['volei', 'superliga'],
    tenis: ['tenis', 'atp', 'wta', 'grand slam', 'roland garros', 'wimbledon', 'us open'],
    futsal: ['futsal', 'lnf'],
    nfl: ['nfl'],
    mma: ['ufc', 'mma', 'boxe'],
    copa: ['copa do mundo', 'libertadores', 'copa do brasil', 'champions league', 'copa america']
};

function inferirPrioridade(campeonato, evento) {
    const texto = normalizarTexto(`${campeonato || ''} ${evento || ''}`);
    for (const [prioridade, palavras] of Object.entries(MAPA_PRIORIDADE)) {
        if (palavras.some(p => texto.includes(p))) return prioridade;
    }
    return 'outros';
}

// Comparação tolerante para evitar duplicar eventos vindos da IA
// (pequenas diferenças de acentuação/espaçamento não geram duplicata)
function eventosSaoIguais(a, b) {
    return normalizarTexto(a.evento) === normalizarTexto(b.evento) &&
        normalizarTexto(a.campeonato) === normalizarTexto(b.campeonato) &&
        normalizarTexto(a.hora) === normalizarTexto(b.hora);
}

// ========================================
// FILTRO DE SEGURANÇA (rede de proteção caso a IA ignore as instruções)
// ========================================

// Categorias de base (sub-15, sub-20, "aspirantes" etc.)
const PADRAO_CATEGORIA_BASE = /\b(sub[\s-]?1[0-9]|sub[\s-]?2[0-3]|u[\s-]?1[0-9]|u[\s-]?2[0-3]|aspirantes|juniores|categoria de base)\b/;

// Divisões inferiores de campeonatos estaduais / futebol amador ou municipal
const PADRAO_DIVISAO_INFERIOR = /(modulo ii|modulo iii|serie b estadual|serie c estadual|segunda divisao|terceira divisao|futebol amador|campeonato municipal|liga regional)/;

// Um evento é descartado se: o canal não está confirmado, OU é categoria de base,
// OU é uma divisão inferior/amadora. Isso funciona como rede de segurança mesmo
// se a IA, por algum motivo, ignorar as instruções do prompt.
function eventoIndesejado(evento) {
    const canal = normalizarTexto(evento.canal);
    if (!canal || canal.includes('a confirmar') || canal.includes('nao confirmado')) return true;

    const texto = normalizarTexto(`${evento.campeonato || ''} ${evento.evento || ''}`);
    if (PADRAO_CATEGORIA_BASE.test(texto)) return true;
    if (PADRAO_DIVISAO_INFERIOR.test(texto)) return true;

    return false;
}

function filtrarEventosIndesejados(eventos) {
    return eventos.filter(e => !eventoIndesejado(e));
}

// ========================================
// ORGANIZAÇÃO EM SEÇÕES (cards e textos usam a mesma lógica)
// ========================================

const CATEGORIAS_ORDEM = ['Motor', 'Quadras', 'Campo', 'Combate', 'Outros'];

const ORDEM_PRIORIDADE = {
    Motor: ['f1', 'indy', 'motogp', 'stockcar'],
    Quadras: ['nba', 'nbb', 'volei', 'tenis', 'futsal'],
    Campo: ['nfl', 'futebol', 'copa'],
    Combate: ['mma', 'boxe'],
    Outros: ['outros']
};

const ICONES_CATEGORIA = { Motor: '🏎️', Quadras: '🏀', Campo: '⚽', Combate: '🥊', Outros: '🎯' };
const CORES_CATEGORIA = { Motor: '#ff3300', Quadras: '#ff8800', Campo: '#00cc44', Combate: '#ffd700', Outros: '#aa00ff' };
const TITULOS_CATEGORIA = { Motor: 'MOTOR', Quadras: 'QUADRAS', Campo: 'CAMPO', Combate: 'COMBATE', Outros: 'OUTROS' };

// Retorna a lista de eventos organizada em "seções" prontas para exibição:
// 1) Cada campeonato marcado como "destaque" vira sua própria seção (tema dourado,
//    igual ao card de exemplo da Copa do Mundo), agrupando todos os jogos daquele campeonato.
// 2) Os demais eventos são agrupados pelas 5 categorias padrão, ordenados pela prioridade.
function organizarEmSecoes(eventos) {
    const secoes = [];

    // --- Eventos de destaque, agrupados por campeonato ---
    const gruposDestaque = {};
    for (const evento of eventos) {
        if (!evento.destaque) continue;
        const chave = (evento.campeonato || 'Destaque').trim();
        if (!gruposDestaque[chave]) gruposDestaque[chave] = [];
        gruposDestaque[chave].push(evento);
    }
    for (const [campeonato, lista] of Object.entries(gruposDestaque)) {
        lista.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        secoes.push({
            tipo: 'destaque',
            categoria: null,
            titulo: campeonato,
            icone: '🏆',
            badgeIcone: '🌐',
            cor: '#ffd700',
            eventos: lista
        });
    }

    // --- Eventos padrão, agrupados pelas categorias fixas ---
    const grupos = {};
    CATEGORIAS_ORDEM.forEach(c => { grupos[c] = []; });

    for (const evento of eventos) {
        if (evento.destaque) continue;
        const cat = CATEGORIAS_ORDEM.includes(evento.categoria) ? evento.categoria : 'Outros';
        grupos[cat].push(evento);
    }

    for (const categoria of CATEGORIAS_ORDEM) {
        const lista = grupos[categoria];
        if (lista.length === 0) continue;

        const prioridades = ORDEM_PRIORIDADE[categoria] || [];
        lista.sort((a, b) => {
            const pa = prioridades.indexOf(a.prioridade);
            const pb = prioridades.indexOf(b.prioridade);
            return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
        });

        secoes.push({
            tipo: 'categoria',
            categoria,
            titulo: TITULOS_CATEGORIA[categoria],
            icone: ICONES_CATEGORIA[categoria],
            badgeIcone: ICONES_CATEGORIA[categoria],
            cor: CORES_CATEGORIA[categoria],
            eventos: lista
        });
    }

    return secoes;
}

function getTemaCategoria(categoria) {
    const temas = { Motor: 'motor', Quadras: 'quadras', Campo: 'campo', Combate: 'combate', Outros: 'outros' };
    return temas[categoria] || 'outros';
}

function formatarDataAtual() {
    const data = new Date();
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${dias[data.getDay()]}, ${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}
