/**
 * GestaPBI - Controle de Acesso e Autenticação Corporativa (LDAP Mock)
 */
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const usernameError = document.getElementById('usernameError');
    const passwordError = document.getElementById('passwordError');
    const btnSubmit = document.querySelector('.btn-submit');
    
    // Limpa estados de erros anteriores
    usernameInput.classList.remove('invalid');
    passwordInput.classList.remove('invalid');
    usernameError.textContent = '';
    passwordError.textContent = '';

    const usuarioValue = usernameInput.value.trim();
    const senhaValue = passwordInput.value;
    let formValido = true;

    // 1. Validação Visual Básica de Campos Vazios
    if (!usuarioValue) {
        usernameInput.classList.add('invalid');
        usernameError.textContent = 'Por favor, insira seu usuário corporativo.';
        formValido = false;
    }
    if (!senhaValue) {
        passwordInput.classList.add('invalid');
        passwordError.textContent = 'A senha corporativa é obrigatória.';
        formValido = false;
    }

    if (!formValido) return;

    // Alteração visual do botão para dar feedback de "Carregando/Autenticando..."
    const textoOriginalBotao = btnSubmit.textContent;
    btnSubmit.textContent = 'Autenticando no LDAP...';
    btnSubmit.style.opacity = '0.7';
    btnSubmit.disabled = true;

    try {
        // 2. Lógica do Modo de Teste ("Bypass" para Homologação)
        if (usuarioValue.toLowerCase() === 'teste') {
            console.warn("[Ambiente Dev] Modo de teste ativado. Ignorando validação estrita do LDAP.");
            
            // Simula um pequeno delay de rede de 1 segundo para parecer real no portfólio
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            window.location.href = '/dashboard'; 
            // window.location.href = '/dashboard'; // Caminho futuro no Python
            return;
        }

        // 3. Estrutura Padrão de Chamada para o Backend Python (Futura API)
        // Aqui simulamos como o seu JS conversará com o script Python
        console.log(`Enviando credenciais de ${usuarioValue} para validação no AD/LDAP via Python...`);
        
        /* 
        // Descomente este bloco quando o backend em Python (Flask/FastAPI) estiver pronto:
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuarioValue, senha: senhaValue })
        });
        const resultado = await response.json();
        if (!response.ok) throw new Error(resultado.message || 'Falha na autenticação');
        */

        // Simulando uma resposta genérica de erro caso não seja o usuário "teste"
        await new Promise(resolve => setTimeout(resolve, 1500));
        throw new Error('Usuário ou senha incorretos no diretório LDAP. Use "teste" para validar a tela.');

    } catch (error) {
        // Exibe o erro corporativo retornado pelo servidor
        usernameInput.classList.add('invalid');
        passwordInput.classList.add('invalid');
        usernameError.textContent = error.message;
    } finally {
        // Restaura o estado original do botão
        btnSubmit.textContent = textoOriginalBotao;
        btnSubmit.style.opacity = '1';
        btnSubmit.disabled = false;
    }
});

// Limpeza de erros ao digitar
document.getElementById('username').addEventListener('input', function() {
    this.classList.remove('invalid');
    document.getElementById('usernameError').textContent = '';
});
document.getElementById('password').addEventListener('input', function() {
    this.classList.remove('invalid');
    document.getElementById('passwordError').textContent = '';
});
