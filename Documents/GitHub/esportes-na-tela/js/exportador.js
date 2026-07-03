// ========================================
// EXPORTADOR - Exportação de Imagens
// ========================================

// Baixar um card específico
async function baixarCardUnico(elemento, creditos) {
    if (!elemento) return;
    
    mostrarToast('🔄 Gerando imagem...', 'info');
    
    try {
        // Clonar o card para não afetar a exibição
        const clone = elemento.cloneNode(true);
        clone.style.transform = 'scale(1)';
        clone.style.position = 'relative';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        
        // Remover os dois botões de download (card normal + stories) — antes só
        // o de card normal era removido, e o de stories (📱) ficava "vazando"
        // na imagem quando o mouse estava sobre o card no momento do clique.
        const btnDownloadClone = clone.querySelector('.btn-download-card');
        if (btnDownloadClone) btnDownloadClone.remove();
        const btnStoryClone = clone.querySelector('.btn-download-story');
        if (btnStoryClone) btnStoryClone.remove();
        
        // Criar container para renderização
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '340px';
        container.style.background = 'transparent';
        container.appendChild(clone);
        document.body.appendChild(container);
        
        // Renderizar com html2canvas
        const canvas = await html2canvas(clone, {
            scale: 2.5,
            backgroundColor: null,
            allowTaint: true,
            useCORS: true,
            logging: false,
            width: 340,
            height: clone.scrollHeight,
            onclone: (doc) => {
                // Garantir que estilos sejam aplicados
            }
        });
        
        // Remover container
        document.body.removeChild(container);
        
        // Baixar imagem
        const link = document.createElement('a');
        link.download = `card-esportes-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        mostrarToast('✅ Card baixado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao baixar card:', error);
        mostrarToast('❌ Erro ao gerar imagem. Tente novamente.', 'error');
    }
}

// Baixar o primeiro card (função legado)
function baixarCard() {
    const primeiroCard = document.querySelector('.card-esportivo');
    if (primeiroCard) {
        baixarCardUnico(primeiroCard);
    } else {
        mostrarToast('Nenhum card para baixar.', 'error');
    }
}

// Baixar todos os cards em uma única imagem
async function baixarTodosCards() {
    const cards = document.querySelectorAll('.card-esportivo');
    if (cards.length === 0) {
        mostrarToast('Nenhum card para baixar.', 'error');
        return;
    }
    
    mostrarToast(`🔄 Gerando ${cards.length} cards...`, 'info');
    
    try {
        // Criar um container com todos os cards
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '-9999px';
        wrapper.style.background = 'transparent';
        wrapper.style.display = 'flex';
        wrapper.style.flexWrap = 'wrap';
        wrapper.style.gap = '20px';
        wrapper.style.padding = '20px';
        wrapper.style.maxWidth = '1100px';
        wrapper.style.justifyContent = 'center';
        
        // Clonar cada card
        for (const card of cards) {
            const clone = card.cloneNode(true);
            // Remover os dois botões de download (card normal + stories)
            const btnDownloadClone = clone.querySelector('.btn-download-card');
            if (btnDownloadClone) btnDownloadClone.remove();
            const btnStoryClone = clone.querySelector('.btn-download-story');
            if (btnStoryClone) btnStoryClone.remove();
            clone.style.transform = 'scale(1)';
            clone.style.margin = '0';
            clone.style.boxShadow = 'none';
            wrapper.appendChild(clone);
        }
        
        document.body.appendChild(wrapper);
        
        // Usa a cor de fundo do tema atual (escuro ou claro) em vez de fixa,
        // para o PNG combinar com o tema escolhido pelo usuário
        const corFundo = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-primary').trim() || '#0a0a0f';
        
        // Renderizar tudo junto
        const canvas = await html2canvas(wrapper, {
            scale: 2.5,
            backgroundColor: corFundo,
            allowTaint: true,
            useCORS: true,
            logging: false,
            onclone: (doc) => {
                // Aplicar estilos
            }
        });
        
        document.body.removeChild(wrapper);
        
        // Baixar imagem
        const link = document.createElement('a');
        link.download = `cards-esportes-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        mostrarToast(`✅ ${cards.length} cards baixados com sucesso!`, 'success');
    } catch (error) {
        console.error('Erro ao baixar cards:', error);
        mostrarToast('❌ Erro ao gerar imagem. Tente novamente.', 'error');
    }
}

// Função para baixar card individual via botão na interface
function baixarCardUnicoById(cardId) {
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (card) {
        baixarCardUnico(card);
    }
}

// ========================================
// FORMATO STORIES (9:16) - Instagram/WhatsApp Status
// ========================================

// Baixa o card centralizado numa moldura vertical 1080x1920, pronta pra
// Stories/Status. Funciona pra qualquer card (categoria ou destaque).
//
// Importante: a primeira versão usava CSS "transform: scale()" pra ampliar o
// card dentro da moldura, mas o html2canvas tem um bug conhecido de não
// calcular direito os limites de elementos com transform + flexbox, cortando
// as bordas do card. A abordagem abaixo evita isso: primeiro captura o card
// em tamanho normal (sem nenhum transform), depois desenha essa imagem já
// pronta dentro de um canvas 9:16 usando a API nativa do Canvas (drawImage),
// que sempre escala corretamente, sem cortes.
async function baixarCardComoStory(elemento) {
    if (!elemento) return;

    mostrarToast('🔄 Gerando Stories...', 'info');

    try {
        const clone = elemento.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.position = 'relative';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';

        const btnDownload = clone.querySelector('.btn-download-card');
        if (btnDownload) btnDownload.remove();
        const btnStory = clone.querySelector('.btn-download-story');
        if (btnStory) btnStory.remove();

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '340px';
        container.style.background = 'transparent';
        container.appendChild(clone);
        document.body.appendChild(container);

        // Passo 1: captura o card em tamanho normal, em alta resolução
        const canvasCard = await html2canvas(clone, {
            scale: 2.5,
            backgroundColor: null,
            allowTaint: true,
            useCORS: true,
            logging: false,
            width: 340,
            height: clone.scrollHeight
        });

        document.body.removeChild(container);

        // Passo 2: monta o quadro final 1080x1920 (9:16) e desenha o card
        // centralizado dentro dele, com o maior tamanho que couber
        const corFundo = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-primary').trim() || '#0a0a0f';

        const LARGURA_FINAL = 1080;
        const ALTURA_FINAL = 1920;
        const MARGEM = 90; // respiro em volta do card dentro do Stories

        const canvasFinal = document.createElement('canvas');
        canvasFinal.width = LARGURA_FINAL;
        canvasFinal.height = ALTURA_FINAL;
        const ctx = canvasFinal.getContext('2d');

        ctx.fillStyle = corFundo || '#0a0a0f';
        ctx.fillRect(0, 0, LARGURA_FINAL, ALTURA_FINAL);

        const escala = Math.min(
            (LARGURA_FINAL - MARGEM * 2) / canvasCard.width,
            (ALTURA_FINAL - MARGEM * 2) / canvasCard.height
        );
        const larguraDesenho = canvasCard.width * escala;
        const alturaDesenho = canvasCard.height * escala;
        const x = (LARGURA_FINAL - larguraDesenho) / 2;
        const y = (ALTURA_FINAL - alturaDesenho) / 2;

        ctx.drawImage(canvasCard, x, y, larguraDesenho, alturaDesenho);

        const link = document.createElement('a');
        link.download = `story-esportes-${Date.now()}.png`;
        link.href = canvasFinal.toDataURL('image/png');
        link.click();

        mostrarToast('✅ Story baixado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao baixar story:', error);
        mostrarToast('❌ Erro ao gerar Stories. Tente novamente.', 'error');
    }
}