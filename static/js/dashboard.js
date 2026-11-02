/* ============================================================
   HUB ALM - POWER BI / WORKSPACE MANAGER
   Arquivo consolidado e ajustado.
   ============================================================ */

let listaDashboardsCarregados = [];

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

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    // 1. Sidebar
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

    // 2. Menu principal (SPA)
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
            if (item.botao.id === "menuUsuario") renderizarTabelaUsuarios(); // <--- ADICIONE ESTA LINHA
        });
    });

    // 3. Sub-abas
    configurarSubAbasWorkspace();
    configurarSubAbasPowerBI();
    configurarSubAbasUsuario();

    // 4. Formulários
    configurarFormularios();

    // 5. Input de arquivo PBIx
    configurarInputArquivoPBIx();

    // 6. Modais (delete + details) — unificados aqui
    configurarModais();

    // 7. Carga inicial da home
    carregarDadosPainel("u123456");
});

// ------------------------------------------------------------
// Sub-abas Workspace
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

// ------------------------------------------------------------
// Sub-abas Power BI
// ------------------------------------------------------------
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

            // VALIDAÇÃO FRONTEND: Verifica se o nome já está na lista visível
            const workspacesExistentes = Array.from(document.querySelectorAll(".ws-row td strong")).map(el => el.innerText.trim().toLowerCase());
            if (workspacesExistentes.includes(nomeDigitado.toLowerCase())) {
                exibirNotificacaoErro("Este nome de Workspace já está em uso. Escolha outro.");
                inputNome.focus();
                return;
            }

            const guidAuto = (document.getElementById("wsIdPbi")?.value || "").trim()
                || ("auto-ws-" + Math.random().toString(36).substring(2, 15));

            const payload = {
                nome: nomeDigitado,
                guid: guidAuto,
                descricao: document.getElementById("wsDescricao").value
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
                    exibirNotificacaoSucesso(
                        `Commit realizado! Registrado como ${resultado.versao_gerada}. Fontes mapeadas com sucesso.`
                    );
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

    // 3. FORMULÁRIO DE USUÁRIO (Agora integrado com o Python)
    const formUsuario = document.getElementById("formUsuario");
    if (formUsuario) {
        formUsuario.addEventListener("submit", async function (e) {
            e.preventDefault();
            
            const nome = document.getElementById("userNome").value.trim();
            const ldap = document.getElementById("userLdap").value.trim();
            const email = document.getElementById("userEmail").value.trim();
            const papel = document.getElementById("userRole").value;
            
            // Pega as checkboxes de workspaces que o usuário marcou
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
                    document.getElementById("subTabListarUser")?.click(); // Volta para a lista
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
let idVersaoSelecionadaParaDeletar = null;
let elementoTrLinhaCommitAtiva = null;

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

    // Modal de detalhes da deleção
    const modalDetails = document.getElementById("detailsModal");
    const btnCloseDetailsX = document.getElementById("btnCloseDetailsX");
    const btnCloseDetailsBtn = document.getElementById("btnCloseDetailsBtn");
    const fecharDetalhes = () => { if (modalDetails) modalDetails.classList.remove("show"); };
    if (btnCloseDetailsX) btnCloseDetailsX.addEventListener("click", fecharDetalhes);
    if (btnCloseDetailsBtn) btnCloseDetailsBtn.addEventListener("click", fecharDetalhes);
}

// ------------------------------------------------------------
// Home — dados do painel
// ------------------------------------------------------------
async function carregarDadosPainel(codigoLdap) {
    try {
        const response = await fetch(`/api/workspaces/${codigoLdap}`);
        if (!response.ok) throw new Error("Erro de resposta.");
        const data = await response.json();

        const userName = document.getElementById("userName");
        const userCode = document.getElementById("userCode");
        const badge = document.getElementById("userBadge");
        const adminMenu = document.getElementById("adminMenu");

        if (userName) userName.textContent = "Administrador PBI";
        if (userCode) userCode.textContent = `LDAP: ${codigoLdap}`;
        if (badge) badge.textContent = `Papel: ${data.papel}`;

        if (data.is_admin) {
            if (adminMenu) adminMenu.style.display = "flex";
            if (badge) {
                badge.style.backgroundColor = "#e2fbf0";
                badge.style.color = "#0f766e";
            }
        } else {
            if (adminMenu) adminMenu.style.display = "none";
        }

        const grid = document.getElementById("workspacesGrid");
        if (!grid) return;
        grid.innerHTML = "";

        if (!data.workspaces || data.workspaces.length === 0) {
            grid.innerHTML = "<p class='text-muted'>Nenhum ambiente localizado para o seu acesso.</p>";
            return;
        }

        data.workspaces.forEach(ws => {
            const card = document.createElement("div");
            card.className = "workspace-card";

            card.onclick = () => {
                document.getElementById("menuWorkspace")?.click();
                setTimeout(() => {
                    const idWs = ws.id_workspace ?? ws.id;
                    const tr = document.getElementById(`tr-ws-${idWs}`);
                    if (tr) tr.click();
                }, 150);
            };

            card.innerHTML = `
                <div class="card-title">${escapeHtml(ws.nome || "")}</div>
                <div class="card-desc">${escapeHtml(ws.descricao || "Sem especificações.")}</div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Erro interno detectado:", error);
        const grid = document.getElementById("workspacesGrid");
        if (grid) {
            grid.innerHTML = `<p style="color:#b91c1c; font-size:14px;">
                Falha crítica ao conectar com a camada Service/Repository.</p>`;
        }
    }
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

    // CORREÇÃO: O botão de excluir agora usa data-id e data-nome para evitar erros de string
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
                        <!-- Botão de Excluir Corrigido -->
                        <button type="button" 
                                data-id="${ws.id_workspace}" 
                                data-nome="${escapeHtml(ws.nome_comercial).replace(/'/g, "\\'")}" 
                                onclick="event.stopPropagation(); excluirWorkspace(this, event)" 
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
                    style="color:#b91c1c; font-size:11px; font-weight:600; text-decoration:underline; cursor:pointer;">
                    Ver Detalhes do Descarte</a>`;
            } else {
                btnAcao = `<div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="event.stopPropagation(); window.location.href='/api/dashboards/versao/download/${c.id_versao}';"
                        style="background-color:#0284c7; color:#fff; border:none; padding:6px 10px; border-radius:4px;
                        cursor:pointer; font-weight:600; font-size:11px; min-width:65px;">
                        📥 Baixar</button>
                    <button onclick="executarDescarteBinario(${c.id_versao}, event)"
                        style="background-color:#fee2e2; color:#991b1b; border:none; padding:6px 10px; border-radius:4px;
                        cursor:pointer; font-weight:500; font-size:11px; min-width:85px;">
                        Excluir Binário</button>
                </div>`;
            }

            linhasCommits += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 8px; vertical-align:top;">
                        <strong>${escapeHtml(c.numero_versao || "")}</strong>
                    </td>
                    <td style="padding:12px 8px; vertical-align:top; color:var(--text-muted);">${data}</td>
                    <td style="padding:12px 8px; vertical-align:top; font-size:11px;">
                        ${statusBlob}
                        <small style="color:#475569; display:block; margin-top:4px; font-style:italic; font-weight:500;">
                            📝 Resumo: ${resumo}
                        </small>
                    </td>
                    <td style="padding:12px 8px; vertical-align:top;">${btnAcao}</td>
                </tr>`;
        });
    } else {
        linhasCommits = "<tr><td colspan='4' style='padding:16px; text-align:center;'>Nenhum histórico registrado.</td></tr>";
    }

    // ----- Bloco de tabelas -----
    const textoBruto = db.tabelas_utilizadas_texto || db.tabelas_utilizadas || "Nenhuma tabela indexada.";
    
    // Aplica a formatação de árvore
    const textoFormatado = formatarDicionarioDados(textoBruto);

    // Usa white-space: pre-wrap para garantir que o layout de texto seja mantido na tela
    const listaTabelasHTML = `
        <div style="font-family:'Fira Code','Courier New',monospace; font-size:13px; color:#0f172a;
            background-color:#f8fafc; padding:18px; border-radius:8px; border:1px solid #cbd5e1;
            line-height:1.6; max-height:280px; overflow-y:auto; white-space:pre-wrap; margin:0;
            box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
${escapeHtml(textoFormatado)}</div>`;
        
    // AQUI FOI FEITA A REORDENAÇÃO DOS BLOCOS (Governança -> Iframe -> Histórico)
    trAudit.innerHTML = `
        <td colspan="4">
            <div id="edit-block-db-${db.id_dashboard}" class="bi-audit-container"
                 style="padding:24px 32px; display:flex; flex-direction:column; gap:24px;
                        width:100%; box-sizing:border-box; border-bottom:2px solid var(--primary-light);">

                <!-- 1. INFORMAÇÕES DE GOVERNANÇA E TABELAS -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.5px; font-weight:700;">
                            📋 Informações de Governança</h4>
                        <div style="display:flex; gap:10px;">
                            <button onclick="atalhoCommitNovaVersao(${db.id_dashboard}, event)"
                                style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0;
                                padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                                🚀 Commit de Nova Versão</button>
                            <button onclick="ativarModoEdicaoDB(${db.id_dashboard}, event)"
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
                            ${escapeHtml(db.link_embed || "")}</p>
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
                         style="width:100%; height:450px; background:#e2e8f0; border-radius:8px;
                                overflow:hidden; border:1px solid var(--border-color);">
                        <iframe src="${escapeHtml(db.link_embed || "")}" title="Relatório Power BI"
                                style="width:100%; height:100%; border:none;" allowfullscreen></iframe>
                    </div>
                </div>

                <!-- 3. HISTÓRICO DE COMMITS COM SCROLL -->
                <div>
                    <h4 style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                        📜 Histórico de Commits e Controle de Versão</h4>
                    <div style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                        <table class="version-control-table"
                               style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                            <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <tr style="background-color:#f1f5f9; color:var(--text-muted);">
                                    <th style="padding:10px 8px; background-color:#f1f5f9;">Versão</th>
                                    <th style="padding:10px 8px; background-color:#f1f5f9;">Data Commit</th>
                                    <th style="padding:10px 8px; background-color:#f1f5f9;">Status / Detalhes do Commit</th>
                                    <th style="padding:10px 8px; background-color:#f1f5f9;">Ações</th>
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

// ------------------------------------------------------------
// Detalhes de deleção
// ------------------------------------------------------------
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
// Toasts
// ------------------------------------------------------------
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
// Edição inline de cadastro
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
                <label style="display:flex; align-items:center; gap:8px; font-size:13px;
                              color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="edit_workspaces_${db.id_dashboard}"
                           value="${escapeHtml(ws.id_workspace)}" ${estaVinculado}
                           style="width:16px; height:16px; accent-color:var(--primary);">
                    <span>${escapeHtml(ws.nome_comercial || "")}</span>
                </label>`;
        });
    } catch (err) {
        opcoesWorkspacesHTML = "<p style='color:red; font-size:12px;'>Falha ao carregar ambientes relacionais.</p>";
    }

    const tabelasValue = (db.tabelas_utilizadas_texto === "Nenhuma tabela indexada neste relatório.")
        ? ""
        : (db.tabelas_utilizadas_texto || "");

    container.innerHTML = `
        <div style="background:#fff; border:1px solid var(--primary); padding:24px;
                    border-radius:var(--radius-md); box-shadow:0 4px 12px rgba(2,132,199,0.05); width:100%;">
            <h4 style="font-size:12px; color:var(--primary); margin-bottom:16px; font-weight:700;
                       text-transform:uppercase; letter-spacing:.5px;">
                ✏️ Editar Registro Principal de Governança</h4>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:14px;">
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted);
                                  margin-bottom:6px; display:block;">Nome Comercial do Relatório</label>
                    <input type="text" id="edit-nome-${db.id_dashboard}" value="${escapeHtml(db.nome_dashboard || "")}"
                           style="width:100%; padding:10px; border:1px solid var(--border-color);
                                  border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted);
                                  margin-bottom:6px; display:block;">Tabelas Consultadas no Banco (Oracle)</label>
                    <input type="text" id="edit-tabelas-${db.id_dashboard}" value="${escapeHtml(tabelasValue)}"
                           style="width:100%; padding:10px; border:1px solid var(--border-color);
                                  border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted);
                              margin-bottom:6px; display:block;">Link de Embed do Frame (URL de Visualização)</label>
                <input type="url" id="edit-link-${db.id_dashboard}" value="${escapeHtml(db.link_embed || "")}"
                       style="width:100%; padding:10px; border:1px solid var(--border-color);
                              border-radius:6px; font-size:13px; font-family:monospace; color:var(--text-main);">
            </div>

            <div class="form-group" style="margin-bottom:20px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted);
                              margin-bottom:6px; display:block;">
                    Alocação nos Ambientes / Workspaces (Marque para Vincular)</label>
                <div style="background:#f8fafc; border:1px solid var(--border-color); padding:14px;
                            border-radius:6px; display:flex; flex-direction:column; gap:8px;
                            max-height:120px; overflow-y:auto;">
                    ${opcoesWorkspacesHTML}
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border-color);
                        padding-top:16px;">
                <button class="btn-modal-cancel" onclick="restaurarTelaAuditoriaAnterior(${db.id_dashboard}, event)"
                        style="padding:8px 16px; font-size:12px; cursor:pointer;">Cancelar</button>
                <button class="btn-primary" onclick="salvarAlteracaoRegistroPrincipal(${db.id_dashboard}, event)"
                        style="padding:8px 20px; font-size:12px; background:var(--primary); cursor:pointer;">
                    Salvar Alterações</button>
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
        alert("Nome e Link do Frame são obrigatórios.");
        return;
    }
    if (listaWorkspacesIds.length === 0) {
        alert("O relatório precisa estar alocado em pelo menos uma workspace.");
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
            alert("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        alert("Falha de comunicação com o servidor Python.");
    }
}

// ------------------------------------------------------------
// Atalho: abrir formulário de commit para versão nova
// ------------------------------------------------------------
function atalhoCommitNovaVersao(idDashboard, event) {
    if (event) event.stopPropagation();
    const db = listaDashboardsCarregados.find(item => item.id_dashboard === idDashboard);
    if (!db) return;

    document.getElementById("subTabNovoBI")?.click();
    const inputNome = document.getElementById("biNomeComercial");
    if (inputNome && db.nome_dashboard) inputNome.value = db.nome_dashboard;
}

function formatarDicionarioDados(textoBruto) {
    if (!textoBruto) return "Nenhuma tabela indexada.";
    
    let texto = textoBruto;

    // 1. Coloca um espaço antes de "TABELA:" para não colar na palavra anterior
    texto = texto.replace(/TABELA:/g, " TABELA:");

    // 2. Quebra a linha antes de "TABELA:" (com um espaço extra para respirar)
    texto = texto.replace(/ TABELA:/g, "\n\nTABELA:");

    // 3. O padrão do seu print mostra as colunas com hífen. 
    // Se o texto estiver inline, precisamos quebrar a linha antes de cada coluna.
    // Isso substitui o traço por "\n   - " (quebra de linha e 3 espaços)
    texto = texto.replace(/\s-\s/g, "\n   - ");

    // 4. Limpa espaços extras no começo e no fim
    return texto.trim();
}

function redirecionarParaItem(tipo, nomeOuId, event) {
    if (event) event.stopPropagation(); 

    // A MÁGICA ACONTECE AQUI: Limpa o texto, removendo o "(Criado: ... | Commit: ...)"
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

                    tr.click(); // Abre a auditoria com o Iframe
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
            label.style.margin = "0"; // Sobrescreve margens se houver
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

async function salvarNovoUsuario(event) {
    event.preventDefault();
    
    const nome = document.getElementById("userNome").value.trim();
    const ldap = document.getElementById("userLdap").value.trim();
    const checkboxes = document.querySelectorAll('input[name="user_workspaces"]:checked');
    const workspacesIds = Array.from(checkboxes).map(cb => cb.value);

    if (!nome || !ldap) {
        exibirNotificacaoErro("Nome e Usuário (LDAP) são obrigatórios.");
        return;
    }

    try {
        // Supondo que a API aceite esse payload. Ajuste conforme seu backend Python.
        const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: nome,
                ldap: ldap,
                id_workspaces: workspacesIds
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Usuário cadastrado com sucesso!");
            document.getElementById("formUsuario").reset();
            document.getElementById("subTabListarUsuario").click(); // Vai para a aba de listagem
        } else {
            alert("Erro ao salvar usuário.");
        }
    } catch (error) {
        exibirNotificacaoErro("Falha de comunicação com o servidor.");
    }
}

// =========================================================================
// GESTÃO DE USUÁRIOS (ABAS, LISTAGEM, FILTRO E AUDITORIA)
// =========================================================================

let listaUsuariosCarregados = [];

// 1. Configura as abas de Listar e Cadastrar
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
        renderizarTabelaUsuarios(); // Chama a busca
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


async function renderizarTabelaUsuarios() {
    console.log("1. Iniciando renderização da tabela de usuários...");
    const tbody = document.getElementById("tbodyUsuarios");
    
    if (!tbody) {
        console.error("❌ ERRO FATAL: A tag <tbody id='tbodyUsuarios'> NÃO EXISTE no HTML!");
        return;
    }
    
    tbody.innerHTML = "<tr><td colspan='4' style='padding:16px;'>Buscando usuários...</td></tr>";

    try {
        const response = await fetch('/api/usuarios'); 
        
        if (!response.ok) throw new Error(`O servidor retornou o status ${response.status}`);
        
        listaUsuariosCarregados = await response.json();
        console.log("2. Dados recebidos do Python:", listaUsuariosCarregados);

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

// 3. Desenha as linhas na tabela (usado pelo carregamento e pelo filtro)
function desenharLinhasUsuarios(usuariosParaDesenhar = listaUsuariosCarregados) {
    console.log("3. Tentando desenhar as linhas na tela. Total:", usuariosParaDesenhar.length);
    
    const tbody = document.getElementById("tbodyUsuarios");
    tbody.innerHTML = "";

    if (!usuariosParaDesenhar || usuariosParaDesenhar.length === 0) {
        console.warn("⚠️ Nenhum usuário para desenhar (lista vazia).");
        tbody.innerHTML = "<tr><td colspan='4' style='padding:16px; color:var(--text-muted);'>Nenhum usuário encontrado.</td></tr>";
        return;
    }

    usuariosParaDesenhar.forEach(user => {
        const tr = document.createElement("tr");
        tr.className = "user-row";
        
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
    
    console.log("4. ✅ Tabela desenhada com sucesso!");
}

// 4. Filtro de Pesquisa
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

// 5. Auditoria (Acordeão do usuário)
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

    // Adicionado o botão de editar e a div com ID para ser substituída pelo formulário
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

// 6. Abre o painel de dashboards dentro da workspace do usuário
function toggleDashboardsDaWorkspace(wsId, event) {
    event.stopPropagation();
    const panel = document.getElementById(`panel-dashs-${wsId}`);
    if (panel) {
        panel.classList.toggle("active");
    }
}

async function ativarModoEdicaoUsuario(idUsuario, event) {
    if (event) event.stopPropagation();

    // Busca os dados atuais do usuário na memória
    const user = listaUsuariosCarregados.find(u => u.id_usuario === idUsuario);
    if (!user) return;

    const container = document.getElementById(`edit-block-user-${idUsuario}`);
    if (!container) return;

    // Salva o HTML original caso o usuário clique em "Cancelar"
    if (!container.dataset.htmlOriginal) {
        container.dataset.htmlOriginal = container.innerHTML;
    }

    // Prepara a lista de checkboxes de workspaces
    let opcoesWorkspacesHTML = "";
    try {
        const resWS = await fetch('/api/workspaces');
        const todasWorkspaces = await resWS.json();
        
        // Mapeia as IDs de workspaces que esse usuário já tem
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

    // Substitui o conteúdo pela tela de edição
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
        alert("O Nome é obrigatório.");
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
            
            // Recarrega a tabela para atualizar os dados
            await renderizarTabelaUsuarios();
            
            // Reabre a auditoria do usuário com os dados novos
            setTimeout(() => {
                const trPai = document.getElementById(`tr-user-${idUsuario}`);
                if (trPai) trPai.click(); 
            }, 250);
        } else {
            alert("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        alert("Falha de comunicação com o servidor Python.");
    }
}

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

// --- FUNÇÃO DE EXCLUIR COM CONFIRMAÇÃO ---

// Variável para guardar qual workspace está sendo excluída no momento
let wsIdParaExcluir = null;

function excluirWorkspace(botao, event) {
    if (event) event.stopPropagation();

    // Pega os dados diretamente do botão
    const idWorkspace = botao.getAttribute('data-id');
    const nomeWorkspace = botao.getAttribute('data-nome');
    
    wsIdParaExcluir = idWorkspace;
    
    // Preenche o modal
    const elNome = document.getElementById("deleteWsNome");
    if (elNome) elNome.textContent = nomeWorkspace;
    
    // Abre o modal
    const modal = document.getElementById("deleteWsModal");
    if (modal) modal.classList.add("show");
}

// =========================================================================
// OUVINTE GLOBAL (O Segredo para funcionar sempre)
// Este evento escuta qualquer clique na tela inteira, garantindo que o botão
// "Sim, Excluir" funcione independente de quando ele foi carregado.
// =========================================================================
document.addEventListener("click", async function(event) {
    // Verifica se o que foi clicado é o botão de confirmar (ou algo dentro dele)
    const btnConfirm = event.target.closest("#btnConfirmDeleteWs");
    
    if (btnConfirm) {
        if (!wsIdParaExcluir) return;
        
        const textoOriginal = btnConfirm.textContent;
        btnConfirm.textContent = "Excluindo...";
        btnConfirm.disabled = true;

        try {
            const response = await fetch('/api/workspaces/excluir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_workspace: wsIdParaExcluir })
            });

            if (response.ok) {
                document.getElementById("deleteWsModal").classList.remove("show");
                exibirNotificacaoSucesso("Workspace excluída com sucesso!");
                renderizarTabelaWorkspaces(); // Atualiza a tabela
            } else {
                exibirNotificacaoErro("Erro ao excluir a workspace no servidor.");
            }
        } catch (error) {
            exibirNotificacaoErro("Falha de comunicação com o servidor.");
        } finally {
            btnConfirm.textContent = textoOriginal;
            btnConfirm.disabled = false;
            wsIdParaExcluir = null;
        }
    }
});