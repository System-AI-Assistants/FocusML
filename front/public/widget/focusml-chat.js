(function() {
  'use strict';

  // Get widget configuration from script tag
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const widgetId = currentScript.getAttribute('data-widget-id');
  const token = currentScript.getAttribute('data-token');

  if (!widgetId || !token) {
    console.error('FocusML Widget: Missing widget-id or token');
    return;
  }

  // Configuration
  const API_BASE = currentScript.getAttribute('data-api-base') || 'https://aiassistant.smartlilac.com/api';
  const STORAGE_KEY = `focusml_widget_${widgetId}`;

  // State
  let config = null;
  let sessionId = null;
  let visitorId = null;
  let messages = [];
  let isOpen = false;
  let isLoading = false;

  // Initialize
  async function init() {
    try {
      // Load or generate visitor ID
      visitorId = localStorage.getItem(`${STORAGE_KEY}_visitor`) || generateId();
      localStorage.setItem(`${STORAGE_KEY}_visitor`, visitorId);

      // Load session from storage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        sessionId = data.sessionId;
        messages = data.messages || [];
      }

      // Fetch widget config (we'll use defaults for now since config comes from backend)
      config = {
        position: 'bottom-right',
        primaryColor: '#1890ff',
        buttonSize: 60,
        windowTitle: 'Chat with us',
        placeholderText: 'Type a message...',
        showBranding: true
      };

      // If we have a session, try to restore it
      if (sessionId) {
        try {
          const response = await fetch(`${API_BASE}/widgets/session/${token}/${sessionId}/`);
          if (response.ok) {
            const data = await response.json();
            messages = data.messages || [];
            if (data.start_message && messages.length === 0) {
              messages.push({
                role: 'assistant',
                content: data.start_message,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          console.warn('Could not restore session:', e);
        }
      }

      // Create widget UI
      createWidget();
    } catch (error) {
      console.error('FocusML Widget initialization error:', error);
    }
  }

  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId,
      messages: messages.slice(-50) // Keep last 50 messages
    }));
  }

  function createWidget() {
    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = `
      .focusml-widget-container {
        position: fixed;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .focusml-widget-container.bottom-right { bottom: 20px; right: 20px; }
      .focusml-widget-container.bottom-left { bottom: 20px; left: 20px; }
      .focusml-widget-container.top-right { top: 20px; right: 20px; }
      .focusml-widget-container.top-left { top: 20px; left: 20px; }
      
      .focusml-widget-button {
        width: ${config.buttonSize}px;
        height: ${config.buttonSize}px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .focusml-widget-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      .focusml-widget-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }
      
      .focusml-widget-window {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 380px;
        height: 520px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .focusml-widget-container.bottom-left .focusml-widget-window,
      .focusml-widget-container.top-left .focusml-widget-window {
        right: auto;
        left: 0;
      }
      .focusml-widget-container.top-right .focusml-widget-window,
      .focusml-widget-container.top-left .focusml-widget-window {
        bottom: auto;
        top: 70px;
      }
      .focusml-widget-window.open {
        display: flex;
      }
      
      .focusml-widget-header {
        padding: 16px;
        background: ${config.primaryColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .focusml-widget-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .focusml-widget-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .focusml-widget-close:hover {
        opacity: 1;
      }
      
      .focusml-widget-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .focusml-message {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
      }
      .focusml-message.user {
        align-self: flex-end;
        background: ${config.primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }
      .focusml-message.assistant {
        align-self: flex-start;
        background: #f0f0f0;
        color: #333;
        border-bottom-left-radius: 4px;
      }
      .focusml-message.loading {
        background: #f0f0f0;
        color: #666;
      }
      .focusml-typing-indicator {
        display: flex;
        gap: 4px;
        padding: 4px 0;
      }
      .focusml-typing-indicator span {
        width: 8px;
        height: 8px;
        background: #999;
        border-radius: 50%;
        animation: focusml-bounce 1.4s infinite ease-in-out both;
      }
      .focusml-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
      .focusml-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes focusml-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }
      
      .focusml-widget-input {
        padding: 12px 16px;
        border-top: 1px solid #e8e8e8;
        display: flex;
        gap: 8px;
      }
      .focusml-widget-input input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #d9d9d9;
        border-radius: 20px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }
      .focusml-widget-input input:focus {
        border-color: ${config.primaryColor};
      }
      .focusml-widget-input button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
      }
      .focusml-widget-input button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .focusml-widget-input button svg {
        width: 18px;
        height: 18px;
        fill: white;
      }
      
      .focusml-widget-branding {
        padding: 8px;
        text-align: center;
        font-size: 11px;
        color: #999;
        border-top: 1px solid #f0f0f0;
      }
      .focusml-widget-branding a {
        color: #666;
        text-decoration: none;
      }
      .focusml-widget-branding a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(styles);

    // Create container
    const container = document.createElement('div');
    container.className = `focusml-widget-container ${config.position}`;
    container.innerHTML = `
      <div class="focusml-widget-window">
        <div class="focusml-widget-header">
          <h4>${escapeHtml(config.windowTitle)}</h4>
          <button class="focusml-widget-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="focusml-widget-messages"></div>
        <div class="focusml-widget-input">
          <input type="text" placeholder="${escapeHtml(config.placeholderText)}" />
          <button type="button" aria-label="Send">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        ${config.showBranding ? '<div class="focusml-widget-branding">Powered by <a href="https://focusml.io" target="_blank">FocusML</a></div>' : ''}
      </div>
      <button class="focusml-widget-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
    `;
    document.body.appendChild(container);

    // Get elements
    const button = container.querySelector('.focusml-widget-button');
    const window = container.querySelector('.focusml-widget-window');
    const closeBtn = container.querySelector('.focusml-widget-close');
    const messagesContainer = container.querySelector('.focusml-widget-messages');
    const input = container.querySelector('.focusml-widget-input input');
    const sendBtn = container.querySelector('.focusml-widget-input button');

    // Event handlers
    button.addEventListener('click', () => {
      isOpen = !isOpen;
      window.classList.toggle('open', isOpen);
      if (isOpen) {
        input.focus();
        scrollToBottom();
      }
    });

    closeBtn.addEventListener('click', () => {
      isOpen = false;
      window.classList.remove('open');
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Render existing messages
    renderMessages();

    async function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;

      input.value = '';
      isLoading = true;
      sendBtn.disabled = true;

      // Add user message
      messages.push({
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      });
      renderMessages();
      scrollToBottom();

      // Show loading
      const loadingEl = document.createElement('div');
      loadingEl.className = 'focusml-message assistant loading';
      loadingEl.innerHTML = '<div class="focusml-typing-indicator"><span></span><span></span><span></span></div>';
      messagesContainer.appendChild(loadingEl);
      scrollToBottom();

      try {
        const response = await fetch(`${API_BASE}/widgets/chat/${token}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            visitor_id: visitorId
          })
        });

        loadingEl.remove();

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        sessionId = data.session_id;

        messages.push({
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString()
        });

        saveSession();
        renderMessages();
        scrollToBottom();

      } catch (error) {
        loadingEl.remove();
        console.error('FocusML Widget error:', error);
        
        messages.push({
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date().toISOString()
        });
        renderMessages();
        scrollToBottom();
      } finally {
        isLoading = false;
        sendBtn.disabled = false;
      }
    }

    function renderMessages() {
      messagesContainer.innerHTML = messages.map(msg => `
        <div class="focusml-message ${msg.role}">
          ${escapeHtml(msg.content)}
        </div>
      `).join('');
    }

    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

