// ========================================
// CARDS RENDERER - Renderização Premium
// ========================================

// Lê quais categorias estão marcadas no filtro acima dos cards
function categoriasSelecionadas() {
    const checkboxes = document.querySelectorAll('.filtro-categoria-item:checked');
    return new Set(Array.from(checkboxes).map(cb => cb.value));
}

function secaoEstaSelecionada(secao) {
    const selecionadas = categoriasSelecionadas();
    if (secao.tipo === 'destaque') return selecionadas.has('destaque');
    return selecionadas.has(secao.categoria);
}

// Marca/desmarca todas as categorias de uma vez (checkbox "Todos")
function alternarTodasCategorias(marcar) {
    document.querySelectorAll('.filtro-categoria-item').forEach(cb => { cb.checked = marcar; });
    gerarCards();
}

function gerarCards() {
    const container = document.getElementById('cardsContainer');
    const creditos = document.getElementById('creditosInput').value || '@esportesnatela';

    const eventos = jogosFiltrados();

    if (eventos.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 16px;">📺</div>
                <h3 style="font-family: var(--font-display); font-size: 20px;">Nenhum evento encontrado</h3>
                <p style="font-size: 14px;">Adicione eventos manualmente ou busque com IA para começar.</p>
            </div>
        `;
        gerarTextos();
        return;
    }

    const secoes = organizarEmSecoes(eventos).filter(secaoEstaSelecionada);

    if (secoes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 16px;">🗂️</div>
                <h3 style="font-family: var(--font-display); font-size: 20px;">Nenhuma categoria selecionada</h3>
                <p style="font-size: 14px;">Marque pelo menos uma categoria acima para gerar os cards.</p>
            </div>
        `;
        gerarTextos();
        return;
    }

    let html = '';

    for (const secao of secoes) {
        const temaClasse = secao.tipo === 'destaque' ? 'card-destaque' : `card-${getTemaCategoria(secao.categoria)}`;
        const tituloExibido = secao.tipo === 'destaque'
            ? `${secao.icone} ${escapeHTML(secao.titulo.toUpperCase())}`
            : `${secao.icone} ${escapeHTML(secao.titulo)}`;
        const classeTitulo = secao.titulo.length > 18 ? 'card-title titulo-compacto' : 'card-title';
        const legendaIcones = montarLegendaIcones(secao.eventos);
        const legendaHtml = legendaIcones.length > 0
            ? `
                <div class="card-legenda-esportes">
                    ${legendaIcones.map(item => `<span class="legenda-esporte-item"><span class="legenda-esporte-icone">${item.icone}</span>${escapeHTML(item.nome)}</span>`).join('')}
                </div>
            `
            : '';

        html += `
            <div class="card-esportivo ${temaClasse}" style="border-left: 4px solid ${secao.cor};">
                <!-- CABEÇALHO: Ícone + Categoria + Data -->
                <div class="card-header">
                    <span class="card-badge">${secao.badgeIcone} ${escapeHTML(secao.titulo.toUpperCase())}</span>
                    <span class="card-date">${secao.dataFormatada || formatarDataAtual()}${ehDataFutura(secao.data) ? ' <span class="card-date-badge">AMANHÃ</span>' : ''}</span>
                </div>

                <!-- TÍTULO PRINCIPAL -->
                <div class="${classeTitulo}">${tituloExibido}</div>

                <!-- LISTA DE EVENTOS -->
                <div class="card-events">
                    ${secao.eventos.map((evento) => montarLinhaEvento(evento, secao.icone)).join('')}
                </div>

                <!-- LEGENDA DOS ÍCONES: o que cada ícone de esporte significa -->
                ${legendaHtml}

                <!-- RODAPÉ -->
                <div class="card-footer">
                    <span class="credit">${escapeHTML(creditos)} • Horários de Brasília</span>
                </div>

                <!-- DISCLAIMER (aviso) -->
                <div class="card-disclaimer">
                    ⚠️ Aviso: Horários e canais de transmissão podem ser alterados pelas emissoras ou organizadores sem aviso prévio. Não nos responsabilizamos por mudanças de última hora.
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Adicionar botões de download individual (card normal + formato Stories)
    document.querySelectorAll('.card-esportivo').forEach((card) => {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-download-card';
        downloadBtn.innerHTML = '📥';
        downloadBtn.title = 'Baixar este card (PNG)';
        downloadBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0,0,0,0.6);
            border: none;
            color: white;
            padding: 6px 10px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10;
        `;

        const storyBtn = document.createElement('button');
        storyBtn.className = 'btn-download-story';
        storyBtn.innerHTML = '📱';
        storyBtn.title = 'Baixar como Stories (9:16)';
        storyBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 46px;
            background: rgba(0,0,0,0.6);
            border: none;
            color: white;
            padding: 6px 10px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10;
        `;

        card.addEventListener('mouseenter', () => {
            downloadBtn.style.opacity = '1';
            storyBtn.style.opacity = '1';
        });
        card.addEventListener('mouseleave', () => {
            downloadBtn.style.opacity = '0';
            storyBtn.style.opacity = '0';
        });

        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            baixarCardUnico(card);
        });

        storyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            baixarCardComoStory(card);
        });

        card.style.position = 'relative';
        card.appendChild(downloadBtn);
        card.appendChild(storyBtn);
    });

    gerarTextos();

    if (typeof carregarEscudosVisiveis === 'function') {
        carregarEscudosVisiveis();
    }
}

// Monta a linha de um evento dentro do card. Padrão único para todos os
// esportes: hora + nome do evento em cima, canal de transmissão sempre
// embaixo (largura total) — evita a inconsistência de um card mostrar o
// canal do lado e outro embaixo dependendo do tamanho do texto.
// O nome do evento leva um ícone do esporte específico (ex: 🎾 pra tênis,
// 🏐 pra vôlei) mesmo dentro de um card de categoria mais ampla como
// "Quadras", que reúne vários esportes diferentes sob o mesmo ícone genérico.
function montarLinhaEvento(evento, iconeCategoriaPadrao) {
    const canal = evento.canal || 'A confirmar';
    const hora = escapeHTML(evento.hora || '--:--');
    const nome = escapeHTML(evento.evento || '');
    const canalEsc = escapeHTML(canal);
    const iconeEvento = iconePorPrioridade(evento, iconeCategoriaPadrao || '');

    return `
        <div class="event-line">
            <div class="event-line-top">
                <span class="event-time">${hora}</span>
                <span class="event-name" data-evento-nome="${nome}" data-evento-icone="${iconeEvento}">${iconeEvento ? `<span class="event-icone">${iconeEvento}</span>` : ''}${nome}</span>
            </div>
            <span class="event-channel-badge">${canalEsc}</span>
        </div>
    `;
}
