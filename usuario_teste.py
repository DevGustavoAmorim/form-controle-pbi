import sqlite3

# Conecta ao banco (ajuste o caminho se o seu banco estiver em outra pasta)
conn = sqlite3.connect('gestapbi.db')
cursor = conn.cursor()

try:
    # Insere o usuário de teste com papel 1 (Visualizador)
    cursor.execute("""
        INSERT INTO Usuarios (codigo_ldap, nome, email, senha, papel, data_criacao) 
        VALUES ('teste', 'Usuario de Teste', 'teste@empresa.com', NULL, 1, datetime('now', 'localtime'))
    """)
    conn.commit()
    print("✅ Usuário 'teste' criado com sucesso no banco de dados!")
except sqlite3.IntegrityError:
    print("⚠️ O usuário 'teste' já existe no banco.")
except Exception as e:
    print(f"❌ Erro: {e}")
finally:
    conn.close()