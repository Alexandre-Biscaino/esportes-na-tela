// ========================================
// APP - Inicialização e Controle Principal
// ========================================

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', function() {
    // Carregar tema salvo
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    // Carregar eventos salvos
    carregarJogos();
    
    // Gerar cards iniciais
    setTimeout(() => {
        gerarCards();
    }, 100);
    
    // Configurar atalho de teclado para busca (Ctrl+Shift+B)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            buscarComIA();
        }
    });
    
    // Configurar atalho para gerar cards (Ctrl+Shift+G)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') {
            e.preventDefault();
            gerarCards();
        }
    });
    
    console.log('🏆 Esportes na Tela - Sistema Inicializado');
    console.log(`📋 ${jogos.length} eventos carregados`);
});

// ========================================
// FUNÇÃO PARA ALTERNAR TEMA
// ========================================

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Atualizar botões
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ========================================
// TOAST SYSTEM
// ========================================

function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = mensagem;
    toast.className = `toast ${tipo}`;
    toast.classList.add('show');
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ========================================
// MANUAL DO USUÁRIO
// ========================================

function abrirManual() {
    const manual = `
📖 MANUAL DO USUÁRIO - ESPORTES NA TELA

🤖 BUSCA COM IA
1. Obtenha sua chave API no Google AI Studio
2. Cole no campo "Chave da API Gemini"
3. Clique em "Salvar" e depois em "Buscar com IA"

📝 GERENCIAMENTO DE EVENTOS
- Adicionar: Clique em "+ Adicionar" e preencha os dados
- Editar: Clique em ✏️ ao lado do evento
- Remover: Clique em 🗑️ ao lado do evento
- Filtrar: Use os checkboxes para filtrar por tipo de canal
- Destaque: Marque "Evento de destaque" para eventos como Copa do Mundo
  ou finais — eles ganham um card dourado próprio, separado das categorias

🎴 CARDS PREMIUM
- Clique em "Gerar Cards" para atualizar a visualização
- Passe o mouse sobre um card para ver o botão de download
- Clique em "Baixar Todos" para baixar todos os cards juntos

📝 TEXTOS PARA REDES SOCIAIS
- Clique nas abas para alternar entre as redes
- Clique em "Copiar texto" para copiar o conteúdo

⌨️ ATALHOS DO TECLADO
- Ctrl+Shift+B: Buscar eventos com IA
- Ctrl+Shift+G: Gerar cards

💾 DADOS
- Os eventos são salvos automaticamente no seu navegador
`;

    // Mostrar em uma modal simples
    const modal = document.getElementById('modalJogo');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.innerHTML = `
                <h3>📖 Manual do Usuário</h3>
                <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.8; color: var(--text-secondary); max-height: 70vh; overflow-y: auto; padding: 8px 0;">
                    ${manual}
                </div>
                <button onclick="fecharManual()" class="btn-primary" style="margin-top: 16px;">Fechar</button>
            `;
            modal.classList.add('active');
        }
    }
}

function fecharManual() {
    const modal = document.getElementById('modalJogo');
    if (modal) {
        modal.classList.remove('active');
        // Restaurar conteúdo do modal
        restaurarModal();
    }
}

function restaurarModal() {
    const modal = document.getElementById('modalJogo');
    if (!modal) return;
    
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.innerHTML = `
            <h3>➕ Adicionar Evento</h3>
            <form id="formJogo" onsubmit="salvarJogo(event)">
                <input type="hidden" id="editId" />
                <div class="form-group">
                    <label>Hora</label>
                    <input type="text" id="jogoHora" placeholder="Ex: 15h00" required />
                </div>
                <div class="form-group">
                    <label>Evento</label>
                    <input type="text" id="jogoEvento" placeholder="Ex: GP de Mônaco - Classificação" required />
                </div>
                <div class="form-group">
                    <label>Campeonato</label>
                    <input type="text" id="jogoCampeonato" placeholder="Ex: Fórmula 1" required />
                </div>
                <div class="form-group">
                    <label>Canal</label>
                    <input type="text" id="jogoCanal" placeholder="Ex: Band, F1 TV" required />
                </div>
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="jogoCategoria">
                        <option value="Motor">🏎️ Motor</option>
                        <option value="Quadras">🏀 Quadras</option>
                        <option value="Campo">⚽ Campo</option>
                        <option value="Combate">🥊 Combate</option>
                        <option value="Outros">🎯 Outros</option>
                    </select>
                </div>
                <div class="form-group form-group-checkbox">
                    <label><input type="checkbox" id="jogoDestaque" /> 🏆 Evento de destaque (ganha card próprio, ex: Copa do Mundo, final)</label>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">Salvar</button>
                </div>
            </form>
        `;
    }
}

// ========================================
// CONFIGURAÇÕES ADICIONAIS
// ========================================

// Salvar créditos automaticamente
document.addEventListener('DOMContentLoaded', function() {
    const creditInput = document.getElementById('creditosInput');
    if (creditInput) {
        const savedCredits = localStorage.getItem('esportesCreditos');
        if (savedCredits) {
            creditInput.value = savedCredits;
        }
        
        creditInput.addEventListener('change', function() {
            localStorage.setItem('esportesCreditos', this.value);
            gerarCards();
        });
    }
});

// ========================================
// FUNÇÃO PARA FECHAR MODAL (GLOBAL)
// ========================================

function fecharModal() {
    const modal = document.getElementById('modalJogo');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ========================================
// FUNÇÃO PARA ABRIR MODAL (GLOBAL)
// ========================================

function abrirModalJogo() {
    const modal = document.getElementById('modalJogo');
    if (modal) {
        // Resetar formulário
        const form = document.getElementById('formJogo');
        if (form) form.reset();
        document.getElementById('editId').value = '';
        modal.classList.add('active');
    }
}

// ========================================
// EXPORTAÇÃO DE FUNÇÕES GLOBAIS
// ========================================

// Exportar funções globais
window.salvarJogo = salvarJogo;
window.removerJogo = removerJogo;
window.editarJogo = editarJogo;
window.limparEventos = limparEventos;
window.abrirModalJogo = abrirModalJogo;
window.fecharModal = fecharModal;
window.buscarComIA = buscarComIA;
window.salvarApiKey = salvarApiKey;
window.gerarCards = gerarCards;
window.baixarCard = baixarCard;
window.baixarTodosCards = baixarTodosCards;
window.baixarCardUnico = baixarCardUnico;
window.baixarCardComoStory = baixarCardComoStory;
window.copiarTexto = copiarTexto;
window.abrirManual = abrirManual;
window.fecharManual = fecharManual;
window.mostrarToast = mostrarToast;
window.setTheme = setTheme;
window.gerarOutroConteudo = gerarOutroConteudo;
window.baixarOutroConteudo = baixarOutroConteudo;
window.atualizarTipoConteudo = atualizarTipoConteudo;
window.alternarEscudos = alternarEscudos;
window.salvarApiDadosUrl = salvarApiDadosUrl;