from database.database import get_db_connection

def listar_workspaces_por_usuario(id_usuario):
    """Executa a query SQL mapeando as workspaces que o usuário logado possui permissão."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT w.id_workspace, w.nome_comercial, w.descricao 
        FROM Workspace w
        INNER JOIN Workspace_Usuarios wu ON w.id_workspace = wu.id_workspace
        WHERE wu.id_usuario = ?
        ORDER BY w.nome_comercial ASC
    """
    cursor.execute(query, (id_usuario,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def listar_todos_workspaces():
    """Retorna todas as workspaces cadastradas para a tela de gestão técnica."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id_workspace, workspace_id_pbi, nome_comercial, descricao, data_criacao FROM Workspace ORDER BY nome_comercial ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def buscar_dashboards_por_workspace(id_workspace):
    """Busca os dashboards vinculados a esta workspace específica trazidos em ordem alfabética."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT d.nome_dashboard, d.data_criacao, d.ultimo_commit 
        FROM Dashboard d
        INNER JOIN Workspace_Dashboard wd ON d.id_dashboard = wd.id_dashboard
        WHERE wd.id_workspace = ?
        ORDER BY d.nome_dashboard ASC
    """
    cursor.execute(query, (id_workspace,))
    rows = cursor.fetchall()
    conn.close()
    return [f"{row['nome_dashboard']} (Criado: {row['data_criacao'][:10]} | Commit: {row['ultimo_commit'][:10]})" for row in rows]

def buscar_usuarios_por_workspace(id_workspace):
    """Busca os colaboradores vinculados a esta workspace trazendo em ordem alfabética."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT u.codigo_ldap, u.nome 
        FROM Usuarios u
        INNER JOIN Workspace_Usuarios wu ON u.id_usuario = wu.id_usuario
        WHERE wu.id_workspace = ?
        ORDER BY u.nome ASC
    """
    cursor.execute(query, (id_workspace,))
    rows = cursor.fetchall()
    conn.close()
    return [f"{row['nome']} ({row['codigo_ldap']})" for row in rows]

def salvar_nova_workspace(nome, guid, descricao):
    """Insere fisicamente um novo registro de workspace na base SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO Workspace (workspace_id_pbi, nome_comercial, descricao) VALUES (?, ?, ?)",
        (guid, nome, descricao)
    )
    conn.commit()
    conn.close()

def verificar_se_workspace_existe(nome_comercial):
    """Verifica se já existe uma workspace com este nome exato."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Usa o COLLATE NOCASE para ignorar diferenças entre maiúsculas e minúsculas (ex: "Vendas" e "vendas")
    cursor.execute("SELECT id_workspace FROM Workspace WHERE nome_comercial = ? COLLATE NOCASE", (nome_comercial,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def atualizar_workspace(id_workspace, nome, descricao):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE Workspace 
            SET nome_comercial = ?, descricao = ?
            WHERE id_workspace = ?
        """, (nome, descricao, id_workspace))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        return False
    finally:
        conn.close()

def excluir_workspace(id_workspace):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Remove os vínculos para não quebrar as chaves estrangeiras
        cursor.execute("DELETE FROM Workspace_Usuarios WHERE id_workspace = ?", (id_workspace,))
        cursor.execute("DELETE FROM Workspace_Dashboard WHERE id_workspace = ?", (id_workspace,))
        
        # 2. Remove a workspace em si
        cursor.execute("DELETE FROM Workspace WHERE id_workspace = ?", (id_workspace,))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Erro ao excluir: {e}")
        return False
    finally:
        conn.close()