from flask import Flask
from database.database import init_db
from controllers.view_controller import views_blueprint
from controllers.api_controller import api_blueprint

app = Flask(__name__)

# Inicializa o banco de dados e dados iniciais
init_db()

# Registra os Blueprints (as camadas de controle criadas)
app.register_blueprint(views_blueprint)
app.register_blueprint(api_blueprint)

if __name__ == '__main__':
    app.run(debug=True)

