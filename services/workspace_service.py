import repositories.usuario_repo as usuario_repo
import repositories.workspace_repo as workspace_repo

def obter_painel_workspaces(codigo_ldap):
    """Orquestra a regra de validação do usuário e coleta de suas workspaces."""
    user = usuario_repo.buscar_por_ldap(codigo_ldap)
    
    if not user:
        return None, "Usuário não localizado no sistema."
        
    papel = user['papel']
    id_usuario = user['id_usuario']
    
    # Coleta as workspaces vinculadas a esse ID no banco
    workspaces_brutas = workspace_repo.listar_workspaces_por_usuario(id_usuario)
    
    # Formata garantindo a leitura exata das chaves do SQLite
    lista_workspaces = [
        {
            "id": ws['id_workspace'], 
            "nome": ws['nome_comercial'], 
            "descricao": ws['descricao']
        } for ws in workspaces_brutas
    ]
    
    resultado = {
        "papel": papel,
        "is_admin": papel == 127,
        "workspaces": lista_workspaces
    }
    
    return resultado, None
