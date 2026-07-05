// ========================================
// IA BUSCAR - Integração com Google Gemini
// ========================================

// Modelo com suporte a grounding com Google Search.
// gemini-2.0-flash foi desativado em jun/2026 — usar 2.5-flash (estável) ou
// trocar para 'gemini-3.5-flash' se sua chave já tiver acesso à geração 3.
const GEMINI_MODEL = 'gemini-2.5-flash';

let apiKey = localStorage.getItem('geminiApiKey') || '';

// Salvar chave da API
function salvarApiKey() {
    const input = document.getElementById('apiKey');
    if (input.value.trim()) {
        apiKey = input.value.trim();
        localStorage.setItem('geminiApiKey', apiKey);
        mostrarToast('Chave da API salva com sucesso!', 'success');
        input.value = '';
        input.placeholder = '🔑 Chave salva';
    } else {
        mostrarToast('Digite uma chave de API válida.', 'error');
    }
}

// Carregar chave salva
document.addEventListener('DOMContentLoaded', function () {
    if (apiKey) {
        document.getElementById('apiKey').placeholder = '🔑 Chave salva';
    }
});

// Buscar tudo numa chamada só sobrecarrega o orçamento de pesquisas do
// grounding (a IA só faz um punhado de buscas por chamada) e deixa a
// cobertura incompleta. Por isso a busca é dividida em grupos menores,
// cada um com sua própria chamada — bem mais completo.
// Série C e D têm sua própria busca dedicada porque costumam ter muito mais
// jogos simultâneos por rodada (espalhados por canais regionais do YouTube)
// do que a Série A/B, e uma busca genérica "futebol nacional" não se
// aprofundava o suficiente nelas.
const GRUPOS_BUSCA = [
    { nome: 'Futebol Série A e B', esportes: 'Futebol brasileiro: Brasileirão Série A e Série B' },
    { nome: 'Futebol Série C, D e Estaduais', esportes: 'Futebol brasileiro: Série C, Série D, Copa do Brasil, e a primeira divisão dos principais estaduais (SP, RJ, MG, RS, BA, PR, SC, PE, CE etc.). ATENÇÃO: essas divisões costumam ter MUITOS jogos na mesma rodada (10 a 20 jogos), espalhados por vários canais regionais no YouTube — procure ativamente a lista COMPLETA da rodada, não pare nos primeiros 2-3 jogos que encontrar.' },
    { nome: 'Futebol Internacional', esportes: 'Futebol internacional: Copa do Mundo, Libertadores, Sul-Americana, Champions League, Eliminatórias, jogos de seleções, principais ligas europeias quando envolverem brasileiros ou grande repercussão' },
    { nome: 'Motor', esportes: 'Fórmula 1, Fórmula Indy, MotoGP, Stock Car' },
    { nome: 'Quadras', esportes: 'NBA, NBB, Vôlei (Superliga e seleções), Tênis (ATP, WTA, Grand Slams), Futsal (LNF e seleções)' },
    { nome: 'Combate e NFL', esportes: 'NFL, UFC, MMA, Boxe' }
];

// Roda as tarefas com um limite de chamadas simultâneas (em vez de todas de
// uma vez), pra não estourar limite de requisições por minuto da API do Gemini.
async function executarComLimite(tarefas, limite, fn) {
    const resultados = new Array(tarefas.length);
    let indice = 0;

    async function worker() {
        while (indice < tarefas.length) {
            const meuIndice = indice++;
            try {
                resultados[meuIndice] = { status: 'fulfilled', value: await fn(tarefas[meuIndice]) };
            } catch (erro) {
                resultados[meuIndice] = { status: 'rejected', reason: erro };
            }
        }
    }

    const workers = Array.from({ length: Math.min(limite, tarefas.length) }, worker);
    await Promise.all(workers);
    return resultados;
}

function dataParaISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Buscar eventos com IA
async function buscarComIA() {
    if (!apiKey) {
        mostrarToast('Por favor, configure sua chave da API Gemini primeiro.', 'error');
        document.getElementById('apiKey').focus();
        return;
    }

    const botoes = document.querySelectorAll('[onclick="buscarComIA()"]');
    botoes.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });

    const statusEl = document.getElementById('statusIA');
    statusEl.className = 'status-message loading';

    // Monta a lista de datas-alvo a partir do seletor "Buscar eventos de"
    const diaBuscaEl = document.getElementById('diaBusca');
    const diaBusca = diaBuscaEl ? diaBuscaEl.value : 'hoje';

    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const datasAlvo = [];
    if (diaBusca === 'hoje' || diaBusca === 'ambos') datasAlvo.push(hoje);
    if (diaBusca === 'amanha' || diaBusca === 'ambos') datasAlvo.push(amanha);

    const tarefas = [];
    for (const dataAlvo of datasAlvo) {
        for (const grupo of GRUPOS_BUSCA) {
            tarefas.push({ grupo, dataAlvo });
        }
    }

    statusEl.textContent = `🔄 Buscando eventos em ${tarefas.length} buscas (por esporte${datasAlvo.length > 1 ? ' e por dia' : ''})... isso pode levar um minuto.`;
    statusEl.style.display = 'block';

    try {
        // No máximo 3 chamadas simultâneas — completo, mas sem estourar limite de requisições por minuto
        const resultados = await executarComLimite(tarefas, 3, (tarefa) => chamarGemini(tarefa.grupo, tarefa.dataAlvo));

        let eventosBrutos = [];
        let falhas = 0;
        let parseFalhouEmAlgum = false;

        resultados.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                const dataISO = dataParaISO(tarefas[i].dataAlvo);
                const comData = r.value.eventos.map((e) => ({ ...e, data: dataISO }));
                eventosBrutos = eventosBrutos.concat(comData);
                if (r.value.parseFalhou) parseFalhouEmAlgum = true;
            } else {
                falhas++;
                console.warn(`[IA Buscar] Falha na busca de "${tarefas[i].grupo.nome}" (${tarefas[i].dataAlvo.toLocaleDateString('pt-BR')}):`, r.reason);
            }
        });

        const eventosValidos = filtrarEventosIndesejados(eventosBrutos);
        const descartados = eventosBrutos.length - eventosValidos.length;

        if (eventosValidos.length > 0) {
            let adicionados = 0;
            for (const evento of eventosValidos) {
                if (!evento.evento || !evento.campeonato) continue;

                const existe = jogos.some(j => eventosSaoIguais(j, evento) && j.data === evento.data);
                if (existe) continue;

                const prioridade = normalizarPrioridade(evento.prioridade, evento.campeonato, evento.evento);

                jogos.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                    hora: evento.hora || 'Horário a definir',
                    evento: evento.evento,
                    campeonato: evento.campeonato || 'Campeonato',
                    canal: evento.canal || 'A confirmar',
                    tipo: ['tv-aberta', 'tv-fechada', 'streaming', 'youtube'].includes(evento.tipo) ? evento.tipo : 'tv-aberta',
                    categoria: categoriaPorPrioridade(prioridade),
                    prioridade,
                    destaque: !!evento.destaque,
                    fonteUrl: (typeof evento.fonteUrl === 'string' && evento.fonteUrl.startsWith('http')) ? evento.fonteUrl : '',
                    data: evento.data,
                    fonte: 'IA - Gemini'
                });
                adicionados++;
            }

            salvarJogosStorage();
            renderizarJogos();
            gerarCards();

            statusEl.className = 'status-message success';
            let msg = adicionados > 0
                ? `✅ ${adicionados} novos eventos encontrados e adicionados!`
                : 'ℹ️ A IA encontrou eventos, mas todos já estavam na sua lista.';
            if (descartados > 0) {
                msg += ` (${descartados} descartado(s): categoria de base, divisão inferior, canal não confirmado ou evento genérico)`;
            }
            if (falhas > 0) {
                msg += ` ⚠️ ${falhas} de ${tarefas.length} buscas falharam — rode de novo se quiser tentar completar.`;
            }
            statusEl.textContent = msg;
        } else if (parseFalhouEmAlgum) {
            statusEl.className = 'status-message error';
            statusEl.textContent = '⚠️ A IA respondeu, mas o formato não pôde ser interpretado em pelo menos uma busca. Abra o console do navegador (F12) para ver a resposta bruta.';
        } else if (descartados > 0) {
            statusEl.className = 'status-message error';
            statusEl.textContent = `⚠️ A IA encontrou ${descartados} evento(s), mas todos foram descartados (categoria de base, divisão inferior, canal não confirmado ou evento genérico).`;
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = '⚠️ Nenhum evento encontrado. Tente novamente mais tarde ou adicione manualmente.';
        }
    } catch (error) {
        console.error('Erro na busca com IA:', error);
        statusEl.className = 'status-message error';
        statusEl.textContent = `❌ Erro: ${error.message || 'Falha ao buscar eventos'}`;
    } finally {
        botoes.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }

    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 15000);
}

// Chamar API Gemini com grounding no Google Search, para um grupo de
// esportes e uma data específicos (cada grupo/dia é uma chamada independente)
async function chamarGemini(grupo, dataAlvo) {
    const prompt = construirPrompt(grupo, dataAlvo);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            // Grounding com Google Search: sem isso, o modelo NÃO acessa a
            // internet e responde só com o que aprendeu no treinamento —
            // ou seja, inventaria a programação. Isso é o que faz a busca
            // real funcionar.
            tools: [
                { google_search: {} }
            ],
            generationConfig: {
                temperature: 0.1,
                // Respostas com grounding tendem a ser mais longas (o modelo
                // processa trechos de busca antes de responder), por isso o
                // limite é mais folgado que o de uma chamada sem ferramentas.
                maxOutputTokens: 16384
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro na API Gemini: ${errorData.error?.message || response.status}`);
    }

    const data = await response.json();
    const partes = data.candidates?.[0]?.content?.parts || [];
    const texto = partes.map(p => p.text || '').join('\n');

    // Sempre loga a resposta bruta no console — essencial para depurar quando
    // a IA responde algo que o parser não consegue interpretar.
    console.log('[IA Buscar] Resposta bruta do Gemini:', texto);

    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
        console.warn('[IA Buscar] Resposta cortada por atingir o limite de tokens (MAX_TOKENS). O JSON pode estar incompleto.');
    }

    return processarResposta(texto);
}

// Construir prompt para a IA — focado num grupo de esportes e numa data
// específica (cada busca cobre só isso, o que deixa a cobertura bem mais
// completa do que tentar tudo numa chamada só)
function construirPrompt(grupo, dataAlvo) {
    const dataFormatada = dataAlvo.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const ehHoje = dataParaISO(dataAlvo) === dataParaISO(new Date());
    const referenciaDia = ehHoje ? 'HOJE' : 'nessa data específica (não hoje)';

    return `
        Você é um assistente especializado em buscar programação esportiva para uma data específica: ${dataFormatada}.
        Use a ferramenta de busca do Google para consultar fontes reais e atuais. Não responda de memória.

        Sua tarefa: Encontrar eventos esportivos que acontecerão em ${dataFormatada} (${referenciaDia}), com horários
        (horário de Brasília) e canais de transmissão. NÃO retorne eventos de outros dias.

        Esportes para buscar NESTA busca (ignore outros esportes — eles são cobertos em buscas separadas):
        ${grupo.esportes}

        Fontes obrigatórias para consultar (em ordem de prioridade):
        1. cbf.com.br — agenda e transmissão oficial de Série A, B, C, D e Copa do Brasil
        2. ge.globo.com — seção "onde assistir" / "guia de jogos" (curadoria editorial, alta confiabilidade)
        3. mantosdofutebol.com.br/guia-de-jogos-tv-hoje-ao-vivo — guia diário consolidado de jogos na TV
        4. futnatv.net/futebol — guia semanal MUITO completo, geralmente com a lista inteira da rodada
           (inclusive Série C e D); acesse essa página específica, não só a home do site
        5. futebolnatv.com.br — guia diário jogo a jogo com horário e onde assistir
        6. goal.com/br — programação completa de futebol na TV
        7. espn.com.br, ge.globo.com/tv-e-streaming
        8. sportv.globo.com, premiere.globo.com, tntsports.com.br (Champions League/HBO Max), primevideo.com
        9. band.uol.com.br
        10. grandepremio.com.br / motorsport.com (F1, Indy, MotoGP, Stock Car)
        11. ufc.com.br, paramountplus.com/br
        12. nba.com/brasil, nfl.com/brasil
        13. cbv.com.br, lnb.com.br
        14. uol.com.br/esporte — guia diário com programação de diversos esportes
        15. torcedores.com — notícias e guia de programação esportiva
        16. lance.com.br — guia "Onde Assistir" com agenda diária de jogos
        17. youtube.com/c/CBFSTV, youtube.com/lnfoficial, youtube.com/@nbboficial, youtube.com/user/VoleiBrasil1,
            youtube.com/@MetropolesEsportes, youtube.com/@sportynet — canais regionais que costumam transmitir
            Série C, D e estaduais menores

        IMPORTANTE SOBRE EXAUSTIVIDADE: se a divisão pesquisada tiver muitos jogos na mesma rodada (comum em
        Série C, Série D e estaduais), retorne TODOS os jogos que você encontrar nas fontes, não só os 2-3
        mais visíveis. Times pequenos/pouco conhecidos são igualmente válidos, desde que o canal esteja confirmado.

        Canais/plataformas atuais a considerar (não se limite a essa lista, mas ela cobre os principais):
        - TV aberta: Globo, SBT, Record, Band, RedeTV!, Xsports, N Sports (FAST), TV Cultura, TV Brasil
        - TV fechada: SporTV, Premiere, ESPN, TNT Sports, N Sports, XSports, Fox Sports
        - Streaming: Globoplay, GE TV, Amazon Prime Video, Disney+, HBO Max, Star+, DAZN, UOL Play, Zapping, Paramount+
        - YouTube/gratuito: CazéTV, GOAT BR, One Football, Sportynet, N Sports, Desimpedidos

        REGRAS CRÍTICAS PARA CANAIS DE FUTEBOL:
        - Cada divisão/campeonato tem um pacote de transmissão DIFERENTE. NÃO copie o canal de uma divisão para outra.
        - Série A: confira jogo por jogo (pode ser Globo, Premiere, SporTV, GE TV — nem todo jogo passa em todos).
        - Série B: pacote PRÓPRIO, diferente da Série A. Confirme via CBF/ge.globo.com.
        - Série C e D: pacotes mais restritos (geralmente SportyNet ou GE TV). Confirme via CBF.
        - Estaduais: cada federação tem contrato próprio, pesquise o campeonato e o estado específico. Inclua
          SOMENTE a primeira divisão/módulo principal de cada estadual.
        - Se não conseguir confirmar com certeza que o jogo vai passar em algum canal/streaming, NÃO inclua esse
          evento na lista. Não retorne jogos com transmissão incerta ou "a confirmar" — é preferível trazer
          menos eventos, porém confirmados.

        O QUE NÃO INCLUIR (mesmo que apareça nas fontes pesquisadas):
        - Categorias de base: sub-15, sub-17, sub-20, sub-23, "aspirantes", "juniores", torneios de formação.
        - Segunda divisão (ou inferior) de campeonatos estaduais: módulo II, série B/C estadual, ligas regionais
          de cidades menores, campeonatos amadores ou municipais.
        - Qualquer jogo cuja transmissão você não conseguiu confirmar com uma fonte real.
        - Foque nos jogos de maior relevância/audiência do dia: Série A/B/C/D nacional, primeira divisão dos
          principais estaduais (SP, RJ, MG, RS, BA etc.), competições internacionais (Copa do Mundo, Libertadores,
          Champions League, Copa do Brasil) e os outros esportes já listados acima.

        REGRA CRÍTICA: CADA EVENTO PRECISA SER UM JOGO/PARTIDA/CORRIDA ESPECÍFICA, NÃO UMA MENÇÃO GENÉRICA:
        - Para esportes de confronto (futebol, NBA, NBB, vôlei, tênis, futsal, NFL, UFC/MMA/boxe), o campo
          "evento" precisa nomear os dois competidores (ex: "Fernanda x Amanda") ou indicar claramente uma fase
          específica (ex: "Final", "Semifinal", "Jogo 3"). NUNCA retorne uma menção solta ao torneio inteiro
          como se fosse um evento — isso não informa nada de útil pra quem for assistir.
        - Exemplos REAIS de "eventos" ERRADOS que já foram gerados por engano (NÃO faça isso):
          "Pelas Quadras de Wimbledon", "Torneio de Wimbledon de Tênis 2026" — essas frases não dizem quem
          está jogando, não são um evento specific, são só uma referência genérica ao campeonato.
        - Exemplo CORRETO para o mesmo cenário: "Alcaraz x Sinner - Final", ou "Bia Haddad x Swiatek - 3ª rodada".
        - Se você não conseguir identificar os competidores específicos de uma partida em uma fonte real,
          NÃO invente o evento — simplesmente não o inclua na lista.

        REGRA SOBRE DESTAQUE:
        - Marque "destaque": true APENAS para partidas/eventos de grande relevância que merecem um card próprio,
          como jogos de Copa do Mundo, finais de Champions League/Libertadores/Copa do Brasil, clássicos decisivos
          ou eventos de repercussão nacional. Nesses casos, o campo "campeonato" deve conter o nome do torneio
          exatamente como deve aparecer no título do card (ex: "Copa do Mundo").
        - Para os demais jogos do dia a dia, use "destaque": false.

        Retorne APENAS um JSON (sem markdown, sem texto antes ou depois) com a lista de eventos neste formato:
        [
            {
                "hora": "15h00",
                "evento": "GP de Mônaco - Classificação",
                "campeonato": "Fórmula 1",
                "canal": "Band, F1 TV",
                "tipo": "tv-aberta",
                "categoria": "Motor",
                "prioridade": "f1",
                "destaque": false,
                "fonteUrl": "https://... (o endereço exato da página onde você confirmou horário/canal deste evento)"
            }
        ]

        O campo "fonteUrl" é obrigatório e importante: é o que a pessoa que administra este
        sistema usa para conferir manualmente se a informação está certa antes de publicar.
        Use sempre o link real da página que você consultou para aquele evento específico
        (não um link genérico do site). Se por algum motivo não tiver um link específico,
        use "" (string vazia) — nunca invente uma URL.

        Tipos de canal:
        - TV aberta: Globo, SBT, Record, Band, RedeTV!, Xsports, N Sports (FAST), TV Cultura, TV Brasil
        - TV fechada: SporTV, Premiere, ESPN, TNT Sports, N Sports, XSports, Fox Sports
        - Streaming: Globoplay, GE TV, Amazon Prime Video, Disney+, HBO Max, Star+, DAZN, UOL Play, Zapping, Paramount+
        - YouTube/gratuito: CazéTV, GOAT BR, One Football, Sportynet, N Sports, Desimpedidos, canais oficiais

        Categorias válidas (use exatamente um destes valores em "categoria"):
        - Motor: F1, Indy, MotoGP, Stock Car
        - Quadras: NBA, NBB, Vôlei, Tênis, Futsal
        - Campo: NFL, Futebol
        - Combate: UFC, MMA, Boxe
        - Outros: demais esportes

        Valores válidos para "prioridade" (use EXATAMENTE um destes, sempre em minúsculo, sem
        variações como "atp"/"wta"/"fiba" — isso é usado para escolher o ícone certo do evento):
        f1, indy, motogp, stockcar, nba, nbb, volei, tenis, futsal, nfl, futebol, basquete, copa, mma, boxe, outros
        (use "basquete" para jogos de seleções/torneios internacionais que não sejam especificamente NBA ou NBB,
        como Copa do Mundo de Basquete ou Jogos Olímpicos; use "copa" para torneios internacionais de futebol
        como Copa do Mundo, Libertadores, Champions League)

        IMPORTANTE: Se você não encontrar eventos reais para essa data nas fontes pesquisadas, retorne um array vazio [].
        Não invente eventos, horários ou canais. Apenas retorne o que encontrar de fato.

        FORMATO DA RESPOSTA FINAL (muito importante):
        - Sua resposta final deve ser SOMENTE o array JSON, começando em "[" e terminando em "]".
        - NÃO inclua marcadores de citação/fonte (como [1], [2], [cbf.com.br]) nem qualquer texto,
          comentário ou explicação antes ou depois do array. Isso quebra a leitura automática do sistema.

        Agora, pesquise e retorne os eventos de ${grupo.nome} para ${dataFormatada}.
    `;
}

// Tenta interpretar o texto inteiro como JSON: pode ser um array direto,
// ou um objeto que embrulha o array numa propriedade comum (eventos, events...)
function tentarParseComoLista(texto) {
    try {
        const parsed = JSON.parse(texto);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') {
            for (const chave of ['eventos', 'events', 'data', 'resultados', 'items']) {
                if (Array.isArray(parsed[chave])) return parsed[chave];
            }
        }
    } catch (e) {
        // não é JSON puro — segue para a extração por varredura
    }
    return null;
}

// Encontra o "]" que fecha o "[" em `inicio`, contando profundidade e
// ignorando colchetes que estejam dentro de strings JSON.
function encontrarArrayBalanceado(texto, inicio) {
    let profundidade = 0;
    let dentroString = false;
    let escapando = false;

    for (let i = inicio; i < texto.length; i++) {
        const c = texto[i];

        if (dentroString) {
            if (escapando) escapando = false;
            else if (c === '\\') escapando = true;
            else if (c === '"') dentroString = false;
            continue;
        }

        if (c === '"') { dentroString = true; continue; }
        if (c === '[') profundidade++;
        else if (c === ']') {
            profundidade--;
            if (profundidade === 0) return texto.slice(inicio, i + 1);
        }
    }
    return null;
}

// Varre o texto procurando um array JSON válido de eventos, ignorando
// texto solto ao redor (ex: citações do grounding como "[1]", "[cbf.com.br]",
// ou frases que o modelo às vezes adiciona apesar da instrução de não fazer isso).
function extrairEventosDoTexto(texto) {
    const limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim();

    const direto = tentarParseComoLista(limpo);
    if (direto) return direto;

    for (let i = 0; i < limpo.length; i++) {
        if (limpo[i] !== '[') continue;
        const candidato = encontrarArrayBalanceado(limpo, i);
        if (!candidato) continue;

        try {
            const parsed = JSON.parse(candidato);
            if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'object')) {
                return parsed;
            }
        } catch (e) {
            // não era um array de eventos válido (provavelmente uma citação
            // tipo "[1, 2]") — continua procurando o próximo "["
        }
    }

    return null;
}

// Processar resposta da IA
function processarResposta(texto) {
    const eventos = extrairEventosDoTexto(texto);
    if (eventos === null) {
        console.warn('[IA Buscar] Não foi possível extrair um array JSON válido da resposta. Veja o texto bruto logado acima.');
        return { eventos: [], parseFalhou: true };
    }
    return { eventos, parseFalhou: false };
}
