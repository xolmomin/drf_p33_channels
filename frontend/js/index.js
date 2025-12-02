const accessToken = localStorage.getItem('access_token');
const baseUrl = 'http://localhost:8000/api/v1/';


async function isValidToken(token) {
    try {
        const response = await fetch(`${baseUrl}auth/verify-token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            mode: 'cors',  // important for cross-origin requests
            body: JSON.stringify({token: token})
        });
        if (!response.ok) {
            localStorage.removeItem('access_token');
            window.location.href = 'register.html';

        }
    } catch (error) {
        alert('error')
    }
}


// Sample data structure matching Django models
const sampleChats = [
    {
        id: 1,
        name: "Sarah Wilson",
        type: "private",
        image: null,
        lastMessage: "Hey! How are you doing?",
        lastMessageTime: "10:30 AM",
        unreadCount: 2,
        isOnline: true,
        members: [1, 2]
    },
    {
        id: 2,
        name: "Project Team",
        type: "group",
        image: null,
        lastMessage: "Meeting at 3 PM today",
        lastMessageTime: "9:15 AM",
        unreadCount: 5,
        isOnline: false,
        members: [1, 3, 4, 5]
    },
    {
        id: 3,
        name: "Mike Johnson",
        type: "private",
        image: null,
        lastMessage: "Thanks for your help!",
        lastMessageTime: "Yesterday",
        unreadCount: 0,
        isOnline: true,
        members: [1, 3]
    },
    {
        id: 4,
        name: "Design Team",
        type: "group",
        image: null,
        lastMessage: "New mockups are ready",
        lastMessageTime: "Yesterday",
        unreadCount: 0,
        isOnline: false,
        members: [1, 6, 7, 8]
    }
];

const sampleMessages = {
    1: [
        {
            id: 1,
            message: "Hey! How are you doing?",
            fromUserId: 2,
            isRead: true,
            isEdited: false,
            createdAt: "10:28 AM"
        },
        {
            id: 2,
            message: "I'm great! Just working on the new project",
            fromUserId: 1,
            isRead: true,
            isEdited: false,
            createdAt: "10:29 AM"
        },
        {
            id: 3,
            message: "That sounds exciting! Can you tell me more?",
            fromUserId: 2,
            isRead: false,
            isEdited: false,
            createdAt: "10:30 AM"
        }
    ],
    2: [
        {id: 4, message: "Good morning everyone!", fromUserId: 3, isRead: true, isEdited: false, createdAt: "9:00 AM"},
        {
            id: 5,
            message: "Don't forget about the meeting",
            fromUserId: 4,
            isRead: true,
            isEdited: false,
            createdAt: "9:10 AM"
        },
        {id: 6, message: "Meeting at 3 PM today", fromUserId: 5, isRead: false, isEdited: false, createdAt: "9:15 AM"}
    ],
    3: [
        {
            id: 7,
            message: "Can you help me with the code review?",
            fromUserId: 3,
            isRead: true,
            isEdited: false,
            createdAt: "Yesterday"
        },
        {
            id: 8,
            message: "Of course! Send it over",
            fromUserId: 1,
            isRead: true,
            isEdited: false,
            createdAt: "Yesterday"
        },
        {id: 9, message: "Thanks for your help!", fromUserId: 3, isRead: true, isEdited: false, createdAt: "Yesterday"}
    ],
    4: [
        {id: 10, message: "New mockups are ready", fromUserId: 6, isRead: true, isEdited: false, createdAt: "Yesterday"}
    ]
};

let currentUserId = 1;
let activeChat = null;
let typingTimeout = null;
let searchQuery = '';

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
        return chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
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
        const chatItem = $(`
                    <div class="chat-item" data-chat-id="${chat.id}">
                        <div class="chat-avatar">
                            ${firstLetter}
                            ${chat.isOnline ? '<div class="online-indicator"></div>' : ''}
                        </div>
                        <div class="chat-info">
                            <div class="chat-name">${chat.name}</div>
                            <div class="chat-preview">${chat.lastMessage}</div>
                        </div>
                        <div class="chat-meta">
                            <div class="chat-time">${chat.lastMessageTime}</div>
                            ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
                        </div>
                    </div>
                `);

        chatItem.on('click', function () {
            openChat(chat.id);
        });

        chatListElement.append(chatItem);
    });
}

// Open specific chat
function openChat(chatId) {
    activeChat = sampleChats.find(c => c.id === chatId);
    if (!activeChat) return;

    // Update active state
    $('.chat-item').removeClass('active');
    $(`.chat-item[data-chat-id="${chatId}"]`).addClass('active');

    // Show chat area
    $('#emptyState').hide();
    $('#activeChatArea').css('display', 'flex');

    // Update header
    const firstLetter = activeChat.name.charAt(0).toUpperCase();
    $('#activeChatAvatar').text(firstLetter);
    $('#activeChatName').text(activeChat.name);
    const config = window.elementSdk?.config || defaultConfig;
    $('#activeChatStatus').text(activeChat.isOnline ? config.online_status_text : config.offline_status_text);

    // Load messages
    renderMessages(chatId);

    // Clear unread badge
    activeChat.unreadCount = 0;
    $(`.chat-item[data-chat-id="${chatId}"] .unread-badge`).remove();

    // Focus input
    $('#messageInput').focus();
}

// Render messages for active chat
function renderMessages(chatId) {
    const messagesContainer = $('#messagesContainer');
    messagesContainer.empty();

    const messages = sampleMessages[chatId] || [];

    messages.forEach(msg => {
        const isSent = msg.fromUserId === currentUserId;
        const messageElement = $(`
                    <div class="message ${isSent ? 'sent' : 'received'}">
                        <div class="message-content">
                            <div class="message-bubble">${msg.message}</div>
                            <div class="message-time">
                                ${msg.createdAt}
                                ${isSent ? '<span class="message-status">✓���</span>' : ''}
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

    if (!message || !activeChat) return;

    // Create new message
    const newMessage = {
        id: Date.now(),
        message: message,
        fromUserId: currentUserId,
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
    activeChat.lastMessage = message;
    activeChat.lastMessageTime = "Just now";

    // Re-render
    renderMessages(activeChat.id);
    renderChatList();
    $(`.chat-item[data-chat-id="${activeChat.id}"]`).addClass('active');

    // Clear input
    input.val('');
    $('#sendButton').prop('disabled', true);

    // In a real app, this would send via WebSocket:
    // chatSocket.send(JSON.stringify({
    //     'message': message,
    //     'chat_id': activeChat.id
    // }));
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
        const statusText = activeChat.isOnline ?
            (config.online_status_text || defaultConfig.online_status_text) :
            (config.offline_status_text || defaultConfig.offline_status_text);
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
    $('#settingsPageTitle').text('Settings');
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
    const initials = $('#fullName').val().split(' ').map(n => n[0]).join('');
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
        data.forEach(chat => sampleChats.push(chat));

        renderChatList();
    } catch (error) {
        console.error('Error fetching chats:', error);
    }
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
    alert('Logged out successfully! In a real app, you would be redirected to login page.');
    localStorage.removeItem('access_token')
    window.location.href = 'register.html';
}

function saveProfile(e) {
    e.preventDefault();

    // Get form values
    const fullName = $('#fullName').val();
    const username = $('#username').val();
    const email = $('#email').val();
    const bio = $('#bio').val();

    // In a real app, send to backend API
    console.log('Saving profile:', {fullName, username, email, bio});

    // Update current user info
    const initials = fullName.split(' ').map(n => n[0]).join('');
    $('#currentUserAvatar').text(initials);
    $('#currentUserName').text(fullName);
    $('#profileAvatarLarge').text(initials);

    // Show success message
    $('#successMessage').addClass('show');
    setTimeout(() => {
        $('#successMessage').removeClass('show');
    }, 3000);
}

// Event listeners
$(document).ready(function () {
    renderChatList();

    // Settings icon click
    $('#settingsIcon').on('click', openSettings);

    // Back button click
    $('#backButton').on('click', function () {
        if ($('#profileSection').hasClass('active')) {
            // Go back to settings menu
            $('#profileSection').removeClass('active');
            $('#settingsMenu').show();
            $('#settingsPageTitle').text('Settings');
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

    // Search functionality
    $('#searchInput').on('input', function () {
        searchQuery = $(this).val().trim();
        const clearBtn = $('#clearSearch');

        if (searchQuery.length > 0) {
            clearBtn.css('display', 'flex');
        } else {
            clearBtn.hide();
        }

        renderChatList();
    });

    // Clear search
    $('#clearSearch').on('click', function () {
        searchQuery = '';
        $('#searchInput').val('');
        $(this).hide();
        renderChatList();
    });

    // Send button click
    $('#sendButton').on('click', sendMessage);

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
                recolorables: [],
                borderables: [],
                fontEditable: undefined,
                fontSizeable: undefined
            }),
            mapToEditPanelValues: (config) => new Map([
                ["app_title", config.app_title || defaultConfig.app_title],
                ["search_placeholder", config.search_placeholder || defaultConfig.search_placeholder],
                ["online_status_text", config.online_status_text || defaultConfig.online_status_text],
                ["offline_status_text", config.offline_status_text || defaultConfig.offline_status_text],
                ["typing_indicator_text", config.typing_indicator_text || defaultConfig.typing_indicator_text],
                ["send_button_text", config.send_button_text || defaultConfig.send_button_text]
            ])
        });
    }

    // Simulate receiving a message after 5 seconds
    setTimeout(() => {
        if (activeChat && activeChat.id === 1) {
            const newMessage = {
                id: Date.now(),
                message: "I'd love to hear more about it!",
                fromUserId: 2,
                isRead: false,
                isEdited: false,
                createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            };
            sampleMessages[1].push(newMessage);
            renderMessages(1);
        }
    }, 5000);
});


$(document).ready(function () {
    if (accessToken) {
        isValidToken(accessToken);
        fetchChats();  // Sahifa yuklanganda chatlarni yuklaymiz
    } else {
        // Token yo'q bo'lsa, ro'yxatdan o'tish sahifasiga yo'naltirish
        window.location.href = 'register.html';
    }

    // Qolgan event listenerlar va funksiyalar...
});