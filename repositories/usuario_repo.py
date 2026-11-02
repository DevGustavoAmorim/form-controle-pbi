from database.database import get_db_connection

def buscar_por_ldap(codigo_ldap):
    """Busca os dados do usuário com base no código LDAP."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id_usuario, papel, nome, email FROM Usuarios WHERE codigo_ldap = ?", (codigo_ldap,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
