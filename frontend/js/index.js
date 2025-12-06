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
        alert('error')
        return false
    }
}

// Sample data structure matching Django models
const sampleChats = [{
    id: 1,
    name: "Sarah Wilson",
    type: "private",
    image: null,
    last_message: "Hey! How are you doing?",
    last_message_time: "10:30 AM",
    unread_count: 2,
    is_online: true,
    members: [1, 2]
}, {
    id: 2,
    name: "Project Team",
    type: "group",
    image: null,
    last_message: "Meeting at 3 PM today",
    last_message_time: "9:15 AM",
    unread_count: 5,
    is_online: false,
    members: [1, 3, 4, 5]
}, {
    id: 3,
    name: "Mike Johnson",
    type: "private",
    image: null,
    last_message: "Thanks for your help!",
    last_message_time: "Yesterday",
    unread_count: 0,
    is_online: true,
    members: [1, 3]
}, {
    id: 4,
    name: "Design Team",
    type: "group",
    image: null,
    last_message: "New mockups are ready",
    last_message_time: "Yesterday",
    unread_count: 0,
    is_online: false,
    members: [1, 6, 7, 8]
}];

const sampleMessages = {};

let currentUser = null;
let activeChat = null;
let typingTimeout = null;
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
                            <div class="chat-preview">${chat.last_message}</div>
                        </div>
                        <div class="chat-meta">
                            <div class="chat-time">${chat.last_message_time}</div>
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
        renderChatList([]);
        return;
    }

    $.ajax({
        url: `${baseUrl}users`,   // API endpointingiz
        method: 'GET', data: {search: query}, headers: {
            'Authorization': `Bearer ${accessToken}`
        }, success: function (res) {
            renderChatListFromUsers(res);
        }, error: function (err) {
            console.error("Search error:", err);
        }
    });
}

function renderMessagesFromApi(chat) {
    const container = $("#messagesContainer");
    container.empty();

    if (!chat.messages || chat.messages.length === 0) {
        container.append(`<div class="empty-messages"></div>`);
        return;
    }

    chat.messages.forEach(msg => {
        container.append(`
            <div class="message ${msg.isSent ? 'sent' : 'received'}">
                <div class="message-content">
                    <div class="message-bubble">${msg.message}</div>
                    <div class="message-time">
                        ${msg.created_at}
                        ${msg.isSent ? '<span class="message-status">✓���</span>' : ''}
                    </div>
                </div>
            </div>
        `);
    });
    container.scrollTop(container[0].scrollHeight);
}

// Open specific chat
async function openChat(chatId) {
    let activeChat = null;

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
    console.log(activeChat.messages);

    console.log('xatolik')
    // Unread badge yo‘q qilinadi
    activeChat.unread_count = 0;
    $(`.chat-item[data-chat-id="${chatId}"] .unread-badge`).remove();

    // Fokus inputga
    $('#messageInput').focus();
}

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

// Render messages for active chat
function renderMessages(chatId) {
    const messagesContainer = $('#messagesContainer');
    messagesContainer.empty();

    const messages = sampleMessages[chatId] || [];

    messages.forEach(msg => {
        // const isSent = msg.fromUserId === currentUser.id;
        const messageElement = $(`
                    <div class="message ${msg.isSent ? 'sent' : 'received'}">
                        <div class="message-content">
                            <div class="message-bubble">${msg.message}</div>
                            <div class="message-time">
                                ${msg.created_at}
                                ${msg.isSent ? '<span class="message-status">✓���</span>' : ''}
                            </div>
                        </div>
                    </div>
                `);
        messagesContainer.append(messageElement);
    });

    // Scroll to bottom
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}

// Send message
function sendMessage() {
    const input = $('#messageInput');
    const message = input.val().trim();

    let activeChat = window.activeChat

    if (!message || !activeChat) return;

    // Create new message
    const newMessage = {
        id: Date.now(),
        message: message,
        fromUserId: currentUser.id,
        isRead: false,
        isEdited: false,
        createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    };

    // Add to messages
    if (!sampleMessages[activeChat.id]) {
        sampleMessages[activeChat.id] = [];
    }
    sampleMessages[activeChat.id].push(newMessage);

    // Update chat preview
    activeChat.last_message = message;
    activeChat.last_message_time = "Just now";

    // Re-render
    console.log('shu yerda');
    renderMessages(activeChat.id);
    renderChatList();
    $(`.chat-item[data-chat-id="${activeChat.id}"]`).addClass('active');

    // Clear input
    input.val('');
    $('#sendButton').prop('disabled', true);

    // In a real app, this would send via WebSocket:
    let msg = JSON.stringify({
        'message': message,
        'chat_id': activeChat.id
    });
    console.log(msg);
    ws.send(msg);
}

// Handle typing indicator
function handleTyping() {
    if (!activeChat) return;

    // In a real app, send typing status via WebSocket
    // chatSocket.send(JSON.stringify({
    //     'type': 'typing',
    //     'chat_id': activeChat.id
    // }));
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

// function renderChatListFromUsers(users) {
//     const chatListElement = $('#chatList');
//     chatListElement.empty();
//
//     if (!users || users.length === 0) {
//         chatListElement.append(`
//             <div style="padding: 40px; text-align: center; color: #95a5a6;">
//                 <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
//                 <div style="font-size: 15px;">No results found</div>
//             </div>
//         `);
//         return;
//     }
//
//     users.forEach(user => {
//         const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No Name';
//         const firstLetter = name.charAt(0).toUpperCase();
//
//         const avatarContent = user.image
//             ? `<img src="${user.image}" alt="${name}" style="width: 40px; height: 40px; border-radius: 50%;">`
//             : firstLetter;
//
//         const chatItem = $(`
//             <div class="chat-item" data-user-id="${user.id}">
//                 <div class="chat-avatar">
//                      ${avatarContent}
//                 </div>
//                 <div class="chat-info">
//                     <div class="chat-name">${name}</div>
//                     <div class="chat-preview">@${user.username || 'unknown'}</div>
//                 </div>
//             </div>
//         `);
//
//         chatItem.on('click', function () {
//             openChat(user.id);
//             console.log("Open chat with user ID:", user.id);
//         });
//
//         chatListElement.append(chatItem);
//     });
// }

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
    alert('Logged out successfully! In a real app, you would be redirected to login page.');
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
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            alert('Profilni yangilashda xatolik yuz berdi.');
        });


    // Update current user info
    const initials = fullName.split(' ').map(n => n[0]).join('');
    $('#profileAvatarLarge').text(initials);

    // Show success message
    $('#successMessage').addClass('show');
    setTimeout(() => {
        $('#successMessage').removeClass('show');
    }, 3000);
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

    // SampleMessages ichiga qo‘shamiz
    if (!sampleMessages[chatId]) sampleMessages[chatId] = [];
    sampleMessages[chatId].push({
        id: Date.now(),
        message: text,
        fromUserId: fromUserId,
        createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    });

    // Chat preview yangilash
    const chat = sampleChats.find(c => c.id === chatId);
    if (chat) {
        chat.last_message = text;
        chat.last_message_time = "Now";
    }

    renderChatList();
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

        if (data.type === "chat.message") {
            addIncomingMessage(
                data.chat_id,
                data.message,
                data.from
            );
        }
        // Bu yerda chatga real-time xabar qo‘shish mumkin
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected.");
        // Istasa reconnect funksiyasi yozish mumkin
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
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

    // $('#searchInput').on('input', debounce(function () {
    //     const query = $(this).val().trim();
    //     const clearBtn = $('#clearSearch');
    //
    //     if (query.length > 0) {
    //         clearBtn.css('display', 'flex');
    //     } else {
    //         clearBtn.hide();
    //     }
    //
    //     // API ga so‘rov
    //     searchFromApi(query);
    //
    // }, 300)); // 300ms debounce

    // Clear search
    $('#clearSearch').on('click', function () {
        searchQuery = '';
        $('#searchInput').val('');
        $(this).hide();
        renderChatList();
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

    // Enable/disable send button
    $('#messageInput').on('input', function () {
        const hasContent = $(this).val().trim().length > 0;
        $('#sendButton').prop('disabled', !hasContent);

        // Clear previous timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Set new timeout
        if (hasContent) {
            handleTyping();
            typingTimeout = setTimeout(() => {
                // Stop typing indicator after 2 seconds
            }, 2000);
        }
    });

    // Initialize Elements SDK
    if (window.elementSdk) {
        window.elementSdk.init({
            defaultConfig: defaultConfig,
            onConfigChange: onConfigChange,
            mapToCapabilities: (config) => ({
                recolorables: [], borderables: [], fontEditable: undefined, fontSizeable: undefined
            }),
            mapToEditPanelValues: (config) => new Map([["app_title", config.app_title || defaultConfig.app_title], ["search_placeholder", config.search_placeholder || defaultConfig.search_placeholder], ["online_status_text", config.online_status_text || defaultConfig.online_status_text], ["offline_status_text", config.offline_status_text || defaultConfig.offline_status_text], ["typing_indicator_text", config.typing_indicator_text || defaultConfig.typing_indicator_text], ["send_button_text", config.send_button_text || defaultConfig.send_button_text]])
        });
    }

    // // Simulate receiving a message after 5 seconds
    // setTimeout(() => {
    //     if (activeChat && activeChat.id === 1) {
    //         const newMessage = {
    //             id: Date.now(),
    //             message: "I'd love to hear more about it!",
    //             fromUserId: 2,
    //             is_read: false,
    //             is_edited: false,
    //             createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    //         };
    //         sampleMessages[1].push(newMessage);
    //         renderMessages(1);
    //     }
    // }, 5000);
});
