const accessToken = localStorage.getItem('access_token');
const hostName = window.location.hostname;
const baseUrl = `http://${hostName}:8000/api/v1/`;


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
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        alert('error')
    }
}

if (accessToken) {
    isValidToken(accessToken)
}

const defaultConfig = {
    background_color: "#F4F4F5",
    surface_color: "#FFFFFF",
    text_color: "#222222",
    primary_color: "#2AABEE",
    secondary_color: "#707579",
    app_title: "Telegram",
    phone_label: "Telefon raqam",
    code_label: "SMS kod",
    submit_button: "Davom etish"
};

let phoneNumber = '';

async function onConfigChange(config) {
    const bgColor = config.background_color || defaultConfig.background_color;
    const surfaceColor = config.surface_color || defaultConfig.surface_color;
    const textColor = config.text_color || defaultConfig.text_color;
    const primaryColor = config.primary_color || defaultConfig.primary_color;
    const secondaryColor = config.secondary_color || defaultConfig.secondary_color;

    document.body.style.background = bgColor;
    document.querySelector('.container').style.background = bgColor;
    document.querySelector('.login-box').style.background = surfaceColor;

    const headings = document.querySelectorAll('h1');
    headings.forEach(h => h.style.color = textColor);

    const labels = document.querySelectorAll('label');
    labels.forEach(l => l.style.color = secondaryColor);

    const subtitles = document.querySelectorAll('.subtitle');
    subtitles.forEach(s => s.style.color = secondaryColor);

    const buttons = document.querySelectorAll('button:not(:disabled)');
    buttons.forEach(btn => {
        btn.style.background = primaryColor;
    });

    const links = document.querySelectorAll('.resend-link, .back-link');
    links.forEach(link => link.style.color = primaryColor);

    document.getElementById('appTitle').textContent = config.app_title || defaultConfig.app_title;
    document.getElementById('codeTitle').textContent = config.app_title || defaultConfig.app_title;
    document.getElementById('phoneLabel').textContent = config.phone_label || defaultConfig.phone_label;
    document.getElementById('codeLabel').textContent = config.code_label || defaultConfig.code_label;
    document.getElementById('submitButtonText').textContent = config.submit_button || defaultConfig.submit_button;
}

function mapToCapabilities(config) {
    return {
        recolorables: [
            {
                get: () => config.background_color || defaultConfig.background_color,
                set: (value) => {
                    config.background_color = value;
                    window.elementSdk.setConfig({background_color: value});
                }
            },
            {
                get: () => config.surface_color || defaultConfig.surface_color,
                set: (value) => {
                    config.surface_color = value;
                    window.elementSdk.setConfig({surface_color: value});
                }
            },
            {
                get: () => config.text_color || defaultConfig.text_color,
                set: (value) => {
                    config.text_color = value;
                    window.elementSdk.setConfig({text_color: value});
                }
            },
            {
                get: () => config.primary_color || defaultConfig.primary_color,
                set: (value) => {
                    config.primary_color = value;
                    window.elementSdk.setConfig({primary_color: value});
                }
            },
            {
                get: () => config.secondary_color || defaultConfig.secondary_color,
                set: (value) => {
                    config.secondary_color = value;
                    window.elementSdk.setConfig({secondary_color: value});
                }
            }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
    };
}

function mapToEditPanelValues(config) {
    return new Map([
        ["app_title", config.app_title || defaultConfig.app_title],
        ["phone_label", config.phone_label || defaultConfig.phone_label],
        ["code_label", config.code_label || defaultConfig.code_label],
        ["submit_button", config.submit_button || defaultConfig.submit_button]
    ]);
}

if (window.elementSdk) {
    window.elementSdk.init({
        defaultConfig,
        onConfigChange,
        mapToCapabilities,
        mapToEditPanelValues
    });
}

// Phone input formatting
const phoneInput = document.getElementById('phone');
phoneInput.addEventListener('input', (e) => {
    // Remove all non-digits
    let value = e.target.value.replace(/\D/g, '');

    // Limit to 9 digits
    if (value.length > 9) {
        value = value.slice(0, 9);
    }

    // Format: 90 123 45 67
    let formatted = '';
    if (value.length > 0) {
        formatted = value.slice(0, 2);
    }
    if (value.length > 2) {
        formatted += ' ' + value.slice(2, 5);
    }
    if (value.length > 5) {
        formatted += ' ' + value.slice(5, 7);
    }
    if (value.length > 7) {
        formatted += ' ' + value.slice(7, 9);
    }

    e.target.value = formatted;
});

// Allow only numbers in phone input
phoneInput.addEventListener('keypress', (e) => {
    if (e.key && !/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        e.preventDefault();
    }
});

// Phone form submission
document.getElementById('phoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone = phoneInput.value.replace(/\D/g, '');
    const errorDiv = document.getElementById('phoneError');
    const submitBtn = document.getElementById('phoneSubmit');

    if (phone.length !== 9) {
        errorDiv.textContent = 'Iltimos, to\'liq telefon raqamni kiriting';
        errorDiv.classList.remove('hidden');
        return;
    }

    errorDiv.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Yuborilmoqda</span><span class="loading"></span>';

    phoneNumber = '+998' + phone;

    // API call simulation
    try {
        const response = await fetch(`${baseUrl}auth/send-code`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            mode: 'cors',  // important for cross-origin requests
            body: JSON.stringify({phone: phoneNumber})
        });

        if (!response.ok) {
            // HTTP status kodi 200-299 oralig'ida emas, ya'ni xatolik bo'lsa
            const errorData = await response.json();
            console.error('Server xatosi:', errorData);
            // Istalgan tarzda xatolikni chiqarish yoki qayta ishlash
            throw new Error(errorData.message || 'Serverdan noto‘g‘ri javob olindi');
        }

        const data = await response.json();
        // alert('Muvaffaqiyatli javob:', data);

        setTimeout(() => {
            document.getElementById('phoneStep').classList.add('hidden');
            document.getElementById('codeStep').classList.remove('hidden');
            document.getElementById('phoneDisplay').textContent = phoneNumber;
            document.querySelector('.code-input').focus();
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span id="submitButtonText">' + (window.elementSdk?.config?.submit_button || defaultConfig.submit_button) + '</span>';
        }, 500);
    } catch (error) {
        alert('error')
    }
});

// Code input handling
const codeInputs = document.querySelectorAll('.code-input');

codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value;

        if (value && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }

        if (index === codeInputs.length - 1 && value) {
            const code = Array.from(codeInputs).map(inp => inp.value).join('');
            if (code.length === 5) {
                document.getElementById('codeForm').dispatchEvent(new Event('submit'));
            }
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            codeInputs[index - 1].focus();
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');

        pastedData.split('').forEach((char, i) => {
            if (index + i < codeInputs.length) {
                codeInputs[index + i].value = char;
            }
        });

        const lastFilledIndex = Math.min(index + pastedData.length - 1, codeInputs.length - 1);
        codeInputs[lastFilledIndex].focus();
    });
});

// Code form submission
document.getElementById('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const code = Array.from(codeInputs).map(input => input.value).join('');
    const errorDiv = document.getElementById('codeError');
    const submitBtn = document.getElementById('codeSubmit');

    if (code.length !== 6) {
        errorDiv.textContent = 'Iltimos, 5 raqamli kodni kiriting';
        errorDiv.classList.remove('hidden');
        return;
    }

    errorDiv.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Tekshirilmoqda<span class="loading"></span>';

    // API call simulation
    try {
        const response = await fetch(`${baseUrl}auth/verify-code`, {
            method: 'POST',
            mode: "cors",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone: phoneNumber, code: code})
        });
        if (!response.ok) {
            alert('XATOLIK');
        } else {

            const result = await response.json();

            const accessToken = result.data.access_token;
            // Access tokenni localStorage ga saqlash
            localStorage.setItem('access_token', accessToken);

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    } catch (error) {
        alert('XATOLIK');
    }
});

// Resend code
document.getElementById('resendLink').addEventListener('click', async () => {
    const link = document.getElementById('resendLink');
    link.style.pointerEvents = 'none';
    link.textContent = 'Yuborilmoqda...';

    try {
        await fetch('https://api.example.com/send-code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone: phoneNumber})
        });
    } catch (error) {
        // Handle error silently
    }

    setTimeout(() => {
        link.textContent = 'Kod qayta yuborildi ✓';
        setTimeout(() => {
            link.textContent = 'Kodni qayta yuborish';
            link.style.pointerEvents = 'auto';
        }, 2000);
    }, 1500);
});

// Back to phone
document.getElementById('backLink').addEventListener('click', () => {
    document.getElementById('codeStep').classList.add('hidden');
    document.getElementById('phoneStep').classList.remove('hidden');
    codeInputs.forEach(input => input.value = '');
    document.getElementById('codeError').classList.add('hidden');
});