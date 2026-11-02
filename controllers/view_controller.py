from flask import Blueprint, render_template

views_blueprint = Blueprint('views', __name__)

@views_blueprint.route('/')
def login_page():
    return render_template('login.html')

@views_blueprint.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')
