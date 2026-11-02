from database.database import get_db_connection
import sqlite3 

def listar_todos_dashboards():
    """Busca todos os painéis unificados com o nome da Workspace em que estão alocados."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT 
            d.id_dashboard, 
            d.report_id_pbi, 
            d.nome_dashboard, 
            d.link_embed, 
            d.tabelas_utilizadas,
            d.data_criacao, 
            d.ultimo_commit,
            GROUP_CONCAT(w.nome_comercial, ', ') AS nome_workspace
        FROM Dashboard d
        LEFT JOIN Workspace_Dashboard wd ON d.id_dashboard = wd.id_dashboard
        LEFT JOIN Workspace w ON wd.id_workspace = w.id_workspace
        GROUP BY d.id_dashboard
        ORDER BY d.nome_dashboard ASC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def buscar_versoes_e_commits(id_dashboard):
    """Traz o histórico completo de commits sem carregar o arquivo binário na listagem geral."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # REMOVIDA A COLUNA arquivo_pbix DO SELECT: Usamos o CASE para saber o status do arquivo.
    # Isso impede que o Flask trave ao tentar converter binários para JSON na tabela.
    query = """
        SELECT 
            id_versao, 
            id_dashboard,
            numero_versao, 
            data_atualizacao, 
            descricao_alteracao,
            usuario_excluiu, 
            data_exclusao_binario, 
            motivo_exclusao, 
            detalhes_exclusao,
            CASE WHEN arquivo_pbix IS NULL THEN 1 ELSE 0 END as is_deleted
        FROM Dashboards_versao
        WHERE id_dashboard = ?
        ORDER BY data_atualizacao DESC
    """
    cursor.execute(query, (id_dashboard,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def inserir_novo_dashboard(nome, link_embed, fontes):
    """Insere o cabeçalho do PBI e armazena as fontes descobertas de forma legível."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # O report_id_pbi é gerado oculto para consistência relacional
    import uuid
    guid_oculto = str(uuid.uuid4())
    
    cursor.execute("""
        INSERT INTO Dashboard (report_id_pbi, nome_dashboard, link_embed) 
        VALUES (?, ?, ?)
    """, (guid_oculto, nome, link_embed))
    
    id_gerado = cursor.lastrowid
    conn.commit()
    conn.close()
    return id_gerado

def inserir_nova_versao_blob(id_dashboard, numero_versao, bytes_pbix):
    """Insere o arquivo físico convertido em BLOB (binário compactado) na timeline de controle."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Dashboards_versao (id_dashboard, numero_versao, arquivo_pbix) 
        VALUES (?, ?, ?)
    """, (id_dashboard, numero_versao, sqlite3.Binary(bytes_pbix)))
    conn.commit()
    conn.close()

def deletar_binario_versao(id_versao, usuario_ldap, motivo, detalhes):
    """Remove o arquivo físico (BLOB) atualizando as novas colunas de auditoria."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        UPDATE Dashboards_versao
        SET arquivo_pbix = NULL,
            usuario_excluiu = ?,
            data_exclusao_binario = CURRENT_TIMESTAMP,
            motivo_exclusao = ?,
            detalhes_exclusao = ?
        WHERE id_versao = ?
    """
    cursor.execute(query, (usuario_ldap, motivo, detalhes, id_versao))
    conn.commit()
    conn.close()
    return True

def verificar_e_gerar_sequencia_versao_sem_alterar_link(nome_dashboard, link_embed_novo):
    """
    Busca se o painel existe pelo nome. 
    Se já existir: PRESERVA o link_embed atual do banco e calcula a sequence (v2, v3...).
    Se for inédito: Insere o registro completo inicial criando a v1.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id_dashboard, link_embed FROM Dashboard WHERE nome_dashboard = ?", (nome_dashboard,))
    row = cursor.fetchone()
    
    if row:
        id_dashboard = row['id_dashboard']
        # Contabiliza o volume de commits existentes para determinar o próximo inteiro da sequence (v1 -> v2)
        cursor.execute("SELECT COUNT(*) as total FROM Dashboards_versao WHERE id_dashboard = ?", (id_dashboard,))
        total_versoes = cursor.fetchone()['total']
        proxima_versao = f"v{total_versoes + 1}"
        
        # REGRA ATENDIDA: Atualiza apenas a estampa de tempo do deploy, deixando o link_embed antigo INTACTO
        cursor.execute("UPDATE Dashboard SET ultimo_commit = CURRENT_TIMESTAMP WHERE id_dashboard = ?", (id_dashboard,))
    else:
        # Registro novo na governança: Gera GUID oculto e salva com o link enviado no formulário
        import uuid
        guid_oculto = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO Dashboard (report_id_pbi, nome_dashboard, link_embed) 
            VALUES (?, ?, ?)
        """, (guid_oculto, nome_dashboard, link_embed_novo))
        id_dashboard = cursor.lastrowid
        proxima_versao = "v1"
        
    conn.commit()
    conn.close()
    return id_dashboard, proxima_versao

def inserir_nova_versao_blob_com_dados(id_dashboard, numero_versao, bytes_pbix):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Dashboards_versao (id_dashboard, numero_versao, arquivo_pbix) 
        VALUES (?, ?, ?)
    """, (id_dashboard, numero_versao, sqlite3.Binary(bytes_pbix)))
    conn.commit()
    conn.close()

def vincular_dashboard_workspace(id_workspace, id_dashboard):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Garante que não duplique a restrição se for um commit de nova versão do mesmo relatório
    cursor.execute("INSERT OR IGNORE INTO Workspace_Dashboard (id_workspace, id_dashboard) VALUES (?, ?)", 
                   (id_workspace, id_dashboard))
    conn.commit()
    conn.close()


def atualizar_registro_principal(id_dashboard, nome, link, tabelas):
    """Executa o UPDATE de alteração cadastral mantendo os binários .pbix intactos."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        UPDATE Dashboard
        SET nome_dashboard = ?,
            link_embed = ?,
            tabelas_utilizadas = ?,
            ultimo_commit = CURRENT_TIMESTAMP
        WHERE id_dashboard = ?
    """
    cursor.execute(query, (nome, link, tabelas, id_dashboard))
    conn.commit()
    conn.close()
    return True

def atualizar_tabelas_do_modelo(id_dashboard, tabelas):
    """Grava ou substitui as tabelas consultadas identificadas na varredura do arquivo físico."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE Dashboard 
        SET tabelas_utilizadas = ? 
        WHERE id_dashboard = ?
    """, (tabelas, id_dashboard))
    conn.commit()
    conn.close()
    return True

def reconstruir_vinculos_workspaces(id_dashboard, lista_workspaces_ids):
    """Limpa as amarrações antigas do relatório e insere o novo lote selecionado nos checkboxes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Remove associações anteriores para evitar chaves duplicadas ou lixo lógico
    cursor.execute("DELETE FROM Workspace_Dashboard WHERE id_dashboard = ?", (id_dashboard,))
    
    # Injeta a nova lista de ambientes selecionados na tela de edição
    for ws_id in lista_workspaces_ids:
        cursor.execute("""
            INSERT INTO Workspace_Dashboard (id_workspace, id_dashboard) 
            VALUES (?, ?)
        """, (ws_id, id_dashboard))
        
    conn.commit()
    conn.close()
    return True

def buscar_binario_por_id_versao(id_versao):
    """Busca o arquivo BLOB físico e o nome do painel para fins de download."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT v.arquivo_pbix, v.numero_versao, d.nome_dashboard
        FROM Dashboards_versao v
        JOIN Dashboard d ON v.id_dashboard = d.id_dashboard
        WHERE v.id_versao = ?
    """
    cursor.execute(query, (id_versao,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
