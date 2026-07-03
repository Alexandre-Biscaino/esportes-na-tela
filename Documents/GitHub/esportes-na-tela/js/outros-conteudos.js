// ========================================
// OUTROS CONTEÚDOS - Tabela de classificação, resultados, artilharia etc.
// ========================================
// Reaproveita `apiKey` e `GEMINI_MODEL`, já declarados em js/ia-buscar.js
// (scripts clássicos compartilham o mesmo escopo global da página).

const DESCRICOES_CONTEUDO = {
    tabela: {
        desc: 'Gera a tabela de classificação atualizada de um campeonato, com as faixas de classificação (Libertadores, Pré-Libertadores, Sul-Americana, acesso, playoffs, rebaixamento etc.) e a variação de posição de cada time.',
        labelCampo: 'Campeonato',
        placeholder: 'ex: Brasileirão Série A 2026'
    },
    resultados: {
        desc: 'Gera um resumo com os resultados dos jogos de ontem do campeonato escolhido. (em breve)',
        labelCampo: 'Campeonato',
        placeholder: 'ex: Brasileirão Série A 2026'
    },
    previa: {
        desc: 'Gera uma prévia com os confrontos da próxima rodada do campeonato (data, horário, mandante x visitante, local e canal quando já divulgado).',
        labelCampo: 'Campeonato',
        placeholder: 'ex: Brasileirão Série A 2026'
    },
    artilharia: {
        desc: 'Gera a lista dos maiores goleadores do campeonato. (em breve)',
        labelCampo: 'Campeonato',
        placeholder: 'ex: Brasileirão Série A 2026'
    },
    proximaRodada: {
        desc: 'Gera o próximo jogo de um time específico. (em breve)',
        labelCampo: 'Time',
        placeholder: 'ex: Flamengo'
    },
    ondeAssistir: {
        desc: 'Gera a lista de jogos disponíveis em uma plataforma/canal específico. (em breve)',
        labelCampo: 'Plataforma/Canal',
        placeholder: 'ex: SporTV'
    },
    curiosidade: {
        desc: 'Gera uma curiosidade ou fato histórico sobre o campeonato ou time informado. (em breve)',
        labelCampo: 'Campeonato ou time',
        placeholder: 'ex: Brasileirão ou Corinthians'
    },
    resumoSemanal: {
        desc: 'Gera um resumo dos principais acontecimentos da semana no campeonato. (em breve)',
        labelCampo: 'Campeonato',
        placeholder: 'ex: Brasileirão Série A 2026'
    },
    aniversario: {
        desc: 'Gera um post comemorativo de aniversário de um clube. (em breve)',
        labelCampo: 'Time',
        placeholder: 'ex: Palmeiras'
    }
};

// Atualiza a descrição/placeholder de acordo com o tipo de conteúdo escolhido
function atualizarTipoConteudo() {
    const tipo = document.getElementById('tipoConteudo').value;
    const info = DESCRICOES_CONTEUDO[tipo];
    if (!info) return;

    document.getElementById('descricaoConteudo').textContent = info.desc;
    document.getElementById('labelCampeonato').textContent = info.labelCampo;
    document.getElementById('campeonatoConteudo').placeholder = info.placeholder;
}

document.addEventListener('DOMContentLoaded', atualizarTipoConteudo);

// ========================================
// GERAÇÃO DE CONTEÚDO
// ========================================

// Tipos de conteúdo já implementados, cada um com seu prompt, validação e renderização
const HANDLERS_CONTEUDO = {
    tabela: {
        prompt: construirPromptTabela,
        validar: (d) => Array.isArray(d.times) && d.times.length > 0,
        renderizar: renderizarTabelaClassificacao,
        mensagemBusca: (v) => `🔄 Buscando tabela atualizada de ${v}...`,
        mensagemSucesso: (d, v) => `✅ Tabela de ${d.campeonato || v} gerada!`
    },
    previa: {
        prompt: construirPromptPrevia,
        validar: (d) => Array.isArray(d.jogos) && d.jogos.length > 0,
        renderizar: renderizarPreviaRodada,
        mensagemBusca: (v) => `🔄 Buscando a próxima rodada de ${v}...`,
        mensagemSucesso: (d, v) => `✅ Prévia da rodada de ${d.campeonato || v} gerada!`
    }
};

async function gerarOutroConteudo() {
    if (!apiKey) {
        mostrarToast('Configure sua chave da API Gemini primeiro (seção "Configuração IA").', 'error');
        return;
    }

    const tipo = document.getElementById('tipoConteudo').value;
    const valorCampo = document.getElementById('campeonatoConteudo').value.trim();
    const statusEl = document.getElementById('statusOutros');

    if (!valorCampo) {
        mostrarToast('Preencha o campo antes de gerar.', 'error');
        return;
    }

    const handler = HANDLERS_CONTEUDO[tipo];
    if (!handler) {
        statusEl.className = 'status-message error';
        statusEl.textContent = '🚧 Esse tipo de conteúdo ainda não está implementado nesta versão. "Tabela de Classificação" e "Prévia da Rodada" já estão disponíveis — os demais podem ser adicionados sob demanda.';
        return;
    }

    statusEl.className = 'status-message loading';
    statusEl.textContent = handler.mensagemBusca(valorCampo);

    try {
        let dados = null;
        let fonteAPI = false;

        // Para Tabela de Classificação, se for Série A/B/C/D do Brasileirão e a
        // API dedicada estiver configurada, tenta ela primeiro (mais confiável
        // que pedir pra IA "lembrar" números). Se não bater, cai para IA.
        if (tipo === 'tabela' && apiDadosUrl) {
            const serie = detectarSerieBrasileirao(valorCampo);
            if (serie) {
                dados = await buscarTabelaAPI(serie);
                if (dados) fonteAPI = true;
            }
        }

        if (!dados) {
            const prompt = handler.prompt(valorCampo);
            const texto = await chamarGeminiConteudo(prompt);
            dados = extrairObjetoDoTexto(texto);
        }

        if (!dados || !handler.validar(dados)) {
            statusEl.className = 'status-message error';
            statusEl.textContent = '⚠️ Não consegui obter o conteúdo. Confira o nome digitado ou veja o console (F12) para depurar a resposta da IA.';
            return;
        }

        handler.renderizar(dados, valorCampo);

        const wrapper = document.getElementById('outrosConteudoWrapper');
        wrapper.style.display = 'block';
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

        statusEl.className = 'status-message success';
        statusEl.textContent = handler.mensagemSucesso(dados, valorCampo) + (fonteAPI ? ' (fonte: API dedicada ⚡)' : '');
    } catch (error) {
        console.error('Erro ao gerar conteúdo:', error);
        statusEl.className = 'status-message error';
        statusEl.textContent = `❌ Erro: ${error.message || 'Falha ao gerar conteúdo'}`;
    }
}

// Prompt para buscar a tabela de classificação real e atual do campeonato.
// A "zona" de cada time é definida pela própria IA (com base em busca das
// regras vigentes), em vez de fixarmos no código um número de vagas que
// pode mudar de temporada para temporada.
function construirPromptTabela(campeonato) {
    return `
        Você é um assistente especializado em estatísticas de futebol brasileiro.
        Use a ferramenta de busca do Google para consultar a tabela de classificação ATUAL e OFICIAL
        do campeonato "${campeonato}". Não responda de memória — busque o dado real e atualizado.

        Fontes preferenciais: cbf.com.br, ge.globo.com, sofascore.com, ogol.com.br.

        Para cada time da tabela, retorne:
        - posicao (número da posição atual)
        - time (nome do clube, de forma curta e reconhecível, ex: "Palmeiras", "Athletico-PR")
        - pontos, jogos, vitorias, empates, derrotas
        - golsPro, golsContra, saldoGols
        - aproveitamento (percentual de aproveitamento de pontos, número inteiro, sem o símbolo %)
        - variacao: "subiu", "caiu" ou "manteve", comparado à posição da rodada anterior
        - zona: pesquise as regras ATUAIS e OFICIAIS de acesso/classificação/rebaixamento dessa competição
          (elas mudam de temporada para temporada, não assuma um número fixo de vagas) e classifique o time
          usando exatamente um destes valores:
          "libertadores" | "pre-libertadores" | "sul-americana" | "acesso" | "playoff" | "rebaixamento" | ""
          (use "" quando o time não estiver em nenhuma faixa de destaque)

        Retorne também "legenda": um array com { "zona": "...", "rotulo": "texto explicando a faixa" },
        cobrindo SOMENTE as zonas que de fato aparecem entre os times retornados. Exemplos de rótulo:
        "Libertadores", "Pré-Libertadores", "Sul-Americana", "Rebaixados", "Acesso à Série A",
        "Playoffs de acesso", "Rebaixados à Série C" — adapte o texto à divisão pesquisada.

        Retorne APENAS um JSON (sem markdown, sem texto antes ou depois) neste formato:
        {
            "campeonato": "${campeonato}",
            "atualizadoEm": "rodada X" ou a data considerada,
            "legenda": [{ "zona": "libertadores", "rotulo": "Libertadores" }],
            "times": [
                {
                    "posicao": 1, "time": "Palmeiras", "pontos": 41, "jogos": 18, "vitorias": 12,
                    "empates": 5, "derrotas": 1, "golsPro": 30, "golsContra": 13, "saldoGols": 17,
                    "aproveitamento": 75, "variacao": "manteve", "zona": "libertadores"
                }
            ]
        }

        Retorne a tabela completa, com todos os times da competição.
    `;
}

// Prompt para buscar os confrontos da PRÓXIMA rodada (ainda não disputada)
// de um campeonato — usado pelo tipo "Prévia da Rodada".
function construirPromptPrevia(campeonato) {
    return `
        Você é um assistente especializado em futebol brasileiro.
        Use a ferramenta de busca do Google para encontrar os jogos da PRÓXIMA rodada (ainda não disputada,
        a que vem pela frente) do campeonato "${campeonato}". Não responda de memória — busque o dado real.

        Fontes preferenciais: cbf.com.br, ge.globo.com, mantosdofutebol.com.br, goal.com/br.

        Para cada confronto retorne:
        - data (formato "dd/mm")
        - diaSemana (ex: "Sábado")
        - hora (horário de Brasília, ex: "16h00" — se ainda não confirmado, use "A definir")
        - mandante, visitante (nomes curtos e reconhecíveis)
        - local (nome do estádio, deixe "" se não encontrar)
        - canal (se já divulgado; caso contrário "A confirmar")

        Retorne APENAS um JSON (sem markdown, sem texto antes ou depois) neste formato:
        {
            "campeonato": "${campeonato}",
            "rodada": "identificação da rodada/fase, ex: Rodada 21",
            "jogos": [
                {
                    "data": "05/07", "diaSemana": "Sábado", "hora": "16h00",
                    "mandante": "Palmeiras", "visitante": "Corinthians",
                    "local": "Allianz Parque", "canal": "Globo"
                }
            ]
        }

        Retorne todos os confrontos da rodada completa, em ordem cronológica.
    `;
}

// Chamada genérica ao Gemini com grounding, reaproveitada por todos os
// tipos de "Outros Conteúdos" (retorna o texto bruto, sem parsear).
async function chamarGeminiConteudo(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: {
                temperature: 0.1,
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

    console.log('[Outros Conteúdos] Resposta bruta do Gemini:', texto);
    return texto;
}

// ========================================
// PARSING DE OBJETO JSON (equivalente ao extrator de array do ia-buscar.js,
// mas para respostas cujo formato principal é um objeto { ... })
// ========================================

function extrairObjetoBalanceado(texto, inicio) {
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
        if (c === '{') profundidade++;
        else if (c === '}') {
            profundidade--;
            if (profundidade === 0) return texto.slice(inicio, i + 1);
        }
    }
    return null;
}

function extrairObjetoDoTexto(texto) {
    const limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
        const parsed = JSON.parse(limpo);
        if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.times) || Array.isArray(parsed.jogos))) return parsed;
    } catch (e) {
        // segue para a varredura manual
    }

    for (let i = 0; i < limpo.length; i++) {
        if (limpo[i] !== '{') continue;
        const candidato = extrairObjetoBalanceado(limpo, i);
        if (!candidato) continue;

        try {
            const parsed = JSON.parse(candidato);
            if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.times) || Array.isArray(parsed.jogos))) return parsed;
        } catch (e) {
            // não era o objeto certo, tenta a próxima ocorrência de "{"
        }
    }

    return null;
}

// ========================================
// RENDERIZAÇÃO DA TABELA
// ========================================

const ZONA_INFO = {
    'libertadores': { cor: '#3b82f6', rotuloPadrao: 'Libertadores' },
    'pre-libertadores': { cor: '#22d3ee', rotuloPadrao: 'Pré-Libertadores' },
    'sul-americana': { cor: '#22c55e', rotuloPadrao: 'Sul-Americana' },
    'acesso': { cor: '#3b82f6', rotuloPadrao: 'Acesso' },
    'playoff': { cor: '#22d3ee', rotuloPadrao: 'Playoff de acesso' },
    'rebaixamento': { cor: '#ef4444', rotuloPadrao: 'Rebaixados' }
};

const VARIACAO_INFO = {
    subiu: { icone: '▲', cor: '#22c55e' },
    caiu: { icone: '▼', cor: '#ef4444' },
    manteve: { icone: '▪', cor: '#6b7280' }
};

function renderizarTabelaClassificacao(dados, valorCampoOriginal) {
    const container = document.getElementById('outrosConteudoContainer');
    const legenda = Array.isArray(dados.legenda) ? dados.legenda : [];

    const linhasHtml = dados.times.map(t => {
        const zonaInfo = ZONA_INFO[t.zona] || null;
        const corPos = zonaInfo ? zonaInfo.cor : '#e5e7eb';
        const variacao = VARIACAO_INFO[t.variacao] || VARIACAO_INFO.manteve;

        return `
            <div class="tabela-row">
                <div class="tabela-col-pos">
                    <span class="tabela-pos" style="color:${corPos};">${escapeHTML(t.posicao)}</span>
                    <span class="tabela-variacao" style="color:${variacao.cor};">${variacao.icone}</span>
                </div>
                <div class="tabela-col-time">${escapeHTML(t.time)}</div>
                <div class="tabela-col-stat tabela-pontos">${escapeHTML(t.pontos)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.jogos)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.vitorias)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.empates)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.derrotas)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.golsPro)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.golsContra)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.saldoGols)}</div>
                <div class="tabela-col-stat">${escapeHTML(t.aproveitamento)}%</div>
            </div>
        `;
    }).join('');

    const legendaZonasHtml = legenda.map(l => {
        const info = ZONA_INFO[l.zona];
        const cor = info ? info.cor : '#9ca3af';
        const rotulo = l.rotulo || (info ? info.rotuloPadrao : l.zona);
        return `<span class="tabela-legenda-item"><span class="tabela-legenda-dot" style="background:${cor};"></span>${escapeHTML(rotulo)}</span>`;
    }).join('');

    const legendaVariacaoHtml = `
        <span class="tabela-legenda-item"><span class="tabela-legenda-seta" style="color:#22c55e;">▲</span>subiu</span>
        <span class="tabela-legenda-item"><span class="tabela-legenda-seta" style="color:#ef4444;">▼</span>caiu</span>
        <span class="tabela-legenda-item"><span class="tabela-legenda-seta" style="color:#6b7280;">▪</span>manteve</span>
    `;

    container.innerHTML = `
        <div class="tabela-card" id="conteudoCardExport">
            <div class="tabela-titulo">TABELA</div>
            <div class="tabela-subtitulo">${escapeHTML(dados.campeonato || valorCampoOriginal)}${dados.atualizadoEm ? ' • ' + escapeHTML(dados.atualizadoEm) : ''}</div>

            <div class="tabela-header-row">
                <div class="tabela-col-pos">CLASSIFICAÇÃO</div>
                <div class="tabela-col-time"></div>
                <div class="tabela-col-stat">P</div>
                <div class="tabela-col-stat">J</div>
                <div class="tabela-col-stat">V</div>
                <div class="tabela-col-stat">E</div>
                <div class="tabela-col-stat">D</div>
                <div class="tabela-col-stat">GP</div>
                <div class="tabela-col-stat">GC</div>
                <div class="tabela-col-stat">SG</div>
                <div class="tabela-col-stat">%</div>
            </div>

            <div class="tabela-body">${linhasHtml}</div>

            <div class="tabela-legenda">${legendaZonasHtml}${legendaVariacaoHtml}</div>
        </div>
    `;
}

// ========================================
// RENDERIZAÇÃO DA PRÉVIA DA RODADA
// ========================================

function renderizarPreviaRodada(dados, valorCampoOriginal) {
    const container = document.getElementById('outrosConteudoContainer');

    const jogosHtml = dados.jogos.map(j => `
        <div class="previa-jogo">
            <div class="previa-data">
                <span>${escapeHTML(j.diaSemana || '')}</span>
                <span>${escapeHTML(j.data || '')}</span>
                <span class="previa-hora">${escapeHTML(j.hora || 'A definir')}</span>
            </div>
            <div class="previa-confronto">
                <span>${escapeHTML(j.mandante || '')}</span>
                <span class="previa-x">x</span>
                <span>${escapeHTML(j.visitante || '')}</span>
            </div>
            <div class="previa-info">
                ${j.local ? `<span class="previa-local">📍 ${escapeHTML(j.local)}</span>` : '<span></span>'}
                <span class="previa-canal-badge">${escapeHTML(j.canal || 'A confirmar')}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="previa-card" id="conteudoCardExport">
            <div class="previa-titulo">🔥 PRÉVIA DA RODADA</div>
            <div class="previa-subtitulo">${escapeHTML(dados.campeonato || valorCampoOriginal)}${dados.rodada ? ' • ' + escapeHTML(dados.rodada) : ''}</div>
            <div class="previa-lista">${jogosHtml}</div>
        </div>
    `;
}

// ========================================
// DOWNLOAD DA TABELA
// ========================================

async function baixarOutroConteudo() {
    const el = document.getElementById('conteudoCardExport');
    if (!el) {
        mostrarToast('Gere um conteúdo antes de baixar.', 'error');
        return;
    }

    mostrarToast('🔄 Gerando imagem...', 'info');

    try {
        const canvas = await html2canvas(el, {
            scale: 2.5,
            backgroundColor: '#0d0d0d',
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const link = document.createElement('a');
        link.download = `conteudo-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        mostrarToast('✅ Imagem baixada com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao baixar tabela:', error);
        mostrarToast('❌ Erro ao gerar imagem. Tente novamente.', 'error');
    }
}
