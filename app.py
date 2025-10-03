import os
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv

# 1. Настройка и Инициализация
# Загружаем переменные окружения из .env файла
load_dotenv()
# Чтение настроек из переменных окружения
API_KEY = os.getenv("OPENROUTER_API_KEY")
BASE_URL = os.getenv("OPENROUTER_BASE_URL")
MODEL_NAME = os.getenv("OPENROUTER_MODEL")
SECRET_KEY = os.getenv("FLASK_SECRET_KEY")
# Проверяем, что все необходимые переменные окружения установлены
if not all([API_KEY, BASE_URL, MODEL_NAME]):
    missing_vars = []
    if not API_KEY: missing_vars.append("OPENROUTER_API_KEY")
    if not BASE_URL: missing_vars.append("OPENROUTER_BASE_URL")
    if not MODEL_NAME: missing_vars.append("OPENROUTER_MODEL")
    if not SECRET_KEY: missing_vars.append("FLASK_SECRET_KEY")
    # Используем raise ValueError, как в оригинальном коде
    raise ValueError(f"Отсутствуют обязательные переменные окружения: {', '.join(missing_vars)}")

# Инициализируем клиент OpenAI с настройками для OpenRouter
client = OpenAI(
    api_key=API_KEY,
    base_url=BASE_URL,
)

# Инициализация Flask приложения
app = Flask(__name__)
app.secret_key = SECRET_KEY
# Отключаем экранирование Unicode для корректного отображения кириллицы
app.json.ensure_ascii = False


# 2. Роут для Фронтенда (Главная страница)

@app.route("/", methods=["GET"])
def index():
    """Отправляет HTML-файл фронтенда."""
    return render_template("index.html")


# 3. Роут для обработки чат-запросов (API Endpoint)

@app.route("/chat", methods=["POST"])
def chat():
    """
    Конечная точка /chat. Принимает JSON с историей диалога ('history'),
    отправляет ее к нейросети и возвращает ответ.
    """

    if not request.is_json:
        return jsonify({"error": "Content-Type должен быть application/json"}), 415

    try:
        data = request.get_json()
    except Exception as e:
        return jsonify({"error": f"Неверный формат JSON: {str(e)}"}), 400

    # ⭐ ИЗМЕНЕНИЕ: Извлекаем историю диалога по ключу 'history'
    conversation_history = data.get("history")

    if not isinstance(conversation_history, list) or not conversation_history:
        return jsonify({"error": "Поле 'history' обязательно и должно быть непустым массивом сообщений."}), 400

    # ⭐ Формирование списка сообщений для API
    # 1. Определяем системное сообщение
    system_message = {
        "role": "system",
        "content": "Ты - полезный и дружелюбный ассистент, разработанный для помощи с задачами. Поддерживай контекст предыдущих 10 сообщений."
    }

    # 2. Создаем финальный список: Системное сообщение + История из фронтенда
    messages_for_api = [system_message] + conversation_history

    # Последнее сообщение пользователя для логгирования
    last_user_message = conversation_history[-1].get("content", "Нет текста")

    try:
        # Отправка запроса к нейросети через OpenRouter API
        # ⭐ Передаем полный массив сообщений с контекстом
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages_for_api
        )

        # Извлечение и возврат ответа
        gpt_response = response.choices[0].message.content

        print(f"Успешный запрос: '{last_user_message[:50]}...' -> Ответ получен")

        return jsonify({"response": gpt_response})

    except Exception as e:
        # Обработка ошибок API и логирование
        print(f"Ошибка при вызове API OpenRouter: {str(e)}")

        error_message = f"Произошла ошибка при обращении к нейросети: {str(e)}"
        return jsonify({"error": error_message}), 500


# 4. Роут проверки работоспособности

@app.route("/health", methods=["GET"])
def health_check():
    """Простая проверка здоровья приложения (Health Check)."""
    return jsonify({"status": "healthy", "service": "chat-api"})


# Запуск приложения
if __name__ == "__main__":
    app.run(
        debug=False, #<-- Меняем на False
        host='127.0.0.1',
        port=5000
    )