// ========================================
// ESPORTES NA TELA - API de dados do Brasileirão
// ========================================
// Cloudflare Worker que expõe tabela, rodada e escudos das Séries A/B/C/D
// do Campeonato Brasileiro, usando o pacote gratuito e open-source
// "campeonato-brasileiro-api" como fonte — sem depender de IA para números.
//
// Rotas:
//   GET /tabela?serie=a        -> tabela de classificação (a, b, c ou d)
//   GET /rodada?serie=a        -> jogos da rodada atual
//   GET /escudo?time=Flamengo  -> procura o escudo do time nas 4 séries
//   GET /series                -> lista as séries disponíveis no pacote

import { getStandings, getRounds, listSeries } from 'campeonato-brasileiro-api';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function jsonResponse(dados, status = 200) {
    return new Response(JSON.stringify(dados), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=120',
            ...CORS_HEADERS
        }
    });
}

function erroResponse(mensagem, status = 400) {
    return jsonResponse({ erro: mensagem }, status);
}

const SERIES_VALIDAS = ['a', 'b', 'c', 'd'];

// O pacote "campeonato-brasileiro-api" tem um campo de escudo, mas o nome
// exato pode variar entre versões (badge/crest/logo/shield/escudo). Em vez
// de arriscar um nome errado, testamos vários e devolvemos o primeiro que
// existir — junto com o objeto "team" completo, cru, como reserva.
function extrairEscudo(team) {
    if (!team || typeof team !== 'object') return null;
    return team.badge || team.crest || team.logo || team.shield || team.escudo || null;
}

export default {
    async fetch(request) {
        const url = new URL(request.url);

        // Requisição de "preflight" do navegador (necessária pro CORS funcionar)
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        try {
            if (url.pathname === '/series') {
                return jsonResponse(listSeries());
            }

            if (url.pathname === '/tabela') {
                const serie = (url.searchParams.get('serie') || 'a').toLowerCase();
                if (!SERIES_VALIDAS.includes(serie)) {
                    return erroResponse('Parâmetro "serie" deve ser a, b, c ou d.');
                }
                const grupo = url.searchParams.get('grupo') || undefined;
                const dados = await getStandings(serie, grupo ? { group: grupo } : undefined);

                // Adiciona um campo "escudo" já normalizado em cada time, sem
                // remover os campos originais do pacote (que ficam como reserva).
                for (const tabela of dados.tables || []) {
                    for (const entrada of tabela.entries || []) {
                        if (entrada.team) {
                            entrada.team.escudo = extrairEscudo(entrada.team);
                        }
                    }
                }

                return jsonResponse(dados);
            }

            if (url.pathname === '/rodada') {
                const serie = (url.searchParams.get('serie') || 'a').toLowerCase();
                if (!SERIES_VALIDAS.includes(serie)) {
                    return erroResponse('Parâmetro "serie" deve ser a, b, c ou d.');
                }
                const grupo = url.searchParams.get('grupo') || undefined;
                const dados = await getRounds(serie, grupo ? { group: grupo } : undefined);
                return jsonResponse(dados);
            }

            if (url.pathname === '/escudo') {
                const nomeTime = (url.searchParams.get('time') || '').trim().toLowerCase();
                if (!nomeTime) {
                    return erroResponse('Informe o parâmetro "time", ex: /escudo?time=Flamengo');
                }

                // Busca nas 4 séries em paralelo (mais rápido que uma de cada vez)
                const resultados = await Promise.allSettled(
                    SERIES_VALIDAS.map((serie) => getStandings(serie))
                );

                for (let i = 0; i < resultados.length; i++) {
                    const resultado = resultados[i];
                    if (resultado.status !== 'fulfilled') continue;

                    const tabelas = resultado.value.tables || [];
                    for (const tabela of tabelas) {
                        for (const entrada of tabela.entries || []) {
                            const nomeEntrada = (entrada.team?.name || '').toLowerCase();
                            if (
                                nomeEntrada === nomeTime ||
                                nomeEntrada.includes(nomeTime) ||
                                nomeTime.includes(nomeEntrada)
                            ) {
                                return jsonResponse({
                                    time: entrada.team.name,
                                    escudo: extrairEscudo(entrada.team),
                                    serie: SERIES_VALIDAS[i]
                                });
                            }
                        }
                    }
                }

                return jsonResponse({ time: nomeTime, escudo: null });
            }

            return erroResponse(
                'Rota não encontrada. Use /tabela, /rodada, /escudo ou /series.',
                404
            );
        } catch (error) {
            return erroResponse(`Erro ao buscar dados: ${error.message || error}`, 502);
        }
    }
};
