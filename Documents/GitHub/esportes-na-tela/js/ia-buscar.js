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
    statusEl.textContent = '🔄 Buscando eventos esportivos de hoje com IA + Google Search...';
    statusEl.style.display = 'block';

    try {
        const resultado = await chamarGemini();
        const eventosBrutos = resultado.eventos;
        const eventosValidos = filtrarEventosIndesejados(eventosBrutos);
        const descartados = eventosBrutos.length - eventosValidos.length;

        if (eventosValidos.length > 0) {
            let adicionados = 0;
            for (const evento of eventosValidos) {
                if (!evento.evento || !evento.campeonato) continue;

                const existe = jogos.some(j => eventosSaoIguais(j, evento));
                if (existe) continue;

                jogos.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                    hora: evento.hora || 'Horário a definir',
                    evento: evento.evento,
                    campeonato: evento.campeonato || 'Campeonato',
                    canal: evento.canal || 'A confirmar',
                    tipo: ['tv-aberta', 'tv-fechada', 'streaming', 'youtube'].includes(evento.tipo) ? evento.tipo : 'tv-aberta',
                    categoria: CATEGORIAS_ORDEM.includes(evento.categoria) ? evento.categoria : 'Outros',
                    prioridade: evento.prioridade || inferirPrioridade(evento.campeonato, evento.evento),
                    destaque: !!evento.destaque,
                    fonteUrl: (typeof evento.fonteUrl === 'string' && evento.fonteUrl.startsWith('http')) ? evento.fonteUrl : '',
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
                msg += ` (${descartados} descartado(s): categoria de base, divisão inferior ou canal não confirmado)`;
            }
            statusEl.textContent = msg;
        } else if (resultado.parseFalhou) {
            statusEl.className = 'status-message error';
            statusEl.textContent = '⚠️ A IA respondeu, mas o formato não pôde ser interpretado. Abra o console do navegador (F12) para ver a resposta bruta — geralmente ajuda ajustar o prompt.';
        } else if (descartados > 0) {
            statusEl.className = 'status-message error';
            statusEl.textContent = `⚠️ A IA encontrou ${descartados} evento(s), mas todos foram descartados (categoria de base, divisão inferior ou canal não confirmado).`;
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = '⚠️ Nenhum evento encontrado para hoje. Tente novamente mais tarde ou adicione manualmente.';
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
    }, 10000);
}

// Chamar API Gemini com grounding no Google Search
async function chamarGemini() {
    const prompt = construirPrompt();

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
                maxOutputTokens: 8192
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

// Construir prompt para a IA
function construirPrompt() {
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return `
        Você é um assistente especializado em buscar programação esportiva para o dia de hoje (${dataAtual}).
        Use a ferramenta de busca do Google para consultar fontes reais e atuais. Não responda de memória.

        Sua tarefa: Encontrar eventos esportivos que acontecerão HOJE, com horários (horário de Brasília) e canais de transmissão.

        Esportes para buscar:
        - Futebol (Série A, B, C, D, Estaduais, Copa do Brasil, torneios internacionais como Copa do Mundo, Libertadores, Champions League)
        - Fórmula 1, Fórmula Indy, MotoGP, Stock Car
        - NBA, NBB
        - NFL
        - UFC / MMA
        - Tênis (ATP, WTA, Grand Slams)
        - Vôlei (Superliga, seleções)
        - Futsal (LNF, seleções)

        Fontes obrigatórias para consultar (em ordem de prioridade):
        1. cbf.com.br — agenda e transmissão oficial de Série A, B, C, D e Copa do Brasil
        2. ge.globo.com — seção "onde assistir" / "guia de jogos" (curadoria editorial, alta confiabilidade)
        3. mantosdofutebol.com.br/guia-de-jogos-tv-hoje-ao-vivo — guia diário consolidado de jogos na TV
        4. goal.com/br — programação completa de futebol na TV
        5. espn.com.br, ge.globo.com/tv-e-streaming
        6. sportv.globo.com, premiere.globo.com, tntsports.com.br (Champions League/HBO Max), primevideo.com
        7. band.uol.com.br
        8. grandepremio.com.br / motorsport.com (F1, Indy, MotoGP, Stock Car)
        9. ufc.com.br
        10. nba.com/brasil, nfl.com/brasil
        11. cbv.com.br, lnb.com.br
        12. uol.com.br/esporte — guia diário com programação de diversos esportes
        13. torcedores.com — notícias e guia de programação esportiva
        14. lance.com.br — guia "Onde Assistir" com agenda diária de jogos

        Canais/plataformas atuais a considerar (não se limite a essa lista, mas ela cobre os principais):
        - TV aberta: Globo, SBT, Record, Band, RedeTV!, Xsports, N Sports (FAST), TV Cultura
        - TV fechada: SporTV, Premiere, ESPN, TNT Sports, N Sports, XSports, Fox Sports
        - Streaming: Globoplay, GE TV, Amazon Prime Video, Disney+, HBO Max, Star+, DAZN, UOL Play, Zapping
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
          Champions League, Copa do Brasil, Europa League, Conference League, Copa Sulamericana) e os outros esportes já listados acima.

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
        - TV aberta: Globo, SBT, Record, Band, RedeTV!, Xsports, N Sports (FAST), TV Cultura
        - TV fechada: SporTV, Premiere, ESPN, TNT Sports, N Sports, XSports, Fox Sports
        - Streaming: Globoplay, GE TV, Amazon Prime Video, Disney+, HBO Max, Star+, DAZN, UOL Play, Zapping
        - YouTube/gratuito: CazéTV, GOAT BR, One Football, Sportynet, N Sports, Desimpedidos, canais oficiais

        Categorias válidas (use exatamente um destes valores em "categoria"):
        - Motor: F1, Indy, MotoGP, Stock Car
        - Quadras: NBA, NBB, Vôlei, Tênis, Futsal
        - Campo: NFL, Futebol
        - Combate: UFC, MMA, Boxe
        - Outros: demais esportes

        IMPORTANTE: Se você não encontrar eventos reais para hoje nas fontes pesquisadas, retorne um array vazio [].
        Não invente eventos, horários ou canais. Apenas retorne o que encontrar de fato.

        FORMATO DA RESPOSTA FINAL (muito importante):
        - Sua resposta final deve ser SOMENTE o array JSON, começando em "[" e terminando em "]".
        - NÃO inclua marcadores de citação/fonte (como [1], [2], [cbf.com.br]) nem qualquer texto,
          comentário ou explicação antes ou depois do array. Isso quebra a leitura automática do sistema.

        Agora, pesquise e retorne os eventos esportivos para HOJE (${dataAtual}).
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
