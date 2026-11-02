/* ============================================================
   HUB ALM - POWER BI / WORKSPACE MANAGER (CONSOLIDADO)
   ============================================================ */

let listaDashboardsCarregados = [];
let listaUsuariosCarregados = [];
let iconeBase64Carregado = null;
let wsIdParaExcluir = null;
let idVersaoSelecionadaParaDeletar = null;
let elementoTrLinhaCommitAtiva = null;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function encodeErrorKind(str) {
    return encodeURIComponent(str ?? "");
}

function formatarData(dataIso) {
    if (!dataIso) return "—";
    const s = String(dataIso).replace("T", " ");
    return s.substring(0, 10);
}

function formatarDicionarioDados(textoBruto) {
    if (!textoBruto) return "Nenhuma tabela indexada.";
    let texto = textoBruto;
    texto = texto.replace(/TABELA:/g, " TABELA:");
    texto = texto.replace(/ TABELA:/g, "\n\nTABELA:");
    texto = texto.replace(/\s-\s/g, "\n   - ");
    return texto.trim();
}

function exibirNotificacaoSucesso(mensagem) {
    const toast = document.getElementById("toastSuccess");
    const toastMsg = document.getElementById("toastMessage");
    if (!toast || !toastMsg) return;
    toastMsg.textContent = mensagem;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
}

function exibirNotificacaoErro(mensagem) {
    const toast = document.getElementById("toastError");
    const toastMsg = document.getElementById("toastErrorMessage");
    if (!toast || !toastMsg) return;
    toastMsg.textContent = mensagem;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 5000);
}

// ------------------------------------------------------------
// DOMContentLoaded (ÚNICO)
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    // 1. Proteção de Acesso
    const userStorage = localStorage.getItem("usuarioLogado");
    if (!userStorage) {
        window.location.href = "/";
        return;
    }
    const usuarioLogado = JSON.parse(userStorage);

    // 2. Sidebar
    const btnCloseSidebar = document.getElementById("btnCloseSidebar");
    const btnOpenSidebar = document.getElementById("btnOpenSidebar");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("mainContent");

    if (btnCloseSidebar && sidebar && mainContent && btnOpenSidebar) {
        btnCloseSidebar.addEventListener("click", function () {
            sidebar.classList.add("collapsed");
            btnOpenSidebar.style.display = "flex";
            mainContent.classList.add("expanded");
        });
    }

    if (btnOpenSidebar && sidebar && mainContent) {
        btnOpenSidebar.addEventListener("click", function () {
            sidebar.classList.remove("collapsed");
            btnOpenSidebar.style.display = "none";
            mainContent.classList.remove("expanded");
        });
    }

    // 3. Menu principal (SPA)
    const mapeamentoMenus = [
        { botao: document.getElementById("menuHome"), aba: document.getElementById("tabHome") },
        { botao: document.getElementById("menuWorkspace"), aba: document.getElementById("tabWorkspace") },
        { botao: document.getElementById("menuUsuario"), aba: document.getElementById("tabUsuario") },
        { botao: document.getElementById("menuPowerBI"), aba: document.getElementById("tabPowerBI") }
    ];

    mapeamentoMenus.forEach(item => {
        if (!item.botao) return;
        item.botao.addEventListener("click", function (e) {
            e.preventDefault();
            mapeamentoMenus.forEach(i => {
                if (i.botao) i.botao.classList.remove("active");
                if (i.aba) i.aba.classList.remove("active");
            });
            item.botao.classList.add("active");
            if (item.aba) item.aba.classList.add("active");

            if (item.botao.id === "menuWorkspace") renderizarTabelaWorkspaces();
            if (item.botao.id === "menuPowerBI") renderizarTabelaDashboards();
            if (item.botao.id === "menuUsuario") renderizarTabelaUsuarios();
        });
    });

    // 4. Sub-abas
    configurarSubAbasWorkspace();
    configurarSubAbasPowerBI();
    configurarSubAbasUsuario();

    // 5. Formulários
    configurarFormularios();

    // 6. Input de arquivo PBIx
    configurarInputArquivoPBIx();

    // 7. Configurar Upload de Ícone PNG
    const inputUploadIcone = document.getElementById("wsIconeUpload");
    if (inputUploadIcone) {
        inputUploadIcone.addEventListener("change", function(e) {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            if (arquivo.type !== "image/png") {
                exibirNotificacaoErro("Por favor, envie apenas arquivos PNG.");
                this.value = "";
                return;
            }

            if (arquivo.size > 1024 * 1024) {
                exibirNotificacaoErro("A imagem deve ter no máximo 1MB.");
                this.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                iconeBase64Carregado = event.target.result; 
                const txtPreview = document.getElementById("wsIconePreviewText");
                if (txtPreview) {
                    txtPreview.textContent = "✅ Imagem personalizada carregada com sucesso!";
                    txtPreview.style.display = "block";
                }
                document.getElementById("wsIcone").value = "";
            };
            reader.readAsDataURL(arquivo);
        });
    }

    // 8. Modais
    configurarModais();

    // 9. Carga inicial da home
    carregarDadosPainel(usuarioLogado.codigo_ldap);
    
    // 10. Atualiza o perfil na barra lateral
    const elNome = document.getElementById("userName");
    if (elNome) elNome.textContent = usuarioLogado.nome;
    const elCode = document.getElementById("userCode");
    if (elCode) elCode.textContent = `LDAP: ${usuarioLogado.codigo_ldap}`;
});

// ------------------------------------------------------------
// Sub-abas
// ------------------------------------------------------------
function configurarSubAbasWorkspace() {
    const btnListar = document.getElementById("subTabListarWS");
    const btnNovo = document.getElementById("subTabNovoWS");
    const secListar = document.getElementById("secListarWS");
    const secNovo = document.getElementById("secNovoWS");
    if (!btnListar || !btnNovo) return;

    btnListar.addEventListener("click", function () {
        btnListar.classList.add("active");
        btnNovo.classList.remove("active");
        secListar.classList.add("active");
        secNovo.classList.remove("active");
        renderizarTabelaWorkspaces();
    });

    btnNovo.addEventListener("click", function () {
        btnNovo.classList.add("active");
        btnListar.classList.remove("active");
        secNovo.classList.add("active");
        secListar.classList.remove("active");
    });
}

function configurarSubAbasPowerBI() {
    const btnListarBI = document.getElementById("subTabListarBI");
    const btnNovoBI = document.getElementById("subTabNovoBI");
    const secListarBI = document.getElementById("secListarBI");
    const secNovoBI = document.getElementById("secNovoBI");
    if (!btnListarBI || !btnNovoBI) return;

    btnListarBI.addEventListener("click", function (e) {
        e.preventDefault();
        btnListarBI.classList.add("active");
        btnNovoBI.classList.remove("active");
        secListarBI.classList.add("active");
        secNovoBI.classList.remove("active");
        renderizarTabelaDashboards();
    });

    btnNovoBI.addEventListener("click", function (e) {
        e.preventDefault();
        btnNovoBI.classList.add("active");
        btnListarBI.classList.remove("active");
        secNovoBI.classList.add("active");
        secListarBI.classList.remove("active");
        carregarWorkspacesNoFormSelect();
    });
}

function configurarSubAbasUsuario() {
    const btnListar = document.getElementById("subTabListarUser");
    const btnNovo = document.getElementById("subTabNovoUser");
    const secListar = document.getElementById("secListarUser");
    const secNovo = document.getElementById("secNovoUser");
    if (!btnListar || !btnNovo) return;

    btnListar.addEventListener("click", function () {
        btnListar.classList.add("active");
        btnNovo.classList.remove("active");
        secListar.classList.add("active");
        secNovo.classList.remove("active");
        renderizarTabelaUsuarios();
    });

    btnNovo.addEventListener("click", function () {
        btnNovo.classList.add("active");
        btnListar.classList.remove("active");
        secNovo.classList.add("active");
        secListar.classList.remove("active");
        document.getElementById("formUsuario").reset();
        carregarWorkspacesNoFormUsuario(); 
    });
}

// ------------------------------------------------------------
// Formulários
// ------------------------------------------------------------
function configurarFormularios() {
    // 1. FORMULÁRIO DE WORKSPACE
    const formWS = document.getElementById("formWorkspace");
    if (formWS) {
        formWS.addEventListener("submit", async function (e) {
            e.preventDefault();

            const inputNome = document.getElementById("wsNomeComercial");
            const nomeDigitado = inputNome.value.trim();

            const workspacesExistentes = Array.from(document.querySelectorAll(".ws-row td strong")).map(el => el.innerText.trim().toLowerCase());
            if (workspacesExistentes.includes(nomeDigitado.toLowerCase())) {
                exibirNotificacaoErro("Este nome de Workspace já está em uso. Escolha outro.");
                inputNome.focus();
                return;
            }

            const guidAuto = "auto-ws-" + Math.random().toString(36).substring(2, 15);

            const iconeEmoji = document.getElementById("wsIcone").value;
            const iconeFinal = iconeBase64Carregado ? iconeBase64Carregado : iconeEmoji;

            const payload = {
                nome: nomeDigitado,
                guid: guidAuto,
                descricao: document.getElementById("wsDescricao").value,
                icone: iconeFinal
            };

            try {
                const response = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    exibirNotificacaoSucesso("Workspace cadastrada com sucesso!");
                    formWS.reset();
                    iconeBase64Carregado = null;
                    const txtPreview = document.getElementById("wsIconePreviewText");
                    if (txtPreview) txtPreview.style.display = "none";
                    document.getElementById("subTabListarWS")?.click();
                } else {
                    const err = await response.json();
                    exibirNotificacaoErro(err.error || "Erro ao cadastrar workspace."); 
                }
            } catch (error) {
                exibirNotificacaoErro("Falha ao se conectar com o servidor Python.");
            }
        });
    }

    // 2. FORMULÁRIO POWER BI (UPLOAD)
    const formPBI = document.getElementById("formPowerBI");
    if (formPBI) {
        formPBI.addEventListener("submit", async function (e) {
            e.preventDefault();

            const fileInput = document.getElementById("filePbix");
            const arquivo = fileInput?.files?.[0];
            if (!arquivo) {
                exibirNotificacaoErro("Por favor, selecione um arquivo de relatório (.pbix) válido.");
                return;
            }

            const btnSubmit = document.getElementById("btnSubmitCommit");
            const pbiExiste = btnSubmit?.dataset?.pbiExiste === "true";
            let listaWorkspacesIds = [];

            if (!pbiExiste) {
                const checkboxes = document.querySelectorAll('input[name="workspaces_selecionadas"]:checked');
                listaWorkspacesIds = Array.from(checkboxes).map(cb => cb.value);
                if (listaWorkspacesIds.length === 0) {
                    exibirNotificacaoErro("Selecione ao menos um Workspace de destino para a primeira alocação.");
                    return;
                }
            }

            const formData = new FormData();
            formData.append("file", arquivo);
            formData.append("link_embed", document.getElementById("biLinkEmbed").value);
            formData.append("id_workspaces", JSON.stringify(listaWorkspacesIds));

            if (btnSubmit) {
                btnSubmit.textContent = "Processando e compactando em ZIP...";
                btnSubmit.disabled = true;
            }

            try {
                const response = await fetch("/api/dashboards/upload", {
                    method: "POST",
                    body: formData
                });

                if (response.ok) {
                    const resultado = await response.json();
                    exibirNotificacaoSucesso(`Commit realizado! Registrado como ${resultado.versao_gerada}. Fontes mapeadas com sucesso.`);
                    formPBI.reset();
                    document.getElementById("fileInfoArea")?.classList.add("hidden");
                    const containerWS = document.getElementById("containerSeletorWorkspaces");
                    if (containerWS) containerWS.style.display = "flex";
                    if (btnSubmit) {
                        btnSubmit.textContent = "Fazer Commit e Incrementar Versão";
                        btnSubmit.dataset.pbiExiste = "false";
                    }
                    document.getElementById("subTabListarBI")?.click();
                } else {
                    const err = await response.json();
                    exibirNotificacaoErro(err.error || "Erro ao processar estrutura do arquivo.");
                }
            } catch (error) {
                exibirNotificacaoErro("Falha crítica de comunicação com o servidor Python.");
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    // 3. FORMULÁRIO DE USUÁRIO
    const formUsuario = document.getElementById("formUsuario");
    if (formUsuario) {
        formUsuario.addEventListener("submit", async function (e) {
            e.preventDefault();
            
            const nome = document.getElementById("userNome").value.trim();
            const ldap = document.getElementById("userLdap").value.trim();
            const email = document.getElementById("userEmail").value.trim();
            const papel = document.getElementById("userRole").value;
            
            const checkboxes = document.querySelectorAll('input[name="user_workspaces"]:checked');
            const workspacesIds = Array.from(checkboxes).map(cb => cb.value);

            if (!nome || !ldap) {
                exibirNotificacaoErro("Nome e LDAP são obrigatórios.");
                return;
            }

            try {
                const response = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: nome,
                        ldap: ldap,
                        email: email,
                        papel: parseInt(papel),
                        id_workspaces: workspacesIds
                    })
                });

                if (response.ok) {
                    exibirNotificacaoSucesso("Usuário cadastrado com sucesso!");
                    formUsuario.reset();
                    document.getElementById("subTabListarUser")?.click();
                } else {
                    const err = await response.json();
                    exibirNotificacaoErro(err.error || "Erro ao cadastrar usuário.");
                }
            } catch (error) {
                exibirNotificacaoErro("Falha de comunicação com o servidor.");
            }
        });
    }
}

// ------------------------------------------------------------
// Input de arquivo PBIx
// ------------------------------------------------------------
function configurarInputArquivoPBIx() {
    const fileInputPBI = document.getElementById("filePbix");
    if (!fileInputPBI) return;

    fileInputPBI.addEventListener("change", async function () {
        if (!this.files || this.files.length === 0) return;

        const arquivo = this.files[0];
        const nomeLimpo = arquivo.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        const inputNome = document.getElementById("biNomeComercial");
        if (inputNome) inputNome.value = nomeLimpo;

        const inputFontes = document.getElementById("biFontesDetectadas");
        if (inputFontes) inputFontes.value = "Analisando metadados e conexões no SQLite...";

        const badge = document.getElementById("fileInfoArea");
        const badgeText = document.getElementById("fileInfoText");
        if (badge && badgeText) {
            badgeText.textContent = `Arquivo carregado: ${arquivo.name} (${(arquivo.size / (1024 * 1024)).toFixed(2)} MB)`;
            badge.classList.remove("hidden");
        }

        try {
            const response = await fetch(`/api/dashboards/verificar/${encodeErrorKind(nomeLimpo)}`);
            const checagem = await response.json();

            const containerWS = document.getElementById("containerSeletorWorkspaces");
            const btnSubmit = document.getElementById("btnSubmitCommit");

            if (checagem.existe) {
                if (containerWS) containerWS.style.display = "none";
                if (btnSubmit) {
                    btnSubmit.textContent = `🚀 Fazer Commit de Nova Versão (${checagem.proxima_versao})`;
                    btnSubmit.dataset.pbiExiste = "true";
                }
            } else {
                if (containerWS) containerWS.style.display = "flex";
                if (btnSubmit) {
                    btnSubmit.textContent = "Fazer Commit e Incrementar Versão";
                    btnSubmit.dataset.pbiExiste = "false";
                }
            }
        } catch (err) {
            console.error("Erro na verificação ALM:", err);
        }
    });
}

// ------------------------------------------------------------
// Modais
// ------------------------------------------------------------
function configurarModais() {
    const modalDelete = document.getElementById("deleteModal");
    const btnCancel = document.getElementById("btnCancelModal");
    const btnCloseX = document.getElementById("btnCloseModalX");
    const btnConfirm = document.getElementById("btnConfirmModal");

    const fecharDelete = () => { if (modalDelete) modalDelete.classList.remove("show"); };
    if (btnCancel) btnCancel.addEventListener("click", fecharDelete);
    if (btnCloseX) btnCloseX.addEventListener("click", fecharDelete);

    if (btnConfirm) {
        btnConfirm.addEventListener("click", async function () {
            if (!idVersaoSelecionadaParaDeletar || !elementoTrLinhaCommitAtiva) return;

            const motivoValue = document.getElementById("modalMotivo")?.value || "";
            const detalhesValue = document.getElementById("modalDetalhes")?.value || "";

            btnConfirm.textContent = "Limpando registros...";
            btnConfirm.disabled = true;

            try {
                const response = await fetch("/api/dashboards/versao/deletar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id_versao: idVersaoSelecionadaParaDeletar,
                        usuario_ldap: "u123456",
                        motivo: motivoValue,
                        detalhes: detalhesValue
                    })
                });

                if (!response.ok) {
                    alert("Erro interno do servidor ao processar descarte.");
                    return;
                }

                fecharDelete();
                exibirNotificacaoSucesso("Arquivo físico .pbix removido do SQLite. Histórico de Logs preservado!");

                const commitAtualizado = {
                    id_versao: idVersaoSelecionadaParaDeletar,
                    numero_versao: (elementoTrLinhaCommitAtiva.cells[0]?.innerText || "").trim() || "v1",
                    usuario_excluiu: "u123456 (Admin)",
                    data_exclusao_binario: new Date().toISOString(),
                    motivo_exclusao: motivoValue,
                    detalhes_exclusao: detalhesValue
                };

                const celulaStatus = elementoTrLinhaCommitAtiva.cells[2];
                const celulaBotao = elementoTrLinhaCommitAtiva.cells[3];
                const payloadEncoded = encodeURIComponent(JSON.stringify(commitAtualizado));

                if (celulaStatus && celulaBotao) {
                    celulaStatus.innerHTML = `<span style="color:#b91c1c; font-weight:600;">Excluído (Fisicamente)</span>`;
                    celulaBotao.innerHTML = `
                        <a href="javascript:void(0);"
                           onclick="exibirDetalhesDelecao('${payloadEncoded}', event)"
                           style="color:#b91c1c; font-size:12px; font-weight:600; text-decoration:underline; cursor:pointer;">
                            Arq Deletado - Detalhes
                        </a>`;
                }
            } catch (error) {
                alert("Falha crítica de comunicação com o Python.");
            } finally {
                btnConfirm.textContent = "Confirmar Exclusão Física";
                btnConfirm.disabled = false;
            }
        });
    }

    const modalDetails = document.getElementById("detailsModal");
    const btnCloseDetailsX = document.getElementById("btnCloseDetailsX");
    const btnCloseDetailsBtn = document.getElementById("btnCloseDetailsBtn");
    const fecharDetalhes = () => { if (modalDetails) modalDetails.classList.remove("show"); };
    if (btnCloseDetailsX) btnCloseDetailsX.addEventListener("click", fecharDetalhes);
    if (btnCloseDetailsBtn) btnCloseDetailsBtn.addEventListener("click", fecharDetalhes);
}

// ------------------------------------------------------------
// HOME — Navegação em 3 Níveis (Workspace -> Dashboards -> Iframe)
// ------------------------------------------------------------
async function carregarDadosPainel(codigoLdap) {
    try {
        const userStorage = localStorage.getItem("usuarioLogado");
        const usuarioLogado = JSON.parse(userStorage);
        const isAdmin = usuarioLogado && usuarioLogado.papel === 127;

        let workspacesParaMostrar = [];

        if (isAdmin) {
            const response = await fetch('/api/workspaces');
            workspacesParaMostrar = await response.json();
        } else {
            const response = await fetch(`/api/workspaces/${codigoLdap}`);
            const data = await response.json();
            workspacesParaMostrar = data.workspaces || [];
        }

        const userName = document.getElementById("userName");
        const userCode = document.getElementById("userCode");
        const badge = document.getElementById("userBadge");
        
        if (userName && usuarioLogado) userName.textContent = usuarioLogado.nome;
        if (userCode && usuarioLogado) userCode.textContent = `LDAP: ${usuarioLogado.codigo_ldap}`;
        if (badge && usuarioLogado) badge.textContent = isAdmin ? "Papel: Administrador" : "Papel: Visualizador";

        const grid = document.getElementById("workspacesGrid");
        if (!grid) return;
        grid.innerHTML = "";

        if (!workspacesParaMostrar || workspacesParaMostrar.length === 0) {
            grid.innerHTML = "<p class='text-muted'>Nenhum ambiente localizado.</p>";
            return;
        }

        workspacesParaMostrar.forEach(ws => {
            const card = document.createElement("div");
            card.className = "workspace-card-home";

            // NÍVEL 1: Clicar no card abre a pasta do Workspace (Nível 2)
            card.onclick = () => abrirWorkspaceHome(ws);

            const icone = ws.icone || "📁"; 
            const qtdDashs = ws.qtd_dashboards !== undefined ? ws.qtd_dashboards : 0;

            let iconeHTML = "";
            if (icone.startsWith("data:image")) {
                iconeHTML = `<img src="${icone}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: var(--radius-md);">`;
            } else {
                iconeHTML = icone;
            }

            card.innerHTML = `
                <div class="card-icon-large" style="overflow: hidden; padding: 10px;">${iconeHTML}</div>
                <div class="card-info">
                    <div class="card-info-title">${escapeHtml(ws.nome_comercial || ws.nome || "")}</div>
                    <div class="card-info-desc">${escapeHtml(ws.descricao || "Sem descrição.")}</div>
                    <div class="card-badge-dashs">📊 ${qtdDashs} relatórios</div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Erro interno detectado:", error);
    }
}

// NÍVEL 2: Abrir a "Pasta" do Workspace
async function abrirWorkspaceHome(ws) {
    // Atualiza o visual da tela
    document.getElementById("homeTitulo").textContent = ws.nome_comercial || ws.nome;
    document.getElementById("homeSubtitulo").textContent = ws.descricao || "Selecione um painel para visualizar.";
    document.getElementById("btnVoltarHome").style.display = "flex";
    document.getElementById("workspacesGrid").style.display = "none";
    
    // Atualiza o Breadcrumb
    const breadcrumb = document.getElementById("homeBreadcrumb");
    breadcrumb.innerHTML = `
        <span style="cursor: pointer; color: var(--primary); font-weight: 600;" onclick="voltarParaRaizHome()">🏠 Meus Workspaces</span>
        <span> / </span>
        <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(ws.nome_comercial || ws.nome)}</span>
    `;

    // Prepara o container dos dashboards
    const containerDashs = document.getElementById("homeDashboardView");
    containerDashs.style.display = "none"; // Garante que o iframe grande esteja escondido

    // Cria a div onde os mini cards dos dashboards vão ficar
    let gridDashs = document.getElementById("homeDashboardsGrid");
    if (!gridDashs) {
        gridDashs = document.createElement("div");
        gridDashs.id = "homeDashboardsGrid";
        gridDashs.className = "dashboards-grid";
        containerDashs.parentNode.insertBefore(gridDashs, containerDashs);
    }
    gridDashs.style.display = "grid";
    gridDashs.innerHTML = "<p class='text-muted'>Carregando painéis...</p>";

    try {
        // Busca os dashboards que estão dentro desse workspace
        // Como o seu backend não tem uma rota específica para isso, vamos buscar todos e filtrar
        const response = await fetch('/api/dashboards');
        const todosDashboards = await response.json();
        
        // Filtra os dashboards que pertencem à workspace (usando o nome_workspace como filtro)
        const dashboardsDoWs = todosDashboards.filter(d => 
            d.nome_workspace && d.nome_workspace.includes(ws.nome_comercial)
        );

        gridDashs.innerHTML = "";

        if (dashboardsDoWs.length === 0) {
            gridDashs.innerHTML = "<p class='text-muted' style='grid-column: 1/-1;'>Nenhum dashboard alocado nesta workspace.</p>";
            return;
        }

        dashboardsDoWs.forEach(db => {
            const miniCard = document.createElement("div");
            miniCard.className = "dashboard-card-mini";
            
            const linkLimpo = extrairLinkPuro(db.link_embed);

            miniCard.innerHTML = `
                <div class="mini-iframe-preview">
                    <iframe src="${linkLimpo}" scrolling="no"></iframe>
                </div>
                <div class="dashboard-mini-title">${escapeHtml(db.nome_dashboard)}</div>
            `;

            // NÍVEL 3: Clicar no mini card abre o frame expandido
            miniCard.onclick = () => abrirDashboardHome(db, ws);
            gridDashs.appendChild(miniCard);
        });

    } catch (error) {
        console.error("Erro ao buscar dashboards:", error);
        gridDashs.innerHTML = "<p style='color:red;'>Erro ao carregar os dashboards.</p>";
    }
}

// NÍVEL 3: Expandir o Dashboard
function abrirDashboardHome(db, ws) {
    document.getElementById("homeDashboardsGrid").style.display = "none";
    
    // Atualiza o Breadcrumb
    const breadcrumb = document.getElementById("homeBreadcrumb");
    breadcrumb.innerHTML = `
        <span style="cursor: pointer; color: var(--primary); font-weight: 600;" onclick="voltarParaRaizHome()">🏠 Meus Workspaces</span>
        <span> / </span>
        <span style="cursor: pointer; color: var(--primary); font-weight: 600;" onclick="abrirWorkspaceHome(${JSON.stringify(ws).replace(/"/g, '&quot;')})">${escapeHtml(ws.nome_comercial || ws.nome)}</span>
        <span> / </span>
        <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(db.nome_dashboard)}</span>
    `;

    document.getElementById("homeTitulo").textContent = db.nome_dashboard;
    document.getElementById("homeSubtitulo").textContent = "Visualização do relatório em tela cheia.";

    // Exibe o iframe grande
    const containerDashs = document.getElementById("homeDashboardView");
    containerDashs.style.display = "block";
    
    // Limpa o link e joga no iframe
    document.getElementById("homeIframe").src = extrairLinkPuro(db.link_embed);
}

// Função para voltar tudo para a raiz (botão de voltar)
function voltarParaRaizHome() {
    // Limpa iframe
    document.getElementById("homeIframe").src = "";
    
    // Esconde as visualizações
    document.getElementById("homeDashboardView").style.display = "none";
    const gridDashs = document.getElementById("homeDashboardsGrid");
    if (gridDashs) gridDashs.style.display = "none";
    
    // Mostra a grade de Workspaces
    document.getElementById("workspacesGrid").style.display = "grid";
    
    // Reseta os títulos
    document.getElementById("homeTitulo").textContent = "Meus Workspaces Autorizados";
    document.getElementById("homeSubtitulo").textContent = "Selecione o ambiente para visualizar os painéis alocados.";
    document.getElementById("btnVoltarHome").style.display = "none";
    
    // Reseta o Breadcrumb
    document.getElementById("homeBreadcrumb").innerHTML = `
        <span style="cursor: pointer; color: var(--primary); font-weight: 600;">🏠 Meus Workspaces</span>
    `;

    // Recarrega os cards iniciais (caso tenha mudado algo)
    const codigoLdap = JSON.parse(localStorage.getItem("usuarioLogado")).codigo_ldap;
    carregarDadosPainel(codigoLdap);
}
// ------------------------------------------------------------
// Workspaces — listagem + auditoria inline
// ------------------------------------------------------------
async function renderizarTabelaWorkspaces() {
    const tbody = document.getElementById("tbodyWorkspaces");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='2' style='padding:16px;'>Buscando ambientes em ordem alfabética no SQLite...</td></tr>";

    try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) throw new Error("Erro na comunicação com a API.");
        const workspacesDoBanco = await response.json();

        tbody.innerHTML = "";

        if (!workspacesDoBanco || workspacesDoBanco.length === 0) {
            tbody.innerHTML = "<tr><td colspan='2' style='padding:16px; color:var(--text-muted);'>Nenhum ambiente de workspace localizado no banco.</td></tr>";
            return;
        }

        workspacesDoBanco.forEach(ws => {
            const trWS = document.createElement("tr");
            trWS.className = "ws-row";
            trWS.id = `tr-ws-${ws.id_workspace}`;

            trWS.innerHTML = `
                <td>
                    <strong>${escapeHtml(ws.nome_comercial || "")}</strong><br>
                    <small style="color:var(--text-muted)">${escapeHtml(ws.descricao || "Sem descrição técnica alocada.")}</small>
                </td>
                <td style="text-align:right; padding-right:24px;">
                    <button class="btn-action-view"
                        style="background-color:var(--primary-light); color:var(--primary); border:none;
                        padding:6px 12px; border-radius:6px; font-weight:500; cursor:pointer;">Auditar</button>
                </td>`;

            trWS.addEventListener("click", () => toggleAuditoriaInline(ws, trWS, tbody));
            tbody.appendChild(trWS);
        });
    } catch (error) {
        console.error("Erro ao carregar workspaces:", error);
        tbody.innerHTML = "<tr><td colspan='2' style='color:red; padding:16px;'>Erro ao conectar com o repositório de Workspaces do SQLite.</td></tr>";
    }
}

function toggleAuditoriaInline(ws, trWS, tbody) {
    const idLinhaAuditoria = `tr-audit-${ws.id_workspace}`;
    const linhaAuditoriaExistente = document.getElementById(idLinhaAuditoria);

    if (linhaAuditoriaExistente) {
        linhaAuditoriaExistente.remove();
        trWS.classList.remove("selected");
        return;
    }

    document.querySelectorAll(".audit-row").forEach(row => row.remove());
    document.querySelectorAll(".ws-row").forEach(row => row.classList.remove("selected"));
    trWS.classList.add("selected");

    const trAudit = document.createElement("tr");
    trAudit.className = "audit-row";
    trAudit.id = idLinhaAuditoria;

    const dashs = Array.isArray(ws.dashs) ? ws.dashs : [];
    const users = Array.isArray(ws.users) ? ws.users : [];

    const liDashboards = dashs.length > 0
        ? dashs.map(d => `
            <li>
                <span style="font-weight: 500;">${escapeHtml(d)}</span>
                <button onclick="event.stopPropagation(); redirecionarParaItem('pbi', '${escapeHtml(d).replace(/'/g, "\\'")}', event)" 
                        title="Ir direto para este Dashboard" 
                        style="background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor:pointer; font-size: 14px; padding: 2px 10px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">
                    ➔
                </button>
            </li>`).join("")
        : "<li style='font-size: 13px; color: var(--text-muted); background: transparent; border: none;'>Nenhum relatório alocado neste ambiente</li>";

    const liUsuarios = users.length > 0
        ? users.map(u => `
            <li>
                <span style="font-weight: 500;">${escapeHtml(u)}</span>
                <button onclick="event.stopPropagation(); redirecionarParaItem('user', '${escapeHtml(u).replace(/'/g, "\\'")}', event)" 
                        title="Ir direto para este Usuário" 
                        style="background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor:pointer; font-size: 14px; padding: 2px 10px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">
                    ➔
                </button>
            </li>`).join("")
        : "<li style='font-size: 13px; color: var(--text-muted); background: transparent; border: none;'>Nenhum usuário liberado neste ambiente</li>";

    trAudit.innerHTML = `
        <td colspan="2" style="padding:0 !important; background-color:#f8fafc;">
            <div class="audit-inline-container" style="flex-direction: column !important; gap: 24px !important; padding: 24px 32px !important;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; font-weight: 700; margin: 0;">
                        📋 Detalhes do Ambiente
                    </h4>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="event.stopPropagation(); ativarModoEdicaoWorkspace(${ws.id_workspace}, event)" 
                                style="background: var(--primary-light); color: var(--primary); border:none; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                            ✏️ Editar
                        </button>
                        
                        <button onclick="event.stopPropagation(); abrirModalExclusao(${ws.id_workspace}, '${escapeHtml(ws.nome_comercial).replace(/'/g, "\\'")}', event)" 
                                style="background: #fee2e2; color: #991b1b; border:none; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>

                <div id="edit-block-ws-${ws.id_workspace}">
                    <div class="audit-inline-container audit-side-by-side" style="padding: 0 !important;">
                        <div class="audit-inline-section">
                            <h4>📊 Dashboards Alocados</h4>
                            <ul class="audit-inline-list">${liDashboards}</ul>
                        </div>
                        <div class="audit-inline-section">
                            <h4>👥 Usuários Autorizados</h4>
                            <ul class="audit-inline-list">${liUsuarios}</ul>
                        </div>
                    </div>
                </div>

            </div>
        </td>`;

    trWS.insertAdjacentElement("afterend", trAudit);
}

function abrirModalExclusao(idWorkspace, nomeWorkspace, event) {
    if (event) event.stopPropagation(); 
    wsIdParaExcluir = idWorkspace;

    const modalAntigo = document.getElementById("deleteWsModalDinamico");
    if (modalAntigo) modalAntigo.remove();

    const modalHTML = `
        <div class="custom-modal-overlay" id="deleteWsModalDinamico" style="display: flex; z-index: 999999;">
            <div class="custom-modal-box">
                <div class="modal-header-danger">
                    <h3>Excluir Workspace</h3>
                    <button class="btn-close-modal" onclick="document.getElementById('deleteWsModalDinamico').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--text-main); font-size:14px; line-height: 1.5;">
                        Tem certeza que deseja excluir a workspace <strong>${nomeWorkspace}</strong>?
                    </p>
                    <p style="color:#b91c1c; font-size:12px; margin-top:8px; font-weight: 500;">
                        ⚠️ Atenção: Todos os vínculos de usuários e dashboards com este ambiente serão removidos permanentemente.
                    </p>
                </div>
                <div class="modal-footer">
                    <button class="btn-modal-cancel" onclick="document.getElementById('deleteWsModalDinamico').remove()">Cancelar</button>
                    <button class="btn-modal-confirm" id="btnConfirmDeleteWsDinamico">Sim, Excluir</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById("btnConfirmDeleteWsDinamico").addEventListener("click", async function() {
        if (!wsIdParaExcluir) return;
        
        const btn = this;
        btn.textContent = "Excluindo...";
        btn.disabled = true;

        try {
            const response = await fetch('/api/workspaces/excluir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_workspace: wsIdParaExcluir })
            });

            if (response.ok) {
                document.getElementById('deleteWsModalDinamico').remove();
                exibirNotificacaoSucesso("Workspace excluída com sucesso!");
                renderizarTabelaWorkspaces();
            } else {
                exibirNotificacaoErro("Erro ao excluir a workspace no servidor.");
            }
        } catch (error) {
            exibirNotificacaoErro("Falha de comunicação com o servidor.");
        } finally {
            wsIdParaExcluir = null;
        }
    });
}

// ------------------------------------------------------------
// Dashboards — listagem + auditoria inline
// ------------------------------------------------------------
async function renderizarTabelaDashboards() {
    const tbody = document.getElementById("tbodyDashboards");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='4' style='padding:16px;'>Buscando relatórios e commits no SQLite...</td></tr>";

    try {
        const response = await fetch("/api/dashboards");
        if (!response.ok) throw new Error("Erro na comunicação com a API.");
        const dashboardsDoBanco = await response.json();
        listaDashboardsCarregados = dashboardsDoBanco || [];

        tbody.innerHTML = "";

        if (listaDashboardsCarregados.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' style='padding:16px; color:var(--text-muted);'>Nenhum relatório .pbix commitado no banco ainda.</td></tr>";
            return;
        }

        listaDashboardsCarregados.forEach(db => {
            const trDB = document.createElement("tr");
            trDB.className = "db-row";
            trDB.id = `tr-db-${db.id_dashboard}`;

            const versaoVigente = (db.commits && db.commits.length > 0)
                ? db.commits[0].numero_versao
                : "v1.0";
            const dataCommit = formatarData(db.ultimo_commit);

            trDB.innerHTML = `
                <td><strong>${escapeHtml(db.nome_dashboard || "")}</strong></td>
                <td>
                    <span style="background-color:var(--primary-light); color:var(--primary);
                        padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;">
                        ${escapeHtml(versaoVigente)}
                    </span>
                </td>
                <td style="color:var(--text-muted); font-size:13px;">${dataCommit}</td>
                <td style="text-align:right; padding-right:24px;">
                    <button class="btn-action-view"
                        style="background-color:var(--primary-light); color:var(--primary); border:none;
                        padding:6px 12px; border-radius:6px; font-weight:500; cursor:pointer;">Auditar</button>
                </td>`;

            trDB.addEventListener("click", () => toggleAuditoriaBIInline(db, trDB, tbody));
            tbody.appendChild(trDB);
        });
    } catch (error) {
        console.error("Erro ao renderizar dashboards:", error);
        tbody.innerHTML = "<tr><td colspan='4' style='color:red; padding:16px;'>Erro ao carregar dados do Hub ALM.</td></tr>";
    }
}

function toggleAuditoriaBIInline(db, trDB, tbody) {
    const idLinhaAuditoria = `tr-audit-db-${db.id_dashboard}`;
    const existente = document.getElementById(idLinhaAuditoria);

    if (existente) {
        existente.classList.add("collapsing-row");
        trDB.classList.remove("selected");
        setTimeout(() => existente.remove(), 230);
        return;
    }

    document.querySelectorAll(".bi-audit-row").forEach(row => {
        row.classList.add("collapsing-row");
        setTimeout(() => row.remove(), 230);
    });
    document.querySelectorAll(".db-row").forEach(r => r.classList.remove("selected"));
    trDB.classList.add("selected");

    const trAudit = document.createElement("tr");
    trAudit.className = "bi-audit-row";
    trAudit.id = idLinhaAuditoria;
    trAudit.style.backgroundColor = "#f8fafc";

    // ----- Histórico de commits -----
    let linhasCommits = "";
    const commits = Array.isArray(db.commits) ? db.commits : [];
    const nomePainel = db.nome_dashboard || "Relatorio";

    if (commits.length > 0) {
        commits.forEach(c => {
            const deletado = c.is_deleted === 1 || c.is_deleted === true;
            const statusBlob = deletado
                ? "<span style='color:#b91c1c; font-weight:600;'>Excluído (Fisicamente)</span>"
                : "📦 Armazenado em ZIP";
            const data = formatarData(c.data_atualizacao);
            const resumo = escapeHtml(c.descricao_alteracao || "Sem sumário informado no commit.");

            let btnAcao;
            if (deletado) {
                const payloadEncoded = encodeURIComponent(JSON.stringify(c));
                btnAcao = `<a href="javascript:void(0);"
                    onclick="exibirDetalhesDelecao('${payloadEncoded}', event)"
                    style="color:#b91c1c; font-size:12px; font-weight:600; text-decoration:underline; cursor:pointer; display: inline-block; padding: 4px;">
                    Ver Detalhes do Descarte</a>`;
            } else {
                btnAcao = `<div style="display:flex; gap:8px; align-items:center; justify-content: center;">
                    <button onclick="event.stopPropagation(); window.location.href='/api/dashboards/versao/download/${c.id_versao}';"
                        style="background-color:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:4px;
                        cursor:pointer; font-weight:600; font-size:12px; white-space: nowrap;">
                        📥 Baixar</button>
                    <button onclick="executarDescarteBinario(${c.id_versao}, event)"
                        style="background-color:#fee2e2; color:#991b1b; border:none; padding:6px 12px; border-radius:4px;
                        cursor:pointer; font-weight:500; font-size:12px; white-space: nowrap;">
                        Excluir Binário</button>
                </div>`;
            }

            // Montagem da linha com os textos solicitados
            linhasCommits += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:16px 12px; vertical-align:middle; text-align:left;">
                        <span style="font-size:13px; font-weight:600; color:var(--text-main);">${escapeHtml(nomePainel)}.pbix</span>
                        <span style="display:inline-block; margin-left:8px; background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">
                            ${escapeHtml(c.numero_versao || "")}
                        </span>
                    </td>
                    <td style="padding:16px 12px; vertical-align:middle; color:var(--text-muted); text-align:center;">${data}</td>
                    <td style="padding:16px 12px; vertical-align:middle; font-size:12px; text-align:left;">
                        <div style="margin-bottom:4px;">${statusBlob}</div>
                        <small style="color:#475569; font-style:italic; font-weight:500;">
                            📝 Resumo: ${resumo}
                        </small>
                    </td>
                    <td style="padding:16px 12px; vertical-align:middle; text-align:center;">${btnAcao}</td>
                </tr>`;
        });
    } else {
        linhasCommits = "<tr><td colspan='4' style='padding:16px; text-align:center;'>Nenhum histórico registrado.</td></tr>";
    }

    // ----- Bloco de tabelas -----
    const textoBruto = db.tabelas_utilizadas_texto || db.tabelas_utilizadas || "Nenhuma tabela indexada.";
    const textoFormatado = formatarDicionarioDados(textoBruto);

    const listaTabelasHTML = `
        <div style="font-family:'Fira Code','Courier New',monospace; font-size:13px; color:#0f172a;
            background-color:#f8fafc; padding:18px; border-radius:8px; border:1px solid #cbd5e1;
            line-height:1.6; max-height:280px; overflow-y:auto; white-space:pre-wrap; margin:0;
            box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
${escapeHtml(textoFormatado)}</div>`;

        trAudit.innerHTML = `
        <td colspan="4">
            <div id="edit-block-db-${db.id_dashboard}" class="bi-audit-container"
                 style="padding:24px 32px; display:flex; flex-direction:column; gap:24px;
                        width:100%; box-sizing:border-box; border-bottom:2px solid var(--primary-light);">

                <!-- 1. INFORMAÇÕES DE GOVERNANÇA E TABELAS -->
                <div>
                    <!-- Cabeçalho com botões, usando flex-wrap para não estourar a tela -->
                    <div style="display:flex; flex-wrap: wrap; justify-content:space-between; align-items:center; gap: 12px; margin-bottom:16px; width: 100%;">
                        <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.5px; font-weight:700; margin: 0;">
                            📋 Informações de Governança</h4>
                        
                        <!-- Botões com flex-shrink: 0 para não sumirem -->
                        <div style="display:flex; gap:10px; flex-shrink: 0;">
                            <button onclick="event.stopPropagation(); atalhoCommitNovaVersao(${db.id_dashboard}, event)"
                                style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0;
                                padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                                🚀 Commit de Nova Versão</button>
                            <button onclick="event.stopPropagation(); ativarModoEdicaoDB(${db.id_dashboard}, event)"
                                style="background:var(--primary-light); color:var(--primary); border:none;
                                padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                                ✏️ Editar Cadastro</button>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div>
                            <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">
                                📍 Localização no Ambiente</h4>
                            <p style="font-size:13px; font-weight:600; color:var(--primary);">
                                ${escapeHtml(db.nome_workspace || "Ambiente Central Compartilhado")}</p>
                        </div>
                        <div>
                            <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">
                                🔌 Conexões de Dados Mapeadas</h4>
                            <p style="font-size:13px; font-weight:500; color:var(--text-main);">
                                ${escapeHtml(db.fontes || "Oracle DB, Excel")}</p>
                        </div>
                    </div>

                    <div style="margin-bottom:16px;">
                        <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">
                            🔗 Link do Iframe (Embed)</h4>
                        <p style="font-size:12px; font-family:monospace; color:var(--text-muted);
                            overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:#fff;
                            padding:6px; border-radius:4px; border:1px solid var(--border-color);">
                            ${escapeHtml(extrairLinkPuro(db.link_embed))}</p>
                    </div>

                    <div style="background:#fff; border:1px solid var(--border-color); padding:16px; border-radius:8px;">
                        <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                            🗂️ Tabelas / Visões Consultadas no Banco (Oracle)</h4>
                        <div style="font-family:monospace; font-size:12px; line-height:1.5;">
                            ${listaTabelasHTML}
                        </div>
                    </div>
                </div>

                <!-- 2. VISUALIZAÇÃO DO RELATÓRIO (IFRAME) -->
                <div>
                    <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                        🖼️ Visualização do Relatório (Homologação / Iframe Ativo)</h4>
                    <div class="pbi-frame-wrapper"
                         style="width:100%; height:600px; background:#e2e8f0; border-radius:8px;
                                overflow:hidden; border:1px solid var(--border-color); position: relative; z-index: 1;">
                        <iframe src="${extrairLinkPuro(db.link_embed)}" 
                                title="Relatório Power BI"
                                style="width:100%; height:100%; border:none; display: block;" 
                                allowfullscreen 
                                webkitallowfullscreen 
                                mozallowfullscreen>
                        </iframe>
                    </div>
                </div>

                <!-- 3. HISTÓRICO DE COMMITS -->
                <div>
                    <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                        📜 Histórico de Commits e Controle de Versão</h4>
                    <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
                        <table class="version-control-table" style="width:100%; border-collapse:collapse; table-layout: fixed;">
                            <thead style="background-color:#f1f5f9; color:var(--text-muted); border-bottom: 1px solid var(--border-color);">
                                <tr>
                                    <!-- Aumentei a largura desta coluna para caber o nome + a versão na mesma linha -->
                                    <th style="padding:14px 12px; width: 35%; text-align: left; font-weight: 600;">Arquivo / Versão</th>
                                    <th style="padding:14px 12px; width: 15%; text-align: center; font-weight: 600;">Data Commit</th>
                                    <th style="padding:14px 12px; width: 30%; text-align: left; font-weight: 600;">Status / Detalhes</th>
                                    <th style="padding:14px 12px; width: 20%; text-align: center; font-weight: 600;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${linhasCommits}</tbody>
                        </table>
                    </div>
                </div>

            </div>
        </td>`;

    trDB.insertAdjacentElement("afterend", trAudit);
}

// ------------------------------------------------------------
// Descarte de binário
// ------------------------------------------------------------
function executarDescarteBinario(idVersao, event) {
    if (event) event.stopPropagation();
    idVersaoSelecionadaParaDeletar = idVersao;
    elementoTrLinhaCommitAtiva = event?.target?.closest("tr") || null;

    const detalhes = document.getElementById("modalDetalhes");
    if (detalhes) detalhes.value = "";
    document.getElementById("deleteModal")?.classList.add("show");
}

function exibirDetalhesDelecao(payloadEncoded, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    let commitObj;
    try {
        commitObj = typeof payloadEncoded === "string"
            ? JSON.parse(decodeURIComponent(payloadEncoded))
            : payloadEncoded;
    } catch (e) {
        console.error("Payload inválido em exibirDetalhesDelecao:", e);
        return;
    }

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set("lblAuditVersao", commitObj.numero_versao || "—");
    set("lblAuditUser", commitObj.usuario_excluiu || "u123456 (Admin)");

    const data = commitObj.data_exclusao_binario
        ? String(commitObj.data_exclusao_binario).replace("T", " ").substring(0, 19)
        : "Data Recente";
    set("lblAuditData", data);
    set("lblAuditMotivo", commitObj.motivo_exclusao || "Liberação de espaço");
    set("lblAuditDetalhes", commitObj.detalhes_exclusao || "Nenhum detalhamento inserido pelo responsável.");

    document.getElementById("detailsModal")?.classList.add("show");
}

// ------------------------------------------------------------
// Select de workspaces no formulário de novo PBIx
// ------------------------------------------------------------
async function carregarWorkspacesNoFormSelect() {
    const containerWS = document.getElementById("biWorkspaceVinculoContainer");
    if (!containerWS) return;

    try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) throw new Error("Falha ao buscar ambientes.");
        const workspaces = await response.json();

        containerWS.innerHTML = "";

        if (!workspaces || workspaces.length === 0) {
            containerWS.innerHTML = "<p style='font-size:13px; color:var(--text-muted);'>Nenhuma workspace cadastrada no banco.</p>";
            return;
        }

        workspaces.forEach(ws => {
            const label = document.createElement("label");
            label.className = "workspace-checkbox-item";
            label.innerHTML = `
                <input type="checkbox" name="workspaces_selecionadas" value="${escapeHtml(ws.id_workspace)}">
                <span>${escapeHtml(ws.nome_comercial || "")}</span>`;
            containerWS.appendChild(label);
        });
    } catch (error) {
        console.error("Erro ao carregar lista de checkboxes:", error);
    }
}

// ------------------------------------------------------------
// Edição inline de cadastro (Power BI)
// ------------------------------------------------------------
async function ativarModoEdicaoDB(idDashboard, event) {
    if (event) event.stopPropagation();

    const db = listaDashboardsCarregados.find(item => item.id_dashboard === idDashboard);
    if (!db) return;

    const container = document.getElementById(`edit-block-db-${db.id_dashboard}`);
    if (!container) return;

    if (!container.dataset.htmlOriginal) {
        container.dataset.htmlOriginal = container.innerHTML;
    }

    container.style.display = "block";

    let opcoesWorkspacesHTML = "";
    try {
        const resWS = await fetch("/api/workspaces");
        const todasWorkspaces = await resWS.json();
        const ambientesAtuais = db.nome_workspace ? db.nome_workspace.split(", ") : [];

        (todasWorkspaces || []).forEach(ws => {
            const estaVinculado = ambientesAtuais.includes(ws.nome_comercial) ? "checked" : "";
            opcoesWorkspacesHTML += `
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="edit_workspaces_${db.id_dashboard}" value="${escapeHtml(ws.id_workspace)}" ${estaVinculado} style="width:16px; height:16px; accent-color:var(--primary);">
                    <span>${escapeHtml(ws.nome_comercial || "")}</span>
                </label>`;
        });
    } catch (err) {
        opcoesWorkspacesHTML = "<p style='color:red; font-size:12px;'>Falha ao carregar ambientes.</p>";
    }

    const tabelasValue = (db.tabelas_utilizadas_texto === "Nenhuma tabela indexada neste relatório.") ? "" : (db.tabelas_utilizadas_texto || "");

    container.innerHTML = `
        <div style="background:#fff; border:1px solid var(--primary); padding:24px; border-radius:var(--radius-md); box-shadow:0 4px 12px rgba(2,132,199,0.05); width:100%;">
            <h4 style="font-size:12px; color:var(--primary); margin-bottom:16px; font-weight:700; text-transform:uppercase; letter-spacing:.5px;">
                ✏️ Editar Registro Principal de Governança</h4>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:14px;">
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px; display:block;">Nome Comercial do Relatório</label>
                    <input type="text" id="edit-nome-${db.id_dashboard}" value="${escapeHtml(db.nome_dashboard || "")}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px; display:block;">Tabelas Consultadas no Banco (Oracle)</label>
                    <textarea id="edit-tabelas-${db.id_dashboard}" rows="3" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main); resize:vertical;">${escapeHtml(tabelasValue)}</textarea>
                </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px; display:block;">Link de Embed do Frame (URL de Visualização)</label>
                <input type="url" id="edit-link-${db.id_dashboard}" value="${escapeHtml(db.link_embed || "")}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; font-family:monospace; color:var(--text-main);">
            </div>

            <div class="form-group" style="margin-bottom:20px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px; display:block;">Alocação nos Ambientes / Workspaces</label>
                <div style="background:#f8fafc; border:1px solid var(--border-color); padding:14px; border-radius:6px; display:flex; flex-direction:column; gap:8px; max-height:120px; overflow-y:auto;">
                    ${opcoesWorkspacesHTML}
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border-color); padding-top:16px;">
                <button class="btn-modal-cancel" onclick="restaurarTelaAuditoriaAnterior(${db.id_dashboard}, event)" style="padding:8px 16px; font-size:12px; cursor:pointer;">Cancelar</button>
                <button class="btn-primary" onclick="salvarAlteracaoRegistroPrincipal(${db.id_dashboard}, event)" style="padding:8px 20px; font-size:12px; background:var(--primary); cursor:pointer;">Salvar Alterações</button>
            </div>
        </div>`;
}

function restaurarTelaAuditoriaAnterior(idDashboard, event) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`edit-block-db-${idDashboard}`);
    if (container && container.dataset.htmlOriginal) {
        container.innerHTML = container.dataset.htmlOriginal;
        container.dataset.htmlOriginal = "";
    }
}

async function salvarAlteracaoRegistroPrincipal(idDashboard, event) {
    if (event) event.stopPropagation();

    const novoNome = (document.getElementById(`edit-nome-${idDashboard}`)?.value || "").trim();
    const novoLink = (document.getElementById(`edit-link-${idDashboard}`)?.value || "").trim();
    const novasTabelas = (document.getElementById(`edit-tabelas-${idDashboard}`)?.value || "").trim();

    const checkboxes = document.querySelectorAll(`input[name="edit_workspaces_${idDashboard}"]:checked`);
    const listaWorkspacesIds = Array.from(checkboxes).map(cb => cb.value);

    if (!novoNome || !novoLink) {
        exibirNotificacaoErro("Nome e Link do Frame são obrigatórios.");
        return;
    }
    if (listaWorkspacesIds.length === 0) {
        exibirNotificacaoErro("O relatório precisa estar alocado em pelo menos uma workspace.");
        return;
    }

    try {
        const response = await fetch("/api/dashboards/editar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_dashboard: idDashboard,
                nome: novoNome,
                link: novoLink,
                tabelas: novasTabelas,
                id_workspaces: listaWorkspacesIds
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Ambientes e metadados atualizados com sucesso no SQLite!");
            await renderizarTabelaDashboards();
            setTimeout(() => {
                const trPai = document.getElementById(`tr-db-${idDashboard}`);
                if (trPai) trPai.click();
            }, 220);
        } else {
            exibirNotificacaoErro("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        exibirNotificacaoErro("Falha de comunicação com o servidor Python.");
    }
}

function restaurarTelaAuditoriaAnterior(idDashboard, event) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`edit-block-db-${idDashboard}`);
    if (container && container.dataset.htmlOriginal) {
        container.innerHTML = container.dataset.htmlOriginal;
        container.dataset.htmlOriginal = "";
    }
}

async function salvarAlteracaoRegistroPrincipal(idDashboard, event) {
    if (event) event.stopPropagation();

    const novoNome = (document.getElementById(`edit-nome-${idDashboard}`)?.value || "").trim();
    const novoLink = (document.getElementById(`edit-link-${idDashboard}`)?.value || "").trim();
    const novasTabelas = (document.getElementById(`edit-tabelas-${idDashboard}`)?.value || "").trim();

    const checkboxes = document.querySelectorAll(`input[name="edit_workspaces_${idDashboard}"]:checked`);
    const listaWorkspacesIds = Array.from(checkboxes).map(cb => cb.value);

    if (!novoNome || !novoLink) {
        exibirNotificacaoErro("Nome e Link do Frame são obrigatórios.");
        return;
    }
    if (listaWorkspacesIds.length === 0) {
        exibirNotificacaoErro("O relatório precisa estar alocado em pelo menos uma workspace.");
        return;
    }

    try {
        const response = await fetch("/api/dashboards/editar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_dashboard: idDashboard,
                nome: novoNome,
                link: novoLink,
                tabelas: novasTabelas,
                id_workspaces: listaWorkspacesIds
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Ambientes e metadados atualizados com sucesso no SQLite!");
            await renderizarTabelaDashboards();
            setTimeout(() => {
                const trPai = document.getElementById(`tr-db-${idDashboard}`);
                if (trPai) trPai.click();
            }, 220);
        } else {
            exibirNotificacaoErro("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        exibirNotificacaoErro("Falha de comunicação com o servidor Python.");
    }
}

function atalhoCommitNovaVersao(idDashboard, event) {
    if (event) event.stopPropagation();
    const db = listaDashboardsCarregados.find(item => item.id_dashboard === idDashboard);
    if (!db) return;

    document.getElementById("subTabNovoBI")?.click();
    const inputNome = document.getElementById("biNomeComercial");
    if (inputNome && db.nome_dashboard) inputNome.value = db.nome_dashboard;
}

function redirecionarParaItem(tipo, nomeOuId, event) {
    if (event) event.stopPropagation(); 
    const nomeLimpo = nomeOuId.replace(/\s*\(.*?\)/g, '').trim();
    console.log("🔍 Buscando pelo nome real:", nomeLimpo);

    if (tipo === 'pbi') {
        document.getElementById("menuPowerBI").click();
        
        let tentativas = 0;
        const abrirDashboard = setInterval(() => {
            tentativas++;
            const linhas = document.querySelectorAll("#tbodyDashboards tr.db-row");
            let encontrou = false;

            for (let tr of linhas) {
                const textoLinha = tr.innerText.toLowerCase().replace(/\s+/g, ' ').trim();
                const textoBusca = nomeLimpo.toLowerCase().replace(/\s+/g, ' ').trim();

                if (textoLinha.includes(textoBusca)) {
                    clearInterval(abrirDashboard);
                    encontrou = true;
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    tr.style.transition = "background-color 0.3s";
                    tr.style.backgroundColor = "#fef08a"; 
                    setTimeout(() => { tr.style.backgroundColor = ""; }, 1500); 
                    tr.click(); 
                    break;
                }
            }

            if (!encontrou && tentativas > 20) {
                clearInterval(abrirDashboard);
                console.warn("❌ O item ainda não foi encontrado.");
            }
        }, 200); 

    } else if (tipo === 'user') {
        document.getElementById("menuUsuario").click();
        
        let tentativasUser = 0;
        const abrirUsuario = setInterval(() => {
            tentativasUser++;
            const linhas = document.querySelectorAll("#tbodyUsuarios tr.user-row");
            let encontrou = false;

            for (let tr of linhas) {
                const textoLinha = tr.innerText.toLowerCase().replace(/\s+/g, ' ').trim();
                const textoBusca = nomeLimpo.toLowerCase().replace(/\s+/g, ' ').trim();

                if (textoLinha.includes(textoBusca)) {
                    clearInterval(abrirUsuario);
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    tr.click(); 
                    encontrou = true;
                    break;
                }
            }

            if (!encontrou && tentativasUser > 20) {
                clearInterval(abrirUsuario);
            }
        }, 200);
    }
}

async function carregarWorkspacesNoFormUsuario() {
    const container = document.getElementById("userWorkspaceGrid");
    if (!container) return;

    try {
        const response = await fetch('/api/workspaces');
        const workspaces = await response.json();
        container.innerHTML = "";

        workspaces.forEach(ws => {
            const label = document.createElement("label");
            label.className = "workspace-checkbox-item";
            label.style.margin = "0";
            label.innerHTML = `
                <input type="checkbox" name="user_workspaces" value="${ws.id_workspace}">
                <span>${escapeHtml(ws.nome_comercial)}</span>
            `;
            container.appendChild(label);
        });
    } catch (error) {
        console.error("Erro ao carregar workspaces:", error);
        container.innerHTML = "<p style='color:red;'>Erro ao carregar ambientes.</p>";
    }
}

// ------------------------------------------------------------
// Usuários — listagem, filtro e auditoria
// ------------------------------------------------------------
async function renderizarTabelaUsuarios() {
    const tbody = document.getElementById("tbodyUsuarios");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='4' style='padding:16px;'>Buscando usuários...</td></tr>";

    try {
        const response = await fetch('/api/usuarios'); 
        if (!response.ok) throw new Error(`O servidor retornou o status ${response.status}`);
        
        listaUsuariosCarregados = await response.json();

        const inputFiltro = document.getElementById("filtroBuscaUser");
        if (inputFiltro) inputFiltro.value = "";

        desenharLinhasUsuarios();
        
    } catch (error) {
        console.error("❌ Erro ao buscar usuários:", error);
        tbody.innerHTML = `<tr><td colspan='4' style='color:red; padding:16px;'>
            Erro ao carregar usuários: ${error.message}
        </td></tr>`;
    }
}

function desenharLinhasUsuarios(usuariosParaDesenhar = listaUsuariosCarregados) {
    const tbody = document.getElementById("tbodyUsuarios");
    tbody.innerHTML = "";

    if (!usuariosParaDesenhar || usuariosParaDesenhar.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='padding:16px; color:var(--text-muted);'>Nenhum usuário encontrado.</td></tr>";
        return;
    }

    usuariosParaDesenhar.forEach(user => {
        const tr = document.createElement("tr");
        tr.className = "user-row";
        tr.id = `tr-user-${user.id_usuario}`;
        
        const nomeUser = user.nome || "Sem Nome";
        const ldapUser = user.ldap || "Sem LDAP";
        const emailUser = user.email || "Sem e-mail";

        tr.innerHTML = `
            <td><strong>${escapeHtml(nomeUser)}</strong></td>
            <td style="color:var(--text-muted);">${escapeHtml(ldapUser)}</td>
            <td style="color:var(--text-muted);">${escapeHtml(emailUser)}</td>
            <td style="text-align:right; padding-right:24px;">
                <button class="btn-action-view">Auditar</button>
            </td>
        `;

        tr.addEventListener("click", () => toggleAuditoriaUsuarioInline(user, tr));
        tbody.appendChild(tr);
    });
}

function filtrarTabelaUsuarios() {
    const input = document.getElementById("filtroBuscaUser");
    if (!input) return;
    
    const termo = input.value.toLowerCase().trim();
    
    if (termo === "") {
        desenharLinhasUsuarios(listaUsuariosCarregados);
        return;
    }

    const usuariosFiltrados = listaUsuariosCarregados.filter(user => {
        const nome = (user.nome || "").toLowerCase();
        const ldap = (user.ldap || "").toLowerCase();
        return nome.includes(termo) || ldap.includes(termo);
    });

    desenharLinhasUsuarios(usuariosFiltrados);
}

function toggleAuditoriaUsuarioInline(user, trUser) {
    const idAuditoria = `tr-audit-user-${user.id_usuario || user.ldap}`;
    const existente = document.getElementById(idAuditoria);

    if (existente) {
        existente.remove();
        trUser.classList.remove("selected");
        return;
    }

    document.querySelectorAll(".user-audit-row").forEach(r => r.remove());
    document.querySelectorAll(".user-row").forEach(r => r.classList.remove("selected"));
    trUser.classList.add("selected");

    const trAudit = document.createElement("tr");
    trAudit.className = "user-audit-row";
    trAudit.id = idAuditoria;

    let htmlWorkspaces = "";
    if (user.workspaces && user.workspaces.length > 0) {
        user.workspaces.forEach(ws => {
            const wsId = ws.id_workspace || ws.id;
            const wsNome = ws.nome_comercial || ws.nome;
            
            const dashsHTML = ws.dashboards && ws.dashboards.length > 0
                ? ws.dashboards.map(d => `<li>📊 ${escapeHtml(d)}</li>`).join("")
                : "<li style='color:var(--text-muted); border:none;'>Nenhum dashboard alocado nesta workspace.</li>";

            htmlWorkspaces += `
                <div style="margin-bottom: 8px; border-radius: 6px;">
                    <button class="btn-ws-user-audit" onclick="toggleDashboardsDaWorkspace('${wsId}', event)">
                        <span>📍 ${escapeHtml(wsNome)}</span>
                        <span>▼</span>
                    </button>
                    <div id="panel-dashs-${wsId}" class="ws-dashboards-panel">
                        <ul style="list-style:none; padding:0; margin:0;">
                            ${dashsHTML}
                        </ul>
                    </div>
                </div>
            `;
        });
    } else {
        htmlWorkspaces = "<p style='color:var(--text-muted); font-size:14px;'>Este usuário não possui acesso a nenhuma workspace.</p>";
    }

    trAudit.innerHTML = `
        <td colspan="4" style="padding:0 !important; background-color:#f8fafc;">
            <div id="edit-block-user-${user.id_usuario}" style="padding: 24px 32px; border-bottom: 2px solid var(--primary-light);">
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h4 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.8px; font-weight: 700; margin:0;">
                        🗂️ Workspaces com Acesso
                    </h4>
                    <button onclick="ativarModoEdicaoUsuario(${user.id_usuario}, event)" 
                            style="background: var(--primary-light); color: var(--primary); border:none; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                        ✏️ Editar Cadastro
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    ${htmlWorkspaces}
                </div>
            </div>
        </td>
    `;

    trUser.insertAdjacentElement("afterend", trAudit);
}

function toggleDashboardsDaWorkspace(wsId, event) {
    event.stopPropagation();
    const panel = document.getElementById(`panel-dashs-${wsId}`);
    if (panel) {
        panel.classList.toggle("active");
    }
}

async function ativarModoEdicaoUsuario(idUsuario, event) {
    if (event) event.stopPropagation();
    const user = listaUsuariosCarregados.find(u => u.id_usuario === idUsuario);
    if (!user) return;

    const container = document.getElementById(`edit-block-user-${idUsuario}`);
    if (!container) return;

    if (!container.dataset.htmlOriginal) {
        container.dataset.htmlOriginal = container.innerHTML;
    }

    let opcoesWorkspacesHTML = "";
    try {
        const resWS = await fetch('/api/workspaces');
        const todasWorkspaces = await resWS.json();
        const idsWssDoUsuario = user.workspaces ? user.workspaces.map(w => w.id_workspace) : [];

        todasWorkspaces.forEach(ws => {
            const estaVinculado = idsWssDoUsuario.includes(ws.id_workspace) ? "checked" : "";
            opcoesWorkspacesHTML += `
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="edit_user_ws_${idUsuario}" value="${ws.id_workspace}" ${estaVinculado} style="width:16px; height:16px; accent-color:var(--primary);">
                    <span>${escapeHtml(ws.nome_comercial)}</span>
                </label>
            `;
        });
    } catch (err) {
        opcoesWorkspacesHTML = "<p style='color:red; font-size:12px;'>Falha ao carregar ambientes.</p>";
    }

    container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--primary); padding: 24px; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.05); width: 100%;">
            <h4 style="font-size: 12px; color: var(--primary); margin-bottom: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                ✏️ Editar Cadastro do Usuário
            </h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px;">
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Nome Completo</label>
                    <input type="text" id="edit-user-nome-${idUsuario}" value="${escapeHtml(user.nome)}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">E-mail Corporativo</label>
                    <input type="email" id="edit-user-email-${idUsuario}" value="${escapeHtml(user.email || '')}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Papel no Sistema (Role ID)</label>
                <select id="edit-user-role-${idUsuario}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                    <option value="1" ${user.papel !== 127 ? "selected" : ""}>Consumidor Padrão (Visualizador)</option>
                    <option value="127" ${user.papel === 127 ? "selected" : ""}>Administrador de Governança (Papel 127)</option>
                </select>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Vincular Workspaces</label>
                <div style="background-color:#f8fafc; border:1px solid var(--border-color); padding:14px; border-radius:6px; display:grid; grid-template-columns:1fr 1fr; gap:10px; max-height:180px; overflow-y:auto;">
                    ${opcoesWorkspacesHTML}
                </div>
            </div>

            <div style="display:flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                <button class="btn-modal-cancel" onclick="restaurarTelaAuditoriaUsuario(${idUsuario}, event)" style="padding:8px 16px; font-size:12px; cursor:pointer;">Cancelar</button>
                <button class="btn-primary" onclick="salvarEdicaoUsuario(${idUsuario}, event)" style="padding:8px 20px; font-size:12px; background:var(--primary); cursor:pointer;">Salvar Alterações</button>
            </div>
        </div>
    `;
}

function restaurarTelaAuditoriaUsuario(idUsuario, event) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`edit-block-user-${idUsuario}`);
    if (container && container.dataset.htmlOriginal) {
        container.innerHTML = container.dataset.htmlOriginal;
        container.dataset.htmlOriginal = "";
    }
}

async function salvarEdicaoUsuario(idUsuario, event) {
    if (event) event.stopPropagation();

    const novoNome = document.getElementById(`edit-user-nome-${idUsuario}`).value.trim();
    const novoEmail = document.getElementById(`edit-user-email-${idUsuario}`).value.trim();
    const novoPapel = document.getElementById(`edit-user-role-${idUsuario}`).value;
    
    const checkboxes = document.querySelectorAll(`input[name="edit_user_ws_${idUsuario}"]:checked`);
    const listaWorkspacesIds = Array.from(checkboxes).map(cb => cb.value);

    if (!novoNome) {
        exibirNotificacaoErro("O Nome é obrigatório.");
        return;
    }

    try {
        const response = await fetch('/api/usuarios/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: idUsuario,
                nome: novoNome,
                email: novoEmail,
                papel: parseInt(novoPapel),
                id_workspaces: listaWorkspacesIds
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Cadastro do usuário atualizado com sucesso!");
            await renderizarTabelaUsuarios();
            setTimeout(() => {
                const trPai = document.getElementById(`tr-user-${idUsuario}`);
                if (trPai) trPai.click(); 
            }, 250);
        } else {
            exibirNotificacaoErro("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        exibirNotificacaoErro("Falha de comunicação com o servidor Python.");
    }
}

// ------------------------------------------------------------
// Edição inline de Workspace
// ------------------------------------------------------------
function ativarModoEdicaoWorkspace(idWorkspace, event) {
    if (event) event.stopPropagation();

    fetch('/api/workspaces')
        .then(res => res.json())
        .then(workspaces => {
            const ws = workspaces.find(w => w.id_workspace === idWorkspace);
            if (!ws) return;

            const container = document.getElementById(`edit-block-ws-${idWorkspace}`);
            if (!container) return;

            if (!container.dataset.htmlOriginal) {
                container.dataset.htmlOriginal = container.innerHTML;
            }

            container.innerHTML = `
                <div style="background: #ffffff; border: 1px solid var(--primary); padding: 20px; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.05);">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Nome Comercial</label>
                        <input type="text" id="edit-ws-nome-${idWorkspace}" value="${escapeHtml(ws.nome_comercial)}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Descrição</label>
                        <textarea id="edit-ws-desc-${idWorkspace}" rows="3" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; resize:vertical;">${escapeHtml(ws.descricao || '')}</textarea>
                    </div>
                    <div style="display:flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn-modal-cancel" onclick="restaurarTelaAuditoriaWS(${idWorkspace}, event)" style="padding:8px 16px; font-size:12px; cursor:pointer;">Cancelar</button>
                        <button class="btn-primary" onclick="salvarEdicaoWorkspace(${idWorkspace}, event)" style="padding:8px 20px; font-size:12px; background:var(--primary); cursor:pointer;">Salvar</button>
                    </div>
                </div>
            `;
        });
}

function restaurarTelaAuditoriaWS(idWorkspace, event) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`edit-block-ws-${idWorkspace}`);
    if (container && container.dataset.htmlOriginal) {
        container.innerHTML = container.dataset.htmlOriginal;
        container.dataset.htmlOriginal = "";
    }
}

async function salvarEdicaoWorkspace(idWorkspace, event) {
    if (event) event.stopPropagation();

    const novoNome = document.getElementById(`edit-ws-nome-${idWorkspace}`).value.trim();
    const novaDesc = document.getElementById(`edit-ws-desc-${idWorkspace}`).value.trim();

    if (!novoNome) {
        exibirNotificacaoErro("O nome da workspace é obrigatório.");
        return;
    }

    try {
        const response = await fetch('/api/workspaces/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_workspace: idWorkspace,
                nome: novoNome,
                descricao: novaDesc
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Workspace atualizada com sucesso!");
            renderizarTabelaWorkspaces();
        } else {
            const err = await response.json();
            exibirNotificacaoErro(err.error || "Erro ao atualizar.");
        }
    } catch (error) {
        exibirNotificacaoErro("Falha de comunicação com o servidor.");
    }
}

// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------
function realizarLogout() {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "/"; 
}

// ------------------------------------------------------------
// PowerBI
// ------------------------------------------------------------

// Função que limpa o link, extraindo apenas a URL correta de dentro do texto
function extrairLinkPuro(linkSujo) {
    if (!linkSujo) return "";
    
    // Se o texto tiver uma tag <iframe>, ele procura o que está dentro de src=""
    const match = linkSujo.match(/src=["'](.*?)["']/);
    if (match && match[1]) {
        return match[1];
    }
    
    // Se não for uma tag, mas tiver espaços em branco, remove os espaços
    return linkSujo.trim();
}