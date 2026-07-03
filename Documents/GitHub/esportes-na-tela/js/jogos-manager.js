// ========================================
// JOGOS MANAGER - CRUD de Eventos
// ========================================

let jogos = [];
let editandoId = null;

// Carregar eventos do localStorage
function carregarJogos() {
    const salvos = localStorage.getItem('esportesJogos');
    if (salvos) {
        try {
            jogos = JSON.parse(salvos);
        } catch (e) {
            jogos = [];
        }
    }
    renderizarJogos();
}

// Salvar eventos no localStorage
function salvarJogosStorage() {
    localStorage.setItem('esportesJogos', JSON.stringify(jogos));
}

// Adicionar ou atualizar jogo
function salvarJogo(event) {
    event.preventDefault();

    const id = document.getElementById('editId').value;
    const hora = document.getElementById('jogoHora').value.trim();
    const evento = document.getElementById('jogoEvento').value.trim();
    const campeonato = document.getElementById('jogoCampeonato').value.trim();
    const canal = document.getElementById('jogoCanal').value.trim();
    const categoria = document.getElementById('jogoCategoria').value;
    const destaqueEl = document.getElementById('jogoDestaque');
    const destaque = destaqueEl ? destaqueEl.checked : false;

    if (!hora || !evento || !campeonato || !canal) {
        mostrarToast('Preencha todos os campos!', 'error');
        return;
    }

    // Ao editar um evento que já existia (ex: veio da IA), preserva o link de
    // verificação original em vez de perdê-lo.
    const jogoExistente = id ? jogos.find(j => j.id === id) : null;

    const novoJogo = {
        id: id || Date.now().toString(),
        hora,
        evento,
        campeonato,
        canal,
        tipo: 'tv-aberta',
        categoria,
        // Antes ficava fixo em 'outros', o que jogava qualquer evento manual
        // para o final da ordenação dentro da categoria. Agora é inferido
        // a partir do nome do campeonato/evento.
        prioridade: inferirPrioridade(campeonato, evento),
        destaque,
        fonte: jogoExistente ? jogoExistente.fonte : 'Manual',
        fonteUrl: jogoExistente ? (jogoExistente.fonteUrl || '') : ''
    };

    if (id) {
        const index = jogos.findIndex(j => j.id === id);
        if (index !== -1) {
            jogos[index] = novoJogo;
            mostrarToast('Evento atualizado com sucesso!', 'success');
        }
    } else {
        jogos.push(novoJogo);
        mostrarToast('Evento adicionado com sucesso!', 'success');
    }

    salvarJogosStorage();
    renderizarJogos();
    fecharModal();
    gerarCards();
}

// Renderizar lista de jogos
function renderizarJogos() {
    const container = document.getElementById('listaJogos');
    if (!container) return;

    if (jogos.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
                Nenhum evento adicionado.<br>
                Clique em "Buscar com IA" ou "Adicionar" para começar.
            </div>
        `;
        return;
    }

    container.innerHTML = jogos.map(jogo => `
        <div class="event-item" data-id="${jogo.id}">
            <div class="event-info">
                <span class="event-time">${escapeHTML(jogo.hora)}</span>
                <span class="event-name">${jogo.destaque ? '🏆 ' : ''}${escapeHTML(jogo.evento)}</span>
                <span class="event-channel">📺 ${escapeHTML(jogo.canal)} • ${escapeHTML(jogo.categoria)}</span>
                <a href="${escapeHTML(montarLinkVerificacao(jogo))}" target="_blank" rel="noopener noreferrer" class="link-verificar">
                    ${jogo.fonteUrl ? '🔗 Conferir na fonte' : '🔍 Conferir no Google'}
                </a>
            </div>
            <div class="event-actions">
                <button onclick="editarJogo('${jogo.id}')" title="Editar">✏️</button>
                <button class="btn-delete" onclick="removerJogo('${jogo.id}')" title="Remover">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Link de verificação de cada evento: se a IA trouxe a página exata que ela
// consultou (fonteUrl), usa ela. Senão, monta uma busca do Google já com o
// nome do evento + canal, pra conferir em 1 clique — vale pra qualquer
// esporte (futebol, basquete, tênis etc.), não é específico de nenhum.
function montarLinkVerificacao(jogo) {
    if (jogo.fonteUrl) return jogo.fonteUrl;
    const consulta = encodeURIComponent(`${jogo.evento} ${jogo.campeonato} onde assistir ${jogo.canal}`);
    return `https://www.google.com/search?q=${consulta}`;
}

// Remover jogo
function removerJogo(id) {
    if (!confirm('Tem certeza que deseja remover este evento?')) return;
    jogos = jogos.filter(j => j.id !== id);
    salvarJogosStorage();
    renderizarJogos();
    gerarCards();
    mostrarToast('Evento removido!', 'info');
}

// Editar jogo
function editarJogo(id) {
    const jogo = jogos.find(j => j.id === id);
    if (!jogo) return;

    document.getElementById('editId').value = jogo.id;
    document.getElementById('jogoHora').value = jogo.hora;
    document.getElementById('jogoEvento').value = jogo.evento;
    document.getElementById('jogoCampeonato').value = jogo.campeonato;
    document.getElementById('jogoCanal').value = jogo.canal;
    document.getElementById('jogoCategoria').value = jogo.categoria;
    const destaqueEl = document.getElementById('jogoDestaque');
    if (destaqueEl) destaqueEl.checked = !!jogo.destaque;

    abrirModal();
}

// Limpar todos os eventos
function limparEventos() {
    if (!confirm('Deseja limpar todos os eventos?')) return;
    jogos = [];
    salvarJogosStorage();
    renderizarJogos();
    gerarCards();
    mostrarToast('Todos os eventos foram removidos!', 'info');
}

// Abrir modal
function abrirModalJogo() {
    document.getElementById('editId').value = '';
    document.getElementById('jogoHora').value = '';
    document.getElementById('jogoEvento').value = '';
    document.getElementById('jogoCampeonato').value = '';
    document.getElementById('jogoCanal').value = '';
    document.getElementById('jogoCategoria').value = 'Motor';
    const destaqueEl = document.getElementById('jogoDestaque');
    if (destaqueEl) destaqueEl.checked = false;
    abrirModal();
}

function abrirModal() {
    document.getElementById('modalJogo').classList.add('active');
}

function fecharModal() {
    document.getElementById('modalJogo').classList.remove('active');
}

// Fechar modal ao clicar fora
document.addEventListener('click', function (e) {
    const modal = document.getElementById('modalJogo');
    if (e.target === modal) {
        fecharModal();
    }
});

// Obter jogos filtrados por tipo de canal
function jogosFiltrados() {
    const checkboxes = document.querySelectorAll('.filter-group input[type="checkbox"]:checked');
    const tiposSelecionados = Array.from(checkboxes).map(cb => cb.value);

    if (tiposSelecionados.length === 0) return [];

    return jogos.filter(jogo => {
        const tipo = jogo.tipo || 'tv-aberta';
        return tiposSelecionados.includes(tipo);
    });
}

// Inicializar
document.addEventListener('DOMContentLoaded', carregarJogos);
