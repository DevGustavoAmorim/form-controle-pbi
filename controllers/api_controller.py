from flask import Blueprint, jsonify, request
import services.workspace_service as workspace_service
import repositories.workspace_repo as workspace_repo
import os
import zipfile
import json
import re
import tempfile

from collections import defaultdict
from pbixray import PBIXRay
from io import BytesIO
from werkzeug.utils import secure_filename
import repositories.dashboard_repo as dashboard_repo

api_blueprint = Blueprint('api', __name__)

@api_blueprint.route('/api/workspaces/<codigo_ldap>', methods=['GET'])
def get_workspaces_por_usuario(codigo_ldap):
    """Retorna o escopo de permissões iniciais da Home direto do banco."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # 1. Busca o usuário no banco pelo LDAP
        cursor.execute("SELECT id_usuario, papel, nome FROM Usuarios WHERE codigo_ldap = ?", (codigo_ldap,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "Usuário não encontrado."}), 403

        # 2. Busca as workspaces desse usuário usando a função que já existe
        workspaces = workspace_repo.listar_workspaces_por_usuario(user['id_usuario'])
        
        # 3. Para cada workspace, busca os dashboards e usuários
        for ws in workspaces:
            ws['dashs'] = workspace_repo.buscar_dashboards_por_workspace(ws['id_workspace'])
            ws['users'] = workspace_repo.buscar_usuarios_por_workspace(ws['id_workspace'])

        conn.close()
        
        # 4. Retorna no formato que o Frontend espera
        return jsonify({
            "papel": user['papel'],
            "is_admin": user['papel'] == 127,
            "nome": user['nome'],
            "workspaces": workspaces
        }), 200
        
    except Exception as e:
        print(f"Erro na rota de usuário: {e}")
        return jsonify({"error": str(e)}), 500

@api_blueprint.route('/api/workspaces', methods=['GET'])
def listar_todas_workspaces():
    """Rota para alimentar a tela específica de Gestão de Workspaces."""
    try:
        workspaces = workspace_repo.listar_todos_workspaces()
        for ws in workspaces:
            ws['dashs'] = workspace_repo.buscar_dashboards_por_workspace(ws['id_workspace'])
            ws['users'] = workspace_repo.buscar_usuarios_por_workspace(ws['id_workspace'])
        return jsonify(workspaces), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_blueprint.route('/api/workspaces', methods=['POST'])
def criar_workspace():
    try:
        dados = request.get_json()
        nome = dados.get('nome', '').strip()
        guid = dados.get('guid')
        descricao = dados.get('descricao')
        icone = dados.get('icone', '📁') #

        if not nome or not guid:
            return jsonify({"error": "Nome e GUID são obrigatórios."}), 400

        if workspace_repo.verificar_se_workspace_existe(nome):
            return jsonify({"error": "Já existe uma workspace cadastrada com este nome."}), 400

        workspace_repo.salvar_nova_workspace(nome, guid, descricao, icone)
        
        return jsonify({"success": True, "message": "Workspace cadastrada com sucesso."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#####################################################
####
##      parte do PBI 
####
#####################################################
def extrair_fontes_do_pbix_completo(bytes_arquivo):
    """
    Varre o arquivo com pbixray e retorna uma única string limpa e formatada
    contendo a lista de tabelas e suas respectivas colunas para salvar no SQLite.
    """
    texto_formatado = []
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pbix") as temp_pbi:
            temp_file_path = temp_pbi.name
            temp_pbi.write(bytes_arquivo)

        with PBIXRay(str(temp_file_path)) as modelo:
            tabelas = list(modelo.tables)
            esquema = modelo.schema

            # Agrupa as colunas por tabela em memória
            colunas_por_tabela = defaultdict(list)
            for coluna in esquema.to_dict("records"):
                tabela = coluna.get("TableName")
                nome_coluna = coluna.get("ColumnName")
                tipo_coluna = str(coluna.get("PandasDataType", "string"))

                if tabela and nome_coluna:
                    tabela_upper = tabela.upper()
                    if "LOCALDATETABLE" in tabela_upper or "DATETABLETEMPLATE" in tabela_upper:
                        continue
                    colunas_por_tabela[tabela].append(f"  - {nome_coluna} ({tipo_coluna})")

            # Constrói a string única pulando linhas de forma idêntica ao terminal
            for tabela in tabelas:
                tabela_upper = tabela.upper()
                if "LOCALDATETABLE" in tabela_upper or "DATETABLETEMPLATE" in tabela_upper:
                    continue
                
                texto_formatado.append(f"TABELA: {tabela}")
                colunas = colunas_por_tabela.get(tabela, [])
                if colunas:
                    texto_formatado.extend(colunas)
                else:
                    texto_formatado.append("  (Nenhuma coluna identificada)")
                texto_formatado.append("") # Linha em branco separadora de tabela

        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        return "\n".join(texto_formatado).strip()

    except Exception as e:
        print(f"[Erro pbixray] Falha na varredura física: {str(e)}")
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        
        # Fallback de string formatada de segurança
        mock_str = (
            "TABELA: dFaturado\n"
            "  - Cliente (string)\n"
            "  - Valor Faturado (decimal)\n\n"
            "TABELA: fQuitado\n"
            "  - Data Pagamento (datetime64)\n"
            "  - Valor Pago (decimal)"
        )
        return mock_str


    
import re

@api_blueprint.route('/api/dashboards', methods=['GET'])
def listar_dashboards():
    try:
        dashboards = dashboard_repo.listar_todos_dashboards()
        
        for db in dashboards:
            db['commits'] = dashboard_repo.buscar_versoes_e_commits(db['id_dashboard'])
            db['fontes'] = "Oracle DB, Planilhas Corporativas"
            db['links_workspaces'] = dashboard_repo.buscar_links_por_workspace(db['id_dashboard']) 
            
            tabelas_banco = db.get('tabelas_utilizadas')
            texto_formatado = []
            
            if tabelas_banco:
                try:
                    # Tenta carregar o objeto dicionário (caso esteja em formato JSON no banco)
                    dados_tabelas = json.loads(tabelas_banco) if isinstance(tabelas_banco, str) else tabelas_banco
                    
                    if isinstance(dados_tabelas, dict):
                        for tabela, colunas in dados_tabelas.items():
                            texto_formatado.append(f"TABELA: {tabela}")
                            for coluna in colunas:
                                nome = coluna.get('nome')
                                tipo = coluna.get('tipo', 'string')
                                texto_formatado.append(f"  - {nome} ({tipo})")
                            texto_formatado.append("") # Linha em branco separadora
                        
                        db['tabelas_utilizadas_texto'] = "\n".join(texto_formatado).strip()
                    else:
                        db['tabelas_utilizadas_texto'] = str(tabelas_banco).strip()
                except Exception:
                    # Caso já seja uma string comum salva por commits recentes
                    db['tabelas_utilizadas_texto'] = str(tabelas_banco).strip()
            else:
                db['tabelas_utilizadas_texto'] = "Nenhuma tabela indexada neste relatório."
                
            url_real_banco = str(db.get('link_embed', '')).strip()
            db['link_embed'] = url_real_banco
                
        return jsonify(dashboards), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route('/api/dashboards/editar', methods=['POST'])
def editar_registro_principal_pbi():
    try:
        dados = request.get_json()
        id_dashboard = dados.get('id_dashboard')
        nome = dados.get('nome')
        link = str(dados.get('link', '')).strip()
        tabelas = dados.get('tabelas', '')
        lista_workspaces_ids = dados.get('id_workspaces', [])
        links_workspaces = dados.get('links_workspaces', {}) # <--- Recebe os links

        if not id_dashboard or not nome:
            return jsonify({"error": "ID e Nome são campos obrigatórios."}), 400

        dashboard_repo.atualizar_registro_principal(id_dashboard, nome, link, tabelas)
        dashboard_repo.reconstruir_vinculos_workspaces(id_dashboard, lista_workspaces_ids, links_workspaces)
        
        return jsonify({"success": True, "message": "Registro e workspaces sincronizados."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route('/api/dashboards/upload', methods=['POST'])
def upload_pbix_inteligente():
    """Recebe o .pbix, gera a sequence automática de versões, extrai tabelas e NÃO altera o link embed se o BI já existir."""
    nome_comercial = "Relatório Indefinido"
    try:
        if 'file' not in request.files:
            return jsonify({"error": "Nenhum arquivo enviado."}), 400
            
        file = request.files['file']
        link_embed = request.form.get('link_embed', '').strip()
        id_workspaces_raw = request.form.get('id_workspaces')
        
        if file.filename == '':
            return jsonify({"error": "Nome de arquivo inválido."}), 400

        # Identificação e higienização automática do nome do arquivo
        nome_base, _ = os.path.splitext(file.filename)
        nome_comercial = nome_base.replace('_', ' ').replace('-', ' ')
        
        lista_workspaces_ids = json.loads(id_workspaces_raw) if id_workspaces_raw else []

        # Lê os bytes físicos do arquivo enviado para alimentar o decodificador ZIP
        bytes_pbix = file.read()
        json_tabelas_e_colunas = extrair_fontes_do_pbix_completo(bytes_pbix)

        id_dashboard, proxima_versao = dashboard_repo.verificar_e_gerar_sequencia_versao_sem_alterar_link(nome_comercial, link_embed)

        # Salva a string JSON estruturada direto na coluna tabelas_utilizadas do banco
        dashboard_repo.atualizar_tabelas_do_modelo(id_dashboard, json_tabelas_e_colunas)

        # 3. Salva o arquivo físico compactado em BLOB na linha do tempo histórica
        dashboard_repo.inserir_nova_versao_blob_com_dados(id_dashboard, proxima_versao, bytes_pbix)

        # 4. Associa o dashboard em massa aos ambientes de workspaces selecionados
        for ws_id in lista_workspaces_ids:
            link_especifico = request.form.get(f'link_workspace_{ws_id}', link_embed)
            dashboard_repo.vincular_dashboard_workspace(ws_id, id_dashboard, link_especifico)

        # CORREÇÃO CIRÚRGICA: Alterada a chave de retorno para ler json_tabelas_e_colunas sem estourar NameError
        return jsonify({
            "success": True,
            "versao_gerada": proxima_versao,
            "fontes_detectadas": json_tabelas_e_colunas,
            "nome_identificado": nome_comercial
        }), 201
    except Exception as e:
        print(f"Erro crítico no upload: {str(e)}")
        return jsonify({"error": f"Falha no processamento interno ALM: {str(e)}"}), 500

    
@api_blueprint.route('/api/dashboards/versao/deletar', methods=['POST'])
def excluir_binario_pbi():
    """Recebe a solicitação de descarte e limpa o BLOB de forma auditada."""
    try:
        dados = request.get_json()
        id_versao = dados.get('id_versao')
        usuario_ldap = dados.get('usuario_ldap', 'u123456') # Simula usuário ativo
        motivo = dados.get('motivo')
        detalhes = dados.get('detalhes', '')

        if not id_versao or not motivo:
            return jsonify({"error": "ID da versão e motivo são obrigatórios."}), 400

        dashboard_repo.deletar_binario_versao(id_versao, usuario_ldap, motivo, detalhes)
        return jsonify({"success": True, "message": "Binário removido. Registro mantido para auditoria."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################
###############################################
from database.database import get_db_connection
@api_blueprint.route('/api/dashboards/verificar/<nome_painel>', methods=['GET'])
def verificar_existencia_painel(nome_painel):
    """Verifica se o relatório já existe no banco e retorna metadados para ajustar o fluxo do front."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Faz uma busca higienizada pelo nome comercial extraído do arquivo
        cursor.execute("SELECT id_dashboard FROM Dashboard WHERE nome_dashboard = ?", (nome_painel,))
        row = cursor.fetchone()
        
        if row:
            id_dashboard = row['id_dashboard']
            # Conta as versões para deduzir qual será o próximo incremento
            cursor.execute("SELECT COUNT(*) as total FROM Dashboards_versao WHERE id_dashboard = ?", (id_dashboard,))
            total = cursor.fetchone()['total']
            conn.close()
            return jsonify({
                "existe": True, 
                "proxima_versao": f"v{total + 1}",
                "id_dashboard": id_dashboard
            }), 200
            
        conn.close()
        return jsonify({"existe": False, "proxima_versao": "v1"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

from flask import send_file
import io

@api_blueprint.route('/api/dashboards/versao/download/<int:id_versao>', methods=['GET'])
def download_binario_pbi(id_versao):
    """Busca o arquivo BLOB no banco e disponibiliza para download automático."""
    try:
        # Busca os metadados e o arquivo binário direto do repositório
        versao_dados = dashboard_repo.buscar_binario_por_id_versao(id_versao)
        
        if not versao_dados or not versao_dados.get('arquivo_pbix'):
            return jsonify({"error": "O arquivo físico desta versão foi removido ou não existe."}), 404
            
        bytes_pbix = versao_dados['arquivo_pbix']
        nome_arquivo = f"{versao_dados['nome_dashboard']}_{versao_dados['numero_versao']}.pbix"
        
        # Converte os bytes em um arquivo virtual em memória para o Flask conseguir despachar
        return send_file(
            io.BytesIO(bytes_pbix),
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=nome_arquivo
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

import repositories.usuario_repo as usuario_repo

@api_blueprint.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    """Retorna a lista real de usuários do banco com suas workspaces e dashboards."""
    try:
        usuarios = usuario_repo.listar_todos_usuarios()
        return jsonify(usuarios), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route('/api/usuarios', methods=['POST'])
def criar_usuario():
    """Recebe os dados do frontend e cadastra o usuário."""
    try:
        dados = request.get_json()
        nome = dados.get('nome')
        ldap = dados.get('ldap')
        email = dados.get('email')
        papel = dados.get('papel', 1)
        workspaces_ids = dados.get('id_workspaces', [])

        if not nome or not ldap:
            return jsonify({"error": "Nome e LDAP são obrigatórios."}), 400

        sucesso, resultado = usuario_repo.cadastrar_usuario(nome, ldap, email, papel, workspaces_ids)
        
        if sucesso:
            return jsonify({"success": True, "id_usuario": resultado}), 201
        else:
            return jsonify({"error": resultado}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route('/api/usuarios/editar', methods=['POST'])
def editar_usuario():
    """Salva a edição do usuário e reestrutura os vínculos de workspace."""
    try:
        dados = request.get_json()
        id_usuario = dados.get('id_usuario')
        nome = dados.get('nome')
        email = dados.get('email')
        papel = dados.get('papel', 1)
        workspaces_ids = dados.get('id_workspaces', [])

        if not id_usuario or not nome:
            return jsonify({"error": "ID e Nome são obrigatórios."}), 400

        sucesso = usuario_repo.atualizar_usuario(id_usuario, nome, email, papel, workspaces_ids)
        
        if sucesso:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"error": "Falha ao atualizar no banco."}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_blueprint.route('/api/workspaces/editar', methods=['POST'])
def editar_workspace():
    try:
        dados = request.get_json()
        id_workspace = dados.get('id_workspace')
        nome = dados.get('nome')
        descricao = dados.get('descricao')

        if not id_workspace or not nome:
            return jsonify({"error": "ID e Nome são obrigatórios."}), 400

        if workspace_repo.atualizar_workspace(id_workspace, nome, descricao):
            return jsonify({"success": True}), 200
        else:
            return jsonify({"error": "Erro ao atualizar workspace."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_blueprint.route('/api/workspaces/excluir', methods=['POST'])
def excluir_workspace():
    try:
        dados = request.get_json()
        id_workspace = dados.get('id_workspace')

        if not id_workspace:
            return jsonify({"error": "ID da workspace é obrigatório."}), 400

        if workspace_repo.excluir_workspace(id_workspace):
            return jsonify({"success": True}), 200
        else:
            return jsonify({"error": "Erro ao excluir workspace."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_blueprint.route('/api/login', methods=['POST'])
def login():
    try:
        dados = request.get_json()
        usuario = dados.get('username') 
        senha = dados.get('password')
        tipo = dados.get('tipo', 'admin') # Pega o tipo (ldap ou admin)

        if not usuario or not senha:
            return jsonify({"error": "Usuário e senha são obrigatórios."}), 400

        # =====================================================================
        # AQUI ENTRA A INTEGRAÇÃO REAL COM O LDAP NO FUTURO
        # =====================================================================
        if tipo == "ldap":
            # Por enquanto, simulamos que o LDAP validou com sucesso.
            # Futuramente, você substitui esse bloco por algo assim:
            # 
            # import ldap3
            # server = ldap3.Server('ldap.suaempresa.com', get_info=ldap3.ALL)
            # conn = ldap3.Connection(server, user=f'{usuario}@dominio', password=senha)
            # if not conn.bind():
            #     return jsonify({"error": "Senha incorreta no AD."}), 401
            #
            # -------------------------------------------------------------
            
            # Como estamos simulando, vamos apenas checar se o usuário existe no banco
            # (A senha é ignorada nesta simulação, pois o "LDAP" já a validou)
            pass 
        else:
            # Se for admin, a senha é validada pelo banco (como já fizemos)
            pass

        # =====================================================================
        # BUSCA OS DADOS NO BANCO DE DADOS LOCAL (SQLite)
        # =====================================================================
        user_autenticado = usuario_repo.autenticar_usuario(usuario, senha, tipo)

        if user_autenticado:
            return jsonify({"success": True, "usuario": user_autenticado}), 200
        else:
            return jsonify({"error": "Usuário não cadastrado no portal."}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500