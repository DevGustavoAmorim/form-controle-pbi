/**
 * GestaPBI - Login (Debug Ativado)
 */
console.log("✅ login.js carregado com sucesso.");

const loginForm = document.getElementById("loginForm");

if (!loginForm) {
    console.error("❌ ERRO FATAL: O formulário com id='loginForm' não foi encontrado no HTML.");
} else {
    console.log("✅ Formulário 'loginForm' encontrado.");

    const tabLdap = document.getElementById("tabLdap");
    const tabAdmin = document.getElementById("tabAdmin");
    const lblUsername = document.getElementById("lblUsername");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const usernameError = document.getElementById("usernameError");
    const passwordError = document.getElementById("passwordError");
    const btnSubmit = document.getElementById("btnEntrar");

    let tipoAcesso = "ldap";

    // Controle de Abas
    if (tabLdap && tabAdmin) {
        tabLdap.addEventListener("click", () => {
            tipoAcesso = "ldap";
            tabLdap.classList.add("active");
            tabAdmin.classList.remove("active");
            lblUsername.textContent = "Usuário LDAP";
            limparErros();
        });

        tabAdmin.addEventListener("click", () => {
            tipoAcesso = "admin";
            tabAdmin.classList.add("active");
            tabLdap.classList.remove("active");
            lblUsername.textContent = "Usuário Administrador";
            limparErros();
        });
    }

    // Envio do Formulário
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault(); 
        console.log("🚀 Botão clicado! Iniciando envio...");
        
        limparErros();
        
        const usuarioValue = usernameInput.value.trim();
        const senhaValue = passwordInput.value;
        
        if (!usuarioValue || !senhaValue) {
            console.warn("⚠️ Campos vazios.");
            usernameError.textContent = "Preencha todos os campos.";
            return;
        }

        const textoOriginal = btnSubmit.textContent;
        btnSubmit.textContent = 'Autenticando...';
        btnSubmit.disabled = true;

        try {
            console.log("📡 Fazendo fetch para /api/login com:", usuarioValue);
            
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: usuarioValue, 
                    password: senhaValue, 
                    tipo: tipoAcesso 
                })
            });

            console.log("📥 Resposta recebida do servidor. Status:", response.status);
            
            const data = await response.json();
            console.log("📦 Dados convertidos:", data);

            if (response.ok && data.success) {
                console.log("✅ Login aprovado! Redirecionando...");
                localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));
                window.location.href = "/dashboard"; // ou "/" dependendo da sua rota
            } else {
                console.warn("❌ Login negado pelo servidor.");
                throw new Error(data.error || "Credenciais inválidas.");
            }
        } catch (error) {
            console.error("💥 Erro durante o login:", error);
            usernameInput.classList.add('invalid');
            passwordInput.classList.add('invalid');
            usernameError.textContent = error.message;
        } finally {
            btnSubmit.textContent = textoOriginal;
            btnSubmit.disabled = false;
        }
    });

    function limparErros() {
        usernameInput.classList.remove('invalid');
        passwordInput.classList.remove('invalid');
        usernameError.textContent = '';
        passwordError.textContent = '';
    }
}