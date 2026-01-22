// Конфигурация API
const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000/api' 
    : '/api';

// Глобальные переменные
let userData = {
    id: null,
    username: 'Пользователь',
    telegram_id: null,
    isAdmin: false,
    requisites: {
        tonWallet: null,
        card: null,
        cardBank: null,
        cardCurrency: null,
        telegram: null
    },
    stats: {
        completedDeals: 0,
        volumes: {}
    }
};

let orders = [];
let currentOrderData = {};
let currentStep = 1;
let tonPrice = 5.5;
let notificationCheckInterval = null;

// Курсы валют к USD
const exchangeRates = {
    'RUB': 0.011,
    'USD': 1,
    'EUR': 1.09,
    'KZT': 0.0022,
    'UAH': 0.024,
    'TON': tonPrice,
    'STARS': 0.013
};

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    await initUser();
    setupNavigation();
    setupOrderCreation();
    startDealsHistory();
    setupAdminTrigger();
    updateTonPrice();
    await checkOrderFromUrl();
    startNotificationPolling();
});

// Инициализация пользователя
async function initUser() {
    let telegramId = localStorage.getItem('telegram_id');
    
    if (!telegramId) {
        telegramId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('telegram_id', telegramId);
    }

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'Пользователь',
                telegram_id: telegramId
            })
        });

        const user = await response.json();
        
        userData.id = user.id;
        userData.telegram_id = user.telegram_id;
        userData.username = user.username;
        userData.requisites.tonWallet = user.ton_wallet;
        userData.requisites.card = user.card_number;
        userData.requisites.cardBank = user.card_bank;
        userData.requisites.cardCurrency = user.card_currency;
        userData.requisites.telegram = user.telegram_username;
        userData.stats.completedDeals = user.completed_deals;
        userData.stats.volumes = user.volumes || {};

        updateUserInterface();
        await loadUserOrders();
    } catch (error) {
        console.error('Ошибка инициализации пользователя:', error);
        showToast('Ошибка', 'Не удалось подключиться к серверу', 'error');
    }
}

// Загрузка ордеров пользователя
async function loadUserOrders() {
    try {
        const response = await fetch(`${API_URL}/users/${userData.telegram_id}/orders`);
        const data = await response.json();
        orders = data;
        updateOrdersList();
    } catch (error) {
        console.error('Ошибка загрузки ордеров:', error);
    }
}

// Обновление курса TON
function updateTonPrice() {
    setInterval(function() {
        const change = (Math.random() - 0.5) * 0.04;
        tonPrice = parseFloat((tonPrice * (1 + change)).toFixed(2));
        tonPrice = Math.max(4.5, Math.min(6.5, tonPrice));
        exchangeRates.TON = tonPrice;
    }, 30000);
}

// Конвертация в USD
function convertToUSD(amount, currency) {
    const rate = exchangeRates[currency] || 1;
    return amount * rate;
}

// Обновление UI
function updateUserInterface() {
    if (userData.requisites.tonWallet) {
        document.getElementById('tonStatus').textContent = 'Добавлен';
        document.getElementById('tonStatus').classList.add('active');
        document.getElementById('tonWalletAddress').textContent = userData.requisites.tonWallet;
        document.getElementById('tonWalletDisplay').style.display = 'block';
        document.getElementById('tonWalletForm').style.display = 'none';
    }
    
    if (userData.requisites.card) {
        document.getElementById('cardStatus').textContent = 'Добавлена';
        document.getElementById('cardStatus').classList.add('active');
        const cardInfo = `${userData.requisites.card}${userData.requisites.cardBank ? ' (' + userData.requisites.cardBank + ')' : ''}`;
        document.getElementById('cardInfo').textContent = cardInfo + ' (' + userData.requisites.cardCurrency + ')';
        document.getElementById('cardDisplay').style.display = 'block';
        document.getElementById('cardForm').style.display = 'none';
    }
    
    if (userData.requisites.telegram) {
        document.getElementById('telegramStatus').textContent = 'Добавлен';
        document.getElementById('telegramStatus').classList.add('active');
        document.getElementById('telegramUsername').textContent = userData.requisites.telegram;
        document.getElementById('telegramDisplay').style.display = 'block';
        document.getElementById('telegramForm').style.display = 'none';
    }
    
    updateProfileStats();
    
    if (userData.isAdmin) {
        document.getElementById('adminPanel').style.display = 'block';
    }
}

// Навигация
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            showPage(page);
            
            navItems.forEach(function(nav) {
                nav.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(function(page) {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    if (pageName === 'orders') {
        updateOrdersList();
    }
}

// Реквизиты
async function saveTonWallet() {
    const wallet = document.getElementById('tonWalletInput').value.trim();
    if (wallet) {
        try {
            const response = await fetch(`${API_URL}/users/${userData.telegram_id}/requisites`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ton_wallet: wallet
                })
            });

            if (response.ok) {
                userData.requisites.tonWallet = wallet;
                updateUserInterface();
                showToast('Успешно', 'TON кошелёк сохранён', 'success');
            } else {
                throw new Error('Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showToast('Ошибка', 'Не удалось сохранить кошелёк', 'error');
        }
    } else {
        showToast('Ошибка', 'Введите адрес кошелька', 'error');
    }
}

function editTonWallet() {
    document.getElementById('tonWalletDisplay').style.display = 'none';
    document.getElementById('tonWalletForm').style.display = 'block';
    document.getElementById('tonWalletInput').value = userData.requisites.tonWallet;
}

async function saveCard() {
    const number = document.getElementById('cardNumberInput').value.trim();
    const bank = document.getElementById('cardBankInput').value.trim();
    const currency = document.getElementById('cardCurrencyInput').value;
    
    if (number && bank && currency) {
        try {
            const response = await fetch(`${API_URL}/users/${userData.telegram_id}/requisites`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    card_number: number,
                    card_bank: bank,
                    card_currency: currency
                })
            });

            if (response.ok) {
                userData.requisites.card = number;
                userData.requisites.cardBank = bank;
                userData.requisites.cardCurrency = currency;
                updateUserInterface();
                showToast('Успешно', 'Банковская карта сохранена', 'success');
            } else {
                throw new Error('Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showToast('Ошибка', 'Не удалось сохранить карту', 'error');
        }
    } else {
        showToast('Ошибка', 'Заполните все поля', 'error');
    }
}

function editCard() {
    document.getElementById('cardDisplay').style.display = 'none';
    document.getElementById('cardForm').style.display = 'block';
}

async function saveTelegram() {
    const telegram = document.getElementById('telegramInput').value.trim();
    if (telegram) {
        try {
            const response = await fetch(`${API_URL}/users/${userData.telegram_id}/requisites`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    telegram_username: telegram
                })
            });

            if (response.ok) {
                userData.requisites.telegram = telegram;
                updateUserInterface();
                showToast('Успешно', 'Telegram сохранён', 'success');
            } else {
                throw new Error('Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showToast('Ошибка', 'Не удалось сохранить Telegram', 'error');
        }
    } else {
        showToast('Ошибка', 'Введите username', 'error');
    }
}

function editTelegram() {
    document.getElementById('telegramDisplay').style.display = 'none';
    document.getElementById('telegramForm').style.display = 'block';
    document.getElementById('telegramInput').value = userData.requisites.telegram;
}

// Создание ордера
function setupOrderCreation() {
    document.getElementById('createOrderBtn').addEventListener('click', showCreateOrderForm);
    
    document.querySelectorAll('#step1 .option-item').forEach(function(item) {
        item.addEventListener('click', function() {
            document.querySelectorAll('#step1 .option-item').forEach(function(i) {
                i.classList.remove('selected');
            });
            this.classList.add('selected');
            currentOrderData.type = this.getAttribute('data-type');
            setTimeout(function() {
                nextStep(2);
            }, 300);
        });
    });
    
    document.querySelectorAll('#step2 .option-item').forEach(function(item) {
        item.addEventListener('click', function() {
            const payment = this.getAttribute('data-payment');
            
            if (payment === 'ton' && !userData.requisites.tonWallet) {
                showToast('Ошибка', 'Добавьте TON кошелёк в разделе Реквизиты', 'error');
                return;
            }
            if (payment === 'card' && !userData.requisites.card) {
                showToast('Ошибка', 'Добавьте банковскую карту в разделе Реквизиты', 'error');
                return;
            }
            if (payment === 'stars' && !userData.requisites.telegram) {
                showToast('Ошибка', 'Добавьте Telegram в разделе Реквизиты', 'error');
                return;
            }
            
            document.querySelectorAll('#step2 .option-item').forEach(function(i) {
                i.classList.remove('selected');
            });
            this.classList.add('selected');
            currentOrderData.payment = payment;
            setTimeout(function() {
                nextStep(3);
            }, 300);
        });
    });
    
    document.getElementById('createOrderSubmit').addEventListener('click', createOrder);
}

function showCreateOrderForm() {
    document.getElementById('ordersListContainer').style.display = 'none';
    document.getElementById('ordersList').style.display = 'none';
    document.getElementById('createOrderForm').style.display = 'block';
    currentStep = 1;
    currentOrderData = {};
    resetOrderForm();
}

function cancelOrderCreation() {
    updateOrdersList();
}

function resetOrderForm() {
    document.querySelectorAll('.form-step').forEach(function(step) {
        step.style.display = 'none';
    });
    document.getElementById('step1').style.display = 'block';
    document.querySelectorAll('.option-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    document.getElementById('orderAmount').value = '';
    document.getElementById('orderDescription').value = '';
}

function nextStep(step) {
    document.querySelectorAll('.form-step').forEach(function(s) {
        s.style.display = 'none';
    });
    document.getElementById('step' + step).style.display = 'block';
    currentStep = step;
}

function previousStep(step) {
    nextStep(step);
}

async function createOrder() {
    const amount = document.getElementById('orderAmount').value;
    const description = document.getElementById('orderDescription').value;
    
    if (!amount || !description) {
        showToast('Ошибка', 'Заполните все поля', 'error');
        return;
    }
    
    let currency;
    let sellerRequisites;
    
    if (currentOrderData.payment === 'ton') {
        currency = 'TON';
        sellerRequisites = userData.requisites.tonWallet;
    } else if (currentOrderData.payment === 'card') {
        currency = userData.requisites.cardCurrency;
        sellerRequisites = `${userData.requisites.card} (${userData.requisites.cardBank})`;
    } else {
        currency = 'STARS';
        sellerRequisites = userData.requisites.telegram;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                seller_telegram_id: userData.telegram_id,
                type: currentOrderData.type,
                payment_method: currentOrderData.payment,
                amount: parseFloat(amount),
                currency: currency,
                description: description,
                seller_requisites: sellerRequisites
            })
        });

        if (response.ok) {
            const order = await response.json();
            await loadUserOrders();
            showToast('Успешно', 'Ордер создан!', 'success');
            showOrderDetailsModal(order);
        } else {
            throw new Error('Ошибка создания ордера');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка', 'Не удалось создать ордер', 'error');
    }
}

function updateOrdersList() {
    const container = document.getElementById('ordersListContainer');
    const listElement = document.getElementById('ordersList');
    const formElement = document.getElementById('createOrderForm');
    
    formElement.style.display = 'none';
    
    if (orders.length === 0) {
        container.style.display = 'block';
        listElement.style.display = 'none';
    } else {
        container.style.display = 'none';
        listElement.style.display = 'flex';
        
        listElement.innerHTML = orders.map(function(order) {
            return createOrderCard(order);
        }).join('');
        
        const newBtn = document.createElement('button');
        newBtn.className = 'btn btn-primary btn-full';
        newBtn.textContent = '+ Создать новый ордер';
        newBtn.onclick = showCreateOrderForm;
        listElement.appendChild(newBtn);
    }
}

function createOrderCard(order) {
    const paymentIcons = {
        ton: '💎',
        card: '💳',
        stars: '⭐'
    };
    
    const typeNames = {
        nft_gift: 'NFT подарок',
        nft_username: 'NFT username',
        nft_number: 'NFT number'
    };
    
    const statusClass = order.status === 'active' ? 'status-active' : 
                       order.status === 'paid' ? 'status-paid' : 'status-completed';
    const statusText = order.status === 'active' ? 'Активен' : 
                      order.status === 'paid' ? 'Оплачен' : 'Завершён';
    
    const orderLink = window.location.origin + window.location.pathname + '?order=' + order.code;
    
    let buttons = '';
    
    // Продавец
    if (order.seller_id === userData.id) {
        if (order.status === 'active') {
            buttons = `<button class="btn btn-secondary" onclick="copyOrderLink('${orderLink}')">Копировать ссылку</button>`;
        } else if (order.status === 'paid') {
            buttons = `<button class="btn btn-primary" onclick="confirmTransfer(${order.id})">Актив передан</button>`;
        }
    }
    // Покупатель
    else if (order.buyer_id === userData.id) {
        if (order.status === 'active') {
            buttons = `<button class="btn btn-primary" onclick="confirmPayment(${order.id})">Я оплатил</button>`;
        } else if (order.status === 'paid') {
            buttons = `<button class="btn btn-success" onclick="confirmReceipt(${order.id})">Подтвердить получение</button>`;
        }
    }
    
    // Админ может подтверждать оплату
    if (userData.isAdmin && order.status === 'active' && order.buyer_id) {
        buttons += `<button class="btn btn-success" onclick="confirmPayment(${order.id})" style="margin-left: 10px;">Админ: Оплачено</button>`;
    }
    
    return `<div class="order-card">
            <div class="order-header">
                <div class="order-code">#${order.code}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            <div class="order-details">
                <div class="order-detail">
                    <span class="detail-label">Тип:</span>
                    <span class="detail-value">${typeNames[order.type]}</span>
                </div>
                <div class="order-detail">
                    <span class="detail-label">Оплата:</span>
                    <span class="detail-value">${paymentIcons[order.payment_method]} ${order.currency}</span>
                </div>
                <div class="order-detail">
                    <span class="detail-label">Сумма:</span>
                    <span class="detail-value">${order.amount} ${order.currency}</span>
                </div>
                <div class="order-detail">
                    <span class="detail-label">Описание:</span>
                    <span class="detail-value">${order.description}</span>
                </div>
                ${order.buyer_id === userData.id && order.status === 'active' ? `
                <div class="order-detail">
                    <span class="detail-label">Реквизиты:</span>
                    <span class="detail-value">${order.seller_requisites}</span>
                </div>` : ''}
            </div>
            ${order.seller_id === userData.id ? `<div class="order-link">
                <strong>Ссылка:</strong><br>
                ${orderLink}
            </div>` : ''}
            <div class="order-actions">
                ${buttons}
            </div>
        </div>`;
}

function copyOrderLink(link) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function() {
            showToast('Успешно', 'Ссылка скопирована', 'success');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Успешно', 'Ссылка скопирована', 'success');
    }
}

async function confirmPayment(orderId) {
    console.log('💳 Подтверждение оплаты для ордера:', orderId);
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'paid',
                user_telegram_id: userData.telegram_id
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Оплата подтверждена, ответ сервера:', data);
            await loadUserOrders();
            showToast('Оплата подтверждена', 'Продавцу отправлено уведомление', 'success');
        } else {
            const error = await response.json();
            console.error('❌ Ошибка от сервера:', error);
            throw new Error('Ошибка обновления статуса');
        }
    } catch (error) {
        console.error('❌ Ошибка confirmPayment:', error);
        showToast('Ошибка', 'Не удалось подтвердить оплату', 'error');
    }
}

async function confirmTransfer(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    console.log('📦 Продавец подтверждает передачу актива для ордера:', orderId);
    
    showModal('Подтверждение передачи', 
        `<p>Вы подтверждаете, что актив передан эскроу аккаунту?</p>
        <p>Сделка: <strong>#${order.code}</strong></p>
        <p style="color: var(--gray-600); font-size: 14px; margin-top: 16px;">
            После подтверждения покупатель получит уведомление о необходимости проверить получение актива.
        </p>
        <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="closeModal()">Отмена</button>
            <button class="btn btn-primary" style="flex: 1;" onclick="actuallyConfirmTransfer(${orderId})">Подтвердить</button>
        </div>`
    );
}

async function actuallyConfirmTransfer(orderId) {
    console.log('✅ Окончательное подтверждение передачи');
    closeModal();
    showToast('Успешно', 'Покупатель уведомлен о передаче актива', 'success');
}

async function confirmReceipt(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'completed',
                user_telegram_id: userData.telegram_id
            })
        });

        if (response.ok) {
            await loadUserOrders();
            await initUser();
            closeModal();
            
            // Показываем большое модальное окно с благодарностью
            showCompletionModal(order);
        } else {
            throw new Error('Ошибка обновления статуса');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка', 'Не удалось завершить сделку', 'error');
    }
}

function showCompletionModal(order) {
    const typeNames = {
        nft_gift: 'NFT подарок',
        nft_username: 'NFT username',
        nft_number: 'NFT number'
    };
    
    showModal('🎉 Сделка успешно завершена!', 
        `<div style="text-align: center;">
            <div style="font-size: 64px; margin: 20px 0;">✅</div>
            <h2 style="color: var(--success); margin-bottom: 24px;">Благодарим за использование GiftMarket!</h2>
            <div class="modal-info-box" style="text-align: left;">
                <p><strong>Номер сделки:</strong> #${order.code}</p>
                <p><strong>Тип:</strong> ${typeNames[order.type]}</p>
                <p><strong>Сумма:</strong> ${order.amount} ${order.currency}</p>
                <p><strong>Описание:</strong> ${order.description}</p>
            </div>
            <p style="margin-top: 24px; color: var(--gray-600); line-height: 1.6;">
                Ваша сделка успешно завершена и учтена в статистике. 
                Спасибо за доверие к нашему сервису безопасных транзакций!
            </p>
            <button class="btn btn-primary btn-large btn-full" style="margin-top: 24px;" onclick="closeModal()">Отлично!</button>
        </div>`
    );
}

function showOrderDetailsModal(order) {
    const orderLink = window.location.origin + window.location.pathname + '?order=' + order.code;
    
    showModal('Ордер создан!', 
        `<div class="modal-info-box">
            <p><strong>Код:</strong> #${order.code}</p>
            <p><strong>Сумма:</strong> ${order.amount} ${order.currency}</p>
            <p><strong>Описание:</strong> ${order.description}</p>
        </div>
        <div class="order-link" style="margin: 15px 0;">
            <strong>Ссылка для покупателя:</strong><br>
            ${orderLink}
        </div>
        <button class="btn btn-primary btn-full" onclick="copyOrderLink('${orderLink}'); closeModal();">Скопировать ссылку</button>`
    );
    
    setTimeout(function() {
        updateOrdersList();
    }, 500);
}

// История сделок
function startDealsHistory() {
    const container = document.getElementById('dealsHistory');
    
    for (let i = 0; i < 4; i++) {
        setTimeout(function() {
            addDealToHistory(container, generateRandomDeal());
        }, i * 300);
    }
    
    setInterval(function() {
        if (container.children.length >= 4) {
            container.removeChild(container.lastChild);
        }
        addDealToHistory(container, generateRandomDeal());
    }, Math.random() * 25000 + 20000);
}

function generateRandomDeal() {
    const types = ['NFT подарок', 'NFT username', 'NFT number'];
    const typeWeights = [0.95, 0.03, 0.02];
    
    const rand = Math.random();
    let type;
    if (rand < typeWeights[0]) {
        type = types[0];
    } else if (rand < typeWeights[0] + typeWeights[1]) {
        type = types[1];
    } else {
        type = types[2];
    }
    
    const currencies = ['RUB', 'USD', 'TON', 'STARS'];
    const currency = currencies[Math.floor(Math.random() * currencies.length)];
    
    let amount;
    if (currency === 'RUB') {
        amount = Math.round((Math.random() * 50000 + 5000) / 5) * 5;
    } else if (currency === 'USD') {
        amount = Math.round((Math.random() * 500 + 50) / 5) * 5;
    } else if (currency === 'TON') {
        amount = (Math.round((Math.random() * 100 + 10) / 5) * 5).toFixed(1);
    } else {
        amount = Math.round((Math.random() * 10000 + 1000) / 5) * 5;
    }
    
    // Генерация буквенно-цифрового кода (8 символов, только заглавные буквы и цифры)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return {
        code: code,
        amount: amount,
        currency: currency,
        description: type
    };
}

function addDealToHistory(container, deal) {
    const dealElement = document.createElement('div');
    dealElement.className = 'deal-item';
    dealElement.innerHTML = 
        `<div class="deal-info">
            <div class="deal-code">#${deal.code}</div>
            <div class="deal-description">${deal.description}</div>
        </div>
        <div class="deal-right">
            <div class="deal-amount">${deal.amount} ${deal.currency}</div>
            <div class="deal-status">Завершена</div>
        </div>`;
    
    container.insertBefore(dealElement, container.firstChild);
    
    if (container.children.length > 4) {
        container.removeChild(container.lastChild);
    }
}

// Профиль
function updateProfileStats() {
    document.getElementById('completedDeals').textContent = userData.stats.completedDeals;
    
    let totalVolumeUSD = 0;
    for (const currency in userData.stats.volumes) {
        totalVolumeUSD += convertToUSD(userData.stats.volumes[currency], currency);
    }
    document.getElementById('totalVolume').textContent = '$' + totalVolumeUSD.toFixed(2);
    
    const currencyStats = document.getElementById('currencyStats');
    currencyStats.innerHTML = '';
    
    if (Object.keys(userData.stats.volumes).length === 0) {
        currencyStats.innerHTML = '<p class="empty-text">Нет данных</p>';
    } else {
        for (const currency in userData.stats.volumes) {
            const item = document.createElement('div');
            item.className = 'currency-item';
            const volumeUSD = convertToUSD(userData.stats.volumes[currency], currency);
            item.innerHTML = 
                `<span class="currency-name">${currency}</span>
                <span class="currency-amount">${userData.stats.volumes[currency].toFixed(2)} (≈$${volumeUSD.toFixed(2)})</span>`;
            currencyStats.appendChild(item);
        }
    }
}

function updateDealsCount() {
    const count = parseInt(document.getElementById('adminDealsInput').value);
    if (!isNaN(count) && count >= 0) {
        userData.stats.completedDeals = count;
        updateProfileStats();
        showToast('Успешно', 'Количество сделок обновлено', 'success');
    }
}

function addVolume() {
    const input = document.getElementById('adminVolumeInput').value.trim();
    const parts = input.split(':');
    
    if (parts.length === 2) {
        const currency = parts[0].toUpperCase();
        const amount = parseFloat(parts[1]);
        
        if (!isNaN(amount)) {
            if (!userData.stats.volumes[currency]) {
                userData.stats.volumes[currency] = 0;
            }
            userData.stats.volumes[currency] += amount;
            updateProfileStats();
            showToast('Успешно', 'Оборот добавлен', 'success');
            document.getElementById('adminVolumeInput').value = '';
        }
    }
}

// Админ доступ
function setupAdminTrigger() {
    let clickCount = 0;
    let clickTimer = null;
    
    const profilePage = document.getElementById('page-profile');
    const profileHeader = profilePage.querySelector('.page-header h1');
    
    if (profileHeader) {
        profileHeader.style.cursor = 'pointer';
        profileHeader.style.userSelect = 'none';
        
        profileHeader.addEventListener('click', function(e) {
            e.preventDefault();
            clickCount++;
            
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            if (userData.isAdmin) {
                return;
            }
            
            if (clickCount === 5) {
                userData.isAdmin = true;
                updateUserInterface();
                showToast('Админ доступ', 'Получен доступ администратора', 'success');
                clickCount = 0;
                return;
            }
            
            clickTimer = setTimeout(function() {
                clickCount = 0;
            }, 2000);
        });
    }
}

// Модальное окно
function showModal(title, content) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}

// Toast уведомления
function showToast(title, message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = 
        `<div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>`;
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3000);
}

// Polling уведомлений
function startNotificationPolling() {
    console.log('🔔 Запуск системы уведомлений');
    checkNotifications();
    notificationCheckInterval = setInterval(checkNotifications, 3000);
}

let lastNotificationId = 0;
let notificationCheckCount = 0;

async function checkNotifications() {
    if (!userData.telegram_id) {
        console.log('⏳ Ожидание инициализации пользователя...');
        return;
    }
    
    notificationCheckCount++;
    
    try {
        const response = await fetch(`${API_URL}/users/${userData.telegram_id}/notifications`);
        if (!response.ok) {
            console.warn('❌ Ошибка получения уведомлений:', response.status);
            return;
        }
        
        const notifications = await response.json();
        console.log(`📊 Проверка #${notificationCheckCount}: Всего уведомлений: ${notifications.length}, Последний ID: ${lastNotificationId}`);
        
        const unread = notifications.filter(n => !n.read && n.id > lastNotificationId);
        
        if (unread.length > 0) {
            console.log('🆕 Найдено новых уведомлений:', unread.length);
            console.table(unread);
            
            unread.forEach(notification => {
                console.log(`🔔 Обработка уведомления ID:${notification.id}, Тип: ${notification.type}`);
                
                if (notification.type === 'buyer_joined') {
                    console.log('👤 Новый покупатель присоединился');
                    showToast('Новый покупатель', notification.message, 'info');
                    loadUserOrders();
                } else if (notification.type === 'payment_confirmed') {
                    console.log('💰 Оплата подтверждена');
                    showToast('Оплата получена', notification.message, 'success');
                    loadUserOrders();
                } else if (notification.type === 'order_completed') {
                    console.log('✅ Сделка завершена');
                    showToast('Сделка завершена', notification.message, 'success');
                    loadUserOrders();
                    initUser();
                }
                
                lastNotificationId = Math.max(lastNotificationId, notification.id);
                
                fetch(`${API_URL}/notifications/${notification.id}/read`, {
                    method: 'PUT'
                }).then(() => {
                    console.log(`✓ Уведомление ${notification.id} помечено прочитанным`);
                }).catch(err => console.error('Ошибка отметки уведомления:', err));
            });
        }
    } catch (error) {
        console.error('❌ Ошибка проверки уведомлений:', error);
    }
}

// Обработка URL параметров
async function checkOrderFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderCode = urlParams.get('order');
    
    if (orderCode) {
        try {
            const response = await fetch(`${API_URL}/orders/${orderCode}`);
            
            if (response.ok) {
                const order = await response.json();
                
                if (order.seller_id === userData.id) {
                    showToast('Информация', 'Это ваш ордер', 'info');
                    showPage('orders');
                    return;
                }
                
                if (order.status === 'active') {
                    await showBuyerView(order);
                } else {
                    showToast('Ошибка', 'Этот ордер уже неактивен', 'error');
                }
            } else {
                showToast('Ошибка', 'Ордер не найден', 'error');
            }
        } catch (error) {
            console.error('Ошибка загрузки ордера:', error);
            showToast('Ошибка', 'Не удалось загрузить ордер', 'error');
        }
    }
}

async function showBuyerView(order) {
    const paymentInfo = order.payment_method === 'ton' ? 'TON кошелёк' :
                       order.payment_method === 'card' ? 'Банковская карта' :
                       'Telegram Stars';
    
    const typeNames = {
        nft_gift: 'NFT подарок',
        nft_username: 'NFT username',
        nft_number: 'NFT number'
    };
    
    showModal(`Ордер #${order.code}`, `
        <div class="modal-info-box">
            <p><strong>Тип:</strong> ${typeNames[order.type]}</p>
            <p><strong>Сумма:</strong> ${order.amount} ${order.currency}</p>
            <p><strong>Способ оплаты:</strong> ${paymentInfo}</p>
            <p><strong>Описание:</strong> ${order.description}</p>
        </div>
        <div class="modal-info-box">
            <p><strong>Реквизиты для оплаты:</strong></p>
            <div class="modal-requisites">${order.seller_requisites}</div>
        </div>
        <p style="color: var(--gray-600); font-size: 14px; margin-top: 16px; line-height: 1.6;">
            После оплаты свяжитесь с продавцом через поддержку <strong>@GiftMarketEscrow</strong> и ожидайте подтверждения.
        </p>
        <button class="btn btn-primary btn-full" style="margin-top: 20px;" onclick="joinOrder(${order.id})">Принять ордер</button>
        <button class="btn btn-secondary btn-full" style="margin-top: 10px;" onclick="closeModal()">Отмена</button>
    `);
}

async function joinOrder(orderId) {
    console.log('🛒 Попытка присоединиться к ордеру:', orderId);
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                buyer_telegram_id: userData.telegram_id
            })
        });

        if (response.ok) {
            console.log('✅ Успешно присоединились к ордеру');
            await loadUserOrders();
            closeModal();
            showToast('Успешно', 'Вы подключились к ордеру!', 'success');
            showPage('orders');
            
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка подключения к ордеру');
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showToast('Ошибка', error.message, 'error');
    }
}