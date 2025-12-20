const accessToken = localStorage.getItem('access_token');
const hostName = window.location.hostname;
const baseUrl = `http://${hostName}:8000/api/v1/`;
const wsBaseUrl = `ws://${hostName}:8000/chat`;

async function isValidToken(token) {
    try {
        const response = await fetch(`${baseUrl}auth/verify-token`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, mode: 'cors',  // important for cross-origin requests
            body: JSON.stringify({token: token})
        });
        if (!response.ok) {
            localStorage.removeItem('access_token');
            window.location.href = 'register.html';
        }
        return true;
    } catch (error) {
        console.log('error', error)
        return false
    }
}

// Sample data structure matching Django models
const sampleChats = [];

const sampleMessages = [];

let currentUser = null;
let activeChat = null;

let typingTimeout = null;
let stopTypingTimeout = null;
let typingUsers = new Set();
let chatTypingTimeouts = {}; // Har bir chat uchun typing timeout

let searchQuery = '';
let ws = null;

const defaultConfig = {
    app_title: "Chat Application",
    online_status_text: "Online",
    offline_status_text: "Offline",
    typing_indicator_text: "typing...",
    send_button_text: "Send",
    search_placeholder: "Search chats..."
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize chat list
function renderChatList() {
    const chatListElement = $('#chatList');
    chatListElement.empty();

    // Filter chats based on search query
    const filteredChats = sampleChats.filter(chat => {
        if (!searchQuery) return true;
        return chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || chat.last_message.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (filteredChats.length === 0) {
        chatListElement.append(`
                    <div style="padding: 40px; text-align: center; color: #95a5a6;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                        <div style="font-size: 15px;">No chats found</div>
                    </div>
                `);
        return;
    }

    filteredChats.forEach(chat => {
        const firstLetter = chat.name.charAt(0).toUpperCase();

        const avatarContent = chat.image
            ? `<img src="${chat.image}" alt="${chat.name}" style="width: 40px; height: 40px; border-radius: 50%;">`
            : firstLetter;

        const chatItem = $(`
                    <div class="chat-item" data-chat-id="${chat.id}">
                        <div class="chat-avatar">
                            ${avatarContent}
                            ${chat.is_online ? '<div class="online-indicator"></div>' : ''}
                        </div>
                        <div class="chat-info">
                            <div class="chat-name">${chat.name}</div>
                            <div class="chat-preview">${chat.last_message || 'cleared chat'}</div>
                        </div>
                        <div class="chat-meta">
                            <div class="chat-time">${chat.last_message_time || ''}</div>
                            ${chat.unread_count > 0 ? `<div class="unread-badge">${chat.unread_count}</div>` : ''}
                        </div>
                    </div>
                `);

        chatItem.on('click', function () {
            openChat(chat.id);
        });

        chatListElement.append(chatItem);
    });
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function searchFromApi(query) {

    if (!query) {
        fetchChats();
        return;
    }

    $.ajax({
        url: `${baseUrl}users`,   // API endpointingiz
        method: 'GET',
        data: {
            search: query
        },
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        success: function (res) {
            renderChatListFromUsers(res);
        },
        error: function (err) {
            console.error("Search error:", err);
        }
    });
}

// HTML escape funksiyasi
function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Edit mode ni boshlash
function startEditMessage(event, messageId, currentText) {
    event.stopPropagation();

    // Agar boshqa xabar edit qilinayotgan bo'lsa, bekor qilish
    if (editingMessageId) {
        cancelEditMessage(editingMessageId);
    }

    editingMessageId = messageId;

    const messageEl = $(`.message[data-message-id="${messageId}"]`);
    const bubbleEl = messageEl.find('.message-bubble');
    const textEl = messageEl.find('.message-text');

    // Edit icon ni yashirish
    bubbleEl.find('.edit-icon').hide();

    // Edit mode
    bubbleEl.addClass('editing');

    // Text ni input bilan almashtirish
    const originalText = textEl.text();
    textEl.html(`
        <textarea class="edit-input" id="editInput_${messageId}">${originalText}</textarea>
        <div class="edit-actions">
            <button class="edit-btn cancel" onclick="cancelEditMessage(${messageId})">Cancel</button>
            <button class="edit-btn save" onclick="saveEditMessage(${messageId})">Save</button>
        </div>
    `);

    // Focus input
    const input = $(`#editInput_${messageId}`);
    input.focus();
    input[0].setSelectionRange(input.val().length, input.val().length);

    // Enter tugmasi bilan saqlash
    input.on('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEditMessage(messageId);
        } else if (e.key === 'Escape') {
            cancelEditMessage(messageId);
        }
    });
}

// Edit ni bekor qilish
function cancelEditMessage(messageId) {
    const messageEl = $(`.message[data-message-id="${messageId}"]`);
    const bubbleEl = messageEl.find('.message-bubble');
    const textEl = messageEl.find('.message-text');

    // Original textni qaytarish
    const originalText = $(`#editInput_${messageId}`).val();
    textEl.text(originalText);

    // Edit mode ni o'chirish
    bubbleEl.removeClass('editing');
    bubbleEl.find('.edit-icon').show();

    editingMessageId = null;
}

// Edit ni saqlash
async function saveEditMessage(messageId) {
    const input = $(`#editInput_${messageId}`);
    const newText = input.val().trim();

    if (!newText) {
        alert('Message cannot be empty');
        return;
    }

    const messageEl = $(`.message[data-message-id="${messageId}"]`);
    const originalText = messageEl.find('.message-text').text();

    // Agar o'zgarmagan bo'lsa
    if (newText === originalText) {
        cancelEditMessage(messageId);
        return;
    }

    try {
        // API ga so'rov yuborish
        const response = await fetch(`${baseUrl}messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({message: newText})
        });

        if (!response.ok) {
            throw new Error('Failed to update message');
        }

        const data = await response.json();

        // UI ni yangilash
        const bubbleEl = messageEl.find('.message-bubble');
        const textEl = messageEl.find('.message-text');
        const timeEl = messageEl.find('.message-time');

        textEl.text(newText);
        bubbleEl.removeClass('editing');
        bubbleEl.find('.edit-icon').show();

        // Edited label qo'shish
        if (!timeEl.find('.edited-label').length) {
            timeEl.find('.message-status').before('<span class="edited-label">(edited)</span>');
        }

        // WebSocket orqali boshqa userlarga xabar yuborish
        if (ws && window.activeChat) {
            ws.send(JSON.stringify({
                type: 'edit_message',
                message_id: messageId,
                message: newText,
                chat_id: window.activeChat.id
            }));
        }

        editingMessageId = null;

    } catch (error) {
        console.error('Error updating message:', error);
        alert('Failed to update message');
    }
}

function renderMessagesFromApi(chat) {
    const messagesContainer = $("#messagesContainer");
    messagesContainer.empty();

    if (!chat.messages || chat.messages.length === 0) {
        messagesContainer.append(`<div class="empty-messages"></div>`);
        return;
    }

    chat.messages.forEach(msg => {
        const editedLabel = msg.is_edited ? '<span class="edited-label">(edited)</span>' : '';
        const editIcon = msg.isSent ? '<div class="edit-icon" onclick="startEditMessage(event, ' + msg.id + ', \'' + escapeHtml(msg.message) + '\')">✏️</div>' : '';

        messagesContainer.append(`
            <div class="message ${msg.isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
                <div class="message-content">
                    <div class="message-bubble">
                        ${editIcon}
                        <span class="message-text">${msg.message}</span>
                    </div>
                    <div class="message-time">
                        ${msg.created_at}
                        ${editedLabel}
                        ${msg.isSent ? `<span class="message-status">✓${msg.is_read ? '✓' : ''}</span>` : ''}
                    </div>
                </div>
            </div>
        `);
    });
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

// Chat list da typing ko'rsatish
function showChatListTyping(chatId, userId) {
    if (userId === currentUser.id) return;

    const chat = sampleChats.find(c => c.id === chatId);
    if (!chat) return;

    chat.is_typing = true;

    // To'g'ri selector - avval chat-item ni topamiz, keyin ichidan preview ni olamiz
    const chatItem = $(`.chat-item[data-chat-id="${chatId}"]`);
    if (chatItem.length) {
        const previewEl = chatItem.find('.chat-preview');
        if (previewEl.length) {
            previewEl.addClass('typing').text('');
        }
    }

    if (chatTypingTimeouts[chatId]) {
        clearTimeout(chatTypingTimeouts[chatId]);
    }

    chatTypingTimeouts[chatId] = setTimeout(() => {
        hideChatListTyping(chatId);
    }, 500);
}

// Chat list da typing yashirish
function hideChatListTyping(chatId) {
    const chat = sampleChats.find(c => c.id === chatId);
    if (!chat) return;

    chat.is_typing = false;

    // To'g'ri selector
    const chatItem = $(`.chat-item[data-chat-id="${chatId}"]`);
    if (chatItem.length) {
        const previewEl = chatItem.find('.chat-preview');
        if (previewEl.length) {
            previewEl.removeClass('typing').text(chat.last_message || '');
        }
    }

    if (chatTypingTimeouts[chatId]) {
        clearTimeout(chatTypingTimeouts[chatId]);
        delete chatTypingTimeouts[chatId];
    }
}

// Typing indikatorni ko'rsatish (chat header da)
function showTypingIndicator(chatId, userId) {
    const activeChat = window.activeChat;

    // Faqat ochiq chatda ko'rsatamiz
    if (!activeChat || activeChat.id !== chatId) return;

    // O'zimizning typing ni ko'rsatmaymiz
    if (userId === currentUser.id) return;

    typingUsers.add(userId);

    // Header dagi typing indikatorni ko'rsatamiz
    const typingIndicator = $('#typingIndicator');
    const statusText = $('#activeChatStatus');

    // Online yozuvini yashiramiz
    statusText.hide();

    // Typing indikatorni ko'rsatamiz
    const config = window.elementSdk?.config || defaultConfig;
    typingIndicator.text(config.typing_indicator_text || 'typing...').show();

    // Avvalgi timeout ni tozalaymiz
    if (stopTypingTimeout) {
        clearTimeout(stopTypingTimeout);
    }

    // 0.5 sekunddan keyin avtomatik yashiramiz
    stopTypingTimeout = setTimeout(() => {
        hideTypingIndicator(chatId, userId);
    }, 500);
}

// Typing indikatorni yashirish (chat header da)
function hideTypingIndicator(chatId, userId) {
    const activeChat = window.activeChat;
    if (!activeChat || activeChat.id !== chatId) return;

    typingUsers.delete(userId);

    if (typingUsers.size === 0) {
        // Typing indikatorni yashiramiz
        $('#typingIndicator').hide();

        // Online yozuvini qaytaramiz
        const statusText = $('#activeChatStatus');
        const config = window.elementSdk?.config || defaultConfig;
        statusText.text(activeChat.is_online ? config.online_status_text : config.offline_status_text).show();
    }
}

// Open specific chat
async function openChat(chatId) {
    let activeChat = null;

    $('#typingIndicator').removeClass('show');

    // Chat list dagi typing ni ham tozalaymiz
    Object.keys(chatTypingTimeouts).forEach(id => {
        if (chatTypingTimeouts[id]) {
            clearTimeout(chatTypingTimeouts[id]);
            delete chatTypingTimeouts[id];
        }
    });

    try {
        // API’dan olishga harakat
        const res = await fetch(`${baseUrl}chats/${chatId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (res.status === 404) {
            // 404 bo‘lsa — chat bor, lekin ichida xabar yo‘q
            activeChat = {id: chatId, name: `Chat ${chatId}`, messages: [], unread_count: 0};
        } else if (!res.ok) {
            throw new Error("API error");
        } else {
            // API ma’lumotlarini olish
            activeChat = await res.json();
        }

    } catch (e) {
        console.error("Chatni olishda xatolik:", e);
        return;
    }

    // Global activeChat o‘zgartiriladi
    window.activeChat = activeChat;

    // UI ni yangilash
    $('.chat-item').removeClass('active');
    $(`.chat-item[data-chat-id="${chatId}"]`).addClass('active');

    $('#emptyState').hide();
    $('#activeChatArea').css('display', 'flex');

    const firstLetter = (activeChat.name || "C").charAt(0).toUpperCase();
    $('#activeChatAvatar').text(firstLetter);
    $('#activeChatName').text(activeChat.name || `Chat ${chatId}`);

    const config = window.elementSdk?.config || defaultConfig;
    $('#activeChatStatus').text(activeChat.is_online ? config.online_status_text : config.offline_status_text);

    // API dan message larni olish kodni shu yerga yoz
    const response = await fetch(`${baseUrl}chats/${chatId}/messages`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error("Messages API error");
    }

    // Chat obyektiga messages ni qo'shamiz
    activeChat.messages = (await response.json()).map(msg => ({
        ...msg,
        isSent: msg.from_user === currentUser.id,  // xabar o‘zimdan bo‘lsa true
        created_at: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) // vaqtni oson o'qiladigan qilib
    }));

    // Xabarlarni yuklash
    renderMessagesFromApi(activeChat);

    // Unread badge yo‘q qilinadi
    activeChat.unread_count = 0;
    $(`.chat-item[data-chat-id="${chatId}"] .unread-badge`).remove();

    // Fokus inputga
    $('#messageInput').focus();
}


// Voice Chat Module - WebRTC Integration

class VoiceChatManager {
    constructor() {
        this.peerConnections = new Map();
        this.pendingOffers = new Map();  // ← QO'SHISH
        this.localStream = null;
        this.isCallActive = false;
        this.currentCallUserId = null;
        this.durationInterval = null;      // ✅ QO'SHISH
        this.incomingCallTimeoutId = null; // ✅ QO'SHISH
        this.iceServers = {
            iceServers: [
                {urls: 'stun:stun.l.google.com:19302'},
                {urls: 'stun:stun1.l.google.com:19302'}
            ]
        };
    }

    // Mikrofonni ishga tushirish
    async startMicrophone() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log('Microphone started');
            return this.localStream;
        } catch (error) {
            console.error('Microphone error:', error);
            alert('Mikrofonni ishga tushurib bo\'lmadi');
            return null;
        }
    }

    // Mikrofonni yopish
    stopMicrophone() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    // Qo'ng'iroqni boshlash (Caller)
    async initiateCall(targetChatId, targetUserName) {
        if (this.isCallActive) return;

        const stream = await this.startMicrophone();
        if (!stream) return;

        this.currentCallUserId = targetChatId;
        const pc = new RTCPeerConnection(this.iceServers);
        this.peerConnections.set(targetChatId, pc);

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'voice_ice_candidate',
                    to_user_id: targetChatId,
                    candidate: event.candidate
                }));
            }
        };

        pc.ontrack = (event) => {
            console.log('Remote track received');
            this.playRemoteAudio(event.streams[0]);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(JSON.stringify({
            type: 'voice_call_offer',
            chat_id: targetChatId,
            offer: offer
        }));

        this.showCallInterface(targetUserName, true);
        this.isCallActive = true;
    }

    // Qo'ng'iroqni qabul qilish
    async answerCall(fromUserId, offer) {
        this.currentCallUserId = fromUserId;

        // Mikrofonni ishga tushirish
        const stream = await this.startMicrophone();
        if (!stream) return;

        // WebRTC ulanish
        const peerConnection = new RTCPeerConnection(this.iceServers);
        this.peerConnections.set(fromUserId, peerConnection);

        // Local stream ni qo'shish
        stream.getTracks().forEach(track => {
            peerConnection.addTrack(track, stream);
        });

        // ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({
                    type: 'voice_ice_candidate',
                    to_user_id: fromUserId,
                    candidate: event.candidate
                }));
            }
        };

        // Remote stream
        peerConnection.ontrack = (event) => {
            this.playRemoteAudio(event.streams[0]);
        };

        // Offer ni set qilish
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Answer yaratish
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Signal yuborish
        ws.send(JSON.stringify({
            type: 'voice_call_answer',
            to_user_id: fromUserId,
            answer: answer
        }));

        this.isCallActive = true;
    }

    // Offer qabul qilish
    async handleOffer(fromUserId, fullName, offer) {
        // Incoming call notification
        this.pendingOffers.set(fromUserId, offer);  // ← SAQLASH
        this.showIncomingCallNotification(fromUserId, fullName, offer);
    }

    // Answer qabul qilish
    async handleAnswer(fromUserId, answer) {
        const peerConnection = this.peerConnections.get(fromUserId);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }

    // ICE candidate qabul qilish
    async handleIceCandidate(fromUserId, candidate) {
        const peerConnection = this.peerConnections.get(fromUserId);
        if (peerConnection && candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('ICE candidate error:', error);
            }
        }
    }

    // Remote audio ni eshitish
    playRemoteAudio(stream) {
        const audioElement = document.getElementById('remoteAudio');
        if (audioElement) {
            audioElement.srcObject = stream;
            audioElement.play();
        }
    }

    // Qo'ng'iroqni to'xtatish
    endCall() {
        // ← SIGNAL BIRINCHI
        if (this.currentCallUserId && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'voice_call_end',
                to_user_id: this.currentCallUserId
            }));
        }

        // ← KEYIN RESET
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.pendingOffers.clear();
        this.stopMicrophone();
        this.hideCallInterface();

        this.isCallActive = false;
        this.currentCallUserId = null;
    }

    // Qo'ng'iroqni rad qilish
    rejectCall() {
        if (this.currentCallUserId) {
            ws.send(JSON.stringify({
                type: 'voice_call_reject',
                to_user_id: this.currentCallUserId
            }));
        }
        this.endCall();  // Qo'ng'iroqni tugatish
    }

    // Incoming call UI
    showIncomingCallNotification(fromUserId, FullName, offer) {
        const notification = document.createElement('div');
        notification.className = 'incoming-call-notification';
        notification.innerHTML = `
      <div class="incoming-call-content">
        <div class="incoming-call-icon">📞</div>
        <div class="incoming-call-text">
          <p>Incoming voice call...</p>
          <p id="callerName">${FullName} ${fromUserId}</p>
        </div>
        <div class="incoming-call-buttons">
          <button class="accept-call-btn" 
                  onclick="voiceChat.acceptCall(${fromUserId})">
            ✓ Accept
          </button>
          <button class="reject-call-btn" 
                  onclick="voiceChat.rejectCall()">
            ✕ Reject
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(notification);

        // 30 sekunddan keyin avtomatik rad qilish
        setTimeout(() => {
            if (notification.parentElement) {
                this.rejectCall();
                notification.remove();
            }
        }, 30000);
    }

    // UI interfeysini ko'rsatish
    showCallInterface(userName, isInitiator) {
        let callUI = document.getElementById('callInterface');

        // Agar interfeys hali yo'q bo'lsa, yaratamiz
        if (!callUI) {
            callUI = document.createElement('div');
            callUI.id = 'callInterface';
            callUI.className = 'call-interface';
            document.body.appendChild(callUI);
        }

        // HTML tarkibini joylashtiramiz
        callUI.innerHTML = `
        <div class="call-header">
          <span id="callUserName">${userName}</span>
          <span id="callDuration">00:00</span>
        </div>
        <div class="call-controls">
          <button id="muteBtn" class="call-btn">🔊</button>
          <button id="endCallBtn" class="call-btn end-call-btn">📞</button>
        </div>
    `;
        callUI.style.display = 'flex';

        // Xatolikni oldini olish: Elementlarni innerHTML dan keyin topamiz
        const endBtn = callUI.querySelector('#endCallBtn');
        const muteBtn = callUI.querySelector('#muteBtn');

        if (endBtn) {
            endBtn.onclick = () => this.endCall();
        }

        if (muteBtn) {
            let isMuted = false;
            muteBtn.onclick = (e) => {
                isMuted = !isMuted;
                if (this.localStream) {
                    this.localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
                }
                e.target.textContent = isMuted ? '🔇' : '🔊';
            };
        }

        // Taymerni boshlash
        if (this.durationInterval) clearInterval(this.durationInterval);
        let seconds = 0;
        const durationDisplay = callUI.querySelector('#callDuration');

        this.durationInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            if (durationDisplay) {
                durationDisplay.textContent =
                    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
        }, 1000);
    }

    // Call interface yashirish
    hideCallInterface() {
        const callUI = document.getElementById('callInterface');
        if (callUI) {
            callUI.style.display = 'none';
        }
    }

    // Incoming call qabul qilish
    async acceptCall(fromUserId) {
        const notification = document.querySelector('.incoming-call-notification');
        if (notification) {
            notification.remove();
        }

        if (this.incomingCallTimeoutId) {
            clearTimeout(this.incomingCallTimeoutId);
            this.incomingCallTimeoutId = null;
        }

        const offer = this.pendingOffers.get(fromUserId);
        if (!offer) {
            console.error('No pending offer found');
            return;
        }

        await this.answerCall(fromUserId, offer);
        this.showCallInterface(`User ${fromUserId}`, false);
    }
}

// Global voice chat instance
let voiceChat = null;

// WebSocket message handler update
function handleVoiceMessage(data) {
    if (!voiceChat) {
        voiceChat = new VoiceChatManager();
    }

    switch (data.type) {
        // 📤 Caller dan offer keldi
        case 'voice_call_offer':
            voiceChat.handleOffer(
                data.from,
                data.full_name,
                data.offer
            );
            break;

        // ✅ Callee dan answer keldi
        case 'voice_call_answer':
            voiceChat.handleAnswer(data.from, data.answer);
            break;

        // 🌐 ICE candidate (NAT traversal)
        case 'voice_ice_candidate':
            voiceChat.handleIceCandidate(data.from, data.candidate);
            break;

        // 🛑 Qo'ng'iroq tugadi
        case 'voice_call_end':
            voiceChat.endCall();
            break;

        // ❌ Qo'ng'iroq rad qilindi
        case 'voice_call_reject':
            voiceChat.endCall();
            break;
    }
}

// Call button event listener (index.js da)
function initVoiceChat() {
    voiceChat = new VoiceChatManager();

    $('#callButton').off('click').on('click', async function () {
        const activeChat = window.activeChat;
        if (!activeChat || !voiceChat) return;

        if (!voiceChat.isCallActive) {
            // 🔴 QONG'IROQ BOSHLASH
            const userName = $('#activeChatName').text().trim();
            await voiceChat.initiateCall(activeChat.id, userName);
        } else {
            // ✅ QONG'IROQNI TUGATISH
            voiceChat.endCall();
        }
    });
}

// Initialization
setTimeout(() => {
    initVoiceChat();  // 500ms keyin
}, 500);

// function openChat(chatId) {
//     activeChat = sampleChats.find(c => c.id === chatId);
//     if (!activeChat) return;
//
//     // Update active state
//     $('.chat-item').removeClass('active');
//     $(`.chat-item[data-chat-id="${chatId}"]`).addClass('active');
//
//     // Show chat area
//     $('#emptyState').hide();
//     $('#activeChatArea').css('display', 'flex');
//
//     // Update header
//     const firstLetter = activeChat.name.charAt(0).toUpperCase();
//     $('#activeChatAvatar').text(firstLetter);
//     $('#activeChatName').text(activeChat.name);
//     const config = window.elementSdk?.config || defaultConfig;
//     $('#activeChatStatus').text(activeChat.is_online ? config.online_status_text : config.offline_status_text);
//
//     // Load messages
//     renderMessages(chatId);
//
//     // Clear unread badge
//     activeChat.unread_count = 0;
//     $(`.chat-item[data-chat-id="${chatId}"] .unread-badge`).remove();
//
//     // Focus input
//     $('#messageInput').focus();
// }

// // Render messages for active chat
// function renderMessages() {
//     const messagesContainer = $('#messagesContainer');
//     messagesContainer.empty();
//
//     sampleMessages.forEach(msg => {
//         const isSent = msg.from === currentUser.id;
//         const messageElement = $(`
//                     <div class="message ${isSent ? 'sent' : 'received'}">
//                         <div class="message-content">
//                             <div class="message-bubble">${msg.message}</div>
//                             <div class="message-time">
//                                 ${msg.created_at}
//                                 ${msg.isSent ? '<span class="message-status">✓✓</span>' : ''}
//                             </div>
//                         </div>
//                     </div>
//                 `);
//         messagesContainer.append(messageElement);
//     });
//
//     // Scroll to bottom
//     messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
// }

// Send message
async function sendMessage() {
    const input = $('#messageInput');
    const message = input.val().trim();

    let activeChat = window.activeChat

    if (!message || !activeChat) return;

    // Create new message
    const newMessage = {
        message: message,
        from: currentUser.id,
        is_read: false,
        is_edited: false,
        created_at: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    };

    // Typing timeout larni tozalaymiz
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    if (stopTypingTimeout) {
        clearTimeout(stopTypingTimeout);
    }


    sampleMessages.push(newMessage);

    // Update chat preview
    activeChat.last_message = message;
    activeChat.last_message_time = "Just now";

    // Re-render
    // renderMessages();
    const messagesContainer = $('#messagesContainer');
    const isSent = newMessage.from === currentUser.id;
    const messageElement = $(`
                    <div class="message ${isSent ? 'sent' : 'received'}">
                        <div class="message-content">
                            <div class="message-bubble">${newMessage.message}</div>
                            <div class="message-time">
                                ${newMessage.created_at}
                                <span class="loading-spinner"></span>
                            </div>
                        </div>
                    </div>
                `);
    messagesContainer.append(messageElement);
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);


    $(`.chat-item[data-chat-id="${activeChat.id}"]`).addClass('active');

    // Clear input
    input.val('');
    $('#sendButton').prop('disabled', true);

    // In a real app, this would send via WebSocket:
    let msg = JSON.stringify({
        'message': message,
        'chat_id': activeChat.id
    });
    ws.send(msg);
    await sleep(500);
    $('#searchInput').val('')
    await fetchChats();
}

// Handle typing indicator
function handleTyping() {
    const activeChat = window.activeChat;
    if (!activeChat || !ws) return;

    const msg = JSON.stringify({
        'type': 'typing',
        'chat_id': activeChat.id,
        'is_typing': true
    });
    ws.send(msg);

    // Avvalgi timeout larni tozalaymiz
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    if (stopTypingTimeout) {
        clearTimeout(stopTypingTimeout);
    }

    // 0.5 sekunddan keyin typing to'xtatish signalini yuboramiz
    typingTimeout = setTimeout(() => {
        const stopMsg = JSON.stringify({
            'type': 'typing',
            'chat_id': activeChat.id,
            'is_typing': false
        });
        ws.send(stopMsg);
    }, 500);
}


async function onConfigChange(config) {
    $('#appTitle').text(config.app_title || defaultConfig.app_title);
    $('#onlineStatusText').text(config.online_status_text || defaultConfig.online_status_text);
    $('#sendButton').text(config.send_button_text || defaultConfig.send_button_text);
    $('#searchInput').attr('placeholder', config.search_placeholder || defaultConfig.search_placeholder);

    if (activeChat) {
        const statusText = activeChat.is_online ? (config.online_status_text || defaultConfig.online_status_text) : (config.offline_status_text || defaultConfig.offline_status_text);
        $('#activeChatStatus').text(statusText);
    }

    const typingText = config.typing_indicator_text || defaultConfig.typing_indicator_text;
    $('#typingIndicator').text(typingText);
}

// Settings functionality
function openSettings() {
    $('#settingsSidebar').addClass('open');
    $('#settingsOverlay').addClass('active');
    $('#settingsMenu').show();
    $('#profileSection').removeClass('active');
}

function closeSettings() {
    $('#settingsSidebar').removeClass('open');
    $('#settingsOverlay').removeClass('active');
}

function openProfile() {
    $('#settingsMenu').hide();
    $('#profileSection').addClass('active');
    $('#settingsPageTitle').text('Edit Profile');

    // Update avatar in profile section
    const initials = ($('#firstName').val() + ' ' + $('#lastName').val()).split(' ').map(n => n[0]).join('');
    $('#profileAvatarLarge').text(initials);
}

// Yangi: chatsni serverdan olish funksiyasi
async function fetchChats() {
    try {
        const response = await fetch(`${baseUrl}chats`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch chats');
        }
        const data = await response.json();
        // SampleChats massivini yangilaymiz
        sampleChats.length = 0; // eski ma'lumotlarni tozalash
        data.forEach(chat => {
            sampleChats.push(chat)
        });

        renderChatList();
    } catch (error) {
        console.error('Error fetching chats:', error);
    }
}

function renderChatListFromUsers(users) {
    const chatListElement = $('#chatList');
    chatListElement.empty();

    if (!users || users.length === 0) {
        chatListElement.append(`
            <div style="padding: 40px; text-align: center; color: #95a5a6;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 15px;">No results found</div>
            </div>
        `);
        return;
    }

    users.forEach(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No Name';
        const firstLetter = name.charAt(0).toUpperCase();

        const avatarContent = user.image
            ? `<img src="${user.image}" alt="${name}" style="width: 40px; height: 40px; border-radius: 50%;">`
            : firstLetter;

        const chatItem = $(`
            <div class="chat-item" data-user-id="${user.id}">
                <div class="chat-avatar">
                     ${avatarContent}
                     ${user.is_online ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="chat-info">
                    <div class="chat-name">${name}</div>
                    <div class="chat-preview">@${user.username || 'unknown'}</div>
                </div>
            </div>
        `);

        chatItem.on('click', function () {
            openChat(user.id);
        });

        chatListElement.append(chatItem);
    });
}

function showLogoutModal() {
    $('#logoutModal').addClass('active');
}

function hideLogoutModal() {
    $('#logoutModal').removeClass('active');
}

function performLogout() {
    // In a real app, this would call the logout API
    // For demo, we'll show a console message and close modal
    console.log('User logged out');
    hideLogoutModal();
    closeSettings();

    // You could redirect to login page here:
    // window.location.href = '/login';

    // For demo, show a message in console
    console.log('Logged out successfully! In a real app, you would be redirected to login page.');
    localStorage.removeItem('access_token')
    window.location.href = 'register.html';
}

function saveProfile(e) {
    e.preventDefault();

    // Get form values
    const firstName = $('#firstName').val();
    const lastName = $('#lastName').val();
    const username = $('#username').val();
    const bio = $('#bio').val();
    const fullName = `${firstName} ${lastName}`;
    // In a real app, send to backend API
    console.log('Saving profile:', {fullName, username, bio});

    // Data to send
    const data = {
        first_name: firstName,
        last_name: lastName,
        username: username,
        bio: bio
    };

    // Send update request to backend
    fetch(`${baseUrl}profile`, {
        method: 'PATCH',  // yoki 'PATCH', backend-ga qarab
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Profile update failed');
            }
            return response.json();
        })
        .then(updatedUser => {
            console.log('Profile updated:', updatedUser);

            // Update UI
            const initials = fullName.split(' ').map(n => n[0]).join('');
            $('#profileAvatarLarge').text(initials);

            // Success message
            $('#successMessage').addClass('show');
            setTimeout(() => {
                $('#successMessage').removeClass('show');
            }, 3000);

            // Agar kerak bo'lsa, settingsPageTitle ham yangilash:
            $('#settingsPageTitle').text(`${fullName} (${updatedUser.id})`);

            // Show success message
            $('#successMessage').addClass('show');
            setTimeout(() => {
                $('#successMessage').removeClass('show');
            }, 3000);

        })
        .catch(error => {
            console.error('Error updating profile:', error);
        });


    // Update current user info
    const initials = fullName.split(' ').map(n => n[0]).join('');
    $('#profileAvatarLarge').text(initials);

}

function addIncomingMessage(chatId, text, fromUserId) {
    // Agar xabar aynan ochiq chat uchun bo‘lsa — UI ga qo‘shamiz

    if (window.activeChat && window.activeChat.id === chatId) {
        const messageEl = $(`
            <div class="message ${fromUserId === currentUser.id ? 'sent' : 'received'}">
                <div class="message-content">
                    <div class="message-bubble">${text}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                </div>
            </div>
        `);

        $("#messagesContainer").append(messageEl);

        // Scroll pastga
        const mc = document.getElementById('messagesContainer');
        mc.scrollTop = mc.scrollHeight;
    }

    // // SampleMessages ichiga qo‘shamiz
    // sampleMessages.push({
    //     message: text,
    //     from: fromUserId,
    //     is_read:false,
    //     is_edited:false,
    //     created_at: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    // });

    // Chat preview yangilash
    const chat = sampleChats.find(c => c.id === chatId);
    if (chat) {
        chat.last_message = text;
        chat.last_message_time = "Now";
    }

    renderChatList();
}

function updateLastMessageStatus(action) {
    // Oxirgi yuborilgan (sent) xabarni topamiz
    const lastMessage = document.querySelector(
        '.message.sent:last-of-type .message-time'
    );

    if (!lastMessage) return;
    // loading-spinner ni olib tashlaymiz
    const spinner = lastMessage.querySelector('.loading-spinner');
    if (spinner) spinner.remove();

    // Agar status yo‘q bo‘lsa qo‘shamiz
    if (!lastMessage.querySelector('.message-status')) {
        const status = document.createElement('span');
        status.className = 'message-status';
        status.textContent = action;
        lastMessage.appendChild(status);
    } else {
        lastMessage.textContent = action;
    }
}


// WebSocket ulanish funksiyasi
function connectWebSocket(token) {
    const wsUrl = `${wsBaseUrl}?auth=${encodeURIComponent(token)}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        // console.log("WebSocket connected.");
    };

    ws.onmessage = (event) => {
        console.log("New message:", event.data);

        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            console.error("Invalid WS JSON", e);
            return;
        }

        if (data.type === "message") {
            // Typing indikatorlarni yashiramiz
            hideTypingIndicator(data.chat_id, data.from);
            hideChatListTyping(data.chat_id);

            addIncomingMessage(
                data.chat_id,
                data.message,
                data.from
            );
            activeChat = window.activeChat
            if (activeChat && (activeChat.id === data.chat_id || activeChat.id === data.from)) {
                let msg = JSON.stringify({
                    'type': 'action',
                    'is_read': true,
                    'chat_id': activeChat.id,
                });
                ws.send(msg);
            }
        } else if (data.type === 'edit_message') {
            // Boshqa userdan edit kelganda

            // updateEditedMessage(data.message_id, data.message);
        } else if (data.type === 'status') {
            const chatId = data.chat_id;
            const isOnline = data.status;

            // sampleChats ichidan chatni topamiz
            const chat = sampleChats.find(c => c.id === chatId);
            if (!chat) return;
            // Chat modelini yangilash
            chat.is_online = isOnline;

            // Chat list UI yangilash
            const chatItem = $(`.chat-item[data-chat-id="${chatId}"]`);
            if (chatItem.length) {
                const avatar = chatItem.find('.chat-avatar');

                if (isOnline) {
                    if (!avatar.find('.online-indicator').length) {
                        avatar.append('<div class="online-indicator"></div>');
                    }
                } else {
                    avatar.find('.online-indicator').remove();
                }
            }

            // Agar ayni chat ochiq bo‘lsa — header statusni ham yangilash
            if (window.activeChat && window.activeChat.id === chatId) {
                const config = window.elementSdk?.config || defaultConfig;
                $('#activeChatStatus').text(
                    isOnline
                        ? config.online_status_text
                        : config.offline_status_text
                );
            }

        } else if (data.type === 'action') {
            let action = '✓';
            if (data.is_read) {
                action = '✓✓';
            }
            updateLastMessageStatus(action);

        } else if (data.type === 'typing') {
            // Typing signal kelganda
            if (data.is_typing) {
                // Chat list da ko'rsatish
                showChatListTyping(data.chat_id, data.from);
                // Chat ichida ko'rsatish
                showTypingIndicator(data.chat_id, data.from);
            } else {
                // Yashirish
                hideChatListTyping(data.chat_id);
                hideTypingIndicator(data.chat_id, data.from);
            }
        } else if (data.type?.startsWith('voice_')) {
            handleVoiceMessage(data);
        }
    };

    const notification = document.getElementById("ws-notification");

    function showNotification() {
        notification.classList.remove("hidden");
        notification.classList.add("show");
    }

    function hideNotification() {
        notification.classList.remove("show");
        notification.classList.add("hidden");
    }

    ws.onclose = () => {
        console.log("WebSocket disconnected.");
        showNotification();
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        showNotification();
    };

    return ws;
}

async function initializeChatApp() {
    try {
        // 1) Profil ma'lumotlarini olish
        const response = await fetch(`${baseUrl}profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }

        const user = await response.json();
        // Global currentUser yangilash
        currentUser = user;

        // Full Name
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        $('#fullName').val(`${fullName}`);

        // Username
        $('#username').val(user.username || '');

        // First name
        $('#firstName').val(user.first_name || '');

        // Last name
        $('#lastName').val(user.last_name || '');

        // Bio
        $('#bio').val(user.bio || '');

        $('#settingsPageTitle').text(`${fullName} (${user.id})`);

        // Profil avatar katta — agar rasm bo'lsa, rasm, aks holda harflar
        if (user.image) {
            $('#profileAvatarLarge').html(
                `<img src="${user.image}" alt="Avatar" style="width:100px; height:100px; border-radius:50%;">`
            );

        } else {
            // Ism va familiyaning bosh harflari
            const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
            $('#profileAvatarLarge').text(initials);
        }

    } catch (error) {
        console.error("Initialization error:", error);
    }
}


// Event listeners
$(document).ready(function () {
    let ws;
    if (accessToken && isValidToken(accessToken)) {
        initializeChatApp()

        fetchChats().then(() => {
            connectWebSocket(accessToken);   // Chatlar yuklangandan keyin WS ulanish
        });

        setTimeout(() => {
            initVoiceChat();  // Voice chat initialization
        }, 500);
    } else {
        // Token yo'q bo'lsa, ro'yxatdan o'tish sahifasiga yo'naltirish
        window.location.href = 'register.html';
    }

    // Settings icon click
    $('#settingsIcon').on('click', openSettings);

    // Back button click
    $('#backButton').on('click', function () {
        if ($('#profileSection').hasClass('active')) {
            // Go back to settings menu
            $('#profileSection').removeClass('active');
            $('#settingsMenu').show();
            const pageTitle = `${currentUser.first_name || ''} ${currentUser.last_name || ''} (${currentUser.id})`.trim();
            $('#settingsPageTitle').text(`${pageTitle}`);
        } else {
            // Close settings sidebar
            closeSettings();
        }
    });

    // Overlay click
    $('#settingsOverlay').on('click', function () {
        closeSettings();
        hideLogoutModal();
    });

    // Profile menu item click
    $('#profileMenuItem').on('click', openProfile);

    // Logout menu item click
    $('#logoutMenuItem').on('click', showLogoutModal);

    // Logout modal buttons
    $('#cancelLogout').on('click', hideLogoutModal);
    $('#confirmLogout').on('click', performLogout);

    // Profile form submit
    $('#profileForm').on('submit', saveProfile);

    $('#searchInput').on('input', debounce(function () {
        const query = $(this).val().trim();
        const clearBtn = $('#clearSearch');

        if (query.length > 0) {
            clearBtn.css('display', 'flex');
        } else {
            clearBtn.hide();
        }
        // API ga so‘rov
        searchFromApi(query);
    }, 300)); // 300ms debounce

    // Clear search
    $('#clearSearch').on('click', function () {
        searchQuery = '';
        $('#searchInput').val('');
        $(this).hide();
        fetchChats();
    });

    // Send button click
    $('#sendButton').on('click', sendMessage);
    // $('#sendButton').on('click', function () {
    //     sendMessage(ws);
    // });

    // Enter key to send
    $('#messageInput').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Input event listener (yangilangan)
    $('#messageInput').on('input', function () {
        const hasContent = $(this).val().trim().length > 0;
        $('#sendButton').prop('disabled', !hasContent);

        if (hasContent) {
            handleTyping();
        } else {
            // Bo'sh bo'lsa, typing to'xtatish
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            if (stopTypingTimeout) {
                clearTimeout(stopTypingTimeout);
            }
            if (ws && window.activeChat) {
                const stopMsg = JSON.stringify({
                    'type': 'typing',
                    'chat_id': window.activeChat.id,
                    'is_typing': false
                });
                ws.send(stopMsg);
            }
        }
    });


    // Toggle menu
    $("#chatOptionsBtn").on("click", function (e) {
        e.stopPropagation();
        $("#chatOptionsMenu").toggleClass("hidden");
    });

    // Close menu on outside click
    $(document).on("click", function () {
        $("#chatOptionsMenu").addClass("hidden");
    });

    // Clear chat
    $("#clearChat").on("click", function () {
        let activeChatId = window.activeChat.id;

        if (!activeChatId) return;

        $.ajax({
            url: `${baseUrl}chats/${activeChatId}/clear`,
            method: "DELETE",
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            success: function (response) {
                $("#messagesContainer").empty();
                $("#chatOptionsMenu").addClass("hidden");
            },
            error: function () {
                alert("Failed to clear chat");
            }
        });
    });


    // Delete chat
    $("#deleteChat").on("click", function () {
        let activeChatId = window.activeChat.id;

        if (!activeChatId) return;

        if (!confirm("Are you sure you want to delete this chat?")) return;

        $.ajax({
            url: `${baseUrl}chats/${activeChatId}`,
            method: "DELETE",
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            success: function (response) {
                // UI reset
                $("#messagesContainer").empty();
                $("#activeChatArea").hide();
                $("#emptyState").show();

                // chat listdan ham olib tashlash (ixtiyoriy)
                $(`.chat-item[data-chat-id="${activeChatId}"]`).remove();

                $("#chatOptionsMenu").addClass("hidden");
            },
            error: function () {
                alert("Failed to delete chat");
            }
        });
    });

    $('#callButton').on('click', function () {
        const activeChatName = $('#activeChatName').text().trim();
        alert(`Calling ${activeChatName}...`);
        // Bu yerda qo'ng'iroq funksiyasini chaqirishingiz mumkin
    });

});


