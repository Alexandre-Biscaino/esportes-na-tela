// ========================================
// TEXTOS GERADOR - Textos para Redes Sociais
// ========================================

let textoAtual = '';

// Gerar textos para todas as redes
function gerarTextos() {
    const eventos = jogosFiltrados();
    const creditos = document.getElementById('creditosInput').value || '@esportesnatela';

    if (eventos.length === 0) {
        document.getElementById('textoContainer').textContent = 'Adicione eventos para gerar textos.';
        return;
    }

    const secoes = organizarEmSecoes(eventos);
    const datasDistintas = [...new Set(secoes.map(s => s.data))].filter(Boolean).sort();
    const dataAtual = datasDistintas.length > 1
        ? 'Hoje e amanhã'
        : (secoes[0]?.dataFormatada || formatarDataAtual());

    const textos = {
        whatsapp: gerarTextoWhatsApp(secoes, dataAtual, creditos),
        twitter: gerarTextoTwitter(secoes, dataAtual, creditos),
        instagram: gerarTextoInstagram(secoes, dataAtual, creditos),
        facebook: gerarTextoFacebook(secoes, dataAtual, creditos),
        bluesky: gerarTextoBluesky(secoes, dataAtual, creditos),
        threads: gerarTextoThreads(secoes, dataAtual, creditos)
    };

    window.textosGerados = textos;

    const tabAtiva = document.querySelector('.tab-btn.active');
    if (tabAtiva) {
        mostrarTexto(tabAtiva.dataset.tab);
    }
}

// Mostrar texto de uma rede específica
function mostrarTexto(rede) {
    const container = document.getElementById('textoContainer');
    const textos = window.textosGerados || {};
    const texto = textos[rede] || 'Texto não disponível.';
    textoAtual = texto;
    container.textContent = texto;
}

// Alternar abas de texto
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            mostrarTexto(this.dataset.tab);
        });
    });
});

// Copiar texto
function copiarTexto() {
    if (!textoAtual) {
        mostrarToast('Nenhum texto para copiar.', 'error');
        return;
    }

    navigator.clipboard.writeText(textoAtual).then(() => {
        mostrarToast('📋 Texto copiado para a área de transferência!', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = textoAtual;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        mostrarToast('📋 Texto copiado!', 'success');
    });
}

// ========================================
// GERADORES DE TEXTO POR REDE SOCIAL
// ========================================

// Monta o corpo comum (lista de seções/eventos) reaproveitado por todas as redes.
// Quando a busca cobre mais de um dia (hoje + amanhã), insere um subtítulo de
// data toda vez que a seção muda de dia — as seções já vêm ordenadas por data.
function construirCorpoTexto(secoes, negrito) {
    let corpo = '';
    let dataAnterior = null;

    for (const secao of secoes) {
        if (secao.data && secao.data !== dataAnterior) {
            const rotulo = ehDataFutura(secao.data) ? `${secao.dataFormatada} (AMANHÃ)` : secao.dataFormatada;
            corpo += negrito ? `\n*📅 ${rotulo}*\n\n` : `\n📅 ${rotulo}\n\n`;
            dataAnterior = secao.data;
        }

        const tituloSecao = secao.tipo === 'destaque'
            ? `${secao.icone} ${secao.titulo.toUpperCase()}`
            : `${secao.icone} ${secao.titulo}`;

        corpo += negrito ? `*${tituloSecao}*\n` : `${tituloSecao}:\n`;
        for (const evento of secao.eventos) {
            corpo += `${negrito ? '•' : ' '} ${evento.hora || '--:--'} - ${evento.evento}\n`;
            corpo += `  📺 ${evento.canal}\n`;
        }
        corpo += '\n';
    }
    return corpo;
}

// Corta o texto respeitando "caracteres visuais" (Array.from lida melhor
// com emojis do que texto.length, que conta unidades UTF-16)
function cortarTexto(texto, limite) {
    const chars = Array.from(texto);
    if (chars.length <= limite) return texto;
    return chars.slice(0, Math.max(0, limite - 20)).join('') + '... #EsportesNaTela';
}

function gerarTextoWhatsApp(secoes, data, creditos) {
    let texto = `📺 *PROGRAMAÇÃO ESPORTIVA* 📺\n\n`;
    texto += `*${data}*\n\n`;
    texto += construirCorpoTexto(secoes, true);
    texto += `---\n📱 *Siga: ${creditos}*\n`;
    texto += `⚠️ Horários e canais sujeitos a alterações.`;
    return texto;
}

function gerarTextoTwitter(secoes, data, creditos) {
    let texto = `📺 PROGRAMAÇÃO ESPORTIVA - ${data}\n\n`;
    texto += construirCorpoTexto(secoes, false);
    texto += `📱 ${creditos}\n`;
    texto += `#EsportesNaTela #ProgramaçãoEsportiva #Esportes #TV`;
    return cortarTexto(texto, 280);
}

function gerarTextoInstagram(secoes, data, creditos) {
    let texto = `📺 PROGRAMAÇÃO ESPORTIVA DE HOJE\n`;
    texto += `${data}\n\n`;
    texto += construirCorpoTexto(secoes, false);
    texto += `---\n📱 Siga: ${creditos}\n`;
    texto += `\n#EsportesNaTela #ProgramaçãoEsportiva #Esportes #TV #Futebol #NBA #F1 #UFC`;
    return texto;
}

function gerarTextoFacebook(secoes, data, creditos) {
    let texto = `📺 PROGRAMAÇÃO ESPORTIVA - ${data}\n\n`;
    texto += `Confira os principais eventos esportivos de hoje:\n\n`;
    texto += construirCorpoTexto(secoes, false);
    texto += `📱 Acompanhe mais em: ${creditos}\n`;
    texto += `⚠️ Horários e canais podem ser alterados.`;
    return texto;
}

function gerarTextoBluesky(secoes, data, creditos) {
    let texto = `📺 PROGRAMAÇÃO ESPORTIVA - ${data}\n\n`;
    texto += construirCorpoTexto(secoes, false);
    texto += `📱 ${creditos}\n`;
    texto += `#EsportesNaTela #ProgramaçãoEsportiva`;
    return cortarTexto(texto, 300);
}

function gerarTextoThreads(secoes, data, creditos) {
    let texto = `📺 PROGRAMAÇÃO ESPORTIVA - ${data}\n\n`;
    texto += construirCorpoTexto(secoes, false);
    texto += `📱 ${creditos}\n`;
    texto += `#EsportesNaTela #ProgramaçãoEsportiva`;
    return cortarTexto(texto, 500);
}
