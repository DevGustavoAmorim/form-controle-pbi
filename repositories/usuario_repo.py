from database.database import get_db_connection

def buscar_por_ldap(codigo_ldap):
    """Busca os dados do usuário com base no código LDAP."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Nome da tabela igual ao script popular.py: Usuarios
    cursor.execute("SELECT id_usuario, papel, nome, email FROM Usuarios WHERE codigo_ldap = ?", (codigo_ldap,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def listar_todos_usuarios():
    """Busca todos os usuários no banco e já anexa as workspaces de cada um."""
    conn = get_db_connection()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    
    try:
        # 1. Busca todos os usuários (Nome da tabela: Usuarios)
        cursor.execute("""
            SELECT id_usuario, codigo_ldap as ldap, nome, email, papel 
            FROM Usuarios
            ORDER BY nome ASC
        """)
        usuarios = cursor.fetchall()
        
        # 2. Para cada usuário, busca as workspaces atreladas a ele
        for user in usuarios:
            cursor.execute("""
                SELECT w.id_workspace, w.nome_comercial as nome, w.descricao
                FROM Workspace w
                INNER JOIN Workspace_Usuarios wu ON w.id_workspace = wu.id_workspace
                WHERE wu.id_usuario = ?
            """, (user['id_usuario'],))
            
            workspaces = cursor.fetchall()
            
            # 3. Para cada workspace do usuário, busca os dashboards alocados
            for ws in workspaces:
                # CORREÇÃO: O nome da tabela no seu popular.py é Workspace_Dashboard
                cursor.execute("""
                    SELECT d.id_dashboard, d.nome_dashboard as nome
                    FROM Dashboard d
                    INNER JOIN Workspace_Dashboard wd ON d.id_dashboard = wd.id_dashboard
                    WHERE wd.id_workspace = ?
                    AND NOT EXISTS (
                        SELECT 1
                        FROM Workspace_Dashboard_Restricoes wdr
                        WHERE wdr.id_usuario = ?
                          AND wdr.id_workspace = wd.id_workspace
                          AND wdr.id_dashboard = d.id_dashboard
                    )
                """, (ws['id_workspace'], user['id_usuario']))
                
                dashboards = cursor.fetchall()
                ws['dashboards'] = [d['nome'] for d in dashboards] 
                cursor.execute("""
                    SELECT id_dashboard
                    FROM Workspace_Dashboard_Restricoes
                    WHERE id_usuario = ? AND id_workspace = ?
                """, (user['id_usuario'], ws['id_workspace']))
                ws['dashboards_bloqueados'] = [row['id_dashboard'] for row in cursor.fetchall()]
                
            user['workspaces'] = workspaces

        return usuarios
    except Exception as e:
        print(f"[ERRO BANCO] Erro ao buscar usuários: {e}")
        return []
    finally:
        conn.close()

def listar_restricoes_dashboards(id_usuario):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id_workspace, id_dashboard
        FROM Workspace_Dashboard_Restricoes
        WHERE id_usuario = ?
    """, (id_usuario,))
    rows = cursor.fetchall()
    conn.close()

    restricoes = {}
    for row in rows:
        restricoes.setdefault(row['id_workspace'], set()).add(row['id_dashboard'])
    return restricoes

def _salvar_restricoes_dashboards(cursor, id_usuario, lista_workspaces_ids, dashboards_bloqueados):
    cursor.execute("DELETE FROM Workspace_Dashboard_Restricoes WHERE id_usuario = ?", (id_usuario,))

    for id_workspace in lista_workspaces_ids:
        ids_bloqueados = dashboards_bloqueados.get(str(id_workspace), dashboards_bloqueados.get(id_workspace, []))
        for id_dashboard in ids_bloqueados:
            cursor.execute("""
                SELECT 1
                FROM Workspace_Dashboard
                WHERE id_workspace = ? AND id_dashboard = ?
            """, (id_workspace, id_dashboard))
            if cursor.fetchone() is None:
                raise ValueError("Um dos relatórios selecionados não pertence à workspace informada.")

            cursor.execute("""
                INSERT INTO Workspace_Dashboard_Restricoes (id_workspace, id_usuario, id_dashboard)
                VALUES (?, ?, ?)
            """, (id_workspace, id_usuario, id_dashboard))

def atualizar_usuario(id_usuario, nome, email, papel, lista_workspaces_ids, dashboards_bloqueados=None):
    """Atualiza os dados do usuário e reconstrói os vínculos de workspaces."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Atualiza os dados básicos
        cursor.execute("""
            UPDATE Usuarios 
            SET nome = ?, email = ?, papel = ?
            WHERE id_usuario = ?
        """, (nome, email, papel, id_usuario))
        
        # 2. Limpa os vínculos antigos para recriar
        cursor.execute("DELETE FROM Workspace_Dashboard_Restricoes WHERE id_usuario = ?", (id_usuario,))
        cursor.execute("DELETE FROM Workspace_Usuarios WHERE id_usuario = ?", (id_usuario,))
        
        # 3. Insere os novos vínculos selecionados
        for ws_id in lista_workspaces_ids:
            cursor.execute("""
                INSERT INTO Workspace_Usuarios (id_workspace, id_usuario)
                VALUES (?, ?)
            """, (ws_id, id_usuario))

        _salvar_restricoes_dashboards(
            cursor,
            id_usuario,
            lista_workspaces_ids,
            dashboards_bloqueados or {}
        )
            
        conn.commit()
        return True
    except ValueError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ERRO BANCO] Erro ao atualizar usuário: {e}")
        return False
    finally:
        conn.close()

def excluir_usuario(id_usuario):
    """Exclui o usuário e seus vínculos com workspaces em uma única transação."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT codigo_ldap FROM Usuarios WHERE id_usuario = ?", (id_usuario,))
        usuario = cursor.fetchone()
        if usuario is None:
            return None
        if usuario['codigo_ldap'].strip().casefold() == "admin":
            return False

        cursor.execute("DELETE FROM Workspace_Dashboard_Restricoes WHERE id_usuario = ?", (id_usuario,))
        cursor.execute("DELETE FROM Workspace_Usuarios WHERE id_usuario = ?", (id_usuario,))
        cursor.execute("DELETE FROM Usuarios WHERE id_usuario = ?", (id_usuario,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def autenticar_usuario(usuario, senha, tipo="admin"):
    if tipo not in ("ldap", "admin"):
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id_usuario, nome, codigo_ldap, email, senha, papel FROM Usuarios WHERE codigo_ldap = ?", (usuario,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None # Usuário não existe no banco

    user_dict = dict(row)
    usuario_admin = user_dict['codigo_ldap'].strip().casefold() == 'admin'

    # REGRA 1: Se for LDAP, o sistema confia que a senha foi validada pelo servidor da empresa.
    if tipo == "ldap":
        conn.close()
        if usuario_admin:
            return None
        return user_dict

    # REGRA 2: Se for Admin, valida a senha do banco.
    if tipo == "admin" and usuario_admin:
        if user_dict.get('senha') == senha:
            conn.close()
            return user_dict
        else:
            conn.close()
            return None
    
    conn.close()
    return None


def cadastrar_usuario(nome, ldap, email, papel, lista_workspaces_ids, dashboards_bloqueados=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Não envia a senha (deixa NULL no banco para usuários LDAP)
        cursor.execute("""
            INSERT INTO Usuarios (codigo_ldap, nome, email, papel, data_criacao)
            VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
        """, (ldap, nome, email, papel))
        
        id_usuario_novo = cursor.lastrowid
        
        for ws_id in lista_workspaces_ids:
            cursor.execute("""
                INSERT INTO Workspace_Usuarios (id_workspace, id_usuario)
                VALUES (?, ?)
            """, (ws_id, id_usuario_novo))

        _salvar_restricoes_dashboards(
            cursor,
            id_usuario_novo,
            lista_workspaces_ids,
            dashboards_bloqueados or {}
        )
            
        conn.commit()
        return True, id_usuario_novo
    except ValueError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ERRO BANCO] Erro ao cadastrar usuário: {e}")
        return False, str(e)
    finally:
        conn.close()