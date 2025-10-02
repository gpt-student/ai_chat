document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('messages-container');
    const themeToggle = document.getElementById('theme-toggle');

    // Хранилище контекста: массив объектов {role: string, content: string}
    let conversationHistory = [];
    const MAX_HISTORY_LENGTH = 20; // 10 пар сообщений

    // Настройки для marked.js (Markdown-парсер)
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: true,
        // Указываем marked, что highlight.js будет обрабатывать подсветку
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    });

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Функция обновления истории
    function updateHistory(role, content) {
        conversationHistory.push({ role: role, content: content });
        if (conversationHistory.length > MAX_HISTORY_LENGTH) {
            const excess = conversationHistory.length - MAX_HISTORY_LENGTH;
            conversationHistory.splice(0, excess);
        }
    }

    // Функция для создания элемента сообщения
    function createMessageElement(messageText, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        if (sender === 'gpt') {
            const htmlContent = marked.parse(messageText);
            messageDiv.innerHTML = htmlContent;
        } else {
            messageDiv.innerHTML = `<p>${messageText}</p>`;
        }

        messagesContainer.appendChild(messageDiv);
        scrollToBottom();

        // Запускаем Highlight.js для всего нового контента
        hljs.highlightAll();

        return messageDiv;
    }

    function createLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('loading-indicator', 'gpt-message');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(loadingDiv);
        scrollToBottom();
        return loadingDiv;
    }

    // Обработчик отправки формы
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = userInput.value.trim();
        if (!message) return;

        // 1. Отобразить сообщение пользователя
        createMessageElement(message, 'user');

        // 2. Сохранить сообщение пользователя в историю
        updateHistory('user', message);

        // 3. Показать индикатор загрузки
        const loadingIndicator = createLoadingIndicator();

        userInput.value = '';
        userInput.disabled = true;
        document.getElementById('send-btn').disabled = true;

        try {
            // 4. Отправка POST-запроса, включая ВСЮ историю
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: conversationHistory })
            });

            if (!response.ok) {
                // Если ошибка HTTP, пытаемся прочитать ответ для детализации
                const errorData = await response.json().catch(() => ({ error: `Сервер вернул ошибку ${response.status}` }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const gptResponseText = data.response || "Не удалось получить ответ от нейросети.";

            // 5. Заменить индикатор ответом
            loadingIndicator.remove();
            createMessageElement(gptResponseText, 'gpt');

            // 6. Сохранить ответ нейросети в историю
            updateHistory('assistant', gptResponseText);

        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            loadingIndicator.remove();
            createMessageElement(`Произошла ошибка при получении ответа: ${error.message}`, 'gpt');
        } finally {
            // Включаем обратно поле ввода и кнопку
            userInput.disabled = false;
            document.getElementById('send-btn').disabled = false;
            userInput.focus();
        }
    });

    // Логика переключения светлой/темной темы
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });

    // Загрузка сохраненной темы при старте
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    }
    
    loadTheme();
});