import sqlite3
import random
from datetime import datetime, timedelta

DB_NAME = "gestapbi.db"

def gerar_data_aleatoria(dias_atras=60):
    """Gera datas aleatórias recentes para simular histórico profissional."""
    base = datetime.now()
    return (base - timedelta(days=random.randint(1, dias_atras), hours=random.randint(1, 23))).strftime('%Y-%m-%d %H:%M:%S')

def popular():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Limpando tabelas antigas para evitar duplicidade de GUIDs...")
    cursor.execute("DELETE FROM Workspace_Usuarios")
    cursor.execute("DELETE FROM Workspace_Dashboard")
    cursor.execute("DELETE FROM Dashboards_versao")
    cursor.execute("DELETE FROM Dashboard")
    cursor.execute("DELETE FROM Workspace")
    cursor.execute("DELETE FROM Usuarios")
    
    # 1. Inserir Admin Padrão
    cursor.execute("INSERT INTO Usuarios (codigo_ldap, nome, email, papel, data_criacao) VALUES ('u123456', 'Administrador PBI', 'admin@empresa.com', 127, '2026-01-01 08:00:00')")
    
    # 2. Gerar Lista de Nomes para Massa de Usuários
    nomes = ['Ana Silva', 'Bruno Souza', 'Carlos Eduardo', 'Daniela Lima', 'Eduardo Costa', 'Fernanda Oliveira', 'Gabriel Almeida', 'Helena Ribeiro', 'Igor Santos', 'Juliana Carvalho', 'Kevin Pereira', 'Larissa Martins', 'Marcelo Rocha', 'Nádia Mendes', 'Otávio Castro', 'Patrícia Farias', 'Ricardo Azevedo', 'Sabrina Cruz', 'Thiago Teixeira', 'Vanessa Gomes', 'William Barbosa', 'Yasmin Novaes']
    
    usuarios_ids = []
    for idx, nome in enumerate(nomes):
        ldap = f"u{random.randint(100000, 999999)}"
        email = f"{nome.lower().replace(' ', '.')}@empresa.com"
        dt_cria = gerar_data_aleatoria(90)
        cursor.execute("INSERT INTO Usuarios (codigo_ldap, nome, email, papel, data_criacao) VALUES (?, ?, ?, 1, ?)", (ldap, nome, email, dt_cria))
        usuarios_ids.append(cursor.lastrowid)
        
    # 3. Criar Workspaces de Teste
    workspaces = [
        ('Controladoria - Sul', 'guid-ws-001', 'Painéis financeiros da regional sul'),
        ('Recursos Humanos', 'guid-ws-002', 'Indicadores de Turnover e PDI'),
        ('Logística Comercial', 'guid-ws-003', 'Monitoramento de frotas e entregas')
    ]
    
    ws_ids = []
    for nome, guid, desc in workspaces:
        dt_cria = gerar_data_aleatoria(45)
        cursor.execute("INSERT INTO Workspace (workspace_id_pbi, nome_comercial, descricao, data_criacao) VALUES (?, ?, ?, ?)", (guid, nome, desc, dt_cria))
        ws_ids.append(cursor.lastrowid)
        
    # 4. Criar Dashboards (PBIs) de Teste
    dashboards = [
        ('DRE Gerencial', 'guid-rep-001', 'https://powerbi.com', 'FAT_FATURAMENTO, CAD_PRODUTOS, FIN_CONTA_PAGAR'),
        ('Fluxo de Caixa Consolidado', 'guid-rep-002', 'https://powerbi.com', 'FIN_LANÇAMENTOS, CAD_FORNECEDORES'),
        ('Turnover de Pessoal', 'guid-rep-003', 'https://powerbi.com', 'RH_FUNCIONARIOS, RH_DESLIGAMENTOS'),
        ('Metas PDI 2026', 'guid-rep-004', 'https://powerbi.com', 'Planilha_Metas_Anuais.xlsx'),
        ('Tracking de Frotas V2', 'guid-rep-005', 'https://powerbi.com', 'LOG_TRACKING_VEICULOS, LOG_CAD_MOTORISTAS')
    ]
    
    alocacao_ws = [1, 1, 2, 2, 3] 
    bytes_fake_v1 = b"DATA_V1"
    bytes_fake_v2 = b"DATA_V2"

    for idx, (nome, guid, link, tabelas) in enumerate(dashboards):
        dt_cria = gerar_data_aleatoria(30)
        dt_commit = gerar_data_aleatoria(7)
        
        # Inserindo com a coluna de tabelas_utilizadas
        cursor.execute("""
            INSERT INTO Dashboard (report_id_pbi, nome_dashboard, link_embed, tabelas_utilizadas, data_criacao, ultimo_commit) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (guid, nome, link, tabelas, dt_cria, dt_commit))
        dash_id = cursor.lastrowid
        
        target_ws_id = ws_ids[alocacao_ws[idx] - 1]
        cursor.execute("INSERT INTO Workspace_Dashboard (id_workspace, id_dashboard) VALUES (?, ?)", (target_ws_id, dash_id))
        
        # Inserindo Versões com a Descrição de Commit (Mensagem Git)
        cursor.execute("""
            INSERT INTO Dashboards_versao (id_dashboard, numero_versao, data_atualizacao, arquivo_pbix, descricao_alteracao) 
            VALUES (?, ?, ?, ?, ?)
        """, (dash_id, "v1", dt_cria, sqlite3.Binary(bytes_fake_v1), "Criação inicial do modelo de dados e publicação dos visuais básicos."))

        if random.choice([True, False]):
            cursor.execute("""
                INSERT INTO Dashboards_versao (id_dashboard, numero_versao, data_atualizacao, arquivo_pbix, descricao_alteracao) 
                VALUES (?, ?, ?, ?, ?)
            """, (dash_id, "v2", dt_commit, sqlite3.Binary(bytes_fake_v2), "Ajuste na query de performance Oracle SQL e correção de filtros de data."))

        usuarios_do_pbi = random.sample(usuarios_ids, 10)
        for user_id in usuarios_do_pbi:
            cursor.execute("INSERT OR IGNORE INTO Workspace_Usuarios (id_workspace, id_usuario) VALUES (?, ?)", (target_ws_id, user_id))

    conn.commit()
    conn.close()
    print("Massa atualizada com tabelas de banco e mensagens de commit!")

if __name__ == '__main__':
    popular()
