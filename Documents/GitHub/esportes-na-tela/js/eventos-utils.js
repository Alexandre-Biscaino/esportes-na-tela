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
    basquete: ['basquete', 'fiba', 'mundial de basquete', 'jogos olimpicos'],
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

// Comparação tolerante para evitar duplicar eventos vindos da IA. Compara só
// evento (times/confronto) + hora — não exige que o texto do campeonato seja
// idêntico, porque buscas paralelas diferentes podem achar o mesmo jogo real
// e descrever o campeonato com palavras levemente diferentes (isso já causou
// duplicata de verdade: "Náutico x Juventude" aparecendo duas vezes).
function eventosSaoIguais(a, b) {
    return normalizarTexto(a.evento) === normalizarTexto(b.evento) &&
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
// OU é uma divisão inferior/amadora, OU parece uma menção genérica ao torneio
// em vez de um jogo/partida/corrida específica. Isso funciona como rede de
// segurança mesmo se a IA, por algum motivo, ignorar as instruções do prompt.
function eventoIndesejado(evento) {
    const canal = normalizarTexto(evento.canal);
    if (!canal || canal.includes('a confirmar') || canal.includes('nao confirmado')) return true;

    const texto = normalizarTexto(`${evento.campeonato || ''} ${evento.evento || ''}`);
    if (PADRAO_CATEGORIA_BASE.test(texto)) return true;
    if (PADRAO_DIVISAO_INFERIOR.test(texto)) return true;
    if (eventoPareceGenerico(evento)) return true;

    return false;
}

// Esportes que são disputados em confronto (dois lados) — para esses, o nome
// do evento precisa indicar uma partida específica (ex: "Time A x Time B",
// "Fase: Final", "Jogo 3"), não uma menção solta ao torneio como um todo
// (ex: "Pelas Quadras de Wimbledon", "Torneio de Wimbledon de Tênis 2026" —
// exemplos reais de "eventos" inválidos que a IA já retornou).
const PRIORIDADES_DE_CONFRONTO = ['nba', 'nbb', 'volei', 'tenis', 'futsal', 'nfl', 'futebol', 'mma', 'boxe', 'copa'];

const PADRAO_INICIO_GENERICO = /^(pelas |pela |sobre |cobertura |resumo |previa |analise |destaque |quadras de |jogos de |acao d[ao] |acompanhe )/;
const PADRAO_CONFRONTO = /\sx\s|\svs\.?\s|×/;
const PADRAO_FASE_ESPECIFICA = /(final|semifinal|quartas de final|oitavas|rodada \d|jogo \d|estreia|abertura|\d+ª rodada)/;

function eventoPareceGenerico(evento) {
    // Esportes individuais/motor (F1, Indy, MotoGP, Stock Car) legitimamente
    // têm nomes de evento sem "x" (ex: "GP de Mônaco - Classificação") —
    // esse filtro não se aplica a eles.
    if (!PRIORIDADES_DE_CONFRONTO.includes(evento.prioridade)) return false;

    const texto = normalizarTexto(evento.evento || '');
    if (!texto) return true;

    if (PADRAO_INICIO_GENERICO.test(texto)) return true;

    const temConfronto = PADRAO_CONFRONTO.test(texto);
    const temFase = PADRAO_FASE_ESPECIFICA.test(texto);
    if (!temConfronto && !temFase) return true;

    return false;
}

function filtrarEventosIndesejados(eventos) {
    return eventos.filter(e => !eventoIndesejado(e));
}

// Ícone específico por esporte (mais preciso que o ícone genérico da
// categoria) — assim, dentro do card "Quadras", um jogo de tênis mostra 🎾,
// um de vôlei mostra 🏐 etc., em vez de todos mostrarem 🏀.
const ICONES_PRIORIDADE = {
    f1: '🏎️',
    indy: '🏁',
    motogp: '🏍️',
    stockcar: '🏎️',
    nba: '🏀',
    nbb: '🏀',
    basquete: '🏀',
    volei: '🏐',
    tenis: '🎾',
    futsal: '⚽',
    nfl: '🏈',
    futebol: '⚽',
    copa: '🏆',
    mma: '🥊',
    boxe: '🥊'
};

function iconePorPrioridade(evento, iconeCategoriaPadrao) {
    return ICONES_PRIORIDADE[evento.prioridade] || iconeCategoriaPadrao;
}

// Nome de exibição de cada esporte, usado na legenda dos cards (pra quem lê
// saber o que cada ícone significa, especialmente em categorias que juntam
// vários esportes diferentes, como "Quadras" ou "Motor")
const NOMES_PRIORIDADE = {
    f1: 'Fórmula 1',
    indy: 'Fórmula Indy',
    motogp: 'MotoGP',
    stockcar: 'Stock Car',
    nba: 'NBA',
    nbb: 'NBB',
    basquete: 'Basquete',
    volei: 'Vôlei',
    tenis: 'Tênis',
    futsal: 'Futsal',
    nfl: 'NFL',
    futebol: 'Futebol',
    copa: 'Copa/Torneio',
    mma: 'MMA',
    boxe: 'Boxe'
};

// A IA nem sempre devolve exatamente uma das chaves conhecidas em "prioridade"
// (já apareceu "atp" em vez de "tenis", por exemplo). Em vez de confiar
// cegamente nesse valor — o que fazia o ícone específico e a legenda
// silenciosamente não baterem — validamos e, se não for uma chave
// reconhecida, re-inferimos a partir do campeonato/nome do evento.
function normalizarPrioridade(prioridade, campeonato, evento) {
    if (prioridade && (ICONES_PRIORIDADE[prioridade] || prioridade === 'outros')) {
        return prioridade;
    }
    return inferirPrioridade(campeonato, evento);
}

// A categoria (Motor/Quadras/Campo/Combate/Outros) é sempre DERIVADA da
// prioridade já validada, em vez de confiar no campo "categoria" que a IA
// manda separadamente. Isso evita a inconsistência de a IA dizer
// prioridade "futebol" mas categoria "Outros" ao mesmo tempo — já aconteceu.
const CATEGORIA_POR_PRIORIDADE = {
    f1: 'Motor', indy: 'Motor', motogp: 'Motor', stockcar: 'Motor',
    nba: 'Quadras', nbb: 'Quadras', basquete: 'Quadras', volei: 'Quadras', tenis: 'Quadras', futsal: 'Quadras',
    nfl: 'Campo', futebol: 'Campo', copa: 'Campo',
    mma: 'Combate', boxe: 'Combate'
};

function categoriaPorPrioridade(prioridade) {
    return CATEGORIA_POR_PRIORIDADE[prioridade] || 'Outros';
}

// Monta a legenda de ícones de um card: só os esportes que realmente
// aparecem entre os eventos daquele card, sem repetir.
function montarLegendaIcones(eventos) {
    const vistos = new Set();
    const itens = [];

    for (const evento of eventos) {
        const prioridade = evento.prioridade;
        if (!ICONES_PRIORIDADE[prioridade] || vistos.has(prioridade)) continue;
        vistos.add(prioridade);
        itens.push({ icone: ICONES_PRIORIDADE[prioridade], nome: NOMES_PRIORIDADE[prioridade] || prioridade });
    }

    return itens;
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

// Retorna a lista de eventos organizada em "seções" prontas para exibição.
// Primeiro agrupa por DATA (já que agora dá pra buscar hoje e amanhã juntos),
// e dentro de cada dia:
// 1) Cada campeonato marcado como "destaque" vira sua própria seção (tema dourado,
//    igual ao card de exemplo da Copa do Mundo), agrupando todos os jogos daquele campeonato.
// 2) Os demais eventos são agrupados pelas 5 categorias padrão, ordenados pela prioridade.
function organizarEmSecoes(eventos) {
    const hojeISO = dataParaISO(new Date());

    const gruposPorData = {};
    for (const evento of eventos) {
        const dataChave = evento.data || hojeISO;
        if (!gruposPorData[dataChave]) gruposPorData[dataChave] = [];
        gruposPorData[dataChave].push(evento);
    }

    const datasOrdenadas = Object.keys(gruposPorData).sort(); // strings ISO ordenam cronologicamente

    let todasSecoes = [];
    for (const dataChave of datasOrdenadas) {
        todasSecoes = todasSecoes.concat(organizarEmSecoesDeUmDia(gruposPorData[dataChave], dataChave));
    }
    return todasSecoes;
}

function organizarEmSecoesDeUmDia(eventos, dataISO) {
    const secoes = [];
    const dataFormatada = formatarData(new Date(`${dataISO}T12:00:00`));

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
            data: dataISO,
            dataFormatada,
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
            data: dataISO,
            dataFormatada,
            eventos: lista
        });
    }

    return secoes;
}

function getTemaCategoria(categoria) {
    const temas = { Motor: 'motor', Quadras: 'quadras', Campo: 'campo', Combate: 'combate', Outros: 'outros' };
    return temas[categoria] || 'outros';
}

// Formata uma data por extenso em português (ex: "Sexta-feira, 3 de julho de 2026").
// Aceita uma data específica (para eventos de amanhã) ou usa hoje por padrão.
function formatarData(data) {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${dias[data.getDay()]}, ${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}

// Mantido por compatibilidade — código antigo que chamava formatarDataAtual()
// continua funcionando, sempre referente a hoje.
function formatarDataAtual() {
    return formatarData(new Date());
}

// Usado pra mostrar um selo "AMANHÃ" nos cards quando o evento não é de hoje
function ehDataFutura(dataISO) {
    if (!dataISO) return false;
    return dataISO > dataParaISO(new Date());
}
