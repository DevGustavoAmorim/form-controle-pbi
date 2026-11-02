let listaDashboardsCarregados = [];

document.addEventListener("DOMContentLoaded", function() {
    // 1. Controle de Expansão/Recolhimento do Sidebar
    const btnCloseSidebar = document.getElementById("btnCloseSidebar");
    const btnOpenSidebar = document.getElementById("btnOpenSidebar");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("mainContent");
    
    if (btnCloseSidebar) {
        btnCloseSidebar.addEventListener("click", function() {
            sidebar.classList.add("collapsed");
            btnOpenSidebar.style.display = "flex";
            mainContent.classList.add("expanded");
        });
    }

    if (btnOpenSidebar) {
        btnOpenSidebar.addEventListener("click", function() {
            sidebar.classList.remove("collapsed");
            btnOpenSidebar.style.display = "none";
            mainContent.classList.remove("expanded");
        });
    }

    // 2. Sistema SPA - Alternância das Abas Principais do Menu Lateral
    const mapeamentoMenus = [
        { botao: document.getElementById("menuHome"), aba: document.getElementById("tabHome") },
        { botao: document.getElementById("menuWorkspace"), aba: document.getElementById("tabWorkspace") },
        { botao: document.getElementById("menuUsuario"), aba: document.getElementById("tabUsuario") },
        { botao: document.getElementById("menuPowerBI"), aba: document.getElementById("tabPowerBI") }
    ];

    mapeamentoMenus.forEach(item => {
        if (item.botao) {
            item.botao.addEventListener("click", function(e) {
                e.preventDefault();
                
                // Remove o estado ativo de todas as abas e menus
                mapeamentoMenus.forEach(i => {
                    if (i.botao) i.botao.classList.remove("active");
                    if (i.aba) i.aba.classList.remove("active");
                });
                
                // Ativa o menu e a tela correspondente clicada
                item.botao.classList.add("active");
                if (item.aba) item.aba.classList.add("active");
                
                // GATILHO DE SEGURANÇA: Identifica qual tela foi aberta e força a carga real do SQLite
                if (item.botao.id === "menuWorkspace") {
                    renderizarTabelaWorkspaces();
                }
                if (item.botao.id === "menuPowerBI") {
                    renderizarTabelaDashboards();
                }
            });
        }
    });


    // 3. Sistema de Sub-Abas Internas (Workspaces Existentes vs Cadastrar Novo)
    configurarSubAbasWorkspace();
    configurarSubAbasPowerBI();

    // 4. Configuração do Envio de Formulários com Persistência
    configurarFormularios();

    // Carga de dados inicial da Home
    const codigoUsuarioLogado = "u123456"; 
    carregarDadosPainel(codigoUsuarioLogado);
});

function configurarSubAbasWorkspace() {
    const btnListar = document.getElementById("subTabListarWS");
    const btnNovo = document.getElementById("subTabNovoWS");
    const secListar = document.getElementById("secListarWS");
    const secNovo = document.getElementById("secNovoWS");

    if (btnListar && btnNovo) {
        btnListar.addEventListener("click", function() {
            btnListar.classList.add("active");
            btnNovo.classList.remove("active");
            secListar.classList.add("active");
            secNovo.classList.remove("active");
            renderizarTabelaWorkspaces();
        });

        btnNovo.addEventListener("click", function() {
            btnNovo.classList.add("active");
            btnListar.classList.remove("active");
            secNovo.classList.add("active");
            secListar.classList.remove("active");
        });
    }
}

async function renderizarTabelaWorkspaces() {
    const tbody = document.getElementById("tbodyWorkspaces");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='2' style='padding:16px;'>Buscando ambientes em ordem alfabética no SQLite...</td></tr>";

    try {
        const response = await fetch('/api/workspaces');
        if (!response.ok) throw new Error("Erro na comunicação com a API.");
        const workspacesDoBanco = await response.json();
        
        tbody.innerHTML = "";
        
        if (workspacesDoBanco.length === 0) {
            tbody.innerHTML = "<tr><td colspan='2' style='padding:16px; color:var(--text-muted);'>Nenhum ambiente de workspace localizado no banco.</td></tr>";
            return;
        }
        
        workspacesDoBanco.forEach(ws => {
            const trWS = document.createElement("tr");
            trWS.className = "ws-row";
            trWS.id = `tr-ws-${ws.id_workspace}`;
            
            // Renderiza apenas o Nome Comercial e a descrição, com o botão Auditar à direita
            trWS.innerHTML = `
                <td><strong>${ws.nome_comercial}</strong><br><small style="color:var(--text-muted)">${ws.descricao || 'Sem descrição técnica alocada.'}</small></td>
                <td style="text-align: right; padding-right: 24px;">
                    <button class="btn-action-view" style="background-color: var(--primary-light); color: var(--primary); border:none; padding:6px 12px; border-radius:6px; font-weight:500; cursor:pointer;">Auditar</button>
                </td>
            `;
            
            // Adiciona o evento de acordeão dinâmico inline para abrir os subcampos
            trWS.addEventListener("click", () => {
                toggleAuditoriaInline(ws, trWS, tbody);
            });
            
            tbody.appendChild(trWS);
        });
    } catch (error) {
        console.error("Erro ao carregar workspaces:", error);
        tbody.innerHTML = "<tr><td colspan='2' style='color:red; padding:16px;'>Erro ao conectar com o repositório de Workspaces do SQLite.</td></tr>";
    }
}


// O submit do formulário agora gera um GUID falso automaticamente para o banco não reclamar
const formWS = document.getElementById("formWorkspace");
if (formWS) {
    formWS.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        // Como o banco exige um GUID único, nós geramos um randômico oculto aqui no JS
        const guidAutomatico = 'auto-ws-' + Math.random().toString(36).substring(2, 15);

        const payload = {
            nome: document.getElementById("wsNomeComercial").value,
            guid: guidAutomatico, // Enviado oculto para persistência do banco
            descricao: document.getElementById("wsDescricao").value
        };

        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert("Workspace cadastrada com sucesso!");
                formWS.reset();
                document.getElementById("subTabListarWS").click(); // Retorna atualizando a lista
            } else {
                const err = await response.json();
                alert(`Erro interno: ${err.error}`);
            }
        } catch (error) {
            alert("Falha ao se conectar com o servidor Python.");
        }
    });
}


function toggleAuditoriaInline(ws, trWS, tbody) {
    const idLinhaAuditoria = `tr-audit-${ws.id_workspace}`;
    const linhaAuditoriaExistente = document.getElementById(idLinhaAuditoria);

    // Se a linha já estiver aberta embaixo desta, nós fechamos (efeito retrátil)
    if (linhaAuditoriaExistente) {
        linhaAuditoriaExistente.remove();
        trWS.classList.remove("selected");
        return;
    }

    // Fecha qualquer outra linha de auditoria que esteja aberta no momento para manter a tela limpa
    const todasAuditorias = document.querySelectorAll(".audit-row");
    todasAuditorias.forEach(row => row.remove());
    const todasLinhasWS = document.querySelectorAll(".ws-row");
    todasLinhasWS.forEach(row => row.classList.remove("selected"));

    // Marca a linha atual como selecionada (ganha o destaque verde pastel sutil)
    trWS.classList.add("selected");

    // 2. Cria dinamicamente a nova linha de auditoria para encaixar EMBAIXO
    const trAudit = document.createElement("tr");
    trAudit.className = "audit-row";
    trAudit.id = idLinhaAuditoria;

    // Constrói as strings de itens de forma limpa
    const liDashboards = ws.dashs.length > 0 
        ? ws.dashs.map(d => `<li>${d}</li>`).join('') 
        : "<li>Nenhum relatório alocado neste ambiente</li>";

    const liUsuarios = ws.users.length > 0 
        ? ws.users.map(u => `<li>${u}</li>`).join('') 
        : "<li>Nenhum usuário liberado neste ambiente</li>";

    // Procure por esse bloco dentro da função toggleAuditoriaBIInline e substitua:

    trAudit.innerHTML = `
        <td colspan="4">
            <div id="edit-block-db-${db.id_dashboard}" class="bi-audit-container" style="padding: 24px 32px; background-color: #f8fafc; border-bottom: 2px solid var(--primary-light);">
                
                <!-- 1. Cabeçalho de Ações e Informações Macros -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; font-weight: 700;">📋 Informações de Governança</h4>
                    <button class="btn-action-view" onclick="ativarModoEdicaoDB(${db.id_dashboard}, event)" style="background-color: var(--primary-light); color: var(--primary); border:none; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">✏️ Editar Cadastro</button>
                </div>

                <!-- 2. Grid de Distribuição de Metadados Físicos -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px;">
                    <div>
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">📍 Localização no Ambiente</h4>
                        <p style="font-size: 13px; font-weight: 600; color: var(--primary);">${db.nome_workspace || 'Ambiente Central Compartilhado'}</p>
                    </div>
                    <div>
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">🔌 Conexões de Dados Mapeadas</h4>
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-main);">${db.fontes || 'Oracle DB, Excel'}</p>
                    </div>
                </div>

                <!-- 3. Barra de Exibição da URL de Embed Ativa -->
                <div style="margin-bottom: 16px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">🔗 Link do Iframe (Embed)</h4>
                    <p style="font-size: 12px; font-family: monospace; color: var(--text-muted); background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${db.link_embed}</p>
                </div>

                <!-- 4. Submenu Modular das Tabelas Ativas do Oracle SQL -->
                <div style="margin-bottom: 20px; background-color: #ffffff; border: 1px solid var(--border-color); padding: 16px; border-radius: 8px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">🗂️ Tabelas / Visões Consultadas no Banco (Oracle)</h4>
                    <div style="font-family: monospace; font-size: 12px; line-height: 1.5;">
                        ${listaTabelasHTML}
                    </div>
                </div>

                                <!-- 5. Histórico de Commits -->
                <div style="margin-bottom: 24px;">
                    <!-- Mantenha aqui sua tabela de histórico de commits -->
                </div>

                <!-- 6. POWER BI NO FINAL DA PÁGINA -->
                <div style="
                    display: block;
                    clear: both;
                    width: 100%;
                    margin-top: 30px;
                    padding-top: 24px;
                    border-top: 1px solid var(--border-color);
                    box-sizing: border-box;
                ">
                    <h4 style="
                        font-size: 11px;
                        text-transform: uppercase;
                        color: var(--text-muted);
                        letter-spacing: 0.5px;
                        margin-bottom: 12px;
                        font-weight: 700;
                    ">
                        🖼️ Visualização do Relatório Power BI
                    </h4>

                    <div class="pbi-frame-wrapper" style="
                        position: relative;
                        display: block;
                        width: 100%;
                        height: 460px;
                        background-color: #e2e8f0;
                        border-radius: 8px;
                        overflow: hidden;
                        border: 1px solid var(--border-color);
                        box-sizing: border-box;
                    ">
                        <iframe
                            src="${db.link_embed}"
                            title="Relatório Power BI"
                            style="
                                display: block;
                                width: 100%;
                                height: 100%;
                                border: none;
                            "
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>

            </div>
        </td>
    </tr>
`;


    // O truque técnico: Insere a linha de auditoria imediatamente após a linha do Workspace selecionado
    trWS.insertAdjacentElement('afterend', trAudit);
}


function exibirAuditoriaWorkspace(ws, trElement) {
    const linhas = document.querySelectorAll("#tbodyWorkspaces tr");
    linhas.forEach(l => l.classList.remove("selected"));
    trElement.classList.add("selected");

    const placeholder = document.getElementById("auditPlaceholder");
    const content = document.getElementById("auditDetailsContent");
    
    placeholder.classList.add("hidden");
    content.classList.remove("hidden");

    document.getElementById("auditWSNome").textContent = ws.nome;
    document.getElementById("auditWSId").textContent = `GUID: ${ws.guid}`;

    // Renderiza os Dashboards com data de criação e último commit
    const ulDashs = document.getElementById("auditListDashboards");
    ulDashs.innerHTML = "";
    if (ws.dashs.length === 0) {
        ulDashs.innerHTML = "<li>Nenhum relatório alocado</li>";
    } else {
        ws.dashs.forEach(d => {
            const li = document.createElement("li");
            li.textContent = d;
            ulDashs.appendChild(li);
        });
    }

    // Renderiza a lista de usuários com scroll limitado por CSS
    const ulUsers = document.getElementById("auditListUsuarios");
    ulUsers.innerHTML = "";
    if (ws.users.length === 0) {
        ulUsers.innerHTML = "<li>Nenhum usuário com acesso direto</li>";
    } else {
        ws.users.forEach(u => {
            const li = document.createElement("li");
            li.textContent = u;
            ulUsers.appendChild(li);
        });
    }
}

function configurarFormularios() {
    const formWS = document.getElementById("formWorkspace");
    if (formWS) {
        formWS.addEventListener("submit", async function(e) {
            e.preventDefault();
            
            const payload = {
                nome: document.getElementById("wsNomeComercial").value,
                guid: document.getElementById("wsIdPbi").value,
                descricao: document.getElementById("wsDescricao").value
            };

            try {
                const response = await fetch('/api/workspaces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    alert("Workspace adicionada com sucesso ao banco SQLite!");
                    formWS.reset();
                    document.getElementById("subTabListarWS").click(); // Retorna atualizando a lista
                } else {
                    const err = await response.json();
                    alert(`Erro interno: ${err.error}`);
                }
            } catch (error) {
                alert("Falha ao se conectar com o servidor Python.");
            }
        });
    }

    // Interceptadores temporários para as outras abas pendentes de banco
    const interceptarForm = (idForm, msgSucesso) => {
        const form = document.getElementById(idForm);
        if (form && idForm !== "formWorkspace") {
            form.addEventListener("submit", function(e) {
                e.preventDefault();
                alert(`[Sucesso Mocado] ${msgSucesso}`);
                form.reset();
            });
        }
    };
    interceptarForm("formUsuario", "Usuário cadastrado com sucesso.");
}

async function carregarDadosPainel(codigoLdap) {
    try {
        const response = await fetch(`/api/workspaces/${codigoLdap}`);
        if (!response.ok) throw new Error("Erro de resposta.");
        const data = await response.json();
        
        document.getElementById("userName").textContent = "Administrador PBI";
        document.getElementById("userCode").textContent = `LDAP: ${codigoLdap}`;
        
        const badge = document.getElementById("userBadge");
        badge.textContent = `Papel: ${data.papel}`;

        const adminMenu = document.getElementById("adminMenu");
        if (data.is_admin) {
            adminMenu.style.display = "flex";
            badge.style.backgroundColor = "#e2fbf0";
            badge.style.color = "#0f766e";
        } else {
            adminMenu.style.display = "none";
        }

        const grid = document.getElementById("workspacesGrid");
        grid.innerHTML = ""; 

        if (data.workspaces.length === 0) {
            grid.innerHTML = "<p class='text-muted'>Nenhum ambiente localizado para o seu acesso.</p>";
            return;
        }

        data.workspaces.forEach(ws => {
            const card = document.createElement("div");
            card.className = "workspace-card";
            
            // CORREÇÃO: Ajustado para usar ws.id de forma segura no clique
            card.onclick = () => {
                document.getElementById("menuWorkspace").click();
                setTimeout(() => {
                    const tr = document.getElementById(`tr-ws-${ws.id}`);
                    if (tr) tr.click();
                }, 150);
            };
            
            // CORREÇÃO: Envelopado o HTML com crases (Template Literals)
            card.innerHTML = `
                <div class="card-title">${ws.nome}</div> 
                <div class="card-desc">${ws.descricao || 'Sem especificações.'}</div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Erro interno detectado:", error);
        // CORREÇÃO: Envelopado o HTML com crases (Template Literals)
        document.getElementById("workspacesGrid").innerHTML = `
            <p style="color: #b91c1c; font-size: 14px;">Falha crítica ao conectar com a camada Service/Repository.</p>
        `;
    }
}

///////////////////////////////////////////////////////////////
//////  ABA DE CADASTRO DE POWERBI
///////////////////////////////////////////////////////////////
// Adicione este monitor de arquivo dentro da sua função DOMContentLoaded ou de configuração de forms:

const fileInputPBI = document.getElementById("filePbix");
if (fileInputPBI) {
    fileInputPBI.addEventListener("change", async function() {
        if (this.files.length > 0) {
            const arquivo = this.files[0];
            const nomeLimpo = arquivo.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            
            document.getElementById("biNomeComercial").value = nomeLimpo;
            document.getElementById("biFontesDetectadas").value = "Analisando metadados e conexões no SQLite...";
            
            const badge = document.getElementById("fileInfoArea");
            const badgeText = document.getElementById("fileInfoText");
            if (badge && badgeText) {
                badgeText.textContent = `Arquivo carregado: ${arquivo.name} (${(arquivo.size / (1024*1024)).toFixed(2)} MB)`;
                badge.classList.remove("hidden");
            }

            // ==========================================================================
            // NOVO: CONSULTA DE GOVERNANÇA ALM EM TEMPO DE EXECUÇÃO
            // ==========================================================================
            try {
                const response = await fetch(`/api/dashboards/verificar/${encodeErrorKind(nomeLimpo)}`);
                const checagem = await response.json();
                
                const containerWS = document.getElementById("containerSeletorWorkspaces");
                const btnSubmit = document.getElementById("btnSubmitCommit");

                if (checagem.existe) {
                    // REGRA ATENDIDA: Se o relatório já existir, esconde o bloco de workspaces e muda o botão
                    if (containerWS) containerWS.style.display = "none";
                    if (btnSubmit) btnSubmit.textContent = `🚀 Fazer Commit de Nova Versão (${checagem.proxima_versao})`;
                    btnSubmit.dataset.pbiExiste = "true";
                } else {
                    // Registro inédito: mostra as caixas e mantém o texto padrão
                    if (containerWS) containerWS.style.display = "flex";
                    if (btnSubmit) btnSubmit.textContent = "Fazer Commit e Incrementar Versão";
                    btnSubmit.dataset.pbiExiste = "false";
                }
            } catch (err) {
                console.error("Erro na verificação ALM:", err);
            }
        }
    });
}

// Função auxiliar segura para URIs
function encodeErrorKind(str) { return encodeURIComponent(str); }

// ==========================================================================
// FUNÇÕES DE AUDITORIA INLINE DO POWER BI (HUB ALM)
// ==========================================================================

async function renderizarTabelaDashboards() {
    const tbody = document.getElementById("tbodyDashboards");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='4' style='padding:16px;'>Buscando relatórios e commits no SQLite...</td></tr>";

    try {
        // Chamada para a nossa API Python que coleta os PBIs
        const response = await fetch('/api/dashboards');
        if (!response.ok) throw new Error("Erro na comunicação com a API.");
        const dashboardsDoBanco = await response.json();
        listaDashboardsCarregados = dashboardsDoBanco; 
        
        tbody.innerHTML = "";
        
        if (dashboardsDoBanco.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' style='padding:16px; color:var(--text-muted);'>Nenhum relatório .pbix commitado no banco ainda.</td></tr>";
            return;
        }

        dashboardsDoBanco.forEach(db => {
            const trDB = document.createElement("tr");
            trDB.className = "db-row";
            trDB.id = `tr-db-${db.id_dashboard}`;
            
            // Pega a versão mais recente/vigente mapeada na lista de commits
            const versaoVigente = db.commits && db.commits.length > 0 ? db.commits[0].numero_versao : 'v1.0';
            const dataCommit = db.ultimo_commit ? db.ultimo_commit.substring(0, 10) : 'Sem data';

            trDB.innerHTML = `
                <td><strong>${db.nome_dashboard}</strong></td>
                <td><span style="background-color: var(--primary-light); color: var(--primary); padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;">${versaoVigente}</span></td>
                <td style="color: var(--text-muted); font-size:13px;">${dataCommit}</td>
                <td style="text-align: right; padding-right: 24px;">
                    <button class="btn-action-view" style="background-color: var(--primary-light); color: var(--primary); border:none; padding:6px 12px; border-radius:6px; font-weight:500; cursor:pointer;">Auditar</button>
                </td>
            `;
            
            // Evento que abre o painel completo embaixo da linha do BI
            trDB.addEventListener("click", () => {
                toggleAuditoriaBIInline(db, trDB, tbody);
            });
            
            tbody.appendChild(trDB);
        });
    } catch (error) {
        console.error("Erro ao renderizar dashboards:", error);
        tbody.innerHTML = "<tr><td colspan='4' style='color:red; padding:16px;'>Erro ao carregar dados do Hub ALM.</td></tr>";
    }
}

function toggleAuditoriaBIInline(db, trDB, tbody) {
    const idLinhaAuditoria = `tr-audit-db-${db.id_dashboard}`;
    const linhaAuditoriaExistente = document.getElementById(idLinhaAuditoria);

    // SE A LINHA JÁ EXISTIR: Remove com suavidade sem pular a página para o topo
    if (linhaAuditoriaExistente) {
        // Adiciona a classe de animação de fechamento que criamos no CSS
        linhaAuditoriaExistente.classList.add("collapsing-row");
        trDB.classList.remove("selected");
        
        // Aguarda a animação de 250ms terminar para remover o elemento fisicamente do DOM
        setTimeout(() => {
            linhaAuditoriaExistente.remove();
        }, 230);
        return;
    }

    // Limpa outras expansões de BI abertas aplicando o mesmo fechamento suave
    const todasAuditorias = document.querySelectorAll(".bi-audit-row");
    todasAuditorias.forEach(row => {
        row.classList.add("collapsing-row");
        setTimeout(() => row.remove(), 230);
    });
    
    const todasLinhasDB = document.querySelectorAll(".db-row");
    todasLinhasDB.forEach(row => row.classList.remove("selected"));

    trDB.classList.add("selected");

    const trAudit = document.createElement("tr");
    trAudit.className = "bi-audit-row";
    trAudit.id = idLinhaAuditoria;
    trAudit.style.backgroundColor = "#f8fafc";

    // Constrói a lista do histórico de Commits/Versões estilo Git mapeando os binários
    let linhasCommits = "";
    if (db.commits && db.commits.length > 0) {
        db.commits.forEach(c => {
            const statusBlob = c.is_deleted ? "<span style='color:#b91c1c; font-weight:600;'>Excluído (Fisicamente)</span>" : "📦 Armazenado em ZIP";
            
            let btnAcao = "";
            if (c.is_deleted === 1 || c.is_deleted === true) {
                btnAcao = `
                    <a href="javascript:void(0);" 
                       onclick="exibirDetalhesDelecao(${JSON.stringify(c).replace(/"/g, '&quot;')}, event)" 
                       style="color: #b91c1c; font-size: 11px; font-weight: 600; text-decoration: underline; cursor: pointer;">
                        Ver Detalhes do Descarte
                    </a>
                `;
            } else {
                btnAcao = `
                    <button class="btn-action-delete-version" 
                            onclick="executarDescarteBinario(${c.id_versao}, event)" 
                            style="background-color: #fee2e2; color: #991b1b; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:500; font-size:11px;">
                        Excluir Binário
                    </button>
                `;
            }

            linhasCommits += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:12px 8px; vertical-align: top;">
                        <strong>${c.numero_versao}</strong>
                    </td>
                    <td style="padding:12px 8px; vertical-align: top; color: var(--text-muted);">${c.data_atualizacao.substring(0, 10)}</td>
                    <td style="padding:12px 8px; vertical-align: top; font-size:11px;">
                        ${statusBlob}<br>
                        <!-- SUBMENU INTERNO: Exibe a Descrição do Commit / Mensagem Git de ajuste -->
                        <small style="color: #475569; display:block; margin-top:4px; font-style:italic; font-weight:500;">
                            📝 Resumo: ${c.descricao_alteracao || 'Sem sumário informado no commit.'}
                        </small>
                    </td>
                    <td style="padding:12px 8px; vertical-align: top;">${btnAcao}</td>
                </tr>
            `;
        });
    } else {
        linhasCommits = "<tr><td colspan='4' style='padding:16px; text-align:center;'>Nenhum histórico registrado.</td></tr>";
    }

        // ==========================================================================
    // EXIBIÇÃO PREMIUM DE DICIONÁRIO DE DADOS ESTILO TERMINAL (pbixray)
    // ==========================================================================
    const textoTabelasReal = db.tabelas_utilizadas_texto || "Nenhuma tabela indexada.";
    
    // Injeta o visor simulando rastro de código do terminal corporativo real
    const listaTabelasHTML = `
        <pre style="
            font-family: 'Fira Code', 'Courier New', monospace; 
            font-size: 13px; 
            color: #0f172a; 
            background-color: #f8fafc; 
            padding: 18px; 
            border-radius: 8px; 
            border: 1px solid #cbd5e1; 
            line-height: 1.6; 
            max-height: 280px; 
            overflow-y: auto; 
            white-space: pre-wrap; 
            margin: 0;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        ">${textoTabelasReal}</pre>
    `;

    // Link real público e funcional do Power BI para testes de portfólio (Evita o erro 404/Not Found)
    const urlIframeReal = "https://powerbi.com";

    // Substitua o início do bloco trAudit.innerHTML dentro da função toggleAuditoriaBIInline por este trecho:

    trAudit.innerHTML = `
        <td colspan="4">
            <div class="bi-audit-container" style="padding: 24px 32px; display: flex; flex-direction: column; gap: 32px; width: 100%; box-sizing: border-box; border-bottom: 2px solid var(--primary-light);">
                
                <!-- Coluna Esquerda: Metadados, Localização, Fontes e Submenu de Tabelas -->
                <div id="edit-block-db-${db.id_dashboard}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">📋 Informações de Governança</h4>
                        <!-- Botão de Edição do Registro Principal -->
                        <button class="btn-action-view" onclick="ativarModoEdicaoDB(${db.id_dashboard}, event)" style="background-color: var(--primary-light); color: var(--primary); border:none; padding:4px 10px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">✏️ Editar Cadastro</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                        <div>
                            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">📍 Localização no Ambiente</h4>
                            <p style="font-size: 13px; font-weight: 600; color: var(--primary);">${db.nome_workspace || 'Ambiente Central Compartilhado'}</p>
                        </div>
                        <div>
                            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">🔌 Conexões de Dados Mapeadas</h4>
                            <p style="font-size: 13px; font-weight: 500; color: var(--text-main);">${db.fontes || 'Oracle DB, Excel'}</p>
                        </div>
                    </div>

                    <!-- Bloco Interativo de Link de Embed (Visível na Auditoria) -->
                    <div style="margin-bottom: 16px;">
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px;">🔗 Link do Iframe (Embed)</h4>
                        <p style="font-size: 12px; font-family: monospace; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: #ffffff; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color);">${db.link_embed}</p>
                    </div>

                    <!-- SUBMENU INTERNO: Tabelas de Banco Utilizadas -->
                    <div style="margin-bottom: 20px; background-color: #ffffff; border: 1px solid var(--border-color); padding: 16px; border-radius: 8px;">
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">🗂️ Tabelas / Visões Consultadas no Banco (Oracle)</h4>
                        <div style="font-family: monospace; font-size: 12px; line-height: 1.5;">
                            ${listaTabelasHTML}
                        </div>
                    </div>

                    <div>
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">📜 Histórico de Commits e Controle de Versão</h4>
                        <table class="version-control-table" style="width:100%; border-collapse: collapse; font-size:12px; text-align:left;">
                            <thead>
                                <tr style="background-color:#f1f5f9; color:var(--text-muted);">
                                    <th style="padding:8px 8px;">Versão</th>
                                    <th style="padding:8px 8px;">Data Commit</th>
                                    <th style="padding:8px 8px;">Status / Detalhes do Commit</th>
                                    <th style="padding:8px 8px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${linhasCommits}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Coluna Direita: O Iframe Ativo -->
                <div>
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">🖼️ Visualização do Relatório (Homologação / Iframe Ativo)</h4>
                    <div class="pbi-frame-wrapper" style="width: 100%; height: 360px; background-color: #e2e8f0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                        <iframe src="${db.link_embed}" style="width: 100%; height: 100%; border: none;" allowFullScreen="true"></iframe>
                    </div>
                </div>
            </div>
        </td>
    `;


    trDB.insertAdjacentElement('afterend', trAudit);
}


// Variável global oculta para o JavaScript saber qual versão apagar quando clicar em "Confirmar" dentro do modal
// Variáveis de controle para o modal customizado não perder a referência da linha clicada
let idVersaoSelecionadaParaDeletar = null;
let elementoTrLinhaCommitAtiva = null;

function executarDescarteBinario(idVersao, event) {
    event.stopPropagation(); // Impede o fechamento automático do acordeão macro
    
    // Guarda as referências na memória global para uso do modal de confirmação
    idVersaoSelecionadaParaDeletar = idVersao;
    elementoTrLinhaCommitAtiva = event.target.closest("tr");
    
    // Limpa textos de testes anteriores e abre o Pop-up Customizado com CSS Premium
    document.getElementById("modalDetalhes").value = ""; 
    document.getElementById("deleteModal").classList.add("show");
}

// Configuração dos gatilhos de cliques internos do Pop-up Customizado
document.addEventListener("DOMContentLoaded", function() {
    const btnCancel = document.getElementById("btnCancelModal");
    const btnCloseX = document.getElementById("btnCloseModalX");
    const btnConfirm = document.getElementById("btnConfirmModal");
    const modal = document.getElementById("deleteModal");

    const fecharModal = () => { if(modal) modal.classList.remove("show"); };

    if (btnCancel) btnCancel.addEventListener("click", fecharModal);
    if (btnCloseX) btnCloseX.addEventListener("click", fecharModal);

    if (btnConfirm) {
        btnConfirm.addEventListener("click", async function() {
            if (!idVersaoSelecionadaParaDeletar || !elementoTrLinhaCommitAtiva) return;

            const motivoValue = document.getElementById("modalMotivo").value;
            const detalhesValue = document.getElementById("modalDetalhes").value;

            btnConfirm.textContent = "Limpando registros...";
            btnConfirm.disabled = true;

            try {
                const response = await fetch('/api/dashboards/versao/deletar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_versao: idVersaoSelecionadaParaDeletar,
                        usuario_ldap: "u123456",
                        motivo: motivoValue,
                        detalhes: detalhesValue
                    })
                });

                if (response.ok) {
                    fecharModal();
                    
                    // Dispara o Toast verde pastel no topo direito da tela
                    exibirNotificacaoSucesso("Arquivo físico .pbix removido do SQLite. Histórico de Logs preservado!");
                    
                    // Faz a busca rápida em segundo plano para atualizar os dados globais na memória do SPA
                    const responseAtualizada = await fetch('/api/dashboards');
                    if (responseAtualizada.ok) {
                        const novosDados = await responseAtualizada.json();
                        listaDashboardsCarregados = novosDados;

                        // Localiza o objeto atualizado do log para embutir no clique do botão de detalhes
                        let commitAtualizado = {
                            id_versao: idVersaoSelecionadaParaDeletar,
                            numero_versao: elementoTrLinhaCommitAtiva.cells[0].innerText.strip || "v1",
                            usuario_excluiu: "u123456 (Admin)",
                            data_exclusao_binario: new Date().toISOString(),
                            motivo_exclusao: motivoValue,
                            detalhes_exclusao: detalhesValue
                        };

                        // CORREÇÃO DEFINITIVA DO CSS: Atualiza as tags internas sem quebrar as colunas originais <td>
                        const celulaStatus = elementoTrLinhaCommitAtiva.cells[2];
                        const celulaBotao = elementoTrLinhaCommitAtiva.cells[3];

                        if (celulaStatus && celulaBotao) {
                            celulaStatus.innerHTML = `<span style="color:#b91c1c; font-weight:600;">Excluído (Fisicamente)</span>`;
                            celulaBotao.innerHTML = `
                                <a href="javascript:void(0);" 
                                   onclick="exibirDetalhesDelecao(${JSON.stringify(commitAtualizado).replace(/"/g, '&quot;')}, event)" 
                                   style="color: #b91c1c; font-size: 12px; font-weight: 600; text-decoration: underline; cursor: pointer;">
                                    Arq Deletado - Detalhes
                                </a>
                            `;
                        }
                    }
                } else {
                    alert("Erro interno do servidor ao processar descarte.");
                }
            } catch (error) {
                alert("Falha crítica de comunicação com o Python.");
            } finally {
                btnConfirm.textContent = "Confirmar Exclusão Física";
                btnConfirm.disabled = false;
            }
        });
    }
});




function exibirDetalhesDelecao(commitObj, event) {
    event.preventDefault();
    event.stopPropagation(); // Impede o fechamento do acordeão da tabela

    // Captura e injeta os dados reais recuperados do SQLite para dentro do Modal de Detalhes
    document.getElementById("lblAuditVersao").textContent = commitObj.numero_versao;
    document.getElementById("lblAuditUser").textContent = commitObj.usuario_excluiu || "u123456 (Admin)";
    
    // Formata a exibição da data caso exista
    const dataFormatada = commitObj.data_exclusao_binario 
        ? commitObj.data_exclusao_binario.replace("T", " ").substring(0, 19)
        : "Data Recente";
    document.getElementById("lblAuditData").textContent = dataFormatada;
    
    document.getElementById("lblAuditMotivo").textContent = commitObj.motivo_exclusao || "Liberação de espaço";
    document.getElementById("lblAuditDetalhes").textContent = commitObj.detalhes_exclusao || "Nenhum detalhamento inserido pelo responsável.";

    // Abre o modal na tela adicionando a classe show
    document.getElementById("detailsModal").classList.add("show");
}

// Configuração dos gatilhos para fechar o Modal de Detalhes de Auditoria
document.addEventListener("DOMContentLoaded", function() {
    const modalDetails = document.getElementById("detailsModal");
    const btnCloseX = document.getElementById("btnCloseDetailsX");
    const btnCloseBtn = document.getElementById("btnCloseDetailsBtn");

    const fecharModalDetalhes = () => {
        if(modalDetails) modalDetails.classList.remove("show");
    };

    if (btnCloseX) btnCloseX.addEventListener("click", fecharModalDetalhes);
    if (btnCloseBtn) btnCloseBtn.addEventListener("click", fecharModalDetalhes);
});

function exibirNotificacaoSucesso(mensagem) {
    const toast = document.getElementById("toastSuccess");
    const toastMsg = document.getElementById("toastMessage");
    
    if (toast && toastMsg) {
        toastMsg.textContent = mensagem; // CORREÇÃO: Removido o 'mensaje' que quebrava o script
        toast.classList.add("show");
        
        // Remove a notificação automaticamente após 4 segundos
        setTimeout(() => {
            toast.classList.remove("show");
        }, 4000);
    }
}

function configurarSubAbasPowerBI() {
    const btnListarBI = document.getElementById("subTabListarBI");
    const btnNovoBI = document.getElementById("subTabNovoBI");
    const secListarBI = document.getElementById("secListarBI");
    const secNovoBI = document.getElementById("secNovoBI");

    if (btnListarBI && btnNovoBI) {
        // Evento 1: Clicar em "Relatórios e Versões" (Mostra a tabela e atualiza dados do banco)
        btnListarBI.addEventListener("click", function(e) {
            e.preventDefault();
            btnListarBI.classList.add("active");
            btnNovoBI.classList.remove("active");
            secListarBI.classList.add("active");
            secNovoBI.classList.remove("active");
            renderizarTabelaDashboards(); // Recarrega a tabela em ordem alfabética do SQLite
        });

        // Evento 2: Clicar em "+ Commit de Novo Relatório" (Abre o formulário premium)
        btnNovoBI.addEventListener("click", function(e) {
            e.preventDefault();
            btnNovoBI.classList.add("active");
            btnListarBI.classList.remove("active");
            secNovoBI.classList.add("active");
            secListarBI.classList.remove("active");
            
            // Opcional: Aqui chamaremos a função para carregar a lista de Workspaces no select do form
            carregarWorkspacesNoFormSelect();
        });
    }
}

async function carregarWorkspacesNoFormSelect() {
    const containerWS = document.getElementById("biWorkspaceVinculoContainer");
    if (!containerWS) return;

    try {
        const response = await fetch('/api/workspaces');
        if (!response.ok) throw new Error("Falha ao buscar ambientes.");
        const workspaces = await response.json();

        containerWS.innerHTML = ""; // Limpa carregamento anterior

        if (workspaces.length === 0) {
            containerWS.innerHTML = "<p style='font-size:13px; color:var(--text-muted);'>Nenhuma workspace cadastrada no banco.</p>";
            return;
        }

        // Injeta uma caixa de seleção para cada workspace do banco SQLite
        workspaces.forEach(ws => {
            const label = document.createElement("label");
            label.className = "workspace-checkbox-item";
            label.innerHTML = `
                <input type="checkbox" name="workspaces_selecionadas" value="${ws.id_workspace}">
                <span>${ws.nome_comercial}</span>
            `;
            containerWS.appendChild(label);
        });
    } catch (error) {
        console.error("Erro ao carregar lista de checkboxes:", error);
    }
}

// Envio do formulário com suporte a múltiplos IDs de workspaces
const formPBIReal = document.getElementById("formPowerBI");
if (formPBIReal) {
    formPBIReal.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        const fileFiles = document.getElementById("filePbix").files[0];
        if (!fileFiles) {
            exibirNotificacaoErro("Por favor, selecione um arquivo de relatório (.pbix) válido.");
            return;
        }

        const btnSubmit = document.getElementById("btnSubmitCommit");
        const pbiExiste = btnSubmit.dataset.pbiExiste === "true";
        let listaWorkspacesIds = [];

        // Só coleta e exige as caixas se o Power BI for INÉDITO
        if (!pbiExiste) {
            const checkboxes = document.querySelectorAll('input[name="workspaces_selecionadas"]:checked');
            listaWorkspacesIds = Array.from(checkboxes).map(cb => cb.value);

            if (listaWorkspacesIds.length === 0) {
                exibirNotificacaoErro("Selecione ao menos um Workspace de destino para a primeira alocação.");
                return;
            }
        }

        const formData = new FormData();
        formData.append("file", fileFiles);
        formData.append("link_embed", document.getElementById("biLinkEmbed").value);
        formData.append("id_workspaces", JSON.stringify(listaWorkspacesIds));

        btnSubmit.textContent = "Processando e compactando em ZIP...";
        btnSubmit.disabled = true;

        try {
            const response = await fetch('/api/dashboards/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const resultado = await response.json();
                exibirNotificacaoSucesso(`Commit realizado! Registrado como ${resultado.versao_gerada}. Fontes mapeadas com sucesso.`);
                
                formPBIReal.reset();
                document.getElementById("fileInfoArea").classList.add("hidden");
                // Força o container a voltar a aparecer para o próximo cadastro do fluxo
                document.getElementById("containerSeletorWorkspaces").style.display = "flex";
                btnSubmit.textContent = "Fazer Commit e Incrementar Versão";
                btnSubmit.dataset.pbiExiste = "false";
                
                document.getElementById("subTabListarBI").click(); 
            } else {
                alert("Erro ao processar estrutura do arquivo no repositório.");
            }
        } catch (error) {
            exibirNotificacaoErro("Falha crítica de comunicação com o servidor Python.");
        } finally {
            btnSubmit.disabled = false;
        }
    });
}

function exibirNotificacaoErro(mensagem) {
    const toast = document.getElementById("toastError");
    const toastMsg = document.getElementById("toastErrorMessage");
    
    if (toast && toastMsg) {
        toastMsg.textContent = mensagem;
        toast.classList.add("show");
        
        // Remove o aviso de alerta automaticamente após 5 segundos
        setTimeout(() => {
            toast.classList.remove("show");
        }, 5000);
    }
}


async function salvarAlteracaoRegistroPrincipal(idDashboard, event) {
    event.stopPropagation();

    const novoNome = document.getElementById(`edit-nome-${idDashboard}`).value.trim();
    let novoLink = document.getElementById(`edit-link-${idDashboard}`).value.trim();
    const novasTabelas = document.getElementById(`edit-tabelas-${idDashboard}`).value.trim();

    if (!novoNome || !novoLink) {
        alert("Nome e Link do Frame são obrigatórios.");
        return;
    }

    // EXTRAÇÃO DE SEGURANÇA NO SUBMIT: Limpa tags iframe se coladas por engano
    if (novoLink.includes("<iframe")) {
        const match = novoLink.match(/src=["']([^"']+)["']/);
        if (match && match[1]) {
            novoLink = match[1];
        }
    }

    try {
        const response = await fetch('/api/dashboards/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_dashboard: idDashboard,
                nome: novoNome,
                link: novoLink,
                tabelas: novasTabelas
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Registro principal atualizado com sucesso no banco SQLite!");
            renderizarTabelaDashboards(); 
        } else {
            alert("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        alert("Falha de comunicação com o servidor Python.");
    }
}


async function ativarModoEdicaoDB(idDashboard, event) {
    event.stopPropagation(); // Impede o fechamento automático da linha
    
    const db = listaDashboardsCarregados.find(item => item.id_dashboard === idDashboard);
    if (!db) return;
    
    const container = document.getElementById(`edit-block-db-${db.id_dashboard}`);
    if (!container) return;

    // Salva o HTML original para a ação do botão Cancelar
    if (!container.dataset.htmlOriginal) {
        container.dataset.htmlOriginal = container.innerHTML;
    }

    // Força o bloco a ocupar a largura inteira em formato de formulário corporativo
    container.style.display = "block";

    const tabelasAtuais = db.tabelas_utilizadas && db.tabelas_utilizadas !== "Não mapeado no modelo" ? db.tabelas_utilizadas : "";

    // 1. Coleta dinâmica de todas as Workspaces do SQLite para montar o seletor múltiplo inline
    let opcoesWorkspacesHTML = "";
    try {
        const resWS = await fetch('/api/workspaces');
        const todasWorkspaces = await resWS.json();
        
        // Mapeia quais ambientes já estão associados a este painel no momento (lendo a string concatenada)
        const ambientesAtuais = db.nome_workspace ? db.nome_workspace.split(', ') : [];

        todasWorkspaces.forEach(ws => {
            const estaVinculado = ambientesAtuais.includes(ws.nome_comercial) ? "checked" : "";
            opcoesWorkspacesHTML += `
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="edit_workspaces_${db.id_dashboard}" value="${ws.id_workspace}" ${estaVinculado} style="width:16px; height:16px; accent-color:var(--primary);">
                    <span>${ws.nome_comercial}</span>
                </label>
            `;
        });
    } catch (err) {
        opcoesWorkspacesHTML = "<p style='color:red; font-size:12px;'>Falha ao carregar ambientes relacionais.</p>";
    }

    container.innerHTML = `
        <div style="background-color: #ffffff; border: 1px solid var(--primary); padding: 24px; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.05); width: 100%;">
            <h4 style="font-size: 12px; color: var(--primary); margin-bottom: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">✏️ Editar Registro Principal de Governança</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px;">
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Nome Comercial do Relatório</label>
                    <input type="text" id="edit-nome-${db.id_dashboard}" value="${db.nome_dashboard}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
                <div class="form-group">
                    <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Tabelas Consultadas no Banco (Oracle)</label>
                    <input type="text" id="edit-tabelas-${db.id_dashboard}" value="${db.tabelas_utilizadas_texto === 'Nenhuma tabela indexada neste relatório.' ? '' : db.tabelas_utilizadas_texto}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; color:var(--text-main);">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Link de Embed do Frame (URL de Visualização)</label>
                <input type="url" id="edit-link-${db.id_dashboard}" value="${db.link_embed}" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; font-family:monospace; color:var(--text-main);">
            </div>

            <!-- SELETOR MÚLTIPLO ATIVADO NA TELA DE EDIÇÃO -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom: 6px; display:block;">Alocação nos Ambientes / Workspaces (Marque para Vincular)</label>
                <div style="background-color:#f8fafc; border:1px solid var(--border-color); padding:14px; border-radius:6px; display:flex; flex-direction:column; gap:8px; max-height:120px; overflow-y:auto;">
                    ${opcoesWorkspacesHTML}
                </div>
            </div>

            <div style="display:flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                <button class="btn-modal-cancel" onclick="restaurarTelaAuditoriaAnterior(${db.id_dashboard}, event)" style="padding:8px 16px; font-size:12px; cursor:pointer;">Cancelar</button>
                <button class="btn-primary" onclick="salvarAlteracaoRegistroPrincipal(${db.id_dashboard}, event)" style="padding:8px 20px; font-size:12px; background:var(--primary); cursor:pointer;">Salvar Alterações</button>
            </div>
        </div>
    `;
}



function restaurarTelaAuditoriaAnterior(idDashboard, event) {
    if(event) event.stopPropagation();
    const container = document.getElementById(`edit-block-db-${idDashboard}`);
    if (container && container.dataset.htmlOriginal) {
        // Restaura o layout com o embed aberto e as tabelas desenhadas
        container.innerHTML = container.dataset.htmlOriginal;
        container.dataset.htmlOriginal = ""; // Reseta controle
    }
}

async function salvarAlteracaoRegistroPrincipal(idDashboard, event) {
    event.stopPropagation();

    const novoNome = document.getElementById(`edit-nome-${idDashboard}`).value.trim();
    const novoLink = document.getElementById(`edit-link-${idDashboard}`).value.trim();
    const novasTabelas = document.getElementById(`edit-tabelas-${idDashboard}`).value.trim();

    // Captura a lista de IDs das caixas de workspaces marcadas na tela de edição
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
        const response = await fetch('/api/dashboards/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_dashboard: idDashboard,
                nome: novoNome,
                link: novoLink,
                tabelas: novasTabelas,
                id_workspaces: listaWorkspacesIds // Envia a lista para atualização em lote
            })
        });

        if (response.ok) {
            exibirNotificacaoSucesso("Ambientes e metadados atualizados com sucesso no SQLite!");
            
            // Força a sincronização na memória local do SPA
            renderizarTabelaDashboards();
            setTimeout(() => {
                const trPai = document.getElementById(`tr-db-${idDashboard}`);
                if (trPai) trPai.click(); // Reabre a auditoria inline automaticamente com o embed ativo
            }, 220);
        } else {
            alert("Erro interno ao salvar alterações cadastrais.");
        }
    } catch (error) {
        alert("Falha de comunicação com o servidor Python.");
    }
}


