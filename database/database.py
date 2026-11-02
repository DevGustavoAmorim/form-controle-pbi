import sqlite3

DB_NAME = "gestapbi.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Tabela de Usuários (Agora com senha)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Usuarios (
            id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_ldap TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            email TEXT NOT NULL,
            senha TEXT NOT NULL, -- NOVA COLUNA
            papel INTEGER NOT NULL,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # MÁGICA DE SEGURANÇA: Verifica se a coluna senha já existe (para não quebrar bancos antigos)
    try:
        cursor.execute("ALTER TABLE Usuarios ADD COLUMN senha TEXT;")
        print("[Migração] Coluna 'senha' injetada com sucesso no SQLite!")
    except sqlite3.OperationalError:
        pass

    # INSERE O ADMIN PADRÃO (LOGIN: admin / SENHA: admin)
    cursor.execute("SELECT COUNT(*) as qtd FROM Usuarios WHERE codigo_ldap = 'admin'")
    if cursor.fetchone()['qtd'] == 0:
        cursor.execute('''
            INSERT INTO Usuarios (codigo_ldap, nome, email, senha, papel, data_criacao) 
            VALUES ('admin', 'Administrador do Sistema', 'admin@empresa.com', 'admin', 127, datetime('now', 'localtime'))
        ''')
        print("[Banco de Dados] Usuário ADMIN padrão criado com sucesso (admin/admin).")

    # 2. Tabela de Workspaces
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Workspace (
            id_workspace INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id_pbi TEXT UNIQUE NOT NULL,
            nome_comercial TEXT NOT NULL,
            descricao TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 3. Tabela de Dashboards (PowerBI)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Dashboard (
            id_dashboard INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id_pbi TEXT UNIQUE NOT NULL,
            nome_dashboard TEXT NOT NULL,
            link_embed TEXT,
            tabelas_utilizadas TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_commit DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    try:
        cursor.execute("ALTER TABLE Dashboard ADD COLUMN tabelas_utilizadas TEXT;")
        print("[Migração] Coluna tabelas_utilizadas injetada com sucesso no SQLite!")
    except sqlite3.OperationalError:
        pass

    # 4. Relacionamento: Workspace x Usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Workspace_Usuarios (
            id_workspace INTEGER,
            id_usuario INTEGER,
            PRIMARY KEY (id_workspace, id_usuario),
            FOREIGN KEY (id_workspace) REFERENCES Workspace(id_workspace),
            FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
        )
    ''')
    
    # 5. Relacionamento: Workspace x PowerBI
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Workspace_Dashboard (
            id_workspace INTEGER,
            id_dashboard INTEGER,
            PRIMARY KEY (id_workspace, id_dashboard),
            FOREIGN KEY (id_workspace) REFERENCES Workspace(id_workspace),
            FOREIGN KEY (id_dashboard) REFERENCES Dashboard(id_dashboard)
        )
    ''')

    # 6. Versionamento dos Dashboards (Garante as colunas de Soft-Delete de auditoria)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Dashboards_versao (
            id_versao INTEGER PRIMARY KEY AUTOINCREMENT,
            id_dashboard INTEGER,
            numero_versao TEXT NOT NULL,
            data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            arquivo_pbix BLOB,
            descricao_alteracao TEXT,
            usuario_excluiu TEXT,
            data_exclusao_binario DATETIME,
            motivo_exclusao TEXT,
            detalhes_exclusao TEXT,
            FOREIGN KEY (id_dashboard) REFERENCES Dashboard(id_dashboard)
        )
    ''')
    
    try:
        cursor.execute("ALTER TABLE Dashboards_versao ADD COLUMN descricao_alteracao TEXT;")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE Dashboards_versao ADD COLUMN usuario_excluiu TEXT;")
        cursor.execute("ALTER TABLE Dashboards_versao ADD COLUMN data_exclusao_binario DATETIME;")
        cursor.execute("ALTER TABLE Dashboards_versao ADD COLUMN motivo_exclusao TEXT;")
        cursor.execute("ALTER TABLE Dashboards_versao ADD COLUMN detalhes_exclusao TEXT;")
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()